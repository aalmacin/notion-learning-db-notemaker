'use server';

import { getTerm, insertTerm, getAllCategories } from '@/lib/db';
import { explainTermWithAI } from '@/lib/openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Term } from '@/lib/db';

export async function explainTerm(rawName: string, context?: string): Promise<Term> {
  const name = rawName.trim().toLowerCase();
  if (!name) throw new Error('Term name is required');

  const supabase = await createSupabaseServerClient();

  if (!context) {
    const cached = await getTerm(supabase, name);
    if (cached) return cached;
  }

  const dbCategories = await getAllCategories(supabase);
  const categoryNames = dbCategories.map((c) => c.name);
  const explanation = await explainTermWithAI(name, categoryNames, context);

  return insertTerm(supabase, {
    name: explanation.name.trim(),
    content: explanation.content,
    categories: explanation.categories,
    notion_page_id: null,
    priority: 'Medium',
  });
}
