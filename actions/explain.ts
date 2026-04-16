'use server';

import { getTerm, insertTerm, updateTerm, deleteTerm, getAllCategories, getUserSettings } from '@/lib/db';
import { explainTermWithAI } from '@/lib/openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createNotionPage, archiveNotionPage } from '@/lib/notion';
import type { Term } from '@/lib/db';

export type ExplainResult = Term & { alreadyExisted?: true };

function isDuplicateKeyError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

export async function explainTerm(rawName: string, context?: string): Promise<ExplainResult> {
  const name = rawName.trim().toLowerCase();
  if (!name) throw new Error('Term name is required');

  const supabase = await createSupabaseServerClient();

  if (!context) {
    const cached = await getTerm(supabase, name);
    if (cached) return { ...cached, alreadyExisted: true };
  }

  const dbCategories = await getAllCategories(supabase);
  const categoryNames = dbCategories.map((c) => c.name);
  const explanation = await explainTermWithAI(name, categoryNames, context);

  let term: Term;
  try {
    term = await insertTerm(supabase, {
      name: explanation.name.trim(),
      content: explanation.content,
      categories: explanation.categories,
      notion_page_id: null,
      priority: 'Medium',
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const existing = await getTerm(supabase, name);
      if (existing) return { ...existing, alreadyExisted: true };
    }
    throw err;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const settings = await getUserSettings(supabase, user.id);
    if (settings?.notion_api_key && settings?.notion_database_id) {
      const credentials = { apiKey: settings.notion_api_key, databaseId: settings.notion_database_id };
      let notion_page_id: string | undefined;
      try {
        notion_page_id = await createNotionPage(credentials, {
          name: term.name,
          content: term.content,
          categories: term.categories,
          priority: term.priority,
        });
        const synced = await updateTerm(supabase, term.id, { notion_page_id });
        return synced ?? term;
      } catch (err) {
        if (notion_page_id) {
          await archiveNotionPage(credentials, notion_page_id).catch(() => {});
        }
        await deleteTerm(supabase, term.id);
        throw err;
      }
    }
  }

  return term;
}
