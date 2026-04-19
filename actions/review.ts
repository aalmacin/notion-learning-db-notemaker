'use server';

import { type ReviewItem, getReviewItemsByMonth } from '@/lib/db';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getReviewData(year: number, month: number): Promise<ReviewItem[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  return getReviewItemsByMonth(supabase, year, month);
}
