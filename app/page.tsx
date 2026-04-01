import Link from 'next/link'
import { TermForm } from '@/components/TermForm'
import { TermResult } from '@/components/TermResult'

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">NoteMaker</h1>
          <Link
            href="/terms"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
          >
            View All Terms
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-8">
        <TermForm />
        <TermResult />
      </main>
    </div>
  )
}
