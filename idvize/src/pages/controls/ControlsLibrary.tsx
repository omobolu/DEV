/**
 * IDVIZE IAM OS — Controls Library
 *
 * Comprehensive catalog of all IAM controls organised by pillar:
 *   AM   — Access Management
 *   IGA  — Identity Governance & Administration
 *   PAM  — Privileged Access Management
 *   CIAM — Customer Identity & Access Management
 *
 * Each control shows live coverage across all apps and links to a
 * gap drill-down listing every app where the control is missing.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, ShieldCheck, ShieldAlert, UserCheck,
  Search, Tag, ChevronDown, ChevronUp, BookOpen,
  AlertTriangle, Info, Layers, X, ExternalLink,
  BarChart2, ArrowRight,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'
import { useNavigate } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────────────────────
type IamPillar = 'AM' | 'IGA' | 'PAM' | 'CIAM'

interface PlatformConfig {
  platformId: 'entra' | 'sailpoint' | 'cyberark' | 'okta'
  platformName: string
  featureName: string
  featurePath: string
  agentActions: string[]
}

interface CatalogControl {
  controlId: string
  name: string
  pillar: IamPillar
  category: string
  description: string
  capabilities: string[]
  riskReduction: 'critical' | 'high' | 'medium' | 'low'
  applicableTiers: string[]
  policyDrivers: string[]
  implementationComplexity: 'low' | 'medium' | 'high'
  tags: string[]
  platform?: PlatformConfig
}

interface ControlCoverage {
  controlId: string
  implemented: number
  gap: number
  undetected: number
  notApplicable: number
  detectable: number
  total: number
  pct: number | null
}

interface GapApp {
  appId: string
  appName: string
  riskTier: string
  department: string
  status: string
}

// ── Pillar config ─────────────────────────────────────────────────────────
const PILLAR_CONFIG: Record<IamPillar, {
  label: string; fullName: string; icon: React.ElementType; color: string; bg: string; border: string
}> = {
  AM: {
    label: 'AM', fullName: 'Access Management', icon: ShieldCheck,
    color: 'text-a-cyan', bg: 'bg-cyan-900/20', border: 'border-cyan-800/40',
  },
  IGA: {
    label: 'IGA', fullName: 'Identity Governance & Administration', icon: Shield,
    color: 'text-a-indigo', bg: 'bg-indigo-900/20', border: 'border-indigo-800/40',
  },
  PAM: {
    label: 'PAM', fullName: 'Privileged Access Management', icon: ShieldAlert,
    color: 'text-a-amber', bg: 'bg-amber-900/20', border: 'border-amber-800/40',
  },
  CIAM: {
    label: 'CIAM', fullName: 'Customer Identity & Access Management', icon: UserCheck,
    color: 'text-a-green', bg: 'bg-green-900/20', border: 'border-green-800/40',
  },
}

const RISK_COLOR: Record<string, string> = {
  critical: 'text-a-red bg-red-900/20 border-red-800/40',
  high:     'text-a-amber bg-amber-900/20 border-amber-800/40',
  medium:   'text-a-amber bg-yellow-900/20 border-yellow-800/40',
  low:      'text-muted bg-slate-800/40 border-slate-700',
}

const TIER_COLOR: Record<string, string> = {
  critical: 'text-a-red bg-red-900/30 border-red-800/50',
  high:     'text-a-amber bg-amber-900/30 border-amber-800/50',
  medium:   'text-a-amber bg-yellow-900/30 border-yellow-800/50',
  low:      'text-muted bg-slate-800/40 border-slate-700',
}

const COMPLEXITY_COLOR: Record<string, string> = {
  low: 'text-a-green', medium: 'text-a-amber', high: 'text-a-red',
}

// ── Coverage bar ───────────────────────────────────────────────────────────
function CoverageBar({ cov, onViewGaps }: { cov: ControlCoverage; onViewGaps: () => void }) {
  const pct = cov.pct ?? 0
  const barColor = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-surface-700/50">
      {/* Coverage stat */}
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <BarChart2 size={12} />
        {cov.pct !== null
          ? <span><span className="font-semibold text-body">{cov.implemented}</span> / {cov.detectable} apps ({cov.pct}%)</span>
          : <span className="italic text-faint">No posture data</span>
        }
      </div>

      {/* Progress bar */}
      {cov.pct !== null && (
        <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Gap drill-down button */}
      {cov.gap > 0 && (
        <button
          onClick={e => { e.stopPropagation(); onViewGaps() }}
          className="flex items-center gap-1 text-xs text-a-red hover:text-a-red border border-red-800/40
                     hover:border-red-700/60 bg-red-900/10 hover:bg-red-900/20 px-2 py-0.5 rounded transition-colors"
        >
          <AlertTriangle size={10} />
          {cov.gap} {cov.gap === 1 ? 'app' : 'apps'} with gap
          <ArrowRight size={10} />
        </button>
      )}

      {cov.notApplicable > 0 && (
        <span className="text-xs text-faint">{cov.notApplicable} N/A</span>
      )}
    </div>
  )
}

