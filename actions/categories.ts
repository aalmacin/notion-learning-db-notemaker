'use server';

import {
  insertCategory as dbInsertCategory,
  deleteCategory as dbDeleteCategory,
  updateTermCategories as dbUpdateTermCategories,
} from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { Category, Term } from '@/lib/db';

export async function addCategory(name: string): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name is required');
  const category = await dbInsertCategory(trimmed);
  revalidatePath('/categories');
  return category;
}

export async function removeCategory(id: number): Promise<void> {
  await dbDeleteCategory(id);
  revalidatePath('/categories');
  revalidatePath('/terms');
}

export async function updateTermCategories(termId: number, categories: string[]): Promise<Term> {
  const updated = await dbUpdateTermCategories(termId, categories);
  if (!updated) throw new Error('Term not found');
  revalidatePath('/terms');
  return updated;
}
