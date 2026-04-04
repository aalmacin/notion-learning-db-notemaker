import Link from 'next/link';
import { getAllCategories } from '@/lib/db';
import { CategoriesManager } from '@/components/CategoriesManager';

export default async function CategoriesPage() {
  const categories = await getAllCategories();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            ← Home
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Categories</h1>
        </div>
        <CategoriesManager initialData={categories} />
      </div>
    </div>
  );
}