// ── Gap Drill-Down Modal ───────────────────────────────────────────────────
function GapsModal({
  controlId, controlName, pillar, onClose,
}: {
  controlId: string; controlName: string; pillar: IamPillar; onClose: () => void
}) {
  const [gaps, setGaps] = useState<GapApp[] | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const cfg = PILLAR_CONFIG[pillar]

  useEffect(() => {
    apiFetch(`/controls/gaps/${controlId}`)
      .then(r => r.json())
      .then(j => { if (j.success) setGaps(j.data.gaps) })
      .finally(() => setLoading(false))
  }, [controlId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className={`flex items-start justify-between p-5 border-b border-surface-700 ${cfg.bg} rounded-t-2xl`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cfg.color} ${cfg.border}`}>
                {pillar}
              </span>
              <span className="text-xs text-muted">{controlId}</span>
            </div>
            <h2 className="text-base font-bold text-heading mt-1">{controlName}</h2>
            <p className="text-xs text-muted mt-0.5">Apps where this control is confirmed missing</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted text-sm">Loading…</div>
          ) : !gaps || gaps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted">
              <Info size={20} />
              <p className="text-sm">No confirmed gaps — control either implemented or undetectable</p>
            </div>
          ) : (
            <div className="space-y-2">
              {gaps.map(app => (
                <div
                  key={app.appId}
                  className="flex items-center gap-3 p-3 bg-surface-800 border border-surface-700 rounded-xl
                             hover:border-surface-600 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-heading truncate">{app.appName}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize flex-shrink-0
                        ${TIER_COLOR[app.riskTier] ?? 'text-muted bg-slate-800/40 border-slate-700'}`}>
                        {app.riskTier}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted">{app.appId}</span>
                      <span className="text-xs text-faint">·</span>
                      <span className="text-xs text-muted">{app.department}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { onClose(); navigate(`/cmdb/${app.appId}`) }}
                    className="flex items-center gap-1 text-xs text-a-indigo hover:text-a-indigo
                               opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    View app <ExternalLink size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-700 flex items-center justify-between">
          <p className="text-xs text-muted">
            {gaps ? `${gaps.length} app${gaps.length !== 1 ? 's' : ''} with confirmed gap` : ''}
          </p>
          <button
            onClick={onClose}
            className="text-sm text-muted hover:text-body border border-surface-700 hover:border-surface-600
                       px-3 py-1.5 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Control Card ──────────────────────────────────────────────────────────
function ControlCard({
  control, coverage, onViewGaps,
}: {
  control: CatalogControl
  coverage: ControlCoverage | undefined
  onViewGaps: (controlId: string, name: string, pillar: IamPillar) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const pillar = PILLAR_CONFIG[control.pillar]
  const PillarIcon = pillar.icon

  const handleViewGaps = useCallback(() => {
    onViewGaps(control.controlId, control.name, control.pillar)
  }, [control, onViewGaps])

  return (
    <div className={`border rounded-xl transition-colors ${pillar.border} ${expanded ? pillar.bg : 'bg-surface-800 hover:bg-surface-750'}`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        <div className={`mt-0.5 flex-shrink-0 ${pillar.color}`}>
          <PillarIcon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-heading">{control.name}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${pillar.color} ${pillar.bg} ${pillar.border}`}>
              {control.pillar}
            </span>
            {control.platform && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-600 bg-slate-800/50 text-secondary">
                {control.platform.platformName}
              </span>
            )}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize ${RISK_COLOR[control.riskReduction]}`}>
              {control.riskReduction} risk reduction
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted">{control.controlId}</span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">{control.category}</span>
            <span className="text-xs text-muted">·</span>
            <span className={`text-xs capitalize ${COMPLEXITY_COLOR[control.implementationComplexity]}`}>
              {control.implementationComplexity} complexity
            </span>
            {control.platform && (
              <>
                <span className="text-xs text-muted">·</span>
                <span className="text-xs text-a-indigo">{control.platform.featureName}</span>
              </>
            )}
          </div>

          {/* Inline coverage bar (always visible) */}
          {coverage && <CoverageBar cov={coverage} onViewGaps={handleViewGaps} />}
        </div>
        <div className="flex-shrink-0 text-muted mt-0.5">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-surface-700/60 space-y-4 pt-3">
          <p className="text-sm text-secondary leading-relaxed">{control.description}</p>

          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Capabilities</p>
            <div className="flex flex-wrap gap-1.5">
              {control.capabilities.map(cap => (
                <span key={cap} className="text-xs text-secondary bg-surface-700 border border-surface-600 px-2 py-0.5 rounded-full">
                  {cap}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Policy Drivers</p>
              <div className="flex flex-wrap gap-1">
                {control.policyDrivers.map(p => (
                  <span key={p} className="text-[10px] text-a-purple bg-violet-900/20 border border-violet-800/40 px-1.5 py-0.5 rounded">
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Applicable Tiers</p>
              <div className="flex flex-wrap gap-1">
                {control.applicableTiers.map(t => (
                  <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${TIER_COLOR[t] ?? 'text-muted bg-slate-800/40 border-slate-700'}`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Tags</p>
              <div className="flex flex-wrap gap-1">
                {control.tags.map(tag => (
                  <span key={tag} className="text-[10px] text-muted bg-surface-700 px-1.5 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Pillar Section ─────────────────────────────────────────────────────────
function PillarSection({
  pillar, controls, coverageMap, onViewGaps,
}: {
  pillar: IamPillar
  controls: CatalogControl[]
  coverageMap: Record<string, ControlCoverage>
  onViewGaps: (controlId: string, name: string, pillar: IamPillar) => void
}) {
  const cfg = PILLAR_CONFIG[pillar]
  const Icon = cfg.icon

  // Pillar-level aggregation
  const pillarControls = controls
  const totalGaps = pillarControls.reduce((s, c) => s + (coverageMap[c.controlId]?.gap ?? 0), 0)
  const avgPct = (() => {
    const detectable = pillarControls.filter(c => coverageMap[c.controlId]?.pct !== null)
    if (detectable.length === 0) return null
    return Math.round(detectable.reduce((s, c) => s + (coverageMap[c.controlId]?.pct ?? 0), 0) / detectable.length)
  })()

  if (controls.length === 0) return null

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
        <Icon size={18} className={cfg.color} />
        <div className="flex-1">
          <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
          <span className="text-muted text-sm ml-2">— {cfg.fullName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {avgPct !== null && (
            <span className="text-muted">{avgPct}% avg coverage</span>
          )}
          {totalGaps > 0 && (
            <span className="text-a-red">{totalGaps} gaps</span>
          )}
          <span className="text-muted">{controls.length} controls</span>
        </div>
      </div>
      <div className="space-y-2">
        {controls.map(c => (
          <ControlCard
            key={c.controlId}
            control={c}
            coverage={coverageMap[c.controlId]}
            onViewGaps={onViewGaps}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function ControlsLibrary() {
  const [controls, setControls] = useState<CatalogControl[]>([])
  const [coverageMap, setCoverageMap] = useState<Record<string, ControlCoverage>>({})
  const [summary, setSummary] = useState<{ total: number; byPillar: Record<IamPillar, number>; byRiskReduction: Record<string, number> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePillar, setActivePillar] = useState<IamPillar | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [gapsModal, setGapsModal] = useState<{ controlId: string; name: string; pillar: IamPillar } | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetch('/controls/catalog').then(r => r.json()),
      apiFetch('/controls/coverage').then(r => r.json()),
    ]).then(([catalog, coverage]) => {
      if (catalog.success) {
        setControls(catalog.data.controls)
        setSummary(catalog.data.summary)
      }
      if (coverage.success) {
        const map: Record<string, ControlCoverage> = {}
        for (const c of coverage.data.controls) map[c.controlId] = c
        setCoverageMap(map)
      }
    }).finally(() => setLoading(false))
  }, [])

  const pillars: IamPillar[] = ['AM', 'IGA', 'PAM', 'CIAM']

  const filtered = controls.filter(c => {
    const matchesPillar = activePillar === 'ALL' || c.pillar === activePillar
    const q = search.toLowerCase()
    const matchesSearch = !q || c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.tags.some(t => t.includes(q))
    return matchesPillar && matchesSearch
  })

  const byPillar: Partial<Record<IamPillar, CatalogControl[]>> = {}
  for (const p of pillars) byPillar[p] = filtered.filter(c => c.pillar === p)

  const handleViewGaps = useCallback((controlId: string, name: string, pillar: IamPillar) => {
    setGapsModal({ controlId, name, pillar })
  }, [])

  // Aggregate coverage stats for the header
  const totalGaps = Object.values(coverageMap).reduce((s, c) => s + c.gap, 0)
  const overallPct = (() => {
    const detectables = Object.values(coverageMap).filter(c => c.pct !== null)
    if (detectables.length === 0) return null
    return Math.round(detectables.reduce((s, c) => s + (c.pct ?? 0), 0) / detectables.length)
  })()

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <BookOpen size={22} className="text-a-indigo" />
            <h1 className="text-2xl font-bold text-heading">Controls Library</h1>
          </div>
          <p className="text-muted mt-1 text-sm">
            {summary?.total ?? '…'} IAM controls across AM, IGA, PAM & CIAM — with live coverage across all applications
          </p>
        </div>
        {overallPct !== null && (
          <div className="text-right">
            <div className="text-2xl font-bold text-heading">{overallPct}%</div>
            <div className="text-xs text-muted">avg control coverage</div>
            {totalGaps > 0 && <div className="text-xs text-a-red mt-0.5">{totalGaps} total gaps</div>}
          </div>
        )}
      </div>

      {/* Pillar summary tiles */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {pillars.map(p => {
            const cfg = PILLAR_CONFIG[p]
            const Icon = cfg.icon
            const count = summary.byPillar[p]
            const pillarGaps = controls.filter(c => c.pillar === p).reduce((s, c) => s + (coverageMap[c.controlId]?.gap ?? 0), 0)
            return (
              <button
                key={p}
                onClick={() => setActivePillar(activePillar === p ? 'ALL' : p)}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-colors text-left
                  ${activePillar === p ? `${cfg.bg} ${cfg.border}` : 'bg-surface-800 border-surface-700 hover:border-surface-600'}`}
              >
                <Icon size={20} className={`${cfg.color} mt-0.5 flex-shrink-0`} />
                <div>
                  <div className={`text-lg font-bold ${cfg.color}`}>{count}</div>
                  <div className="text-xs text-muted">{cfg.fullName}</div>
                  {pillarGaps > 0 && <div className="text-[10px] text-a-red mt-1">{pillarGaps} gaps</div>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Risk reduction summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['critical','high','medium','low'] as const).map(r => (
            <div key={r} className={`flex items-center gap-3 p-3 rounded-xl border ${RISK_COLOR[r]}`}>
              <AlertTriangle size={14} />
              <div>
                <div className="text-sm font-bold">{summary.byRiskReduction[r]}</div>
                <div className="text-xs opacity-70 capitalize">{r} risk-reduction</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search controls, categories, tags…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-8 pr-3 py-2 text-sm
                       text-body placeholder-faint focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setActivePillar('ALL')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
              ${activePillar === 'ALL'
                ? 'bg-indigo-600 text-white'
                : 'text-muted border border-surface-700 hover:border-surface-600 hover:text-body'}`}
          >
            <Layers size={12} /> All
          </button>
          {pillars.map(p => {
            const cfg = PILLAR_CONFIG[p]
            const Icon = cfg.icon
            return (
              <button
                key={p}
                onClick={() => setActivePillar(activePillar === p ? 'ALL' : p)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                  ${activePillar === p
                    ? `${cfg.bg} ${cfg.border} border ${cfg.color}`
                    : 'text-muted border border-surface-700 hover:border-surface-600 hover:text-body'}`}
              >
                <Icon size={12} /> {p}
              </button>
            )
          })}
        </div>
        {filtered.length !== (summary?.total ?? 0) && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Tag size={12} />
            {filtered.length} of {summary?.total} controls
          </div>
        )}
      </div>

      {/* Controls list */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted text-sm">Loading controls catalog…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted">
          <Info size={24} />
          <p className="text-sm">No controls match your search</p>
        </div>
      ) : activePillar === 'ALL' ? (
        <div className="space-y-8">
          {pillars.map(p => (
            <PillarSection
              key={p}
              pillar={p}
              controls={byPillar[p] ?? []}
              coverageMap={coverageMap}
              onViewGaps={handleViewGaps}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <ControlCard
              key={c.controlId}
              control={c}
              coverage={coverageMap[c.controlId]}
              onViewGaps={handleViewGaps}
            />
          ))}
        </div>
      )}

      {/* Gap drill-down modal */}
      {gapsModal && (
        <GapsModal
          controlId={gapsModal.controlId}
          controlName={gapsModal.name}
          pillar={gapsModal.pillar}
          onClose={() => setGapsModal(null)}
        />
      )}
    </div>
  )
}
