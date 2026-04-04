import { TermForm } from '@/components/TermForm'
import { TermResult } from '@/components/TermResult'

export default function Home() {
  return (
    <main className="w-full max-w-[768px] mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-8">
      <TermForm />
      <TermResult />
    </main>
  )
}
