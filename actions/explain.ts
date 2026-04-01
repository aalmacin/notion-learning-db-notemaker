'use server';

import { getTerm, insertTerm } from '@/lib/db';
import { explainTermWithAI } from '@/lib/openai';
import type { Term } from '@/lib/db';

export async function explainTerm(rawName: string): Promise<Term> {
  const name = rawName.trim().toLowerCase();
  if (!name) throw new Error('Term name is required');

  const cached = getTerm(name);
  if (cached) return cached;

  const explanation = await explainTermWithAI(name);

  return insertTerm({
    name: explanation.name.trim().toLowerCase(),
    content: explanation.content,
    categories: explanation.categories,
    notion_page_id: null,
  });
}
