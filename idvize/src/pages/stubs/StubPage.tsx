import { Construction } from 'lucide-react'

interface StubPageProps { title: string }

export default function StubPage({ title }: StubPageProps) {
  return (
    <div className="flex items-center justify-center h-full min-h-64" role="status">
      <div className="text-center max-w-sm mx-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-800 border border-surface-700 mb-4">
          <Construction size={28} className="text-muted" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-secondary">{title}</h2>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          This module is under development and will be available in a future release.
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs text-faint">In development</span>
        </div>
      </div>
    </div>
  )
}
