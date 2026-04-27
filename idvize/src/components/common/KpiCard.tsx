import { TrendingUp, TrendingDown } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  unit?: string
  trend?: number
  accentColor?: string
  loading?: boolean
}

export default function KpiCard({ label, value, unit = '', trend, accentColor = '#6366f1', loading = false }: KpiCardProps) {
  if (loading) {
    return (
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 flex flex-col gap-2 animate-pulse" aria-busy="true">
        <div className="w-8 h-1 rounded-full bg-surface-700" />
        <div className="w-24 h-3 rounded bg-surface-700 mt-1" />
        <div className="w-16 h-8 rounded bg-surface-700" />
      </div>
    )
  }

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 flex flex-col gap-2">
      <div
        className="w-8 h-1 rounded-full mb-1"
        style={{ backgroundColor: accentColor }}
        aria-hidden="true"
      />
      <p className="text-xs text-muted uppercase tracking-wider font-medium">{label}</p>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold text-heading leading-none">{value}</span>
        {unit && <span className="text-sm text-muted mb-0.5">{unit}</span>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs ${trend >= 0 ? 'text-a-green' : 'text-a-red'}`}>
          {trend >= 0 ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
          <span>{Math.abs(trend)}% vs last period</span>
        </div>
      )}
    </div>
  )
}
