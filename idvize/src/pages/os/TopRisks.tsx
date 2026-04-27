/**
 * Top IAM Risks — CISO Global Risk View
 *
 * Answers: "Across ALL apps — where do I focus first?"
 *
 * Shows every application ranked by computed IAM Risk Score, with:
 *   • Unified risk level (CRITICAL / HIGH / MEDIUM / LOW)
 *   • Estimated financial exposure
 *   • Key risk drivers (why the score is what it is)
 *   • One-click drill-down to full app detail
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, TrendingDown,
  ChevronRight, RefreshCw, Filter, ArrowUpDown,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

// ── Types ─────────────────────────────────────────────────────────────────────

type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

interface AppRiskSummary {
  appId: string
  appName: string
  riskTier: string
  dataClassification: string
  department: string
  userPopulation: number
  riskScore: number
  riskLevel: RiskLevel
  riskDrivers: string[]
  estimatedExposure: number
  gapExposure: number
  priorityRank: number
  gaps: string[]
  controlCoverage: {
    sso: boolean; mfa: boolean; pam: boolean
    jml: boolean; scim: boolean; certifications: boolean
  }
}

interface PortfolioRiskSummary {
  totalApps: number
  critical: number
  high: number
  medium: number
  low: number
  totalExposure: number
  totalGapExposure: number
  appsWithGaps: number
  topRiskDrivers: Array<{ driver: string; count: number }>
}

// ── Config ────────────────────────────────────────────────────────────────────

const RISK_CFG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; dot: string }> = {
  CRITICAL: { label: 'CRITICAL', color: 'text-a-red',    bg: 'bg-red-900/25',    border: 'border-red-700/50',    dot: 'bg-red-400'    },
  HIGH:     { label: 'HIGH',     color: 'text-a-orange', bg: 'bg-orange-900/20', border: 'border-orange-700/40', dot: 'bg-orange-400' },
  MEDIUM:   { label: 'MEDIUM',   color: 'text-a-amber', bg: 'bg-yellow-900/15', border: 'border-yellow-700/40', dot: 'bg-yellow-400' },
  LOW:      { label: 'LOW',      color: 'text-muted',  bg: 'bg-slate-800/40',  border: 'border-slate-700',     dot: 'bg-slate-500'  },
}

const TIER_CFG: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: 'text-a-red',    bg: 'bg-red-900/20',    border: 'border-red-800/40'    },
  high:     { color: 'text-a-orange', bg: 'bg-orange-900/15', border: 'border-orange-800/40' },
  medium:   { color: 'text-a-amber', bg: 'bg-yellow-900/15', border: 'border-yellow-800/40' },
  low:      { color: 'text-muted',  bg: 'bg-slate-800/30',  border: 'border-slate-700'     },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function ScoreBar({ score, level }: { score: number; level: RiskLevel }) {
  const cfg   = RISK_CFG[level]
  const width = `${score}%`
  const barCls = level === 'CRITICAL' ? 'bg-red-500'
               : level === 'HIGH'     ? 'bg-orange-500'
               : level === 'MEDIUM'   ? 'bg-yellow-500'
               : 'bg-slate-500'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barCls}`} style={{ width }} />
      </div>
      <span className={`text-xs font-bold w-7 text-right ${cfg.color}`}>{score}</span>
    </div>
  )
}

// ── Summary KPI tiles ─────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 flex flex-col gap-0.5">
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      <span className="text-xs font-medium text-secondary">{label}</span>
      {sub && <span className="text-[11px] text-muted">{sub}</span>}
    </div>
  )
}

// ── Risk row ──────────────────────────────────────────────────────────────────

function RiskRow({ app, onDrillDown }: { app: AppRiskSummary; onDrillDown: (id: string) => void }) {
  const risk = RISK_CFG[app.riskLevel]
  const tier = TIER_CFG[app.riskTier] ?? TIER_CFG.low

  return (
    <tr
      className="border-b border-surface-700/60 hover:bg-surface-700/30 cursor-pointer transition-colors group"
      onClick={() => onDrillDown(app.appId)}
    >
      {/* Rank */}
      <td className="px-4 py-3 text-center">
        <span className={`text-xs font-bold ${app.priorityRank <= 3 ? 'text-a-red' : app.priorityRank <= 10 ? 'text-a-orange' : 'text-muted'}`}>
          #{app.priorityRank}
        </span>
      </td>

      {/* App name + tier */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${risk.dot}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-body truncate">{app.appName}</p>
            <p className="text-[11px] text-muted">{app.department}</p>
          </div>
          <span className={`hidden sm:inline text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize flex-shrink-0 ${tier.color} ${tier.bg} ${tier.border}`}>
            {app.riskTier}
          </span>
        </div>
      </td>

      {/* Risk level */}
      <td className="px-4 py-3">
        <div className="space-y-1">
          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${risk.color} ${risk.bg} ${risk.border}`}>
            {risk.label}
          </span>
          <ScoreBar score={app.riskScore} level={app.riskLevel} />
        </div>
      </td>

      {/* Exposure */}
      <td className="px-4 py-3">
        <div>
          <p className={`text-sm font-semibold ${app.riskLevel === 'CRITICAL' ? 'text-a-red' : app.riskLevel === 'HIGH' ? 'text-a-orange' : 'text-secondary'}`}>
            {fmt$(app.estimatedExposure)}
          </p>
          {app.gapExposure > 0 && (
            <p className="text-[11px] text-muted">+{fmt$(app.gapExposure)} closeable</p>
          )}
        </div>
      </td>

      {/* Key issues */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {app.riskDrivers.slice(0, 3).map((d, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-surface-700 border border-surface-600 rounded text-muted">
              {d}
            </span>
          ))}
          {app.riskDrivers.length > 3 && (
            <span className="text-[10px] text-muted">+{app.riskDrivers.length - 3}</span>
          )}
          {app.riskDrivers.length === 0 && (
            <span className="text-[10px] text-green-500">No gaps</span>
          )}
        </div>
      </td>

      {/* Action */}
      <td className="px-4 py-3 text-right">
        <span className="inline-flex items-center gap-1 text-xs text-a-indigo group-hover:text-a-indigo transition-colors">
          Investigate <ChevronRight size={12} />
        </span>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TopRisks() {
  const navigate = useNavigate()

  const [ranked,   setRanked]   = useState<AppRiskSummary[]>([])
  const [summary,  setSummary]  = useState<PortfolioRiskSummary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [filter,   setFilter]   = useState<RiskLevel | 'ALL'>('ALL')
  const [sortBy,   setSortBy]   = useState<'rank' | 'exposure'>('rank')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res  = await apiFetch('/os/risks')
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setRanked(json.data.ranked)
      setSummary(json.data.summary)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const visible = ranked
    .filter(r => filter === 'ALL' || r.riskLevel === filter)
    .sort((a, b) => sortBy === 'rank' ? a.priorityRank - b.priorityRank : b.estimatedExposure - a.estimatedExposure)

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-a-red" />
            <h1 className="text-lg font-bold text-heading">Top IAM Risks</h1>
          </div>
          <p className="text-sm text-muted mt-0.5">
            Every application ranked by IAM risk score — highest urgency first
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted border border-surface-600 rounded-lg hover:bg-surface-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/20 border border-red-800/40 rounded-lg text-sm text-a-red">{error}</div>
      )}

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile
            label="CRITICAL Apps" value={String(summary.critical)}
            sub={`of ${summary.totalApps} total`} color="text-a-red"
          />
          <KpiTile
            label="HIGH Risk Apps" value={String(summary.high)}
            sub="requires attention" color="text-a-orange"
          />
          <KpiTile
            label="Total Exposure" value={fmt$(summary.totalExposure)}
            sub="current annual" color="text-a-red"
          />
          <KpiTile
            label="Gap Exposure" value={fmt$(summary.totalGapExposure)}
            sub="closeable with IAM" color="text-a-amber"
          />
          <KpiTile
            label="Apps With Gaps" value={String(summary.appsWithGaps)}
            sub={`${Math.round((summary.appsWithGaps / summary.totalApps) * 100)}% of portfolio`} color="text-a-amber"
          />
          <KpiTile
            label="Clean Apps" value={String(summary.totalApps - summary.appsWithGaps)}
            sub="fully protected" color="text-a-green"
          />
        </div>
      )}

      {/* Top risk drivers */}
      {summary && summary.topRiskDrivers.length > 0 && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            Most Common Risk Drivers Across Portfolio
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.topRiskDrivers.map((d, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-700 border border-surface-600 rounded-lg">
                <TrendingDown size={11} className="text-a-red flex-shrink-0" />
                <span className="text-xs text-secondary">{d.driver}</span>
                <span className="text-[10px] text-muted bg-surface-800 px-1.5 py-0.5 rounded">{d.count} apps</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls: filter + sort */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1">
          <Filter size={13} className="text-muted mr-1" />
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(lvl => {
            const active = filter === lvl
            const cfg    = lvl !== 'ALL' ? RISK_CFG[lvl as RiskLevel] : null
            return (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors
                  ${active
                    ? cfg
                      ? `${cfg.color} ${cfg.bg} ${cfg.border} font-semibold`
                      : 'bg-indigo-600/30 text-a-indigo border-indigo-500/50 font-semibold'
                    : 'text-muted border-surface-600 hover:bg-surface-700'}`}
              >
                {lvl}
                {summary && lvl !== 'ALL' && (
                  <span className="ml-1 opacity-60">
                    {lvl === 'CRITICAL' ? summary.critical
                     : lvl === 'HIGH'   ? summary.high
                     : lvl === 'MEDIUM' ? summary.medium
                     : summary.low}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setSortBy(s => s === 'rank' ? 'exposure' : 'rank')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted border border-surface-600 rounded-lg hover:bg-surface-700 transition-colors"
        >
          <ArrowUpDown size={12} />
          Sort: {sortBy === 'rank' ? 'Risk Score' : 'Exposure'}
        </button>
      </div>

      {/* Risk table */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> Loading risk data…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700 bg-surface-900/40">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider w-12">Rank</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider">Application</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider w-36">IAM Risk</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider w-28">Exposure</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider">Key Issues</th>
                  <th className="px-4 py-2.5 w-24" />
                </tr>
              </thead>
              <tbody>
                {visible.map(app => (
                  <RiskRow
                    key={app.appId}
                    app={app}
                    onDrillDown={id => navigate(`/cmdb/${id}`)}
                  />
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted text-sm">
                      No apps at {filter} risk level.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {!loading && visible.length > 0 && (
        <p className="text-xs text-faint text-center">
          Click any row to open the full IAM control detail for that application.
        </p>
      )}
    </div>
  )
}
