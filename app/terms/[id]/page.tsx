import { notFound } from 'next/navigation';
import { getTermById, getRefinementsByTermId, getChatsByRefinementIds } from '@/lib/db';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TermDetailPage } from '@/components/TermDetailPage';

export default async function TermPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (isNaN(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const [term, refinements] = await Promise.all([getTermById(supabase, id), getRefinementsByTermId(supabase, id)]);
  if (!term) notFound();

  const initialChats = await getChatsByRefinementIds(supabase, refinements.map((r) => r.id));

  return <TermDetailPage term={term} initialRefinements={refinements} initialChats={initialChats} />;
}
