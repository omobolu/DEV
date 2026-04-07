/**
 * Module 10 — Business Value & Risk Intelligence
 *
 * Quantifies the financial value of IAM controls and the cost of not
 * implementing them.  Three views:
 *   PORTFOLIO  — enterprise-level KPIs, tier breakdown, key findings
 *   CONTROLS   — per-control value attribution and ROI ranking
 *   SIMULATE   — what-if scenario analysis
 */

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, ShieldAlert, DollarSign, AlertTriangle, CheckCircle,
  BarChart2, Zap, RefreshCw, Info, ChevronDown, ChevronUp,
  ArrowUpRight, Target, Shield, Activity, Layers, Play, Loader2,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

// ── Types (mirrors backend) ───────────────────────────────────────────────────

type ControlKey = 'sso' | 'mfa' | 'pam' | 'jml' | 'scim' | 'accessReview'

interface AppValueProfile {
  appId: string; appName: string; riskTier: string; department: string
  dataClassification: string; userPopulation: number
  baseAnnualExposure: number; currentAnnualExposure: number
  valueProtected: number; reductionPct: number; gapExposure: number
  potentialAdditionalValue: number
  implementedControls: ControlKey[]; gapControls: ControlKey[]
  estimatedControlCost: number; roi: number
}

interface ControlValueProfile {
  controlKey: ControlKey; controlName: string; pillar: string
  reductionFactor: number; appsImplemented: number; appsWithGap: number
  totalApps: number; coveragePct: number
  totalValueProtected: number; potentialAdditionalValue: number
  totalGapExposure: number; estimatedAnnualCost: number; controlROI: number
  insight: string
}

interface TierValueSummary {
  tier: string; apps: number; baseExposure: number
  currentExposure: number; valueProtected: number
  gapExposure: number; reductionPct: number
}

interface PortfolioSummary {
  totalApps: number; appsWithAnyControl: number; coveragePct: number
  totalBaseExposure: number; totalCurrentExposure: number
  totalValueProtected: number; totalGapExposure: number
  totalPotentialAdditionalValue: number
  totalEstimatedControlCost: number; portfolioROI: number
  byTier: TierValueSummary[]
  topRiskApps: AppValueProfile[]
  topValueControls: ControlValueProfile[]
  insight: string; keyFindings: string[]
}

interface SimDelta {
  exposureReduction: number; exposureReductionPct: number
  additionalValue: number; roiImprovement: number; additionalAppsCovered: number
}

interface SimResult {
  scenarioName: string
  baseline:  { exposure: number; valueProtected: number; portfolioROI: number; coveragePct: number }
  simulated: { exposure: number; valueProtected: number; portfolioROI: number; coveragePct: number }
  delta: SimDelta
  affectedApps: Array<{ appId: string; appName: string; saving: number }>
  narrative: string
}

interface Preset { scenarioId: string; scenarioName: string }

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

function fmtPct(n: number): string { return `${n}%` }

// ── Color helpers ─────────────────────────────────────────────────────────────

function tierColor(t: string): string {
  return t === 'critical' ? '#ef4444' : t === 'high' ? '#f97316' : t === 'medium' ? '#eab308' : '#6366f1'
}

function pillarColor(p: string): string {
  return p === 'AM' ? '#22d3ee' : p === 'IGA' ? '#818cf8' : p === 'PAM' ? '#fbbf24' : '#4ade80'
}

function roiColor(r: number): string {
  return r >= 200 ? '#22c55e' : r >= 50 ? '#eab308' : r > 0 ? '#f97316' : '#ef4444'
}

