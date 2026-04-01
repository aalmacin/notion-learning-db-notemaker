import { Store } from '@tanstack/store'

export interface TermResult {
  id: number
  name: string
  content: string
  categories: string[]
  notion_page_id: string | null
}

interface TermState {
  activeTerm: TermResult | null
  isResultVisible: boolean
}

export const termStore = new Store<TermState>({
  activeTerm: null,
  isResultVisible: false,
})

export function setActiveTerm(term: TermResult) {
  termStore.setState(() => ({ activeTerm: term, isResultVisible: true }))
}

export function clearActiveTerm() {
  termStore.setState(() => ({ activeTerm: null, isResultVisible: false }))
}
