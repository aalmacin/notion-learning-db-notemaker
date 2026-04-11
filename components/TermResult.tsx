'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@tanstack/react-store'
import { useMutation } from '@tanstack/react-query'
import { termStore, updateTermInStore, removeTermFromStore, dismissTerm, type TermResult, type DoneTermResult } from '@/store/termStore'
import { regenerateTerm, deleteTerm } from '@/actions/terms'
import { addToNotion } from '@/actions/notion'

function DismissButton({ name }: { name: string }) {
  return (
    <button
      onClick={() => dismissTerm(name)}
      aria-label="Dismiss"
      className="ml-auto shrink-0 rounded p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )
}

function ProcessingCard({ name }: { name: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex items-center gap-3">
      <svg
        className="animate-spin h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{name}</span>
      <span className="text-sm text-zinc-400 dark:text-zinc-500">Explaining…</span>
      <DismissButton name={name} />
    </div>
  )
}

function ErrorCard({ name, error }: { name: string; error: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-red-200 dark:border-red-900 p-6 flex flex-col gap-2">
      <div className="flex items-center">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{name}</span>
        <DismissButton name={name} />
      </div>
      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
    </div>
  )
}

function DoneTermCard({ term }: { term: DoneTermResult }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateTerm(term.id, term.name),
    onSuccess: updateTermInStore,
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTerm(term.id),
    onSuccess: () => removeTermFromStore(term.id),
  })

  const notionMutation = useMutation({
    mutationFn: () => addToNotion(term.id, { name: term.name, content: term.content, categories: term.categories, priority: term.priority }),
    onSuccess: updateTermInStore,
  })

  const anyError = regenerateMutation.error ?? deleteMutation.error ?? notionMutation.error

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-4">
      <div>
        <div className="flex items-start">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 flex-1">{term.name}</h2>
          <DismissButton name={term.name} />
        </div>
        {term.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {term.categories.map((cat: string) => (
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

      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{term.content}</p>

      {anyError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {anyError instanceof Error ? anyError.message : 'Something went wrong'}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/terms/${term.id}`}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Open
        </Link>

        <button
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {regenerateMutation.isPending ? 'Regenerating…' : 'Regenerate'}
        </button>

        {confirmingDelete ? (
          <>
            <button
              onClick={() => { deleteMutation.mutate(); setConfirmingDelete(false) }}
              disabled={deleteMutation.isPending}
              className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            disabled={deleteMutation.isPending}
            className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Delete
          </button>
        )}

        <button
          onClick={() => notionMutation.mutate()}
          disabled={notionMutation.isPending || term.notion_page_id !== null}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {notionMutation.isPending ? 'Adding…' : term.notion_page_id !== null ? 'Added to Notion' : 'Add to Notion'}
        </button>

        {notionMutation.isSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400">Successfully added to Notion.</p>
        )}
      </div>
    </div>
  )
}

function TermCard({ term }: { term: TermResult }) {
  if (term.status === 'processing') return <ProcessingCard name={term.name} />
  if (term.status === 'error') return <ErrorCard name={term.name} error={term.error} />
  return <DoneTermCard term={term} />
}

export function TermResult() {
  const { activeTerms, isResultVisible } = useStore(termStore, (state) => ({
    activeTerms: state.activeTerms,
    isResultVisible: state.isResultVisible,
  }))

  if (!isResultVisible || activeTerms.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      {activeTerms.map((term) => (
        <TermCard key={term.status === 'done' ? term.id : term.name} term={term} />
      ))}
    </div>
  )
}