const CTRL_LABEL: Record<ControlKey, string> = {
  sso: 'SSO', mfa: 'MFA', pam: 'PAM',
  jml: 'JML', scim: 'SCIM', accessReview: 'Reviews',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiTile({
  label, value, sub, color, icon: Icon, footnote,
}: {
  label: string; value: string; sub?: string; color?: string
  icon?: React.ElementType; footnote?: string
}) {
  const [tip, setTip] = useState(false)
  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 p-4 relative">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-muted uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-1">
          {footnote && (
            <button onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)} className="text-faint hover:text-muted">
              <Info size={11} />
            </button>
          )}
          {Icon && <Icon size={14} style={{ color: color ?? '#64748b' }} />}
        </div>
      </div>
      <div className="text-2xl font-bold" style={{ color: color ?? '#e2e8f0' }}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      {tip && footnote && (
        <div className="absolute top-full left-0 mt-1 z-10 bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-xs text-secondary shadow-xl w-64 leading-relaxed">
          {footnote}
        </div>
      )}
    </div>
  )
}

function TierBar({ t }: { t: TierValueSummary }) {
  const sc = tierColor(t.tier)
  const base = t.baseExposure
  const protPct = base > 0 ? Math.round((t.valueProtected / base) * 100) : 0
  const gapPct  = base > 0 ? Math.round((t.gapExposure   / base) * 100) : 0
  return (
    <div className="py-3 border-b border-surface-700 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc }} />
          <span className="text-sm font-medium capitalize" style={{ color: sc }}>{t.tier}</span>
          <span className="text-xs text-muted">{t.apps} apps</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted">Base: <span className="text-heading font-medium">{fmtMoney(t.baseExposure)}</span></span>
          <span className="text-a-green">Protected: {fmtMoney(t.valueProtected)}</span>
          {t.gapExposure > 0 && <span className="text-a-red">Gap: {fmtMoney(t.gapExposure)}</span>}
        </div>
      </div>
      <div className="h-3 rounded-full bg-surface-700 overflow-hidden flex">
        {protPct > 0 && (
          <div className="h-full transition-all" style={{ width: `${protPct}%`, backgroundColor: '#22c55e' }}>
            <div className="h-full opacity-70 bg-gradient-to-r from-transparent to-white/10" />
          </div>
        )}
        {gapPct > 0 && (
          <div className="h-full transition-all" style={{ width: `${gapPct}%`, backgroundColor: '#ef4444', opacity: 0.6 }} />
        )}
      </div>
      <div className="flex gap-3 mt-1 text-[10px] text-muted">
        <span><span className="inline-block w-2 h-2 rounded-sm bg-green-500 mr-1 align-middle" />Protected ({protPct}%)</span>
        {gapPct > 0 && <span><span className="inline-block w-2 h-2 rounded-sm bg-red-500/60 mr-1 align-middle" />Closeable gap ({gapPct}%)</span>}
      </div>
    </div>
  )
}

