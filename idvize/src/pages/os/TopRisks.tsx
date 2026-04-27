/**
 * Top IAM Risks — Control-Assessment Risk View
 *
 * Answers: "Across ALL apps — where do I focus first?"
 *
 * Shows every application ranked by IAM risk classification (CRITICAL → LOW)
 * based on the 49-control catalog assessment (GAP / ATTN / OK counts).
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ShieldAlert,
  ChevronRight, RefreshCw, Filter, ArrowUpDown,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

// ── Types (matches GET /os/risks response) ────────────────────────────────────

type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

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
  riskLevel: RiskLevel
  gapCount: number
  attentionCount: number
  drivers: ControlDriver[]
}

interface RiskSummary {
  totalApplications: number
  critical: number
  high: number
  medium: number
  low: number
}

// ── Config ────────────────────────────────────────────────────────────────────

const RISK_CFG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; dot: string }> = {
  CRITICAL: { label: 'CRITICAL', color: 'text-a-red',    bg: 'bg-red-900/25',    border: 'border-red-700/50',    dot: 'bg-red-400'    },
  HIGH:     { label: 'HIGH',     color: 'text-a-orange', bg: 'bg-orange-900/20', border: 'border-orange-700/40', dot: 'bg-orange-400' },
  MEDIUM:   { label: 'MEDIUM',   color: 'text-a-amber',  bg: 'bg-yellow-900/15', border: 'border-yellow-700/40', dot: 'bg-yellow-400' },
  LOW:      { label: 'LOW',      color: 'text-muted',    bg: 'bg-slate-800/40',  border: 'border-slate-700',     dot: 'bg-slate-500'  },
}

const RISK_ORDER: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

// ── Components ────────────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 flex flex-col gap-0.5">
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      <span className="text-xs font-medium text-secondary">{label}</span>
      {sub && <span className="text-[11px] text-muted">{sub}</span>}
    </div>
  )
}

function GapBar({ gapCount, attentionCount }: { gapCount: number; attentionCount: number }) {
  const total = gapCount + attentionCount
  if (total === 0) return <span className="text-[10px] text-emerald-400">All OK</span>
  const gapPct = Math.round((gapCount / 49) * 100)
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden flex">
        {gapCount > 0 && (
          <div className="h-full bg-red-500 rounded-l-full" style={{ width: `${gapPct}%` }} />
        )}
      </div>
      <span className="text-[11px] text-muted whitespace-nowrap">{gapCount} GAP</span>
    </div>
  )
}

function RiskRow({ app, rank, onDrillDown }: { app: ApplicationRisk; rank: number; onDrillDown: (id: string) => void }) {
  const risk = RISK_CFG[app.riskLevel]
  const gapDrivers  = app.drivers.filter(d => d.outcome === 'GAP')
  const attnDrivers = app.drivers.filter(d => d.outcome === 'ATTN')

  return (
    <tr
      className="border-b border-surface-700/60 hover:bg-surface-700/30 cursor-pointer transition-colors group"
      onClick={() => onDrillDown(app.applicationId)}
    >
      {/* Rank */}
      <td className="px-4 py-3 text-center">
        <span className={`text-xs font-bold ${rank <= 3 ? 'text-a-red' : rank <= 10 ? 'text-a-orange' : 'text-muted'}`}>
          #{rank}
        </span>
      </td>

      {/* App name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${risk.dot}`} />
          <p className="text-sm font-medium text-body truncate">{app.applicationName}</p>
        </div>
      </td>

      {/* Risk level + gap bar */}
      <td className="px-4 py-3">
        <div className="space-y-1">
          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${risk.color} ${risk.bg} ${risk.border}`}>
            {risk.label}
          </span>
          <GapBar gapCount={app.gapCount} attentionCount={app.attentionCount} />
        </div>
      </td>

      {/* Counts */}
      <td className="px-4 py-3">
        <div className="space-y-0.5">
          {app.gapCount > 0 && (
            <p className="text-sm font-semibold text-a-red">{app.gapCount} GAP</p>
          )}
          {app.attentionCount > 0 && (
            <p className="text-[11px] text-a-amber">{app.attentionCount} ATTN</p>
          )}
          {app.gapCount === 0 && app.attentionCount === 0 && (
            <p className="text-[11px] text-emerald-400">All OK</p>
          )}
        </div>
      </td>

      {/* Key drivers (GAP controls first, then ATTN) */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {gapDrivers.slice(0, 3).map(d => (
            <span key={d.controlId} className="text-[10px] px-1.5 py-0.5 bg-red-900/20 border border-red-800/40 rounded text-red-300">
              {d.controlName}
            </span>
          ))}
          {gapDrivers.length > 3 && (
            <span className="text-[10px] text-muted">+{gapDrivers.length - 3} GAP</span>
          )}
          {gapDrivers.length === 0 && attnDrivers.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-900/15 border border-yellow-800/40 rounded text-yellow-300">
              {attnDrivers.length} controls need attention
            </span>
          )}
          {gapDrivers.length === 0 && attnDrivers.length === 0 && (
            <span className="text-[10px] text-emerald-400">No gaps</span>
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

  const [risks,    setRisks]    = useState<ApplicationRisk[]>([])
  const [summary,  setSummary]  = useState<RiskSummary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [filter,   setFilter]   = useState<RiskLevel | 'ALL'>('ALL')
  const [sortBy,   setSortBy]   = useState<'risk' | 'gaps'>('risk')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res  = await apiFetch('/os/risks')
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setRisks(json.data.risks ?? [])
      setSummary(json.data.summary)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const visible = risks
    .filter(r => filter === 'ALL' || r.riskLevel === filter)
    .sort((a, b) => {
      if (sortBy === 'gaps') return b.gapCount - a.gapCount
      const levelDiff = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel]
      if (levelDiff !== 0) return levelDiff
      if (b.gapCount !== a.gapCount) return b.gapCount - a.gapCount
      return b.attentionCount - a.attentionCount
    })

  const appsWithGaps = risks.filter(r => r.gapCount > 0).length

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
            Every application ranked by control assessment — highest risk first
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiTile
            label="CRITICAL Apps" value={String(summary.critical)}
            sub={`of ${summary.totalApplications} total`} color="text-a-red"
          />
          <KpiTile
            label="HIGH Risk Apps" value={String(summary.high)}
            sub="requires attention" color="text-a-orange"
          />
          <KpiTile
            label="MEDIUM Risk" value={String(summary.medium)}
            sub="attention needed" color="text-a-amber"
          />
          <KpiTile
            label="LOW Risk" value={String(summary.low)}
            sub="well protected" color="text-emerald-400"
          />
          <KpiTile
            label="Apps With Gaps" value={String(appsWithGaps)}
            sub={summary.totalApplications > 0 ? `${Math.round((appsWithGaps / summary.totalApplications) * 100)}% of portfolio` : 'empty portfolio'} color="text-a-amber"
          />
        </div>
      )}

      {/* Top gap drivers across portfolio */}
      {risks.length > 0 && (() => {
        const driverCount = new Map<string, number>()
        for (const app of risks) {
          for (const d of app.drivers.filter(x => x.outcome === 'GAP')) {
            driverCount.set(d.controlName, (driverCount.get(d.controlName) ?? 0) + 1)
          }
        }
        const topDrivers = [...driverCount.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
        if (topDrivers.length === 0) return null
        return (
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Most Common GAP Controls Across Portfolio
            </p>
            <div className="flex flex-wrap gap-2">
              {topDrivers.map(([name, count]) => (
                <div key={name} className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-700 border border-surface-600 rounded-lg">
                  <ShieldAlert size={11} className="text-a-red flex-shrink-0" />
                  <span className="text-xs text-secondary">{name}</span>
                  <span className="text-[10px] text-muted bg-surface-800 px-1.5 py-0.5 rounded">{count} apps</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

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
          onClick={() => setSortBy(s => s === 'risk' ? 'gaps' : 'risk')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted border border-surface-600 rounded-lg hover:bg-surface-700 transition-colors"
        >
          <ArrowUpDown size={12} />
          Sort: {sortBy === 'risk' ? 'Risk Level' : 'Gap Count'}
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
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider w-24">Gaps</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider">Key Issues</th>
                  <th className="px-4 py-2.5 w-24" />
                </tr>
              </thead>
              <tbody>
                {visible.map((app, i) => (
                  <RiskRow
                    key={app.applicationId}
                    app={app}
                    rank={i + 1}
                    onDrillDown={id => navigate(`/risks/${id}/controls`)}
                  />
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted text-sm">
                      {filter === 'ALL' ? 'No applications found.' : `No apps at ${filter} risk level.`}
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
          Click any row to view all 49 controls and remediation steps for that application.
        </p>
      )}
    </div>
  )
}
