import { Store } from '@tanstack/store'

export interface TermResult {
  id: number
  name: string
  content: string
  categories: string[]
  notion_page_id: string | null
  priority: string
}

interface TermState {
  activeTerms: TermResult[]
  isResultVisible: boolean
}

export const termStore = new Store<TermState>({
  activeTerms: [],
  isResultVisible: false,
})

export function setActiveTerm(term: TermResult) {
  termStore.setState(() => ({ activeTerms: [term], isResultVisible: true }))
}

export function setActiveTerms(terms: TermResult[]) {
  termStore.setState(() => ({ activeTerms: terms, isResultVisible: terms.length > 0 }))
}

export function updateTermInStore(term: TermResult) {
  termStore.setState((state) => ({
    ...state,
    activeTerms: state.activeTerms.map((t) => (t.id === term.id ? term : t)),
  }))
}

export function removeTermFromStore(id: number) {
  termStore.setState((state) => {
    const activeTerms = state.activeTerms.filter((t) => t.id !== id)
    return { activeTerms, isResultVisible: activeTerms.length > 0 }
  })
}

export function clearActiveTerms() {
  termStore.setState(() => ({ activeTerms: [], isResultVisible: false }))
}
