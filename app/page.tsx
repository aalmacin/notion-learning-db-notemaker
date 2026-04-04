import { TermForm } from '@/components/TermForm'
import { TermResult } from '@/components/TermResult'

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8 sm:px-6 sm:py-12 flex flex-col gap-8">
      <TermForm />
      <TermResult />
    </main>
  )
}
