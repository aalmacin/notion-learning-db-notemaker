'use client'

import { useStore } from '@tanstack/react-store'
import { useMutation } from '@tanstack/react-query'
import { termStore, setActiveTerm, clearActiveTerm, type TermResult as TermResultState } from '@/store/termStore'
import { regenerateTerm, deleteTerm } from '@/actions/terms'
import { addToNotion } from '@/actions/notion'

interface TermStoreSnapshot {
  activeTerm: TermResultState | null
  isResultVisible: boolean
}

export function TermResult() {
  const { activeTerm, isResultVisible } = useStore(termStore, (state): TermStoreSnapshot => state)

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateTerm(activeTerm!.id, activeTerm!.name),
    onSuccess: (term) => setActiveTerm(term),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTerm(activeTerm!.id),
    onSuccess: () => clearActiveTerm(),
  })

  const notionMutation = useMutation({
    mutationFn: () => addToNotion(activeTerm!.id, { name: activeTerm!.name, content: activeTerm!.content, categories: activeTerm!.categories }),
    onSuccess: (term) => setActiveTerm(term),
  })

  if (!isResultVisible || !activeTerm) return null

  const anyError = regenerateMutation.error ?? deleteMutation.error ?? notionMutation.error

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 capitalize">{activeTerm.name}</h2>
        {activeTerm.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {activeTerm.categories.map((cat: string) => (
              <span
                key={cat}
                className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{activeTerm.content}</p>

      {anyError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {anyError instanceof Error ? anyError.message : 'Something went wrong'}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {regenerateMutation.isPending ? 'Regenerating…' : 'Regenerate'}
        </button>

        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        </button>

        <button
          onClick={() => notionMutation.mutate()}
          disabled={notionMutation.isPending || activeTerm.notion_page_id !== null}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {notionMutation.isPending ? 'Adding…' : activeTerm.notion_page_id !== null ? 'Added to Notion' : 'Add to Notion'}
        </button>
      </div>
    </div>
  )
}
