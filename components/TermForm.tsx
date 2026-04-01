'use client'

import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { explainTerm } from '@/actions/explain'
import { setActiveTerm, setActiveTerms } from '@/store/termStore'

type Mode = 'single' | 'multiple'

export function TermForm() {
  const [mode, setMode] = useState<Mode>('single')
  const [batchCount, setBatchCount] = useState<number | null>(null)

  const singleMutation = useMutation({
    mutationFn: (termName: string) => explainTerm(termName),
    onSuccess: (term) => {
      setActiveTerm(term)
      singleForm.reset()
      setBatchCount(null)
    },
  })

  const multipleMutation = useMutation({
    mutationFn: async (terms: string[]) => {
      const results = await Promise.all(terms.map((t) => explainTerm(t)))
      return results
    },
    onSuccess: (terms) => {
      setActiveTerms(terms)
      multipleForm.reset()
      setBatchCount(terms.length)
    },
  })

  const singleForm = useForm({
    defaultValues: { termName: '' },
    onSubmit: async ({ value }) => {
      setBatchCount(null)
      await singleMutation.mutateAsync(value.termName)
    },
  })

  const multipleForm = useForm({
    defaultValues: { terms: '' },
    onSubmit: async ({ value }) => {
      const terms = value.terms
        .split('\n')
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
      if (terms.length === 0) return
      setBatchCount(null)
      await multipleMutation.mutateAsync(terms)
    },
  })

  const inputClass =
    'rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500'

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Explain a Term</h2>

      <div className="flex gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-800">
        {(['single', 'multiple'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMode(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              mode === tab
                ? 'border-zinc-900 dark:border-zinc-50 text-zinc-900 dark:text-zinc-50'
                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {mode === 'single' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            singleForm.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <singleForm.Field
            name="termName"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.trim().length === 0) return 'Term name is required'
                if (value.trim().length < 2) return 'Term name must be at least 2 characters'
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="flex flex-col gap-1">
                <label htmlFor={field.name} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Term
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g. dependency injection"
                  className={inputClass}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </singleForm.Field>

          {singleMutation.error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {singleMutation.error instanceof Error ? singleMutation.error.message : 'Something went wrong'}
            </p>
          )}

          <button
            type="submit"
            disabled={singleMutation.isPending}
            className="self-start rounded-lg bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {singleMutation.isPending ? 'Explaining…' : 'Explain'}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            multipleForm.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <multipleForm.Field
            name="terms"
            validators={{
              onChange: ({ value }) => {
                const valid = value
                  .split('\n')
                  .map((t) => t.trim())
                  .filter((t) => t.length >= 2)
                if (valid.length === 0) return 'Enter at least one term (min 2 characters)'
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="flex flex-col gap-1">
                <label htmlFor={field.name} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Terms (one per line)
                </label>
                <textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={'dependency injection\nmemoization\nclosure'}
                  rows={6}
                  className={`${inputClass} resize-y`}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </multipleForm.Field>

          {multipleMutation.error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {multipleMutation.error instanceof Error ? multipleMutation.error.message : 'Something went wrong'}
            </p>
          )}

          {batchCount !== null && !multipleMutation.isPending && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{batchCount} term{batchCount !== 1 ? 's' : ''} explained.</p>
          )}

          <button
            type="submit"
            disabled={multipleMutation.isPending}
            className="self-start rounded-lg bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {multipleMutation.isPending ? 'Explaining…' : 'Explain All'}
          </button>
        </form>
      )}
    </div>
  )
}
