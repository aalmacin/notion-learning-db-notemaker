import { getAllTerms, getAllCategories } from '@/lib/db';
import { TermsTable } from '@/components/TermsTable';

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { category } = await searchParams;
  const [terms, categories] = await Promise.all([getAllTerms(), getAllCategories()]);
  const initialCategory = typeof category === 'string' ? category : undefined;

  return (
    <div className="bg-zinc-50 dark:bg-black px-4 py-6 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">Terms</h1>
        <TermsTable initialData={terms} initialCategories={categories} initialCategory={initialCategory} />
      </div>
    </div>
  );
}
