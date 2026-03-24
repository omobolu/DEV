import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart2, ShieldCheck, ShieldAlert, UserCheck, TrendingUp, TrendingDown, Minus, Award, RefreshCw } from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

// ── Maturity types (frontend-local) ────────────────────────────────────────
type MaturityLevel = string   // 'Level 1 - Initial' … 'Level 5 - Optimized'

interface DomainScore {
  domainId: string; name: string; score: number
  level: MaturityLevel; confidence: number; trend?: string
}
interface MaturitySummary {
  overall: number; level: MaturityLevel; confidence: number
  triggeredAt: string; domains: DomainScore[]
}

// ── Domain card config ──────────────────────────────────────────────────────
const DOMAIN_CARDS = [
  { domainId: 'iga',         icon: BarChart2,   label: 'IGA',    title: 'Identity Governance & Administration', path: '/iga',               color: '#6366f1', bg: 'bg-indigo-900/20 border-indigo-800/40' },
  { domainId: 'am',          icon: ShieldCheck, label: 'AM',     title: 'Authentication, SSO & MFA',            path: '/access-management', color: '#06b6d4', bg: 'bg-cyan-900/20 border-cyan-800/40' },
  { domainId: 'pam',         icon: ShieldAlert, label: 'PAM',    title: 'Privileged Access Management',          path: '/pam',               color: '#f59e0b', bg: 'bg-amber-900/20 border-amber-800/40' },
  { domainId: 'ciam',        icon: UserCheck,   label: 'CIAM',   title: 'Customer Identity & Access Management', path: '/ciam',              color: '#22c55e', bg: 'bg-green-900/20 border-green-800/40' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function levelNumber(level: string): number {
  const m = level.match(/Level (\d)/)
  return m ? parseInt(m[1]) : 0
}

function levelColor(score: number): string {
  if (score >= 81) return '#6366f1'
  if (score >= 61) return '#22c55e'
  if (score >= 41) return '#eab308'
  if (score >= 21) return '#f97316'
  return '#ef4444'
}

function TrendIcon({ trend }: { trend?: string }) {
  if (trend === 'improving') return <TrendingUp size={12} className="text-green-400" />
  if (trend === 'declining') return <TrendingDown size={12} className="text-red-400" />
  return <Minus size={12} className="text-slate-500" />
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const cls = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 rounded-full bg-slate-700">
        <div className={`h-full rounded-full ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500">{pct}%</span>
    </div>
  )
}

// ── Maturity badge on domain card ────────────────────────────────────────────
function MaturityBadge({ domain }: { domain?: DomainScore }) {
  if (!domain) {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="h-3 w-24 rounded bg-slate-700 animate-pulse" />
      </div>
    )
  }
  const lnum  = levelNumber(domain.level)
  const sc    = levelColor(domain.score)
  const label = domain.level.replace('Level ', 'L').replace(' - ', ' · ')

  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
      {/* Score + level */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold" style={{ color: sc }}>{domain.score}</span>
          <span className="text-xs text-slate-400">/100</span>
        </div>
        <div className="flex items-center gap-1">
          {/* 5-dot level indicator */}
          {[1,2,3,4,5].map(n => (
            <div key={n} className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: n <= lnum ? sc : '#334155' }} />
          ))}
        </div>
      </div>
      {/* Level label + trend */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: sc }}>{label}</span>
        <TrendIcon trend={domain.trend} />
      </div>
      {/* Confidence */}
      <ConfidenceBar value={domain.confidence} />
    </div>
  )
}

// ── Overall maturity strip ───────────────────────────────────────────────────
function OverallMaturityStrip({ summary, onRecalc, recalcing }: {
  summary: MaturitySummary | null; onRecalc: () => void; recalcing: boolean
}) {
  if (!summary) return null
  const lnum  = levelNumber(summary.level)
  const sc    = levelColor(summary.overall)
  const label = summary.level.replace('Level ', 'L').replace(' - ', ' · ')

  return (
    <Link to="/maturity"
      className="flex items-center gap-6 p-4 rounded-xl border border-surface-600 bg-surface-800 hover:border-indigo-500/40 transition-all group">
      <Award size={28} style={{ color: sc }} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-slate-200">IAM Program Maturity</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: sc + '25', color: sc }}>{label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${Math.round(summary.confidence * 100) >= 70 ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
            {Math.round(summary.confidence * 100)}% confidence
          </span>
        </div>
        {/* 5-level progress */}
        <div className="flex items-center gap-1 mt-2">
          {['L1','L2','L3','L4','L5'].map((l, idx) => (
            <div key={l} className="flex-1 h-2 rounded-full relative overflow-hidden"
              style={{ backgroundColor: idx < lnum ? sc + '40' : '#1e293b' }}>
              <div className="absolute inset-0 rounded-full"
                style={{ backgroundColor: idx < lnum ? sc : 'transparent', opacity: idx + 1 === lnum ? 1 : 0.6 }} />
            </div>
          ))}
          <span className="text-xs text-slate-400 ml-2 shrink-0 font-mono">{summary.overall}/100</span>
        </div>
        <div className="flex gap-3 mt-1">
          {['L1','L2','L3','L4','L5'].map(l => (
            <span key={l} className="flex-1 text-center text-xs text-slate-600">{l}</span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button onClick={e => { e.preventDefault(); onRecalc() }} disabled={recalcing}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-surface-500 hover:border-indigo-500 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors">
          <RefreshCw size={12} className={recalcing ? 'animate-spin' : ''} />
          {recalcing ? 'Running…' : 'Recalculate'}
        </button>
        <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
          View full report →
        </span>
      </div>
    </Link>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [maturity, setMaturity]     = useState<MaturitySummary | null>(null)
  const [recalcing, setRecalcing]   = useState(false)

  useEffect(() => {
    apiFetch('/maturity/summary')
      .then(r => r.json())
      .then(j => { if (j.success) setMaturity(j.data) })
      .catch(() => {/* maturity unavailable — show cards without scores */})
  }, [])

  const handleRecalc = async () => {
    setRecalcing(true)
    try {
      const r = await apiFetch('/maturity/recalculate', { method: 'POST' })
      const j = await r.json()
      if (j.success) setMaturity(j.data)
    } finally { setRecalcing(false) }
  }

  const getDomain = (id: string) => maturity?.domains.find(d => d.domainId === id)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">IAM Overview</h1>
        <p className="text-slate-500 mt-1 text-sm">Identity posture across all OS modules</p>
      </div>

      {/* Overall Maturity Strip */}
      <OverallMaturityStrip summary={maturity} onRecalc={handleRecalc} recalcing={recalcing} />

      {/* IAM Domain Cards with embedded maturity scores */}
      <div>
        <h2 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">IAM Domains</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {DOMAIN_CARDS.map(({ domainId, icon: Icon, label, title, path, color, bg }) => {
            const domain = getDomain(domainId)
            return (
              <div key={path} className={`flex flex-col p-5 rounded-xl border transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer ${bg}`}
                onClick={() => navigate(path)}>
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${color}20` }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <span className="font-semibold text-white text-sm">{label}</span>
                </div>
                <p className="text-slate-400 text-xs leading-snug">{title}</p>

                {/* Maturity score bubble */}
                <MaturityBadge domain={domain} />

                {/* Detail link */}
                <div className="flex items-center justify-between mt-3 pt-2">
                  <span className="text-xs font-medium" style={{ color }}>View Dashboard →</span>
                  {domain && (
                    <button onClick={e => { e.stopPropagation(); navigate(`/maturity/domains/${domainId}`) }}
                      className="text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                      Maturity detail →
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Secondary domains strip */}
      {maturity && (
        <div>
          <h2 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">All Domains</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {maturity.domains
              .filter(d => !['iga','am','pam','ciam'].includes(d.domainId))
              .map(d => {
                const sc = levelColor(d.score)
                const lnum = levelNumber(d.level)
                const label = d.level.replace('Level ','L').replace(' - ',' · ')
                return (
                  <button key={d.domainId} onClick={() => navigate(`/maturity/domains/${d.domainId}`)}
                    className="text-left p-3 rounded-lg border border-surface-600 bg-surface-800 hover:border-indigo-500/40 transition-all">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-300 leading-tight line-clamp-2">{d.name}</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-lg font-bold" style={{ color: sc }}>{d.score}</span>
                      <span className="text-xs text-slate-500">/100</span>
                    </div>
                    <div className="flex items-center gap-0.5 mb-1">
                      {[1,2,3,4,5].map(n => (
                        <div key={n} className="flex-1 h-1 rounded-full"
                          style={{ backgroundColor: n <= lnum ? sc : '#334155' }} />
                      ))}
                    </div>
                    <span className="text-xs" style={{ color: sc }}>{label}</span>
                  </button>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
