/**
 * IDVIZE IAM OS — Controls Library
 *
 * Comprehensive catalog of all IAM controls organised by pillar:
 *   AM   — Access Management
 *   IGA  — Identity Governance & Administration
 *   PAM  — Privileged Access Management
 *   CIAM — Customer Identity & Access Management
 */

import { useState, useEffect } from 'react'
import {
  Shield, ShieldCheck, ShieldAlert, UserCheck,
  Search, Tag, ChevronDown, ChevronUp, BookOpen,
  AlertTriangle, Info, Layers,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

// ── Types ──────────────────────────────────────────────────────────────────
type IamPillar = 'AM' | 'IGA' | 'PAM' | 'CIAM'

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
}

interface CatalogData {
  summary: {
    total: number
    filtered: number
    byPillar: Record<IamPillar, number>
    byRiskReduction: Record<string, number>
  }
  byPillar: Record<IamPillar, CatalogControl[]>
  controls: CatalogControl[]
}

// ── Pillar config ─────────────────────────────────────────────────────────
const PILLAR_CONFIG: Record<IamPillar, {
  label: string; fullName: string; icon: React.ElementType; color: string; bg: string; border: string
}> = {
  AM: {
    label: 'AM',
    fullName: 'Access Management',
    icon: ShieldCheck,
    color: 'text-cyan-400',
    bg: 'bg-cyan-900/20',
    border: 'border-cyan-800/40',
  },
  IGA: {
    label: 'IGA',
    fullName: 'Identity Governance & Administration',
    icon: Shield,
    color: 'text-indigo-400',
    bg: 'bg-indigo-900/20',
    border: 'border-indigo-800/40',
  },
  PAM: {
    label: 'PAM',
    fullName: 'Privileged Access Management',
    icon: ShieldAlert,
    color: 'text-amber-400',
    bg: 'bg-amber-900/20',
    border: 'border-amber-800/40',
  },
  CIAM: {
    label: 'CIAM',
    fullName: 'Customer Identity & Access Management',
    icon: UserCheck,
    color: 'text-green-400',
    bg: 'bg-green-900/20',
    border: 'border-green-800/40',
  },
}

const RISK_COLOR: Record<string, string> = {
  critical: 'text-red-400 bg-red-900/20 border-red-800/40',
  high:     'text-amber-400 bg-amber-900/20 border-amber-800/40',
  medium:   'text-yellow-400 bg-yellow-900/20 border-yellow-800/40',
  low:      'text-slate-400 bg-slate-800/40 border-slate-700',
}

const COMPLEXITY_COLOR: Record<string, string> = {
  low:    'text-green-400',
  medium: 'text-amber-400',
  high:   'text-red-400',
}

