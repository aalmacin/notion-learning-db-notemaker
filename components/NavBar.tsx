import Link from 'next/link';

export function NavBar() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          NoteMaker
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/terms"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
          >
            Terms
          </Link>
          <Link
            href="/categories"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
          >
            Categories
          </Link>
        </nav>
      </div>
    </header>
  );
}
