'use server';

import { deleteTerm as dbDeleteTerm, getAllCategories, getTermById, getUserSettings, updateTerm } from '@/lib/db';
import { explainTermWithAI } from '@/lib/openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { archiveNotionPage, updateNotionPageContent, updateNotionPageMetadata } from '@/lib/notion';
import { revalidatePath } from 'next/cache';
import type { Term, Priority } from '@/lib/db';

async function getNotionCredentials() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, credentials: null };
  const settings = await getUserSettings(supabase, user.id);
  if (!settings?.notion_api_key || !settings?.notion_database_id) return { supabase, credentials: null };
  return { supabase, credentials: { apiKey: settings.notion_api_key, databaseId: settings.notion_database_id } };
}

export async function deleteTerm(id: number): Promise<void> {
  const { supabase, credentials } = await getNotionCredentials();
  if (credentials) {
    const term = await getTermById(supabase, id);
    if (term?.notion_page_id) {
      await archiveNotionPage(credentials, term.notion_page_id);
    }
  }
  await dbDeleteTerm(supabase, id);
  revalidatePath('/terms');
}

export async function updateTermPriority(id: number, priority: Priority): Promise<Term> {
  const { supabase, credentials } = await getNotionCredentials();
  const updated = await updateTerm(supabase, id, { priority });
  if (!updated) throw new Error('Term not found');
  if (updated.notion_page_id && credentials) {
    await updateNotionPageMetadata(credentials, updated.notion_page_id, updated.categories, updated.priority);
  }
  revalidatePath('/terms');
  return updated;
}

export async function regenerateTerm(id: number, name: string, context?: string): Promise<Term> {
  const { supabase, credentials } = await getNotionCredentials();
  const dbCategories = await getAllCategories(supabase);
  const categoryNames = dbCategories.map((c) => c.name);
  const explanation = await explainTermWithAI(name, categoryNames, context);
  const updated = await updateTerm(supabase, id, {
    content: explanation.content,
    categories: explanation.categories,
  });

  if (!updated) throw new Error('Term not found');

  if (updated.notion_page_id && credentials) {
    await Promise.all([
      updateNotionPageContent(credentials, updated.notion_page_id, updated.content),
      updateNotionPageMetadata(credentials, updated.notion_page_id, updated.categories, updated.priority),
    ]);
  }

  revalidatePath('/terms');
  return updated;
}
