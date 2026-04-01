import { notFound } from 'next/navigation';
import { getTermById, getRefinementsByTermId } from '@/lib/db';
import { TermDetailPage } from '@/components/TermDetailPage';

export default async function TermPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (isNaN(id)) notFound();

  const term = getTermById(id);
  if (!term) notFound();

  const refinements = getRefinementsByTermId(id);

  return <TermDetailPage term={term} initialRefinements={refinements} />;
}
