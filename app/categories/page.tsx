import { getAllCategories } from '@/lib/db';
import { CategoriesManager } from '@/components/CategoriesManager';

export default async function CategoriesPage() {
  const categories = await getAllCategories();

  return (
    <div className="bg-zinc-50 dark:bg-black px-4 py-6 sm:p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">Categories</h1>
        <CategoriesManager initialData={categories} />
      </div>
    </div>
  );
}
