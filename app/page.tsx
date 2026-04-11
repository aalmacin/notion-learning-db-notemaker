import { TermForm } from '@/components/TermForm'
import { TermResult } from '@/components/TermResult'

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-8 w-full">
      <TermForm />
      <TermResult />
    </main>
  )
}
