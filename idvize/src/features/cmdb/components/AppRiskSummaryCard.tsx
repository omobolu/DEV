import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ShieldAlert, ChevronRight } from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

interface ControlDriver {
  controlId: string
  controlName: string
  pillar: string
  outcome: 'GAP' | 'ATTN'
}

interface ApplicationRisk {
  applicationId: string
  applicationName: string
  tenantId: string
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  gapCount: number
  attentionCount: number
  drivers: ControlDriver[]
}

const RISK_CFG = {
  CRITICAL: { bar: 'bg-red-500',     text: 'text-a-red',       badge: 'bg-red-500/20 text-red-300 border-red-500/40' },
  HIGH:     { bar: 'bg-orange-500',  text: 'text-a-orange',    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  MEDIUM:   { bar: 'bg-yellow-500',  text: 'text-yellow-400',  badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  LOW:      { bar: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
}

export default function AppRiskSummaryCard({ appId }: { appId: string }) {
  const navigate = useNavigate()
  const [data, setData]       = useState<ApplicationRisk | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/os/risks/${appId}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { setData(j?.data ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [appId])

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-700 bg-surface-800 p-4 animate-pulse h-24" />
    )
  }

  if (!data) return null

  const cfg = RISK_CFG[data.riskLevel]
  const gapDrivers = data.drivers.filter(d => d.outcome === 'GAP')
  const attnDrivers = data.drivers.filter(d => d.outcome === 'ATTN')
  const totalIssues = data.gapCount + data.attentionCount
  const gapPct = totalIssues > 0 ? Math.round((data.gapCount / 49) * 100) : 0

  return (
    <div className="rounded-xl border border-surface-700 bg-surface-800 overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className={cfg.text} />
          <span className="text-xs font-semibold text-secondary uppercase tracking-wider">IAM Risk Summary</span>
        </div>
        <button
          onClick={() => navigate('/risks')}
          className="flex items-center gap-1 text-xs text-a-indigo hover:text-a-indigo transition-colors"
        >
          View all risks <ChevronRight size={12} />
        </button>
      </div>

      <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Risk Level */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted uppercase tracking-wider">Risk Level</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.badge}`}>
              {data.riskLevel}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-700">
            <div className={`h-1.5 rounded-full ${cfg.bar} transition-all`} style={{ width: `${gapPct}%` }} />
          </div>
          <p className="text-[11px] text-muted">{data.gapCount} GAP / {data.attentionCount} ATTN of 49 controls</p>
        </div>

        {/* GAP Controls */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-a-red" />
            <span className="text-[11px] text-muted uppercase tracking-wider">GAP Controls</span>
          </div>
          <span className={`text-2xl font-bold ${data.gapCount > 0 ? 'text-a-red' : 'text-emerald-400'}`}>{data.gapCount}</span>
          <p className="text-[11px] text-muted">confirmed missing</p>
        </div>

        {/* ATTN Controls */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-yellow-400" />
            <span className="text-[11px] text-muted uppercase tracking-wider">ATTN Controls</span>
          </div>
          <span className={`text-2xl font-bold ${data.attentionCount > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>{data.attentionCount}</span>
          <p className="text-[11px] text-muted">needs attention</p>
        </div>

        {/* OK Controls */}
        <div className="space-y-2">
          <span className="text-[11px] text-muted uppercase tracking-wider">OK Controls</span>
          <span className="text-2xl font-bold text-emerald-400">{49 - data.gapCount - data.attentionCount}</span>
          <p className="text-[11px] text-muted">detected / implemented</p>
        </div>
      </div>

      {/* GAP drivers */}
      {gapDrivers.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-[11px] text-muted uppercase tracking-wider mb-2">GAP Controls</p>
          <div className="flex flex-wrap gap-1.5">
            {gapDrivers.map(d => (
              <span key={d.controlId} className="text-[11px] px-2 py-0.5 rounded-full border bg-red-500/20 text-red-300 border-red-500/40">
                {d.controlName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ATTN drivers (only show if no GAPs, to avoid clutter) */}
      {gapDrivers.length === 0 && attnDrivers.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-[11px] text-muted uppercase tracking-wider mb-2">Controls Needing Attention</p>
          <div className="flex flex-wrap gap-1.5">
            {attnDrivers.slice(0, 8).map(d => (
              <span key={d.controlId} className="text-[11px] px-2 py-0.5 rounded-full border bg-yellow-500/20 text-yellow-300 border-yellow-500/40">
                {d.controlName}
              </span>
            ))}
            {attnDrivers.length > 8 && (
              <span className="text-[11px] text-muted">+{attnDrivers.length - 8} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
