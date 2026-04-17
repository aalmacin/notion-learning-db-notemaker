'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getUserSettings,
  updateNotionDatabaseId,
  clearNotionCredentials,
  updateTimezone,
  type UserSettings,
} from '@/lib/db';
import { createNotionDataSource as createNotionDataSourceInNotion } from '@/lib/notion';

export async function getNotionSettings(): Promise<UserSettings | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getUserSettings(supabase, user.id);
}

export async function saveNotionDatabaseId(databaseId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  await updateNotionDatabaseId(supabase, user.id, databaseId);
  revalidatePath('/settings');
}

export async function disconnectNotion(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  await clearNotionCredentials(supabase, user.id);
  revalidatePath('/settings');
}

export async function saveTimezone(timezone: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  await updateTimezone(supabase, user.id, timezone);
  revalidatePath('/settings');
}

export async function createNotionDataSource(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const settings = await getUserSettings(supabase, user.id);
  if (!settings?.notion_api_key) throw new Error('Notion is not connected');

  const dataSource = await createNotionDataSourceInNotion(settings.notion_api_key);
  await updateNotionDatabaseId(supabase, user.id, dataSource.id);
  revalidatePath('/settings');
}
