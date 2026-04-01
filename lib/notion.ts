import { Client } from '@notionhq/client';
import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';

const client = new Client({ auth: process.env.NOTION_API_KEY });

export async function createNotionPage(term: {
  name: string;
  content: string;
  categories: string[];
  priority: string;
}): Promise<string> {
  const response = await client.pages.create({
    parent: { database_id: process.env.NOTION_DATABASE_ID as string },
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
  pageId: string,
  refinement: {
    refinement: string;
    refinement_formatted_note: string;
    refinement_additional_note: string;
  },
  termName: string,
): Promise<void> {
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
