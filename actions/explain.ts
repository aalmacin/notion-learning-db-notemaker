'use server';

import { getTerm, insertTerm, updateTerm, getAllCategories, getUserSettings } from '@/lib/db';
import { explainTermWithAI } from '@/lib/openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createNotionPage } from '@/lib/notion';
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

  const term = await insertTerm(supabase, {
    name: explanation.name.trim(),
    content: explanation.content,
    categories: explanation.categories,
    notion_page_id: null,
    priority: 'Medium',
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const settings = await getUserSettings(supabase, user.id);
    if (settings?.notion_api_key && settings?.notion_database_id) {
      const notion_page_id = await createNotionPage(
        { apiKey: settings.notion_api_key, databaseId: settings.notion_database_id },
        { name: term.name, content: term.content, categories: term.categories, priority: term.priority },
      );
      const synced = await updateTerm(supabase, term.id, { notion_page_id });
      return synced ?? term;
    }
  }

  return term;
}
