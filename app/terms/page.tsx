import Link from 'next/link';
import { getAllTerms, getAllCategories } from '@/lib/db';
import { TermsTable } from '@/components/TermsTable';

export default function TermsPage() {
  const terms = getAllTerms();
  const categories = getAllCategories();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            ← Home
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Terms</h1>
          <Link
            href="/categories"
            className="ml-auto text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Manage Categories
          </Link>
        </div>
        <TermsTable initialData={terms} initialCategories={categories} />
      </div>
    </div>
  );
}
