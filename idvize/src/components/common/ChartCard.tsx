import type { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  loading?: boolean
}

export default function ChartCard({ title, subtitle, children, className = '', loading = false }: ChartCardProps) {
  return (
    <div className={`bg-surface-800 border border-surface-700 rounded-xl p-5 flex flex-col gap-4 ${className}`}>
      <div>
        <p className="text-sm font-semibold text-body">{title}</p>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-48 animate-pulse" aria-busy="true">
            <div className="flex flex-col items-center gap-2 text-faint">
              <div className="w-16 h-16 rounded-full border-2 border-surface-600 border-t-indigo-500 animate-spin" />
              <span className="text-xs">Loading chart…</span>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
