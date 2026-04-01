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
      Name: {
        title: [{ text: { content: term.name } }],
      },
      Content: {
        rich_text: [{ text: { content: term.content } }],
      },
      Categories: {
        multi_select: term.categories.map((category) => ({ name: category })),
      },
    },
  });

  return response.id;
}
