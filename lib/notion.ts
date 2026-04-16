import { Client } from '@notionhq/client';
import type {
  BlockObjectRequest,
  BlockObjectResponse,
  DataSourceObjectResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import type { Priority } from '@/lib/db';

type NotionCredentials = { apiKey: string; databaseId: string };

// Notion allows ~3 req/s. Enforce 400ms between calls to stay safely under the limit.
const NOTION_REQUEST_INTERVAL_MS = 400;
let lastNotionRequestTime = 0;

async function throttleNotion(): Promise<void> {
  const now = Date.now();
  const wait = NOTION_REQUEST_INTERVAL_MS - (now - lastNotionRequestTime);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastNotionRequestTime = Date.now();
}

function getClient(credentials: NotionCredentials) {
  return new Client({ auth: credentials.apiKey, retry: { maxRetries: 5 } });
}

export async function createNotionPage(
  credentials: NotionCredentials,
  term: {
    name: string;
    content: string;
    categories: string[];
    priority: string;
  },
): Promise<string> {
  const client = getClient(credentials);
  await throttleNotion();
  const response = await client.pages.create({
    parent: { data_source_id: credentials.databaseId },
    properties: {
      Study: {
        title: [{ text: { content: term.name } }],
      },
      Category: {
        multi_select: term.categories.map((category) => ({ name: category })),
      },
      Priority: {
        select: { name: term.priority },
      },
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: term.content } }],
        },
      },
    ],
  });

  return response.id;
}

type RichTextItem = {
  type: 'text';
  text: { content: string };
  annotations?: { bold: true };
};

function parseInlineBold(text: string): RichTextItem[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts
    .filter((p) => p.length > 0)
    .map((part) =>
      part.startsWith('**') && part.endsWith('**')
        ? { type: 'text' as const, text: { content: part.slice(2, -2) }, annotations: { bold: true as const } }
        : { type: 'text' as const, text: { content: part } },
    );
}

function parseMarkdownToNotionBlocks(markdown: string): BlockObjectRequest[] {
  return markdown
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line): BlockObjectRequest => {
      if (line.startsWith('- ')) {
        return {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: { rich_text: parseInlineBold(line.slice(2)) },
        };
      }
      return {
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: parseInlineBold(line) },
      };
    });
}

export type NotionPageSummary = {
  id: string;
  name: string;
  categories: string[];
  priority: Priority;
};

