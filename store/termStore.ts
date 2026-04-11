import { Store } from '@tanstack/store'
import type { Term } from '@/lib/db'

export type PendingTermResult = { status: 'processing'; name: string }
export type ErrorTermResult = { status: 'error'; name: string; error: string }
export type DoneTermResult = Term & { status: 'done' }
export type TermResult = PendingTermResult | ErrorTermResult | DoneTermResult

interface TermState {
  activeTerms: TermResult[]
  isResultVisible: boolean
}

export const termStore = new Store<TermState>({
  activeTerms: [],
  isResultVisible: false,
})

export function addPendingTerm(name: string) {
  const pending: PendingTermResult = { status: 'processing', name }
  termStore.setState((state) => ({ activeTerms: [...state.activeTerms, pending], isResultVisible: true }))
}

export function addPendingTerms(names: string[]) {
  const pending: PendingTermResult[] = names.map((name) => ({ status: 'processing', name }))
  termStore.setState((state) => ({
    activeTerms: [...state.activeTerms, ...pending],
    isResultVisible: true,
  }))
}

export function resolveTermResult(pendingName: string, term: Term) {
  termStore.setState((state) => ({
    ...state,
    activeTerms: state.activeTerms.map((t) =>
      t.name === pendingName ? ({ ...term, status: 'done' } as DoneTermResult) : t
    ),
  }))
}

export function rejectTermResult(pendingName: string, error: string) {
  termStore.setState((state) => ({
    ...state,
    activeTerms: state.activeTerms.map((t) =>
      t.name === pendingName ? ({ status: 'error', name: t.name, error } as ErrorTermResult) : t
    ),
  }))
}

export function updateTermInStore(term: Term) {
  termStore.setState((state) => ({
    ...state,
    activeTerms: state.activeTerms.map((t) =>
      t.status === 'done' && t.id === term.id ? ({ ...term, status: 'done' } as DoneTermResult) : t
    ),
  }))
}

export function removeTermFromStore(id: number) {
  termStore.setState((state) => {
    const activeTerms = state.activeTerms.filter((t) => t.status !== 'done' || t.id !== id)
    return { activeTerms, isResultVisible: activeTerms.length > 0 }
  })
}

export function clearActiveTerms() {
  termStore.setState(() => ({ activeTerms: [], isResultVisible: false }))
}
