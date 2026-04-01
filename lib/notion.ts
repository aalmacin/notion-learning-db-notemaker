import { Client } from '@notionhq/client';

const client = new Client({ auth: process.env.NOTION_API_KEY });

export async function createNotionPage(term: {
  name: string;
  content: string;
  categories: string[];
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
        select: { name: 'Medium' },
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