export async function getAllNotionPages(credentials: NotionCredentials): Promise<NotionPageSummary[]> {
  const client = getClient(credentials);
  const pages: NotionPageSummary[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.dataSources.query({
      data_source_id: credentials.databaseId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const result of response.results) {
      if (!('properties' in result)) continue;
      const page = result as PageObjectResponse;

      const titleProp = page.properties['Study'];
      const name =
        titleProp?.type === 'title' ? titleProp.title.map((t) => t.plain_text).join('') : '';
      if (!name) continue;

      const categoryProp = page.properties['Category'];
      const categories =
        categoryProp?.type === 'multi_select' ? categoryProp.multi_select.map((c) => c.name) : [];

      const priorityProp = page.properties['Priority'];
      const rawPriority = priorityProp?.type === 'select' ? priorityProp.select?.name : undefined;
      const priority: Priority =
        rawPriority === 'High' || rawPriority === 'Low' ? rawPriority : 'Medium';

      pages.push({ id: page.id, name, categories, priority });
    }

    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return pages;
}

export async function getNotionPageContent(credentials: NotionCredentials, pageId: string): Promise<string> {
  const client = getClient(credentials);
  const response = await client.blocks.children.list({ block_id: pageId, page_size: 1 });
  const first = response.results[0];
  if (!first || !('type' in first) || first.type !== 'paragraph') return '';
  const block = first as BlockObjectResponse & { type: 'paragraph' };
  return block.paragraph.rich_text.map((rt) => rt.plain_text).join('');
}

export async function archiveNotionPage(credentials: NotionCredentials, pageId: string): Promise<void> {
  const client = getClient(credentials);
  await client.pages.update({ page_id: pageId, archived: true });
}

export async function unarchiveNotionPage(credentials: NotionCredentials, pageId: string): Promise<void> {
  const client = getClient(credentials);
  await client.pages.update({ page_id: pageId, archived: false });
}

export async function updateNotionPageContent(credentials: NotionCredentials, pageId: string, content: string): Promise<void> {
  const client = getClient(credentials);
  const response = await client.blocks.children.list({ block_id: pageId, page_size: 1 });
  const first = response.results[0];
  if (!first || !('type' in first) || first.type !== 'paragraph') return;
  await client.blocks.update({
    block_id: first.id,
    paragraph: { rich_text: [{ type: 'text', text: { content } }] },
  });
}

export async function updateNotionPageMetadata(
  credentials: NotionCredentials,
  pageId: string,
  categories: string[],
  priority: string,
): Promise<void> {
  const client = getClient(credentials);
  const today = new Date().toISOString().split('T')[0];
  await client.pages.update({
    page_id: pageId,
    properties: {
      Category: { multi_select: categories.map((name) => ({ name })) },
      Priority: { select: { name: priority } },
      Date: { date: { start: today } },
    },
  });
}

export async function appendRefinementToNotionPage(
  credentials: NotionCredentials,
  pageId: string,
  refinement: {
    refinement: string;
    refinement_formatted_note: string;
    refinement_additional_note: string;
  },
  termName: string,
): Promise<void> {
  const client = getClient(credentials);
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const formattedDate = today.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  await throttleNotion();
  await client.pages.update({
    page_id: pageId,
    properties: {
      'Daily Learning Done': { checkbox: true },
      Date: { date: { start: dateStr } },
      Priority: { select: { name: 'High' } },
    },
  });

  const formattedNoteBlocks: BlockObjectRequest[] = refinement.refinement_formatted_note
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((line) => ({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: parseInlineBold(line) },
    }));

  await throttleNotion();
  await client.blocks.children.append({
    block_id: pageId,
    children: [
      {
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: `${termName} (${formattedDate})` } }],
        },
      },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: 'Own Words' } }] },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: refinement.refinement } }] },
      },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: 'Formatted' } }] },
      },
      ...formattedNoteBlocks,
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Additional Notes (digital reference)' } }],
        },
      },
      ...parseMarkdownToNotionBlocks(refinement.refinement_additional_note),
    ],
  });
}

export async function getNotionDatabases(
  apiKey: string,
): Promise<{ id: string; title: string }[]> {
  const client = new Client({ auth: apiKey, retry: { maxRetries: 5 } });
  await throttleNotion();
  const response = await client.search({
    filter: { value: 'data_source', property: 'object' },
    page_size: 100,
  });
  return response.results
    .filter((r): r is DataSourceObjectResponse => r.object === 'data_source')
    .map((db) => ({
      id: db.id,
      title: db.title[0]?.plain_text ?? 'Untitled',
    }));
}

export async function createNotionDataSource(
  apiKey: string,
): Promise<{ id: string; title: string }> {
  const client = new Client({ auth: apiKey, retry: { maxRetries: 5 } });
  await throttleNotion();
  const database = await client.databases.create({
    parent: { type: 'workspace', workspace: true },
    title: [{ type: 'text', text: { content: 'Notemaker Terms' } }],
    initial_data_source: {
      properties: {
        Study: { title: {} },
        Category: { multi_select: {} },
        Priority: {
          select: {
            options: [
              { name: 'High', color: 'red' },
              { name: 'Medium', color: 'yellow' },
              { name: 'Low', color: 'blue' },
            ],
          },
        },
        'Daily Learning Done': { checkbox: {} },
        Date: { date: {} },
      },
    },
  });

  let dataSourceId = 'data_sources' in database ? database.data_sources[0]?.id : undefined;
  if (!dataSourceId) {
    await throttleNotion();
    const hydrated = await client.databases.retrieve({ database_id: database.id });
    dataSourceId = 'data_sources' in hydrated ? hydrated.data_sources[0]?.id : undefined;
  }

  if (!dataSourceId) {
    throw new Error('Failed to resolve Notion data source id for the new database.');
  }

  return {
    id: dataSourceId,
    title: ('title' in database ? database.title[0]?.plain_text : undefined) ?? 'Notemaker Terms',
  };
}