// ── Control Card ──────────────────────────────────────────────────────────
function ControlCard({ control }: { control: CatalogControl }) {
  const [expanded, setExpanded] = useState(false)
  const pillar = PILLAR_CONFIG[control.pillar]
  const PillarIcon = pillar.icon

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
            <span className="text-sm font-semibold text-white">{control.name}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${pillar.color} ${pillar.bg} ${pillar.border}`}>
              {control.pillar}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize ${RISK_COLOR[control.riskReduction]}`}>
              {control.riskReduction} risk reduction
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-500">{control.controlId}</span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-500">{control.category}</span>
            <span className="text-xs text-slate-500">·</span>
            <span className={`text-xs capitalize ${COMPLEXITY_COLOR[control.implementationComplexity]}`}>
              {control.implementationComplexity} complexity
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-slate-500 mt-0.5">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-surface-700/60 space-y-4 pt-3">
          <p className="text-sm text-slate-300 leading-relaxed">{control.description}</p>

          {/* Capabilities */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Capabilities</p>
            <div className="flex flex-wrap gap-1.5">
              {control.capabilities.map(cap => (
                <span key={cap} className="text-xs text-slate-300 bg-surface-700 border border-surface-600 px-2 py-0.5 rounded-full">
                  {cap}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Policy Drivers */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Policy Drivers</p>
              <div className="flex flex-wrap gap-1">
                {control.policyDrivers.map(p => (
                  <span key={p} className="text-[10px] text-violet-300 bg-violet-900/20 border border-violet-800/40 px-1.5 py-0.5 rounded">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Applicable Tiers */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Applicable Tiers</p>
              <div className="flex flex-wrap gap-1">
                {control.applicableTiers.map(t => (
                  <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${
                    t === 'critical' ? 'text-red-300 bg-red-900/20 border-red-800/40' :
                    t === 'high'     ? 'text-amber-300 bg-amber-900/20 border-amber-800/40' :
                    t === 'medium'   ? 'text-yellow-300 bg-yellow-900/20 border-yellow-800/40' :
                    'text-slate-400 bg-slate-800/40 border-slate-700'
                  }`}>{t}</span>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tags</p>
              <div className="flex flex-wrap gap-1">
                {control.tags.map(tag => (
                  <span key={tag} className="text-[10px] text-slate-400 bg-surface-700 px-1.5 py-0.5 rounded-full">
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
function PillarSection({ pillar, controls }: { pillar: IamPillar; controls: CatalogControl[] }) {
  const cfg = PILLAR_CONFIG[pillar]
  const Icon = cfg.icon

  if (controls.length === 0) return null

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
        <Icon size={18} className={cfg.color} />
        <div className="flex-1">
          <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
          <span className="text-slate-400 text-sm ml-2">— {cfg.fullName}</span>
        </div>
        <span className="text-xs text-slate-500">{controls.length} controls</span>
      </div>
      <div className="space-y-2 ml-0">
        {controls.map(c => <ControlCard key={c.controlId} control={c} />)}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function ControlsLibrary() {
  const [data, setData] = useState<CatalogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePillar, setActivePillar] = useState<IamPillar | 'ALL'>('ALL')
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiFetch('/controls/catalog')
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data) })
      .finally(() => setLoading(false))
  }, [])

  const pillars: IamPillar[] = ['AM', 'IGA', 'PAM', 'CIAM']

  const filtered = data?.controls.filter(c => {
    const matchesPillar = activePillar === 'ALL' || c.pillar === activePillar
    const q = search.toLowerCase()
    const matchesSearch = !q || c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.tags.some(t => t.includes(q))
    return matchesPillar && matchesSearch
  }) ?? []

  const byPillar: Partial<Record<IamPillar, CatalogControl[]>> = {}
  for (const p of pillars) {
    byPillar[p] = filtered.filter(c => c.pillar === p)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <BookOpen size={22} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Controls Library</h1>
        </div>
        <p className="text-slate-500 mt-1 text-sm">
          Comprehensive IAM controls catalog — {data?.summary.total ?? '…'} controls across AM, IGA, PAM & CIAM
        </p>
      </div>

      {/* Summary tiles */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {pillars.map(p => {
            const cfg = PILLAR_CONFIG[p]
            const Icon = cfg.icon
            const count = data.summary.byPillar[p]
            return (
              <button
                key={p}
                onClick={() => setActivePillar(activePillar === p ? 'ALL' : p)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-colors text-left
                  ${activePillar === p ? `${cfg.bg} ${cfg.border}` : 'bg-surface-800 border-surface-700 hover:border-surface-600'}`}
              >
                <Icon size={20} className={cfg.color} />
                <div>
                  <div className={`text-lg font-bold ${cfg.color}`}>{count}</div>
                  <div className="text-xs text-slate-500">{cfg.fullName}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Risk reduction summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['critical','high','medium','low'] as const).map(r => (
            <div key={r} className={`flex items-center gap-3 p-3 rounded-xl border ${RISK_COLOR[r]}`}>
              <AlertTriangle size={14} />
              <div>
                <div className="text-sm font-bold capitalize">{data.summary.byRiskReduction[r]}</div>
                <div className="text-xs opacity-70 capitalize">{r} risk-reduction controls</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search controls, categories, tags…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-8 pr-3 py-2 text-sm
                       text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setActivePillar('ALL')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
              ${activePillar === 'ALL'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 border border-surface-700 hover:border-surface-600 hover:text-slate-200'}`}
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
                    : 'text-slate-400 border border-surface-700 hover:border-surface-600 hover:text-slate-200'}`}
              >
                <Icon size={12} /> {p}
              </button>
            )
          })}
        </div>
        {filtered.length !== (data?.summary.total ?? 0) && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Tag size={12} />
            {filtered.length} of {data?.summary.total} controls
          </div>
        )}
      </div>

      {/* Controls list */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-500 text-sm">Loading controls catalog…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-500">
          <Info size={24} />
          <p className="text-sm">No controls match your search</p>
        </div>
      ) : activePillar === 'ALL' ? (
        <div className="space-y-8">
          {pillars.map(p => (
            <PillarSection key={p} pillar={p} controls={byPillar[p] ?? []} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => <ControlCard key={c.controlId} control={c} />)}
        </div>
      )}
    </div>
  )
}
