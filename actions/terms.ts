'use server';

import { deleteTerm as dbDeleteTerm, getAllCategories, getTermById, getUserSettings, updateTerm } from '@/lib/db';
import { explainTermWithAI } from '@/lib/openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { archiveNotionPage, unarchiveNotionPage, updateNotionPageContent, updateNotionPageMetadata } from '@/lib/notion';
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
  const notionPageId = credentials ? (await getTermById(supabase, id))?.notion_page_id ?? null : null;

  if (credentials && notionPageId) {
    await archiveNotionPage(credentials, notionPageId);
  }

  try {
    await dbDeleteTerm(supabase, id);
  } catch (err) {
    if (credentials && notionPageId) {
      await unarchiveNotionPage(credentials, notionPageId).catch(() => {});
    }
    throw err;
  }

  revalidatePath('/terms');
}

export async function updateTermPriority(id: number, priority: Priority): Promise<Term> {
  const { supabase, credentials } = await getNotionCredentials();
  const current = await getTermById(supabase, id);
  if (!current) throw new Error('Term not found');
  const updated = await updateTerm(supabase, id, { priority });
  if (!updated) throw new Error('Term not found');
  if (updated.notion_page_id && credentials) {
    try {
      await updateNotionPageMetadata(credentials, updated.notion_page_id, updated.categories, updated.priority);
    } catch (err) {
      await updateTerm(supabase, id, { priority: current.priority }).catch(() => {});
      throw err;
    }
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
