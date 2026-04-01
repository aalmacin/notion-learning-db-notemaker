'use client'

import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { explainTerm } from '@/actions/explain'
import { setActiveTerm } from '@/store/termStore'

export function TermForm() {
  const mutation = useMutation({
    mutationFn: (termName: string) => explainTerm(termName),
    onSuccess: (term) => {
      setActiveTerm(term)
      form.reset()
    },
  })

  const form = useForm({
    defaultValues: { termName: '' },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value.termName)
    },
  })

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Explain a Term</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="flex flex-col gap-4"
      >
        <form.Field
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
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400">{field.state.meta.errors[0]}</p>
              )}
            </div>
          )}
        </form.Field>

        {mutation.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {mutation.error instanceof Error ? mutation.error.message : 'Something went wrong'}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="self-start rounded-lg bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {mutation.isPending ? 'Explaining…' : 'Explain'}
        </button>
      </form>
    </div>
  )
}
