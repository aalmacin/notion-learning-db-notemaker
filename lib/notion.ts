import { Client } from '@notionhq/client';
import type {
  BlockObjectRequest,
  DataSourceObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

type NotionCredentials = { apiKey: string; databaseId: string };

function getClient(credentials: NotionCredentials) {
  return new Client({ auth: credentials.apiKey });
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
  const client = new Client({ auth: apiKey });
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
  const client = new Client({ auth: apiKey });
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

  let dataSourceId = database.data_sources?.[0]?.id;
  if (!dataSourceId) {
    const hydrated = await client.databases.retrieve({ database_id: database.id });
    dataSourceId = hydrated.data_sources?.[0]?.id;
  }

  if (!dataSourceId) {
    throw new Error('Failed to resolve Notion data source id for the new database.');
  }

  return {
    id: dataSourceId,
    title: database.title?.[0]?.plain_text ?? 'Notemaker Terms',
  };
}
