'use server';

import { getTerm, insertTerm } from '@/lib/db';
import { explainTermWithAI } from '@/lib/openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Term } from '@/lib/db';

export async function explainTerm(rawName: string): Promise<Term> {
  const name = rawName.trim().toLowerCase();
  if (!name) throw new Error('Term name is required');

  const supabase = await createSupabaseServerClient();

  const cached = await getTerm(supabase, name);
  if (cached) return cached;

  const explanation = await explainTermWithAI(name);

  return insertTerm(supabase, {
    name: explanation.name.trim(),
    content: explanation.content,
    categories: explanation.categories,
    notion_page_id: null,
    priority: 'Medium',
  });
}
