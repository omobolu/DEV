import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, TrendingUp, DollarSign, Target, ChevronRight } from 'lucide-react'

interface AppRiskSummary {
  appId: string
  appName: string
  riskTier: string
  dataClassification: string
  department: string
  userPopulation: number
  riskScore: number
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  riskDrivers: string[]
  estimatedExposure: number
  gapExposure: number
  priorityRank: number
  gaps: string[]
}

const RISK_CFG = {
  CRITICAL: { bar: 'bg-red-500',    text: 'text-red-400',    badge: 'bg-red-500/20 text-red-300 border-red-500/40' },
  HIGH:     { bar: 'bg-orange-500', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  MEDIUM:   { bar: 'bg-yellow-500', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  LOW:      { bar: 'bg-emerald-500',text: 'text-emerald-400',badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
}

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export default function AppRiskSummaryCard({ appId }: { appId: string }) {
  const navigate = useNavigate()
  const [data, setData]       = useState<AppRiskSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('idvize_token')
    fetch(`/api/os/risks/${appId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
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

  return (
    <div className="rounded-xl border border-surface-700 bg-surface-800 overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className={cfg.text} />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">IAM Risk Summary</span>
        </div>
        <button
          onClick={() => navigate('/risks')}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View all risks <ChevronRight size={12} />
        </button>
      </div>

      <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Risk Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">IAM Risk Score</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.badge}`}>
              {data.riskLevel}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-bold ${cfg.text}`}>{data.riskScore}</span>
            <span className="text-xs text-slate-500 mb-0.5">/ 100</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-700">
            <div className={`h-1.5 rounded-full ${cfg.bar} transition-all`} style={{ width: `${data.riskScore}%` }} />
          </div>
        </div>

        {/* Priority Rank */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Target size={13} className="text-slate-500" />
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Priority Rank</span>
          </div>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold text-slate-200">#{data.priorityRank}</span>
          </div>
          <p className="text-[11px] text-slate-500">of {data.riskTier} tier apps</p>
        </div>

        {/* Estimated Exposure */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <DollarSign size={13} className="text-slate-500" />
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Est. Exposure</span>
          </div>
          <span className="text-2xl font-bold text-slate-200">{fmt$(data.estimatedExposure)}</span>
          <p className="text-[11px] text-slate-500">annual at current posture</p>
        </div>

        {/* Gap Exposure */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} className="text-slate-500" />
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Gap Exposure</span>
          </div>
          <span className="text-2xl font-bold text-amber-400">{fmt$(data.gapExposure)}</span>
          <p className="text-[11px] text-slate-500">additional risk from open gaps</p>
        </div>
      </div>

      {/* Risk drivers */}
      {data.riskDrivers.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Key Risk Drivers</p>
          <div className="flex flex-wrap gap-1.5">
            {data.riskDrivers.map(d => (
              <span key={d} className={`text-[11px] px-2 py-0.5 rounded-full border ${cfg.badge}`}>{d}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
