'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getUserSettings,
  updateNotionDatabaseId,
  clearNotionCredentials,
  type UserSettings,
} from '@/lib/db';

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
