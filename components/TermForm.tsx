'use client'

import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { explainTerm } from '@/actions/explain'
import { setActiveTerm, setActiveTerms } from '@/store/termStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

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

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-card-foreground mb-4">Explain a Term</h2>

      <div className="flex gap-1 mb-4 border-b border-border">
        {(['single', 'multiple'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMode(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              mode === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
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
                <label htmlFor={field.name} className="text-sm font-medium text-foreground">
                  Term
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g. dependency injection"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </singleForm.Field>

          {singleMutation.error && (
            <p className="text-sm text-destructive">
              {singleMutation.error instanceof Error ? singleMutation.error.message : 'Something went wrong'}
            </p>
          )}

          <Button type="submit" disabled={singleMutation.isPending} className="w-full sm:w-auto">
            {singleMutation.isPending ? 'Explaining…' : 'Explain'}
          </Button>
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
                <label htmlFor={field.name} className="text-sm font-medium text-foreground">
                  Terms (one per line)
                </label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={'dependency injection\nmemoization\nclosure'}
                  rows={6}
                  className="resize-y"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </multipleForm.Field>

          {multipleMutation.error && (
            <p className="text-sm text-destructive">
              {multipleMutation.error instanceof Error ? multipleMutation.error.message : 'Something went wrong'}
            </p>
          )}

          {batchCount !== null && !multipleMutation.isPending && (
            <p className="text-sm text-muted-foreground">{batchCount} term{batchCount !== 1 ? 's' : ''} explained.</p>
          )}

          <Button type="submit" disabled={multipleMutation.isPending} className="w-full sm:w-auto">
            {multipleMutation.isPending ? 'Explaining…' : 'Explain All'}
          </Button>
        </form>
      )}
    </div>
  )
}
