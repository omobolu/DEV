/**
 * IDVIZE IAM OS — Control Panel
 *
 * The central command interface for the IAM Operating System.
 * Three operational modes:
 *   MONITOR  — Real-time visibility: kernel status, coverage map, driver health, event stream, alerts
 *   OPERATE  — Gap remediation: action queue, approval centre, active processes
 *   CONTROL  — Configuration: driver manager, coverage policies, installed modules
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity, Cpu, Shield, AlertTriangle, CheckCircle,
  RefreshCw, Zap, Database, Users, BarChart2, ShieldAlert,
  ShieldCheck, UserCheck, Plug, Award, FileText, TrendingUp,
  AlertCircle, Clock, ArrowRight, Settings, Layers,
  X, Mail, Bot, UserCog, ClipboardList, Loader2,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

// ── Types ────────────────────────────────────────────────────────────────────

interface KernelStatus {
  kernel:   { version: string; status: string; engine: string; bootTime: string; uptimeSeconds: number }
  coverage: { totalApps: number; coveredApps: number; coveragePct: number; totalIdentities: number; protectedIdentities: number; protectionPct: number; criticalGaps: number; highGaps: number; totalGaps: number }
  drivers:  { loaded: number; healthy: number; degraded: number; offline: number }
  processes:{ running: number; queued: number; completedToday: number; failed: number }
  modules:  { installed: number; healthy: number }
  alerts:   { critical: number; high: number; medium: number }
}

interface Driver {
  driverId: string; name: string; vendor: string; version: string
  status: 'healthy' | 'degraded' | 'offline'
  capabilities: string[]; appsCovered: number; identitiesManaged: number
  configured: boolean; lastHandshake: string | null
}

interface Gap {
  gapId: string; appId: string; appName: string; riskTier: string; department: string
  missingControls: string[]; presentControls: string[]; riskScore: number
  recommendedAction: string; actionLabel: string; linkedDrivers: string[]
}

interface Process {
  processId: string; type: string; name: string; state: string
  startedAt: string; priority: string; driver: string | null
}

interface OsModule {
  moduleId: string; name: string; version: string; route: string
  category: string; status: string
}

interface Alert {
  alertId: string; severity: string; category: string
  title: string; detail: string; action: string; gapId?: string
}

interface CoverageTier { tier: string; total: number; covered: number; pct: number; gaps: number }
interface ControlTypeCoverage { controlId: string; control: string; pillar: string; apps: number; pct: number | null }

interface AppRow { appId: string; appName: string; riskTier: string; department: string }
interface ControlDrillDownData {
  controlId: string; name: string; pillar: string; category: string
  description: string; riskReduction: string
  implemented: AppRow[]; gap: AppRow[]; notApplicable: AppRow[]; undetected: AppRow[]
  summary: { implemented: number; gap: number; notApplicable: number; undetected: number; total: number }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUptime(secs: number): string {
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
  return `${Math.floor(secs / 86400)}d ${Math.floor((secs % 86400) / 3600)}h`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function tierColor(tier: string): string {
  return tier === 'critical' ? '#ef4444' : tier === 'high' ? '#f97316' : tier === 'medium' ? '#eab308' : '#6366f1'
}

function severityColor(sev: string): string {
  return sev === 'critical' ? '#ef4444' : sev === 'high' ? '#f97316' : sev === 'medium' ? '#eab308' : '#64748b'
}

function driverStatusColor(status: string): string {
  return status === 'healthy' ? '#22c55e' : status === 'degraded' ? '#f97316' : '#64748b'
}

function outcomeColor(outcome: string): string {
  return outcome === 'success' ? '#22c55e' : outcome === 'failure' ? '#ef4444' : '#64748b'
}

// ── KPI Tile ─────────────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, color, icon: Icon, onClick }: {
  label: string; value: string | number; sub?: string
  color?: string; icon?: React.ElementType; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-surface-600 bg-surface-800 p-4 ${onClick ? 'cursor-pointer hover:border-indigo-500/50' : ''} transition-all`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-muted uppercase tracking-wider">{label}</span>
        {Icon && <Icon size={14} style={{ color: color ?? '#64748b' }} />}
      </div>
      <div className="text-2xl font-bold" style={{ color: color ?? '#e2e8f0' }}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Driver Card ───────────────────────────────────────────────────────────────

function DriverCard({ driver, onConfigure }: { driver: Driver; onConfigure: () => void }) {
  const sc = driverStatusColor(driver.status)
  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sc }} />
            <span className="text-sm font-semibold text-body">{driver.name}</span>
          </div>
          <span className="text-xs text-muted ml-4">{driver.vendor} · {driver.version}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: sc + '20', color: sc }}>
          {driver.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-surface-900/60">
          <div className="text-lg font-bold text-body">{driver.appsCovered}</div>
          <div className="text-xs text-muted">Apps Covered</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-surface-900/60">
          <div className="text-lg font-bold text-body">{driver.identitiesManaged.toLocaleString()}</div>
          <div className="text-xs text-muted">Identities</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {driver.capabilities.slice(0, 4).map(c => (
          <span key={c} className="text-xs bg-surface-700 text-muted px-1.5 py-0.5 rounded">{c}</span>
        ))}
      </div>
      <button onClick={onConfigure}
        className="w-full text-xs text-a-indigo hover:text-a-indigo border border-surface-600 hover:border-indigo-500/50 rounded-lg py-1.5 transition-colors">
        Configure Driver
      </button>
    </div>
  )
}

// ── Coverage Bar ──────────────────────────────────────────────────────────────

function CoverageBar({ tier, total, covered, pct, gaps }: CoverageTier) {
  const sc = tierColor(tier)
  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-700 last:border-0">
      <div className="w-16 text-xs font-medium capitalize" style={{ color: sc }}>{tier}</div>
      <div className="flex-1 h-2 rounded-full bg-surface-700">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: sc }} />
      </div>
      <div className="text-xs font-semibold w-10 text-right" style={{ color: sc }}>{pct}%</div>
      <div className="text-xs text-muted w-16 text-right">{covered}/{total} apps</div>
      <div className="text-xs w-14 text-right" style={{ color: gaps > 0 ? '#ef4444' : '#22c55e' }}>
        {gaps} gaps
      </div>
    </div>
  )
}

// ── Control Drill-Down Panel ──────────────────────────────────────────────────
function ControlDrillDownPanel({ controlId, onClose }: { controlId: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [data, setData]   = useState<ControlDrillDownData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'gap' | 'implemented' | 'undetected' | 'na'>('gap')

  useEffect(() => {
    setLoading(true)
    apiFetch(`/controls/app-coverage/${controlId}`)
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data) })
      .finally(() => setLoading(false))
  }, [controlId])

  const PILLAR_COLOR: Record<string, string> = {
    AM: '#22d3ee', IGA: '#818cf8', PAM: '#fbbf24', CIAM: '#4ade80',
  }
  const pillarColor = data ? (PILLAR_COLOR[data.pillar] ?? '#818cf8') : '#818cf8'

  const tabs = [
    { key: 'gap'         as const, label: 'Gap',          count: data?.summary.gap         ?? 0, color: '#ef4444' },
    { key: 'implemented' as const, label: 'Implemented',  count: data?.summary.implemented ?? 0, color: '#22c55e' },
    { key: 'undetected'  as const, label: 'Not Assessed', count: data?.summary.undetected  ?? 0, color: '#64748b' },
    { key: 'na'          as const, label: 'N/A',          count: data?.summary.notApplicable ?? 0, color: '#475569' },
  ]

  const rows: AppRow[] =
    activeTab === 'gap'         ? (data?.gap          ?? []) :
    activeTab === 'implemented' ? (data?.implemented  ?? []) :
    activeTab === 'undetected'  ? (data?.undetected   ?? []) :
                                  (data?.notApplicable ?? [])

  const isClickable = activeTab === 'gap' || activeTab === 'undetected'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-md bg-surface-900 border-l border-surface-700 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-surface-700 flex-shrink-0"
             style={{ borderTopColor: pillarColor + '40', backgroundColor: pillarColor + '08' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded border"
                  style={{ color: pillarColor, borderColor: pillarColor + '40', backgroundColor: pillarColor + '15' }}>
                  {data?.pillar ?? '…'}
                </span>
                <span className="text-xs text-muted">{controlId}</span>
                {data && (
                  <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${
                    data.riskReduction === 'critical' ? 'text-a-red border-red-800/40 bg-red-900/20' :
                    data.riskReduction === 'high'     ? 'text-a-amber border-amber-800/40 bg-amber-900/20' :
                    'text-muted border-slate-700 bg-slate-800/40'
                  }`}>{data.riskReduction} risk reduction</span>
                )}
              </div>
              <h2 className="text-base font-bold text-heading mt-1.5">{data?.name ?? 'Loading…'}</h2>
              {data && <p className="text-xs text-muted mt-0.5">{data.category}</p>}
            </div>
            <button onClick={onClose} className="text-muted hover:text-secondary transition-colors flex-shrink-0 mt-1">
              <X size={18} />
            </button>
          </div>

          {data && (
            <p className="text-xs text-muted mt-3 leading-relaxed">{data.description}</p>
          )}

          {/* Summary bar */}
          {data && (
            <div className="mt-3 h-2 rounded-full bg-surface-700 overflow-hidden flex">
              {data.summary.implemented > 0 && (
                <div className="h-full bg-green-500 transition-all"
                     style={{ width: `${(data.summary.implemented / data.summary.total) * 100}%` }} />
              )}
              {data.summary.gap > 0 && (
                <div className="h-full bg-red-500 transition-all"
                     style={{ width: `${(data.summary.gap / data.summary.total) * 100}%` }} />
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-700 flex-shrink-0">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === t.key ? 'border-current' : 'border-transparent text-muted hover:text-secondary'
              }`}
              style={{ color: activeTab === t.key ? t.color : undefined, borderColor: activeTab === t.key ? t.color : undefined }}>
              {t.label}
              <span className="ml-1 text-[10px] opacity-70">({t.count})</span>
            </button>
          ))}
        </div>

        {/* App list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted">
              <CheckCircle size={20} className={activeTab === 'implemented' ? 'text-a-green' : undefined} />
              <p className="text-sm">
                {activeTab === 'gap' ? 'No confirmed gaps — good coverage' :
                 activeTab === 'implemented' ? 'No apps detected with this control yet' :
                 'None'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-surface-700/50">
              {rows.map(app => {
                const tc = tierColor(app.riskTier)
                return (
                  <div key={app.appId}
                    onClick={() => isClickable ? navigate(`/cmdb/${app.appId}`) : undefined}
                    className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                      isClickable ? 'cursor-pointer hover:bg-surface-800 group' : 'hover:bg-surface-800/40'
                    }`}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tc }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-body font-medium truncate">{app.appName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize flex-shrink-0"
                          style={{ backgroundColor: tc + '20', color: tc }}>{app.riskTier}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted">{app.appId}</span>
                        <span className="text-xs text-faint">·</span>
                        <span className="text-xs text-muted">{app.department}</span>
                      </div>
                    </div>
                    {isClickable && (
                      <ArrowRight size={14} className="text-faint group-hover:text-a-indigo transition-colors flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'gap' && rows.length > 0 && (
          <div className="px-5 py-3 border-t border-surface-700 flex-shrink-0">
            <p className="text-xs text-muted">
              Click any app to open its IAM Controls Assessment page
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ── Gap Action Result type ────────────────────────────────────────────────────
interface GapActionResult {
  actionLabel: string; approvalId: string; buildId: string
  appName: string; riskTier: string; missingControls: string[]; presentControls: string[]
  sentTo: Array<{ role: string; name: string; email: string }>
  nextSteps: string[]; message: string
}

// ── Gap Action Modal ──────────────────────────────────────────────────────────
function GapActionModal({ gap, onClose, onConfirmed }: {
  gap: Gap
  onClose: () => void
  onConfirmed: (result: GapActionResult) => void
}) {
  const [phase, setPhase] = useState<'preview' | 'sending' | 'done'>('preview')
  const [result, setResult] = useState<GapActionResult | null>(null)
  const [error, setError]   = useState('')
  const sc = tierColor(gap.riskTier)

  const ACTION_DESC: Record<string, string> = {
    'onboard-iam':     'Configure SSO, provisioning, PAM coverage, and access reviews across all IAM pillars',
    'request-sso':     'Integrate this application with the enterprise Identity Provider (Entra ID / Okta)',
    'request-pam':     'Onboard privileged accounts to CyberArk vault with session recording and rotation',
    'schedule-review': 'Set up quarterly access certification in SailPoint for all entitlements on this app',
  }

  const send = async () => {
    setPhase('sending')
    setError('')
    try {
      const r = await apiFetch(`/os/gaps/${gap.gapId}/action`, {
        method: 'POST', body: JSON.stringify({ action: gap.recommendedAction }),
      })
      const j = await r.json()
      if (!j.success) throw new Error(j.error)
      setResult(j.data)
      setPhase('done')
      onConfirmed(j.data)
    } catch (e) {
      setError((e as Error).message)
      setPhase('preview')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-surface-700 rounded-t-2xl"
             style={{ backgroundColor: sc + '10', borderTopColor: sc + '30' }}>
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" style={{ color: sc }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-heading">{gap.actionLabel}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                style={{ backgroundColor: sc + '20', color: sc }}>{gap.riskTier}</span>
            </div>
            <p className="text-xs text-muted mt-0.5">{gap.appName} · {gap.department} · Risk {gap.riskScore}/100</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-secondary transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {phase !== 'done' ? (
            <>
              {/* Action description */}
              <p className="text-xs text-muted leading-relaxed">
                {ACTION_DESC[gap.recommendedAction] ?? gap.actionLabel}
              </p>

              {/* Control status */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Control Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {gap.missingControls.map(c => (
                    <span key={c} className="text-xs bg-red-900/20 border border-red-800/30 text-a-red px-2 py-0.5 rounded-full">
                      Missing: {c}
                    </span>
                  ))}
                  {gap.presentControls.map(c => (
                    <span key={c} className="text-xs bg-green-900/20 border border-green-800/30 text-a-green px-2 py-0.5 rounded-full">
                      ✓ {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Workflow */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider">What Happens Next</p>
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    {[Mail, ClipboardList, Bot, UserCog].map((Icon, i) => (
                      <div key={i} className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                             style={{ backgroundColor: [sc, '#7c3aed', '#0891b2', '#d97706'].map(c => c + '30')[i],
                                      borderWidth: 1, borderStyle: 'solid', borderColor: [sc, '#7c3aed', '#0891b2', '#d97706'].map(c => c + '50')[i] }}>
                          <Icon size={11} style={{ color: [sc, '#a78bfa', '#22d3ee', '#fbbf24'][i] }} />
                        </div>
                        {i < 3 && <div className="w-px h-4 bg-surface-600" />}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 space-y-3 pt-0.5">
                    {[
                      { title: 'Email sent to Business Owner & Technical Admin', sub: 'A configuration form is sent requesting the technical information needed' },
                      { title: 'Owner completes configuration form', sub: `Specific details needed for ${gap.recommendedAction === 'request-pam' ? 'PAM vault setup' : gap.recommendedAction === 'schedule-review' ? 'access review configuration' : 'SSO / IAM integration'}` },
                      { title: 'AI agent configures and builds', sub: 'The agent uses the submitted data to configure the IAM controls automatically' },
                      { title: 'Engineer review & sign-off', sub: 'Alert sent to the assigned engineer to review and approve the configuration' },
                    ].map((s, i) => (
                      <div key={i}>
                        <p className="text-xs font-medium text-body">{s.title}</p>
                        <p className="text-[11px] text-muted mt-0.5">{s.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-xs text-a-red bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
              )}
            </>
          ) : result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-800/40 rounded-xl">
                <CheckCircle size={20} className="text-a-green flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-a-green">Workflow initiated</p>
                  <p className="text-xs text-muted mt-0.5">{result.message}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Notified</p>
                {result.sentTo.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-surface-800 border border-surface-700 rounded-lg">
                    <Mail size={13} className="text-a-indigo flex-shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-body">{r.name}</span>
                      <span className="text-[10px] text-muted ml-2">{r.role}</span>
                      <p className="text-[11px] text-muted">{r.email}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Processes Created</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs text-a-purple bg-violet-900/20 border border-violet-800/40 px-2.5 py-1.5 rounded-lg">
                    <ClipboardList size={11} /> Approval: {result.approvalId}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-a-cyan bg-cyan-900/20 border border-cyan-800/40 px-2.5 py-1.5 rounded-lg">
                    <Bot size={11} /> Build: {result.buildId}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Next Steps</p>
                {result.nextSteps.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted">
                    <ArrowRight size={11} className="mt-0.5 flex-shrink-0 text-faint" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-700">
          <button onClick={onClose}
            className="px-4 py-2 text-xs text-muted border border-surface-600 rounded-lg hover:bg-surface-700 transition-colors">
            {phase === 'done' ? 'Close' : 'Cancel'}
          </button>
          {phase !== 'done' && (
            <button onClick={send} disabled={phase === 'sending'}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-60 transition-colors"
              style={{ backgroundColor: sc }}>
              {phase === 'sending'
                ? <><Loader2 size={12} className="animate-spin" /> Sending…</>
                : <><Mail size={12} /> Send Configuration Request</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Gap Row ───────────────────────────────────────────────────────────────────
function GapRow({ gap, onConfigure }: { gap: Gap; onConfigure: (gap: Gap) => void }) {
  const sc = tierColor(gap.riskTier)
  return (
    <div className="rounded-lg border border-surface-600 bg-surface-800 p-4 flex items-center gap-4">
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: sc }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-medium text-body">{gap.appName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
            style={{ backgroundColor: sc + '20', color: sc }}>{gap.riskTier}</span>
          <span className="text-xs text-muted">{gap.department}</span>
          <span className="text-xs text-a-amber ml-auto">Risk {gap.riskScore}/100</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {gap.missingControls.map(c => (
            <span key={c} className="text-xs bg-red-900/20 border border-red-800/30 text-a-red px-1.5 py-0.5 rounded">
              Missing: {c}
            </span>
          ))}
          {gap.presentControls.map(c => (
            <span key={c} className="text-xs bg-green-900/20 border border-green-800/30 text-a-green px-1.5 py-0.5 rounded">
              ✓ {c}
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={() => onConfigure(gap)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0 transition-opacity hover:opacity-90"
        style={{ backgroundColor: sc }}>
        <Zap size={11} /> {gap.actionLabel}
      </button>
    </div>
  )
}



// ── Alert Card ────────────────────────────────────────────────────────────────

function AlertCard({ alert, onAction }: { alert: Alert; onAction?: () => void }) {
  const sc = severityColor(alert.severity)
  const Icon = alert.severity === 'critical' ? AlertCircle
             : alert.severity === 'high'     ? AlertTriangle
             :                                 AlertTriangle
  return (
    <div className="rounded-lg border bg-surface-800 p-3 flex gap-3"
      style={{ borderColor: sc + '30' }}>
      <Icon size={14} style={{ color: sc }} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-body mb-0.5">{alert.title}</div>
        <div className="text-xs text-muted leading-snug">{alert.detail}</div>
      </div>
      {onAction && (
        <button onClick={onAction}
          className="text-xs text-a-indigo hover:text-a-indigo shrink-0 underline">
          {alert.action}
        </button>
      )}
    </div>
  )
}

// ── Module Grid Card ──────────────────────────────────────────────────────────

const MODULE_ICONS: Record<string, React.ElementType> = {
  iga: BarChart2, am: ShieldCheck, pam: ShieldAlert, ciam: UserCheck,
  maturity: Award, cost: TrendingUp, docs: FileText, cmdb: Database,
}

function ModuleCard({ mod, onClick }: { mod: OsModule; onClick: () => void }) {
  const Icon = MODULE_ICONS[mod.moduleId] ?? Layers
  const sc   = mod.status === 'healthy' ? '#22c55e' : '#ef4444'
  return (
    <button onClick={onClick}
      className="text-left rounded-xl border border-surface-600 bg-surface-800 p-4 hover:border-indigo-500/40 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-500/10">
          <Icon size={18} className="text-a-indigo" />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sc }} />
          <span className="text-xs" style={{ color: sc }}>{mod.status}</span>
        </div>
      </div>
      <div className="text-xs font-medium text-body leading-tight mb-1">{mod.name}</div>
      <div className="text-xs text-muted">v{mod.version} · {mod.category}</div>
      <div className="text-xs text-a-indigo opacity-0 group-hover:opacity-100 transition-opacity mt-2">
        Open module →
      </div>
    </button>
  )
}

// ── Process Row ───────────────────────────────────────────────────────────────

const STATE_COLOR: Record<string, string> = {
  running: '#22c55e', pending: '#6366f1', queued: '#eab308',
  overdue: '#ef4444', failed: '#ef4444', completed: '#64748b',
  build_in_progress: '#22c55e', classified: '#eab308', cancelled: '#64748b',
}
const TYPE_COLOR: Record<string, string> = {
  build: '#6366f1', approval: '#06b6d4', rotation: '#f59e0b', certification: '#22c55e',
}

function ProcessRow({ proc }: { proc: Process }) {
  const sc  = STATE_COLOR[proc.state] ?? '#64748b'
  const tc  = TYPE_COLOR[proc.type] ?? '#64748b'
  const pc  = proc.priority === 'critical' ? '#ef4444' : proc.priority === 'high' ? '#f97316' : '#64748b'
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-700 last:border-0 text-xs">
      <span className="px-1.5 py-0.5 rounded font-medium uppercase shrink-0"
        style={{ backgroundColor: tc + '20', color: tc }}>{proc.type}</span>
      <span className="flex-1 text-secondary truncate">{proc.name}</span>
      <span className="px-2 py-0.5 rounded-full text-xs shrink-0"
        style={{ backgroundColor: sc + '20', color: sc }}>{proc.state}</span>
      <span className="shrink-0" style={{ color: pc }}>{proc.priority}</span>
      <span className="text-muted shrink-0">{fmtTime(proc.startedAt)}</span>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

type Tab = 'monitor' | 'operate' | 'control'

export default function OSControlPanel() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'monitor')

  // Data state
  const [status,    setStatus]    = useState<KernelStatus | null>(null)
  const [drivers,   setDrivers]   = useState<Driver[]>([])
  const [gaps,      setGaps]      = useState<Gap[]>([])
  const [processes, setProcesses] = useState<Process[]>([])
  const [modules,   setModules]   = useState<OsModule[]>([])
  const [alerts,    setAlerts]    = useState<Alert[]>([])
  const [coverage,  setCoverage]  = useState<{ byRiskTier: CoverageTier[]; byControlType: ControlTypeCoverage[] } | null>(null)

  const [loading,         setLoading]         = useState(true)
  const [refreshing,      setRefreshing]      = useState(false)
  const [modalGap,        setModalGap]        = useState<Gap | null>(null)
  const [toast,           setToast]           = useState<{ message: string; appName: string } | null>(null)
  const [selectedControl, setSelectedControl] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [statusR, driversR, gapsR, processesR, modulesR, alertsR, coverageR] = await Promise.all([
        apiFetch('/os/status').then(r => r.json()),
        apiFetch('/os/drivers').then(r => r.json()),
        apiFetch('/os/gaps').then(r => r.json()),
        apiFetch('/os/processes').then(r => r.json()),
        apiFetch('/os/modules').then(r => r.json()),
        apiFetch('/os/alerts').then(r => r.json()),
        apiFetch('/os/coverage').then(r => r.json()),
      ])
      if (statusR.success)   setStatus(statusR.data)
      if (driversR.success)  setDrivers(driversR.data)
      if (gapsR.success)     setGaps(gapsR.data.gaps ?? [])
      if (processesR.success)setProcesses(processesR.data)
      if (modulesR.success)  setModules(modulesR.data)
      if (alertsR.success)   setAlerts(alertsR.data)
      if (coverageR.success) setCoverage(coverageR.data)
    } catch { /* errors are silent — partial data is fine */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const refresh = () => { setRefreshing(true); loadAll() }

  const handleTabChange = (t: Tab) => {
    setTab(t)
    setSearchParams(t === 'monitor' ? {} : { tab: t })
  }

  const handleGapConfirmed = useCallback(async (result: GapActionResult) => {
    // Immediately refresh processes list so new build + approval appear
    const procR = await apiFetch('/os/processes').then(r => r.json())
    if (procR.success) setProcesses(procR.data)
    setToast({ message: `${result.actionLabel} workflow started`, appName: result.appName })
    setTimeout(() => setToast(null), 5000)
  }, [])

  const handleApproval = async (requestId: string, decision: 'approved' | 'rejected') => {
    await apiFetch(`/security/approvals/${requestId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ decision, approverId: 'os-operator', comment: `Actioned from IAM OS Control Panel` }),
    })
    await loadAll()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Cpu size={32} className="text-a-indigo animate-pulse mx-auto mb-3" />
          <p className="text-muted text-sm">Initialising IAM OS Kernel…</p>
        </div>
      </div>
    )
  }

  const cov = status?.coverage
  const totalAlerts = (status?.alerts.critical ?? 0) + (status?.alerts.high ?? 0) + (status?.alerts.medium ?? 0)

  return (
    <div className="space-y-4 p-6 max-w-screen-2xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Cpu size={20} className="text-a-indigo" />
            <h1 className="text-xl font-bold text-heading">IAM OS Control Panel</h1>
            {status && (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/20 text-a-green font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                KERNEL RUNNING
              </span>
            )}
          </div>
          {status && (
            <p className="text-xs text-muted mt-1 ml-8">
              v{status.kernel.version} · Uptime {fmtUptime(status.kernel.uptimeSeconds)} · Engine: {status.kernel.engine}
            </p>
          )}
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-600 hover:border-indigo-500 text-xs text-muted hover:text-body transition-colors disabled:opacity-50">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-surface-800 border border-surface-700 rounded-xl w-fit">
        {([
          { id: 'monitor', label: 'Monitor', icon: Activity },
          { id: 'operate', label: 'Operate', icon: Zap },
          { id: 'control', label: 'Control', icon: Settings },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => handleTabChange(id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-indigo-600 text-white'
                : 'text-muted hover:text-body hover:bg-surface-700'
            }`}>
            <Icon size={14} />
            {label}
            {id === 'operate' && (gaps.filter(g => g.riskTier === 'critical').length + processes.filter(p => p.state === 'pending').length) > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                {gaps.filter(g => g.riskTier === 'critical').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MONITOR TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'monitor' && (
        <div className="space-y-4">

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiTile
              label="App Coverage"
              value={`${cov?.coveragePct ?? 0}%`}
              sub={`${cov?.coveredApps}/${cov?.totalApps} apps`}
              color={cov && cov.coveragePct >= 80 ? '#22c55e' : cov && cov.coveragePct >= 60 ? '#eab308' : '#ef4444'}
              icon={Shield}
            />
            <KpiTile
              label="Identity Protection"
              value={`${cov?.protectionPct ?? 0}%`}
              sub={`${cov?.protectedIdentities?.toLocaleString()}/${cov?.totalIdentities?.toLocaleString()}`}
              color="#6366f1"
              icon={Users}
            />
            <KpiTile
              label="Critical Gaps"
              value={cov?.criticalGaps ?? 0}
              sub={`${cov?.totalGaps} total gaps`}
              color={cov && cov.criticalGaps > 0 ? '#ef4444' : '#22c55e'}
              icon={AlertTriangle}
              onClick={() => handleTabChange('operate')}
            />
            <KpiTile
              label="Drivers Online"
              value={`${status?.drivers.healthy ?? 0}/${status?.drivers.loaded ?? 0}`}
              sub={status?.drivers.degraded ? `${status.drivers.degraded} degraded` : 'all healthy'}
              color={status?.drivers.degraded ? '#f97316' : '#22c55e'}
              icon={Plug}
            />
            <KpiTile
              label="Active Processes"
              value={status?.processes.running ?? 0}
              sub={`${status?.processes.queued} queued`}
              color="#06b6d4"
              icon={Activity}
            />
            <KpiTile
              label="OS Alerts"
              value={totalAlerts}
              sub={`${status?.alerts.critical} critical`}
              color={totalAlerts > 0 ? '#ef4444' : '#22c55e'}
              icon={AlertCircle}
            />
          </div>

          {/* Coverage by Risk Tier + Drivers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Coverage by Tier */}
            <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={15} className="text-a-indigo" />
                <span className="text-sm font-semibold text-body">IAM Coverage by Risk Tier</span>
              </div>
              {coverage?.byRiskTier.map(t => (
                <CoverageBar key={t.tier} {...t} />
              ))}
              {(!coverage?.byRiskTier.length) && (
                <p className="text-xs text-muted">No application data. Import apps via Identity CMDB.</p>
              )}
            </div>

            {/* Driver Health */}
            <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Plug size={15} className="text-a-indigo" />
                <span className="text-sm font-semibold text-body">Loaded Drivers</span>
              </div>
              <div className="space-y-3">
                {drivers.map(d => {
                  const sc = driverStatusColor(d.status)
                  return (
                    <div key={d.driverId} className="flex items-center gap-3 py-2 border-b border-surface-700 last:border-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-body">{d.name}</div>
                        <div className="text-xs text-muted">{d.vendor} · {d.appsCovered} apps · {d.identitiesManaged.toLocaleString()} identities</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: sc + '20', color: sc }}>{d.status}</span>
                        {d.status === 'degraded' && (
                          <button onClick={() => navigate('/integrations')}
                            className="block text-xs text-a-orange hover:text-a-orange mt-0.5">
                            Reconnect →
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Control Type Coverage */}
          {coverage?.byControlType && (
            <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={15} className="text-a-indigo" />
                <span className="text-sm font-semibold text-body">IAM Control Coverage</span>
                <span className="text-xs text-muted ml-2">— percentage of apps with each control applied</span>
              </div>
              <p className="text-xs text-muted mb-3">Click any control to see which apps have it implemented vs. which have a gap.</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {coverage.byControlType.map(c => {
                  const col = c.pct !== null && c.pct >= 70 ? '#22c55e' : c.pct !== null && c.pct >= 40 ? '#eab308' : '#ef4444'
                  return (
                    <button key={c.control}
                      onClick={() => setSelectedControl(c.controlId ?? c.control)}
                      className="text-center p-3 rounded-lg bg-surface-900/60 hover:bg-surface-700/60 hover:ring-1 hover:ring-indigo-500/40 transition-all cursor-pointer text-left">
                      <div className="text-xl font-bold mb-1" style={{ color: col }}>{c.pct !== null ? `${c.pct}%` : '—'}</div>
                      <div className="text-xs text-muted font-medium">{c.control}</div>
                      <div className="text-xs text-faint">{c.apps} apps</div>
                      <div className="h-1.5 rounded-full bg-surface-700 mt-2">
                        <div className="h-full rounded-full" style={{ width: `${c.pct ?? 0}%`, backgroundColor: col }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top Unprotected + Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Gaps preview */}
            <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-a-red" />
                  <span className="text-sm font-semibold text-body">Top Unprotected Applications</span>
                </div>
                <button onClick={() => handleTabChange('operate')}
                  className="text-xs text-a-indigo hover:text-a-indigo">View all →</button>
              </div>
              <div className="space-y-2">
                {gaps.slice(0, 6).map(g => {
                  const sc = tierColor(g.riskTier)
                  return (
                    <div key={g.gapId} className="flex items-center gap-3 py-1.5 border-b border-surface-700 last:border-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc }} />
                      <span className="flex-1 text-sm text-secondary truncate">{g.appName}</span>
                      <span className="text-xs capitalize" style={{ color: sc }}>{g.riskTier}</span>
                      <span className="text-xs text-muted">{g.missingControls.length} missing</span>
                      <button onClick={() => handleTabChange('operate')}
                        className="text-xs text-a-indigo hover:text-a-indigo shrink-0">
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )
                })}
                {gaps.length === 0 && (
                  <p className="text-xs text-a-green">All applications are within policy. No gaps detected.</p>
                )}
              </div>
            </div>

            {/* Alerts */}
            <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={15} className="text-a-red" />
                <span className="text-sm font-semibold text-body">Alert Feed</span>
                <span className="ml-auto text-xs text-a-red">{alerts.filter(a => a.severity === 'critical').length} critical</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {alerts.slice(0, 8).map(a => (
                  <AlertCard key={a.alertId} alert={a}
                    onAction={a.gapId ? () => handleTabChange('operate') : undefined} />
                ))}
                {alerts.length === 0 && (
                  <p className="text-xs text-a-green">No active alerts. IAM posture is healthy.</p>
                )}
              </div>
            </div>
          </div>


        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          OPERATE TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {/* Gap action modal */}
      {modalGap && (
        <GapActionModal
          gap={modalGap}
          onClose={() => setModalGap(null)}
          onConfirmed={async (result) => {
            setModalGap(null)
            await handleGapConfirmed(result)
          }}
        />
      )}

      {/* Control drill-down panel */}
      {selectedControl && (
        <ControlDrillDownPanel
          controlId={selectedControl}
          onClose={() => setSelectedControl(null)}
        />
      )}

      {tab === 'operate' && (
        <div className="space-y-4">

          {/* Success toast */}
          {toast && (
            <div className="flex items-center gap-3 p-3 bg-green-900/30 border border-green-700/50 rounded-xl text-sm">
              <CheckCircle size={16} className="text-a-green flex-shrink-0" />
              <span className="text-a-green font-medium">{toast.message}</span>
              <span className="text-muted">workflow started for</span>
              <span className="text-heading font-medium">{toast.appName}</span>
              <span className="text-muted ml-auto text-xs">Processes updated ↓</span>
            </div>
          )}

          {/* Gap Remediation Queue */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-a-red" />
                <span className="text-sm font-semibold text-body">IAM Gap Remediation Queue</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-a-red font-medium">
                  {gaps.length} gaps
                </span>
              </div>
              <div className="flex gap-2 text-xs text-muted">
                <span className="text-a-red font-medium">{gaps.filter(g => g.riskTier === 'critical').length} critical</span>
                <span>·</span>
                <span className="text-a-orange">{gaps.filter(g => g.riskTier === 'high').length} high</span>
              </div>
            </div>
            {gaps.length === 0
              ? <p className="text-sm text-a-green">All applications are within IAM control policy. No remediation required.</p>
              : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {gaps.map(g => (
                    <GapRow key={g.gapId} gap={g} onConfigure={setModalGap} />
                  ))}
                </div>
              )
            }
          </div>

          {/* Pending Approvals */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={15} className="text-a-indigo" />
              <span className="text-sm font-semibold text-body">Pending Approvals</span>
              <span className="text-xs text-muted">— actioned directly from the OS</span>
            </div>
            {(() => {
              const pendingApprovals = processes.filter(p => p.type === 'approval' && p.state === 'pending')
              if (pendingApprovals.length === 0) {
                return <p className="text-xs text-muted">No pending approvals.</p>
              }
              return (
                <div className="space-y-2">
                  {pendingApprovals.map(p => (
                    <div key={p.processId} className="flex items-center gap-4 p-3 rounded-lg border border-surface-600 bg-surface-900/40">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-body truncate">{p.name}</div>
                        <div className="text-xs text-muted">{fmtTime(p.startedAt)} · {p.priority} priority</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleApproval(p.processId, 'approved')}
                          className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors">
                          Approve
                        </button>
                        <button onClick={() => handleApproval(p.processId, 'rejected')}
                          className="px-3 py-1.5 rounded-lg border border-red-600/50 text-a-red hover:bg-red-900/20 text-xs font-medium transition-colors">
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Active Processes */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={15} className="text-a-indigo" />
              <span className="text-sm font-semibold text-body">Active IAM Processes</span>
              <span className="text-xs text-muted">— builds, rotations, approvals</span>
            </div>
            {processes.length === 0
              ? <p className="text-xs text-muted">No active processes.</p>
              : (
                <div className="max-h-72 overflow-y-auto">
                  {processes.map(p => <ProcessRow key={p.processId} proc={p} />)}
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CONTROL TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'control' && (
        <div className="space-y-4">

          {/* Driver Manager */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Plug size={15} className="text-a-indigo" />
                <span className="text-sm font-semibold text-body">Installed Drivers</span>
                <span className="text-xs text-muted">— IAM platform adapters loaded into the kernel</span>
              </div>
              <button onClick={() => navigate('/integrations')}
                className="text-xs text-a-indigo hover:text-a-indigo">
                Driver Settings →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {drivers.map(d => (
                <DriverCard key={d.driverId} driver={d} onConfigure={() => navigate('/integrations')} />
              ))}
            </div>
          </div>

          {/* Coverage Policies */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={15} className="text-a-indigo" />
              <span className="text-sm font-semibold text-body">Coverage Policies</span>
              <span className="text-xs text-muted ml-2">— IAM control requirements per application risk tier</span>
            </div>
            <div className="space-y-2">
              {[
                { tier: 'Critical', controls: ['SSO', 'MFA', 'PAM', 'Access Review'], color: '#ef4444' },
                { tier: 'High',     controls: ['SSO', 'MFA'],                          color: '#f97316' },
                { tier: 'Medium',   controls: ['SSO'],                                 color: '#eab308' },
                { tier: 'Low',      controls: ['No mandatory controls'],               color: '#6366f1' },
              ].map(p => (
                <div key={p.tier} className="flex items-center gap-4 p-3 rounded-lg bg-surface-900/50">
                  <span className="text-sm font-medium w-16" style={{ color: p.color }}>{p.tier}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {p.controls.map(c => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded-full border font-medium"
                        style={{ borderColor: p.color + '40', color: p.color, backgroundColor: p.color + '10' }}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <span className="ml-auto text-xs text-faint">Required</span>
                </div>
              ))}
            </div>
          </div>

          {/* Installed Modules */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers size={15} className="text-a-indigo" />
              <span className="text-sm font-semibold text-body">Installed Modules</span>
              <span className="text-xs text-muted">— {modules.filter(m => m.status === 'healthy').length}/{modules.length} healthy</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {modules.map(m => (
                <ModuleCard key={m.moduleId} mod={m} onClick={() => navigate(m.route)} />
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
