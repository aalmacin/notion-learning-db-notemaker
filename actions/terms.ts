'use server';

import { deleteTerm as dbDeleteTerm, updateTerm } from '@/lib/db';
import { explainTermWithAI } from '@/lib/openai';
import { revalidatePath } from 'next/cache';
import type { Term, Priority } from '@/lib/db';

export async function deleteTerm(id: number): Promise<void> {
  dbDeleteTerm(id);
  revalidatePath('/terms');
}

export async function updateTermPriority(id: number, priority: Priority): Promise<Term> {
  const updated = updateTerm(id, { priority });
  if (!updated) throw new Error('Term not found');
  revalidatePath('/terms');
  return updated;
}

export async function regenerateTerm(id: number, name: string): Promise<Term> {
  const explanation = await explainTermWithAI(name);

  const updated = updateTerm(id, {
    content: explanation.content,
    categories: explanation.categories,
  });

  if (!updated) throw new Error('Term not found');

  revalidatePath('/terms');
  return updated;
}
