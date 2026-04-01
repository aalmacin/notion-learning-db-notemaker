'use server';

import { revalidatePath } from 'next/cache';
import { type Term, updateTerm } from '@/lib/db';
import { createNotionPage } from '@/lib/notion';

export async function addToNotion(
  termId: number,
  term: { name: string; content: string; categories: string[]; priority: string },
): Promise<Term> {
  const pageId = await createNotionPage(term);
  const updated = updateTerm(termId, { notion_page_id: pageId });

  if (!updated) {
    throw new Error(`Term ${termId} not found`);
  }

  revalidatePath('/terms');
  return updated;
}
