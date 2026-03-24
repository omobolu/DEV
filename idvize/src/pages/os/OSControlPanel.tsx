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

interface OsEvent {
  eventId: string; type: string; severity: string
  actor: string; resource: string; outcome: string
  timestamp: string; driver: string
}

interface Alert {
  alertId: string; severity: string; category: string
  title: string; detail: string; action: string; gapId?: string
}

interface CoverageTier { tier: string; total: number; covered: number; pct: number; gaps: number }
interface ControlTypeCoverage { control: string; apps: number; pct: number }

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
        <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
        {Icon && <Icon size={14} style={{ color: color ?? '#64748b' }} />}
      </div>
      <div className="text-2xl font-bold" style={{ color: color ?? '#e2e8f0' }}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
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
            <span className="text-sm font-semibold text-slate-200">{driver.name}</span>
          </div>
          <span className="text-xs text-slate-500 ml-4">{driver.vendor} · {driver.version}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: sc + '20', color: sc }}>
          {driver.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-surface-900/60">
          <div className="text-lg font-bold text-slate-200">{driver.appsCovered}</div>
          <div className="text-xs text-slate-500">Apps Covered</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-surface-900/60">
          <div className="text-lg font-bold text-slate-200">{driver.identitiesManaged.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Identities</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {driver.capabilities.slice(0, 4).map(c => (
          <span key={c} className="text-xs bg-surface-700 text-slate-400 px-1.5 py-0.5 rounded">{c}</span>
        ))}
      </div>
      <button onClick={onConfigure}
        className="w-full text-xs text-indigo-400 hover:text-indigo-300 border border-surface-600 hover:border-indigo-500/50 rounded-lg py-1.5 transition-colors">
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
      <div className="text-xs text-slate-500 w-16 text-right">{covered}/{total} apps</div>
      <div className="text-xs w-14 text-right" style={{ color: gaps > 0 ? '#ef4444' : '#22c55e' }}>
        {gaps} gaps
      </div>
    </div>
  )
}

// ── Gap Row ───────────────────────────────────────────────────────────────────