function ControlRow({ c, rank }: { c: ControlValueProfile; rank: number }) {
  const [open, setOpen] = useState(false)
  const pc = pillarColor(c.pillar)
  const rc = roiColor(c.controlROI)
  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        className="border-b border-surface-700 hover:bg-surface-700/40 cursor-pointer transition-colors"
      >
        <td className="px-4 py-3 text-xs text-muted font-mono w-8">{rank}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-1.5 py-0.5 rounded border flex-shrink-0"
              style={{ color: pc, borderColor: pc + '50', backgroundColor: pc + '15' }}>
              {c.pillar}
            </span>
            <span className="text-sm font-medium text-body">{c.controlName}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-sm font-semibold text-a-green">{fmtMoney(c.totalValueProtected)}</span>
          <div className="text-[10px] text-muted">/year</div>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-sm font-semibold text-a-amber">{fmtMoney(c.potentialAdditionalValue)}</span>
          <div className="text-[10px] text-muted">if gaps closed</div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-surface-700 max-w-24">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${c.coveragePct}%` }} />
            </div>
            <span className="text-xs text-muted w-10 text-right">{fmtPct(c.coveragePct)}</span>
          </div>
          <div className="text-[10px] text-muted mt-0.5">{c.appsImplemented}/{c.totalApps} apps</div>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-sm font-semibold" style={{ color: rc }}>
            {c.controlROI > 0 ? `${c.controlROI}%` : 'N/A'}
          </span>
          <div className="text-[10px] text-muted">ROI</div>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-xs text-muted">{fmtPct(Math.round(c.reductionFactor * 100))}</span>
        </td>
        <td className="px-2 py-3 text-muted">
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </td>
      </tr>
      {open && (
        <tr className="bg-surface-900/50">
          <td colSpan={8} className="px-6 py-3">
            <p className="text-xs text-muted leading-relaxed">{c.insight}</p>
            <div className="flex gap-3 mt-2 text-[10px] text-muted">
              <span>Cost: <span className="text-secondary">{fmtMoney(c.estimatedAnnualCost)}/year</span></span>
              <span>·</span>
              <span>Gap exposure: <span className="text-a-red">{fmtMoney(c.totalGapExposure)}/year</span></span>
              <span>·</span>
              <span>Apps missing: <span className="text-secondary">{c.appsWithGap}</span></span>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function AppRow({ p }: { p: AppValueProfile }) {
  const tc  = tierColor(p.riskTier)
  const rc  = roiColor(p.roi)
  return (
    <tr className="border-b border-surface-700 hover:bg-surface-700/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tc }} />
          <div>
            <div className="text-sm text-body font-medium">{p.appName}</div>
            <div className="text-xs text-muted">{p.department} · {p.userPopulation.toLocaleString()} users</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-xs capitalize font-medium" style={{ color: tc }}>{p.riskTier}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm text-muted">{fmtMoney(p.baseAnnualExposure)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-medium text-a-red">{fmtMoney(p.currentAnnualExposure)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-medium text-a-green">{fmtMoney(p.valueProtected)}</span>
        <div className="text-[10px] text-muted">{p.reductionPct}% reduction</div>
      </td>
      <td className="px-4 py-3 text-right">
        {p.potentialAdditionalValue > 0
          ? <span className="text-xs text-a-amber">{fmtMoney(p.potentialAdditionalValue)}</span>
          : <span className="text-xs text-green-600">—</span>
        }
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-0.5">
          {p.implementedControls.map(c => (
            <span key={c} className="text-[10px] bg-green-900/30 border border-green-800/40 text-a-green px-1 rounded">
              {CTRL_LABEL[c]}
            </span>
          ))}
          {p.gapControls.slice(0, 3).map(c => (
            <span key={c} className="text-[10px] bg-red-900/20 border border-red-800/30 text-a-red px-1 rounded">
              {CTRL_LABEL[c]}
            </span>
          ))}
          {p.gapControls.length > 3 && (
            <span className="text-[10px] text-muted">+{p.gapControls.length - 3}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-xs font-semibold" style={{ color: p.roi === 999 ? '#22c55e' : rc }}>
          {p.roi === 999 ? '∞' : `${p.roi}%`}
        </span>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type View = 'portfolio' | 'controls' | 'simulate'

export default function ValueDashboard() {
  const [view,       setView]       = useState<View>('portfolio')
  const [portfolio,  setPortfolio]  = useState<PortfolioSummary | null>(null)
  const [controls,   setControls]   = useState<ControlValueProfile[]>([])
  const [apps,       setApps]       = useState<AppValueProfile[]>([])
  const [presets,    setPresets]    = useState<Preset[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Apps tab state
  const [appSort,    setAppSort]    = useState<string>('exposure')
  const [appTier,    setAppTier]    = useState<string>('all')
  const [showAll,    setShowAll]    = useState(false)

  // Simulator state
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [simRunning,     setSimRunning]     = useState(false)
  const [simResult,      setSimResult]      = useState<SimResult | null>(null)
  const [simError,       setSimError]       = useState('')

  const loadSummary = useCallback(async () => {
    try {
      const [sumR, presR] = await Promise.all([
        apiFetch('/value/summary').then(r => r.json()),
        apiFetch('/value/presets').then(r => r.json()),
      ])
      if (sumR.success) {
        setPortfolio(sumR.data.portfolio)
        setControls(sumR.data.controls)
      }
      if (presR.success) setPresets(presR.data)
    } catch { /* partial data ok */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  const loadApps = useCallback(async () => {
    try {
      const tier  = appTier !== 'all' ? `&tier=${appTier}` : ''
      const r     = await apiFetch(`/value/applications?sort=${appSort}${tier}`).then(r => r.json())
      if (r.success) setApps(r.data.applications)
    } catch { /* silent */ }
  }, [appSort, appTier])

  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { if (view === 'controls') loadApps() }, [view, loadApps])

  const refresh = () => { setRefreshing(true); loadSummary() }

  const runSimulation = async () => {
    if (!selectedPreset) return
    setSimRunning(true); setSimError(''); setSimResult(null)
    try {
      const r = await apiFetch('/value/simulate', {
        method: 'POST',
        body: JSON.stringify({ scenarioId: selectedPreset }),
      }).then(r => r.json())
      if (!r.success) throw new Error(r.error)
      setSimResult(r.data)
    } catch (e) {
      setSimError((e as Error).message)
    } finally {
      setSimRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <TrendingUp size={32} className="text-a-indigo animate-pulse mx-auto mb-3" />
          <p className="text-muted text-sm">Computing IAM value model…</p>
        </div>
      </div>
    )
  }

  const p = portfolio

  return (
    <div className="space-y-5 p-6 max-w-screen-2xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <TrendingUp size={20} className="text-a-indigo" />
            <h1 className="text-xl font-bold text-heading">Business Value & Risk Intelligence</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-a-indigo">
              Module 10
            </span>
          </div>
          <p className="text-xs text-muted mt-1 ml-8">
            Quantified financial value of IAM controls · probability × impact model
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-600 hover:border-indigo-500 text-xs text-muted hover:text-body transition-colors disabled:opacity-50">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── View tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-surface-800 border border-surface-700 rounded-xl w-fit">
        {([
          { id: 'portfolio', label: 'Portfolio', icon: BarChart2 },
          { id: 'controls',  label: 'Controls',  icon: Shield },
          { id: 'simulate',  label: 'Simulate',  icon: Zap },
        ] as { id: View; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setView(id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              view === id ? 'bg-indigo-600 text-white' : 'text-muted hover:text-body hover:bg-surface-700'
            }`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ══ PORTFOLIO VIEW ═════════════════════════════════════════════════════ */}
      {view === 'portfolio' && p && (
        <div className="space-y-5">

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiTile
              label="Total Risk Exposure"
              value={fmtMoney(p.totalCurrentExposure)}
              sub={`from ${fmtMoney(p.totalBaseExposure)} base`}
              color="#ef4444"
              icon={AlertTriangle}
              footnote="Annual financial exposure with current control coverage. Base exposure assumes zero IAM controls."
            />
            <KpiTile
              label="Value Protected"
              value={fmtMoney(p.totalValueProtected)}
              sub={`${Math.round((p.totalValueProtected / Math.max(p.totalBaseExposure, 1)) * 100)}% risk reduction`}
              color="#22c55e"
              icon={ShieldAlert}
              footnote="Risk eliminated by current IAM controls. Calculated as base exposure minus current exposure using multiplicative control reduction factors."
            />
            <KpiTile
              label="Portfolio ROI"
              value={p.portfolioROI > 0 ? `${p.portfolioROI}%` : 'N/A'}
              sub={`${fmtMoney(p.totalEstimatedControlCost)}/yr control cost`}
              color={roiColor(p.portfolioROI)}
              icon={TrendingUp}
              footnote="(Value Protected − Annual Control Cost) ÷ Annual Control Cost. Control costs are blended estimates for licensing and operations."
            />
            <KpiTile
              label="Closeable Gap"
              value={fmtMoney(p.totalGapExposure)}
              sub={`${fmtMoney(p.totalPotentialAdditionalValue)} additional value`}
              color="#f97316"
              icon={Target}
              footnote="Risk that would be eliminated by implementing all missing controls on every app. This is the maximum addressable exposure from known control gaps."
            />
          </div>

          {/* Coverage stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-surface-600 bg-surface-800 p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-indigo-500/15 flex-shrink-0">
                <Layers size={20} className="text-a-indigo" />
              </div>
              <div>
                <div className="text-2xl font-bold text-heading">{p.appsWithAnyControl}<span className="text-muted text-base font-normal">/{p.totalApps}</span></div>
                <div className="text-xs text-muted">Apps with ≥1 IAM control</div>
              </div>
            </div>
            <div className="rounded-xl border border-surface-600 bg-surface-800 p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-500/10 flex-shrink-0">
                <Activity size={20} className="text-a-green" />
              </div>
              <div>
                <div className="text-2xl font-bold text-heading">{p.coveragePct}%</div>
                <div className="text-xs text-muted">Portfolio coverage rate</div>
              </div>
            </div>
            <div className="rounded-xl border border-surface-600 bg-surface-800 p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-amber-500/10 flex-shrink-0">
                <DollarSign size={20} className="text-a-amber" />
              </div>
              <div>
                <div className="text-2xl font-bold text-heading">{fmtMoney(p.totalEstimatedControlCost)}</div>
                <div className="text-xs text-muted">Estimated annual IAM spend</div>
              </div>
            </div>
          </div>

          {/* Risk by tier + key findings */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Tier breakdown */}
            <div className="lg:col-span-3 rounded-xl border border-surface-600 bg-surface-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={15} className="text-a-indigo" />
                <span className="text-sm font-semibold text-body">Risk Exposure by Tier</span>
                <span className="text-xs text-muted ml-1">— protected vs residual gap</span>
              </div>
              {p.byTier.map(t => <TierBar key={t.tier} t={t} />)}
            </div>

            {/* Key findings */}
            <div className="lg:col-span-2 rounded-xl border border-surface-600 bg-surface-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={15} className="text-a-indigo" />
                <span className="text-sm font-semibold text-body">Key Findings</span>
              </div>
              <div className="space-y-2.5">
                {p.keyFindings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <ArrowUpRight size={13} className="text-a-indigo flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-secondary leading-relaxed">{f}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Insight */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-900/10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Info size={14} className="text-a-indigo flex-shrink-0" />
              <span className="text-sm font-semibold text-a-indigo">Value Analysis Narrative</span>
            </div>
            <p className="text-sm text-secondary leading-relaxed">{p.insight}</p>
            <div className="mt-3 pt-3 border-t border-indigo-500/20 text-[10px] text-faint flex items-center gap-1">
              <Info size={10} />
              Deterministic model · Sources: IBM Cost of a Data Breach 2024, Verizon DBIR 2024, CISA MFA Guidance 2024, Ponemon PAM Study 2023
            </div>
          </div>

          {/* Top risk apps */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={15} className="text-a-red" />
              <span className="text-sm font-semibold text-body">Highest Residual Exposure</span>
              <span className="text-xs text-muted">— apps with most unmitigated risk</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-700">
                    {['Application', 'Tier', 'Residual Exposure', 'Value Protected', 'Missing Controls', 'ROI'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold text-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.topRiskApps.map(a => <AppRow key={a.appId} p={a} />)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ CONTROLS VIEW ══════════════════════════════════════════════════════ */}
      {view === 'controls' && (
        <div className="space-y-5">

          {/* Controls value table */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={15} className="text-a-indigo" />
              <span className="text-sm font-semibold text-body">Control Value Attribution</span>
              <span className="text-xs text-muted ml-1">— ranked by value protected (click row to expand insight)</span>
            </div>
            <p className="text-xs text-muted mb-4 ml-6">
              Value is the marginal contribution of each control — the risk reduction it personally delivers within each app's control set.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-700">
                    {['#', 'Control', 'Value Protected', 'Potential Add\'l', 'Coverage', 'ROI', 'Reduction Factor', ''].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold text-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {controls.map((c, i) => <ControlRow key={c.controlKey} c={c} rank={i + 1} />)}
                </tbody>
              </table>
            </div>
          </div>

          {/* Application table */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-a-indigo" />
                <span className="text-sm font-semibold text-body">Application Risk Register</span>
                <span className="text-xs text-muted ml-1">({apps.length} apps)</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Tier filter */}
                <select
                  value={appTier}
                  onChange={e => { setAppTier(e.target.value); loadApps() }}
                  className="text-xs bg-surface-700 border border-surface-600 rounded-lg px-2 py-1.5 text-secondary focus:border-indigo-500 focus:outline-none">
                  <option value="all">All Tiers</option>
                  {['critical', 'high', 'medium', 'low'].map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
                {/* Sort */}
                <select
                  value={appSort}
                  onChange={e => { setAppSort(e.target.value); loadApps() }}
                  className="text-xs bg-surface-700 border border-surface-600 rounded-lg px-2 py-1.5 text-secondary focus:border-indigo-500 focus:outline-none">
                  <option value="exposure">Sort: Residual Exposure</option>
                  <option value="base">Sort: Base Exposure</option>
                  <option value="value">Sort: Value Protected</option>
                  <option value="gap">Sort: Potential Saving</option>
                  <option value="roi">Sort: ROI</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-700">
                    {['Application', 'Tier', 'Base Exposure', 'Residual Exposure', 'Value Protected', 'Potential Saving', 'Controls', 'ROI'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold text-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(showAll ? apps : apps.slice(0, 15)).map(a => <AppRow key={a.appId} p={a} />)}
                </tbody>
              </table>
            </div>
            {apps.length > 15 && (
              <button onClick={() => setShowAll(s => !s)}
                className="mt-3 text-xs text-a-indigo hover:text-a-indigo flex items-center gap-1">
                {showAll ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {apps.length} apps</>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══ SIMULATE VIEW ══════════════════════════════════════════════════════ */}
      {view === 'simulate' && (
        <div className="space-y-5">

          {/* Explainer */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-900/10 p-5">
            <div className="flex items-start gap-3">
              <Zap size={16} className="text-a-indigo flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-a-indigo mb-1">What-If Scenario Analysis</p>
                <p className="text-xs text-muted leading-relaxed">
                  Select a scenario to model the financial impact of extending IAM controls to additional applications.
                  The engine re-runs the probability × impact calculation with the new control set and shows you the exact delta.
                  Results are deterministic — same inputs always produce the same outputs.
                </p>
              </div>
            </div>
          </div>

          {/* Scenario selector */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={15} className="text-a-indigo" />
              <span className="text-sm font-semibold text-body">Run a Scenario</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {presets.map(preset => (
                <button key={preset.scenarioId}
                  onClick={() => setSelectedPreset(preset.scenarioId)}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    selectedPreset === preset.scenarioId
                      ? 'border-indigo-500 bg-indigo-600/15'
                      : 'border-surface-600 hover:border-indigo-500/50 bg-surface-900/50'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {selectedPreset === preset.scenarioId
                      ? <CheckCircle size={13} className="text-a-indigo flex-shrink-0" />
                      : <div className="w-3 h-3 rounded-full border border-slate-600 flex-shrink-0" />
                    }
                    <span className={`text-xs font-medium ${
                      selectedPreset === preset.scenarioId ? 'text-a-indigo' : 'text-secondary'
                    }`}>{preset.scenarioName}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={runSimulation}
                disabled={!selectedPreset || simRunning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                {simRunning
                  ? <><Loader2 size={14} className="animate-spin" /> Running…</>
                  : <><Play size={14} /> Run Simulation</>
                }
              </button>
              {selectedPreset && (
                <span className="text-xs text-muted">
                  Selected: <span className="text-secondary">{presets.find(p => p.scenarioId === selectedPreset)?.scenarioName}</span>
                </span>
              )}
            </div>

            {simError && (
              <p className="mt-3 text-xs text-a-red bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{simError}</p>
            )}
          </div>

          {/* Results */}
          {simResult && (
            <div className="space-y-4">

              {/* Delta KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-green-500/30 bg-green-900/10 p-4">
                  <div className="text-xs text-muted mb-1">Exposure Reduction</div>
                  <div className="text-2xl font-bold text-a-green">{fmtMoney(simResult.delta.exposureReduction)}</div>
                  <div className="text-xs text-green-600">{simResult.delta.exposureReductionPct}% of current exposure</div>
                </div>
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-900/10 p-4">
                  <div className="text-xs text-muted mb-1">Additional Value</div>
                  <div className="text-2xl font-bold text-a-indigo">{fmtMoney(simResult.delta.additionalValue)}</div>
                  <div className="text-xs text-indigo-600">/year in new protection</div>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-4">
                  <div className="text-xs text-muted mb-1">ROI Improvement</div>
                  <div className="text-2xl font-bold text-a-amber">+{simResult.delta.roiImprovement}pp</div>
                  <div className="text-xs text-amber-600">percentage points</div>
                </div>
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-900/10 p-4">
                  <div className="text-xs text-muted mb-1">Apps Affected</div>
                  <div className="text-2xl font-bold text-a-cyan">{simResult.affectedApps.length}</div>
                  <div className="text-xs text-cyan-600">{simResult.delta.additionalAppsCovered} newly covered</div>
                </div>
              </div>

              {/* Before / After comparison */}
              <div className="grid grid-cols-2 gap-4">
                {([
                  { label: 'Baseline', d: simResult.baseline, color: '#64748b' },
                  { label: 'Simulated', d: simResult.simulated, color: '#22c55e' },
                ] as const).map(({ label, d, color }) => (
                  <div key={label} className="rounded-xl border border-surface-600 bg-surface-800 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm font-semibold text-body">{label}</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { k: 'Residual Exposure', v: fmtMoney(d.exposure), c: '#ef4444' },
                        { k: 'Value Protected',   v: fmtMoney(d.valueProtected), c: '#22c55e' },
                        { k: 'Portfolio ROI',     v: `${d.portfolioROI}%`, c: roiColor(d.portfolioROI) },
                        { k: 'Coverage',          v: `${d.coveragePct}%`, c: '#6366f1' },
                      ].map(({ k, v, c }) => (
                        <div key={k} className="flex items-center justify-between text-xs">
                          <span className="text-muted">{k}</span>
                          <span className="font-semibold" style={{ color: c }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Narrative */}
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-900/10 p-4">
                <div className="flex items-start gap-2">
                  <Info size={13} className="text-a-indigo flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-secondary leading-relaxed">{simResult.narrative}</p>
                </div>
              </div>

              {/* Affected apps */}
              {simResult.affectedApps.length > 0 && (
                <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle size={15} className="text-a-green" />
                    <span className="text-sm font-semibold text-body">Impacted Applications</span>
                    <span className="text-xs text-muted">— sorted by saving</span>
                  </div>
                  <div className="space-y-1.5">
                    {simResult.affectedApps.slice(0, 10).map(a => (
                      <div key={a.appId} className="flex items-center gap-3 py-1.5 border-b border-surface-700/50 last:border-0">
                        <span className="flex-1 text-sm text-secondary">{a.appName}</span>
                        <span className="text-xs font-semibold text-a-green">{fmtMoney(a.saving)}/yr saved</span>
                      </div>
                    ))}
                    {simResult.affectedApps.length > 10 && (
                      <p className="text-xs text-muted pt-1">
                        + {simResult.affectedApps.length - 10} more applications
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
