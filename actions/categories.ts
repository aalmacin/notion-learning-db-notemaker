'use server';

import {
  insertCategory as dbInsertCategory,
  deleteCategory as dbDeleteCategory,
  updateTermCategories as dbUpdateTermCategories,
} from '@/lib/db';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Category, Term } from '@/lib/db';

export async function addCategory(name: string): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name is required');
  const supabase = await createSupabaseServerClient();
  const category = await dbInsertCategory(supabase, trimmed);
  revalidatePath('/categories');
  return category;
}

export async function removeCategory(id: number): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await dbDeleteCategory(supabase, id);
  revalidatePath('/categories');
  revalidatePath('/terms');
}

export async function updateTermCategories(termId: number, categories: string[]): Promise<Term> {
  const supabase = await createSupabaseServerClient();
  const updated = await dbUpdateTermCategories(supabase, termId, categories);
  if (!updated) throw new Error('Term not found');
  revalidatePath('/terms');
  return updated;
}