function GapRow({ gap, onAction, actioning }: { gap: Gap; onAction: (gapId: string, action: string) => void; actioning: string | null }) {
  const sc = tierColor(gap.riskTier)
  const loading = actioning === gap.gapId
  return (
    <div className="rounded-lg border border-surface-600 bg-surface-800 p-4 flex items-center gap-4">
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: sc }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-medium text-slate-200">{gap.appName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
            style={{ backgroundColor: sc + '20', color: sc }}>{gap.riskTier}</span>
          <span className="text-xs text-slate-500">{gap.department}</span>
          <span className="text-xs text-amber-400 ml-auto">Risk {gap.riskScore}/100</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {gap.missingControls.map(c => (
            <span key={c} className="text-xs bg-red-900/20 border border-red-800/30 text-red-400 px-1.5 py-0.5 rounded">
              Missing: {c}
            </span>
          ))}
          {gap.presentControls.map(c => (
            <span key={c} className="text-xs bg-green-900/20 border border-green-800/30 text-green-400 px-1.5 py-0.5 rounded">
              ✓ {c}
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={() => onAction(gap.gapId, gap.recommendedAction)}
        disabled={!!loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-colors shrink-0"
        style={{ backgroundColor: sc }}>
        {loading ? <RefreshCw size={11} className="animate-spin" /> : <ArrowRight size={11} />}
        {loading ? 'Working…' : gap.actionLabel}
      </button>
    </div>
  )
}

// ── Event Row ─────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: OsEvent }) {
  const sc = severityColor(event.severity)
  const oc = outcomeColor(event.outcome)
  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-700/50 last:border-0 text-xs">
      <span className="text-slate-500 font-mono shrink-0 w-18">{fmtTime(event.timestamp)}</span>
      <span className="px-1.5 py-0.5 rounded text-xs shrink-0 font-medium"
        style={{ backgroundColor: sc + '20', color: sc }}>{event.severity}</span>
      <span className="text-slate-500 shrink-0 w-16 truncate">[{event.driver}]</span>
      <span className="text-slate-400 font-mono shrink-0">{event.type}</span>
      <span className="text-slate-300 flex-1 truncate">{event.actor} → {event.resource}</span>
      <span className="shrink-0 font-mono" style={{ color: oc }}>
        {event.outcome === 'success' ? '✓' : event.outcome === 'failure' ? '✗' : '—'}
      </span>
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
        <div className="text-xs font-medium text-slate-200 mb-0.5">{alert.title}</div>
        <div className="text-xs text-slate-500 leading-snug">{alert.detail}</div>
      </div>
      {onAction && (
        <button onClick={onAction}
          className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0 underline">
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
          <Icon size={18} className="text-indigo-400" />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sc }} />
          <span className="text-xs" style={{ color: sc }}>{mod.status}</span>
        </div>
      </div>
      <div className="text-xs font-medium text-slate-200 leading-tight mb-1">{mod.name}</div>
      <div className="text-xs text-slate-500">v{mod.version} · {mod.category}</div>
      <div className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity mt-2">
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
      <span className="flex-1 text-slate-300 truncate">{proc.name}</span>
      <span className="px-2 py-0.5 rounded-full text-xs shrink-0"
        style={{ backgroundColor: sc + '20', color: sc }}>{proc.state}</span>
      <span className="shrink-0" style={{ color: pc }}>{proc.priority}</span>
      <span className="text-slate-500 shrink-0">{fmtTime(proc.startedAt)}</span>
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
  const [events,    setEvents]    = useState<OsEvent[]>([])
  const [alerts,    setAlerts]    = useState<Alert[]>([])
  const [coverage,  setCoverage]  = useState<{ byRiskTier: CoverageTier[]; byControlType: ControlTypeCoverage[] } | null>(null)

  const [loading,   setLoading]   = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)
  const [refreshing,setRefreshing]= useState(false)

  const loadAll = useCallback(async () => {
    try {
      const [statusR, driversR, gapsR, processesR, modulesR, eventsR, alertsR, coverageR] = await Promise.all([
        apiFetch('/os/status').then(r => r.json()),
        apiFetch('/os/drivers').then(r => r.json()),
        apiFetch('/os/gaps').then(r => r.json()),
        apiFetch('/os/processes').then(r => r.json()),
        apiFetch('/os/modules').then(r => r.json()),
        apiFetch('/os/events').then(r => r.json()),
        apiFetch('/os/alerts').then(r => r.json()),
        apiFetch('/os/coverage').then(r => r.json()),
      ])
      if (statusR.success)   setStatus(statusR.data)
      if (driversR.success)  setDrivers(driversR.data)
      if (gapsR.success)     setGaps(gapsR.data.gaps ?? [])
      if (processesR.success)setProcesses(processesR.data)
      if (modulesR.success)  setModules(modulesR.data)
      if (eventsR.success)   setEvents(eventsR.data)
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

  const handleGapAction = async (gapId: string, action: string) => {
    setActioning(gapId)
    try {
      const r = await apiFetch(`/os/gaps/${gapId}/action`, { method: 'POST', body: JSON.stringify({ action }) })
      const j = await r.json()
      if (j.success) await loadAll()
    } finally { setActioning(null) }
  }

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
          <Cpu size={32} className="text-indigo-400 animate-pulse mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Initialising IAM OS Kernel…</p>
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
            <Cpu size={20} className="text-indigo-400" />
            <h1 className="text-xl font-bold text-white">IAM OS Control Panel</h1>
            {status && (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/20 text-green-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                KERNEL RUNNING
              </span>
            )}
          </div>
          {status && (
            <p className="text-xs text-slate-500 mt-1 ml-8">
              v{status.kernel.version} · Uptime {fmtUptime(status.kernel.uptimeSeconds)} · Engine: {status.kernel.engine}
            </p>
          )}
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-600 hover:border-indigo-500 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50">
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
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-700'
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
                <Shield size={15} className="text-indigo-400" />
                <span className="text-sm font-semibold text-slate-200">IAM Coverage by Risk Tier</span>
              </div>
              {coverage?.byRiskTier.map(t => (
                <CoverageBar key={t.tier} {...t} />
              ))}
              {(!coverage?.byRiskTier.length) && (
                <p className="text-xs text-slate-500">No application data. Import apps via Identity CMDB.</p>
              )}
            </div>

            {/* Driver Health */}
            <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Plug size={15} className="text-indigo-400" />
                <span className="text-sm font-semibold text-slate-200">Loaded Drivers</span>
              </div>
              <div className="space-y-3">
                {drivers.map(d => {
                  const sc = driverStatusColor(d.status)
                  return (
                    <div key={d.driverId} className="flex items-center gap-3 py-2 border-b border-surface-700 last:border-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-200">{d.name}</div>
                        <div className="text-xs text-slate-500">{d.vendor} · {d.appsCovered} apps · {d.identitiesManaged.toLocaleString()} identities</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: sc + '20', color: sc }}>{d.status}</span>
                        {d.status === 'degraded' && (
                          <button onClick={() => navigate('/integrations')}
                            className="block text-xs text-orange-400 hover:text-orange-300 mt-0.5">
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
                <CheckCircle size={15} className="text-indigo-400" />
                <span className="text-sm font-semibold text-slate-200">IAM Control Coverage</span>
                <span className="text-xs text-slate-500 ml-2">— percentage of apps with each control applied</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {coverage.byControlType.map(c => {
                  const col = c.pct >= 70 ? '#22c55e' : c.pct >= 40 ? '#eab308' : '#ef4444'
                  return (
                    <div key={c.control} className="text-center p-3 rounded-lg bg-surface-900/60">
                      <div className="text-xl font-bold mb-1" style={{ color: col }}>{c.pct}%</div>
                      <div className="text-xs text-slate-400 font-medium">{c.control}</div>
                      <div className="text-xs text-slate-600">{c.apps} apps</div>
                      <div className="h-1.5 rounded-full bg-surface-700 mt-2">
                        <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: col }} />
                      </div>
                    </div>
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
                  <AlertTriangle size={15} className="text-red-400" />
                  <span className="text-sm font-semibold text-slate-200">Top Unprotected Applications</span>
                </div>
                <button onClick={() => handleTabChange('operate')}
                  className="text-xs text-indigo-400 hover:text-indigo-300">View all →</button>
              </div>
              <div className="space-y-2">
                {gaps.slice(0, 6).map(g => {
                  const sc = tierColor(g.riskTier)
                  return (
                    <div key={g.gapId} className="flex items-center gap-3 py-1.5 border-b border-surface-700 last:border-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc }} />
                      <span className="flex-1 text-sm text-slate-300 truncate">{g.appName}</span>
                      <span className="text-xs capitalize" style={{ color: sc }}>{g.riskTier}</span>
                      <span className="text-xs text-slate-500">{g.missingControls.length} missing</span>
                      <button onClick={() => handleTabChange('operate')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0">
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )
                })}
                {gaps.length === 0 && (
                  <p className="text-xs text-green-400">All applications are within policy. No gaps detected.</p>
                )}
              </div>
            </div>

            {/* Alerts */}
            <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={15} className="text-red-400" />
                <span className="text-sm font-semibold text-slate-200">Alert Feed</span>
                <span className="ml-auto text-xs text-red-400">{alerts.filter(a => a.severity === 'critical').length} critical</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {alerts.slice(0, 8).map(a => (
                  <AlertCard key={a.alertId} alert={a}
                    onAction={a.gapId ? () => handleTabChange('operate') : undefined} />
                ))}
                {alerts.length === 0 && (
                  <p className="text-xs text-green-400">No active alerts. IAM posture is healthy.</p>
                )}
              </div>
            </div>
          </div>

          {/* Live Event Stream */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-indigo-400" />
                <span className="text-sm font-semibold text-slate-200">Live IAM Event Stream</span>
                <span className="text-xs text-slate-500">— last {events.length} events across all drivers</span>
              </div>
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                live
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto font-mono">
              {events.length === 0
                ? <p className="text-xs text-slate-500">No events recorded yet. Events appear as IAM activity occurs.</p>
                : events.map(e => <EventRow key={e.eventId} event={e} />)
              }
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          OPERATE TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'operate' && (
        <div className="space-y-4">

          {/* Gap Remediation Queue */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-400" />
                <span className="text-sm font-semibold text-slate-200">IAM Gap Remediation Queue</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">
                  {gaps.length} gaps
                </span>
              </div>
              <div className="flex gap-2 text-xs text-slate-500">
                <span className="text-red-400 font-medium">{gaps.filter(g => g.riskTier === 'critical').length} critical</span>
                <span>·</span>
                <span className="text-orange-400">{gaps.filter(g => g.riskTier === 'high').length} high</span>
              </div>
            </div>
            {gaps.length === 0
              ? <p className="text-sm text-green-400">All applications are within IAM control policy. No remediation required.</p>
              : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {gaps.map(g => (
                    <GapRow key={g.gapId} gap={g} onAction={handleGapAction} actioning={actioning} />
                  ))}
                </div>
              )
            }
          </div>

          {/* Pending Approvals */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={15} className="text-indigo-400" />
              <span className="text-sm font-semibold text-slate-200">Pending Approvals</span>
              <span className="text-xs text-slate-500">— actioned directly from the OS</span>
            </div>
            {(() => {
              const pendingApprovals = processes.filter(p => p.type === 'approval' && p.state === 'pending')
              if (pendingApprovals.length === 0) {
                return <p className="text-xs text-slate-500">No pending approvals.</p>
              }
              return (
                <div className="space-y-2">
                  {pendingApprovals.map(p => (
                    <div key={p.processId} className="flex items-center gap-4 p-3 rounded-lg border border-surface-600 bg-surface-900/40">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200 truncate">{p.name}</div>
                        <div className="text-xs text-slate-500">{fmtTime(p.startedAt)} · {p.priority} priority</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleApproval(p.processId, 'approved')}
                          className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors">
                          Approve
                        </button>
                        <button onClick={() => handleApproval(p.processId, 'rejected')}
                          className="px-3 py-1.5 rounded-lg border border-red-600/50 text-red-400 hover:bg-red-900/20 text-xs font-medium transition-colors">
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
              <Activity size={15} className="text-indigo-400" />
              <span className="text-sm font-semibold text-slate-200">Active IAM Processes</span>
              <span className="text-xs text-slate-500">— builds, rotations, approvals</span>
            </div>
            {processes.length === 0
              ? <p className="text-xs text-slate-500">No active processes.</p>
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
                <Plug size={15} className="text-indigo-400" />
                <span className="text-sm font-semibold text-slate-200">Installed Drivers</span>
                <span className="text-xs text-slate-500">— IAM platform adapters loaded into the kernel</span>
              </div>
              <button onClick={() => navigate('/integrations')}
                className="text-xs text-indigo-400 hover:text-indigo-300">
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
              <Shield size={15} className="text-indigo-400" />
              <span className="text-sm font-semibold text-slate-200">Coverage Policies</span>
              <span className="text-xs text-slate-500 ml-2">— IAM control requirements per application risk tier</span>
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
                  <span className="ml-auto text-xs text-slate-600">Required</span>
                </div>
              ))}
            </div>
          </div>

          {/* Installed Modules */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers size={15} className="text-indigo-400" />
              <span className="text-sm font-semibold text-slate-200">Installed Modules</span>
              <span className="text-xs text-slate-500">— {modules.filter(m => m.status === 'healthy').length}/{modules.length} healthy</span>
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
