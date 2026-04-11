'use server';

import { deleteTerm as dbDeleteTerm, updateTerm, getAllCategories } from '@/lib/db';
import { explainTermWithAI } from '@/lib/openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Term, Priority } from '@/lib/db';

export async function deleteTerm(id: number): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await dbDeleteTerm(supabase, id);
  revalidatePath('/terms');
}

export async function updateTermPriority(id: number, priority: Priority): Promise<Term> {
  const supabase = await createSupabaseServerClient();
  const updated = await updateTerm(supabase, id, { priority });
  if (!updated) throw new Error('Term not found');
  revalidatePath('/terms');
  return updated;
}

export async function regenerateTerm(id: number, name: string, context?: string): Promise<Term> {
  const supabase = await createSupabaseServerClient();
  const dbCategories = await getAllCategories(supabase);
  const categoryNames = dbCategories.map((c) => c.name);
  const explanation = await explainTermWithAI(name, categoryNames, context);
  const updated = await updateTerm(supabase, id, {
    content: explanation.content,
    categories: explanation.categories,
  });

  if (!updated) throw new Error('Term not found');

  revalidatePath('/terms');
  return updated;
}
