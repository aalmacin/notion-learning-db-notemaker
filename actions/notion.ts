'use server';

import { revalidatePath } from 'next/cache';
import { type Term, updateTerm, getUserSettings } from '@/lib/db';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createNotionPage } from '@/lib/notion';

export async function addToNotion(
  termId: number,
  term: { name: string; content: string; categories: string[]; priority: string },
): Promise<Term> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const settings = await getUserSettings(supabase, user.id);
  if (!settings?.notion_api_key || !settings?.notion_database_id) {
    throw new Error('Notion credentials not configured. Go to Settings to add your Notion API key and database ID.');
  }

  const pageId = await createNotionPage(
    { apiKey: settings.notion_api_key, databaseId: settings.notion_database_id },
    term,
  );
  const updated = await updateTerm(supabase, termId, { notion_page_id: pageId });

  if (!updated) {
    throw new Error(`Term ${termId} not found`);
  }

  revalidatePath('/terms');
  return updated;
}
