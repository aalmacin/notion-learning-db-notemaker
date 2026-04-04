'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useStore } from '@tanstack/react-store'
import { useMutation } from '@tanstack/react-query'
import { termStore, updateTermInStore, removeTermFromStore, type TermResult as TermResultType } from '@/store/termStore'
import { regenerateTerm, deleteTerm } from '@/actions/terms'
import { addToNotion } from '@/actions/notion'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function TermCard({ term }: { term: TermResultType }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateTerm(term.id, term.name),
    onSuccess: updateTermInStore,
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTerm(term.id),
    onSuccess: () => {
      removeTermFromStore(term.id);
    },
  })

  const notionMutation = useMutation({
    mutationFn: () => addToNotion(term.id, { name: term.name, content: term.content, categories: term.categories, priority: term.priority }),
    onSuccess: updateTermInStore,
  })

  const anyError = regenerateMutation.error ?? deleteMutation.error ?? notionMutation.error

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{term.name}</h2>
        {term.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {term.categories.map((cat: string) => (
              <Badge key={cat} variant="secondary">{cat}</Badge>
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
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Open
        </Link>

        <Button
          variant="outline"
          size="sm"
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
        >
          {regenerateMutation.isPending ? 'Regenerating…' : 'Regenerate'}
        </Button>

        {confirmingDelete ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { deleteMutation.mutate(); setConfirmingDelete(false); }}
              disabled={deleteMutation.isPending}
            >
              Confirm
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => notionMutation.mutate()}
          disabled={notionMutation.isPending || term.notion_page_id !== null}
        >
          {notionMutation.isPending ? 'Adding…' : term.notion_page_id !== null ? 'Added to Notion' : 'Add to Notion'}
        </Button>

        {notionMutation.isSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400">Successfully added to Notion.</p>
        )}
      </div>
    </div>
  )
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
        <TermCard key={term.id} term={term} />
      ))}
    </div>
  )
}
