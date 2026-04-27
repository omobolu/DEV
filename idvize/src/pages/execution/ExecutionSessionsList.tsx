/**
 * Execution Sessions List — Dashboard of all agent execution sessions.
 *
 * Shows sessions with status, agent type, plan summary, approval progress,
 * and links to individual session detail views.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot, RefreshCw, Filter, Search, Clock, CheckCircle2,
  XCircle, AlertTriangle, PlayCircle, PauseCircle, Loader2,
  ArrowRight, ShieldCheck, Timer,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

// ── Types ────────────────────────────────────────────────────────────────────

interface SessionSummary {
  sessionId: string
  tenantId: string
  agentType: string
  status: string
  planSummary: {
    planId: string
    applicationId: string
    applicationName: string
    controlId: string
    controlName: string
    summary: string
    stepsCount: number
    blastRadius: { level: string; affectedUsers: number; reversible: boolean }
  } | null
  approvalsCount: number
  approvalsPending: number
  evidenceCount: number
  createdBy: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  errorMessage: string | null
}

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  planning:             { label: 'Planning',          color: '#64748b', bg: '#64748b15', icon: Loader2 },
  pending_approval:     { label: 'Pending Approval',  color: '#eab308', bg: '#eab30815', icon: Clock },
  approved:             { label: 'Approved',           color: '#22c55e', bg: '#22c55e15', icon: ShieldCheck },
  executing:            { label: 'Executing',          color: '#3b82f6', bg: '#3b82f615', icon: PlayCircle },
  paused:               { label: 'Paused',             color: '#f97316', bg: '#f9731615', icon: PauseCircle },
  completed:            { label: 'Completed',          color: '#22c55e', bg: '#22c55e15', icon: CheckCircle2 },
  completed_simulation: { label: 'Simulated',          color: '#06b6d4', bg: '#06b6d415', icon: CheckCircle2 },
  failed:               { label: 'Failed',             color: '#ef4444', bg: '#ef444415', icon: XCircle },
  cancelled:            { label: 'Cancelled',          color: '#64748b', bg: '#64748b15', icon: XCircle },
  expired:              { label: 'Expired',            color: '#f97316', bg: '#f9731615', icon: Timer },
}

const AGENT_LABELS: Record<string, string> = {
  sso: 'SSO Configuration',
  mfa: 'MFA Enforcement',
  lifecycle: 'Lifecycle Provisioning',
  'access-review': 'Access Review',
  pam: 'Privileged Access',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ExecutionSessionsList() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchSessions = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/agent-execution/sessions')
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSessions(json.data ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  // Filtered + searched
  const filtered = sessions.filter(s => {
    if (filter !== 'all' && s.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      const name = s.planSummary?.applicationName?.toLowerCase() ?? ''
      const control = s.planSummary?.controlName?.toLowerCase() ?? ''
      const agent = (AGENT_LABELS[s.agentType] ?? s.agentType).toLowerCase()
      if (!name.includes(q) && !control.includes(q) && !agent.includes(q) && !s.sessionId.includes(q)) {
        return false
      }
    }
    return true
  })

  // Status counts for filter chips
  const counts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  const filterOptions = [
    { key: 'all', label: 'All', count: sessions.length },
    { key: 'pending_approval', label: 'Pending', count: counts.pending_approval ?? 0 },
    { key: 'approved', label: 'Approved', count: counts.approved ?? 0 },
    { key: 'executing', label: 'Executing', count: counts.executing ?? 0 },
    { key: 'completed_simulation', label: 'Simulated', count: counts.completed_simulation ?? 0 },
    { key: 'completed', label: 'Completed', count: counts.completed ?? 0 },
    { key: 'failed', label: 'Failed', count: counts.failed ?? 0 },
    { key: 'cancelled', label: 'Cancelled', count: counts.cancelled ?? 0 },
  ].filter(f => f.key === 'all' || f.count > 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
            <Bot size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-heading">Agent Execution</h1>
            <p className="text-xs text-muted">Controlled execution sessions with human approval gates</p>
          </div>
        </div>
        <button
          onClick={() => fetchSessions(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-body bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile label="Total Sessions" value={sessions.length} color="#3b82f6" />
        <KpiTile label="Pending Approval" value={counts.pending_approval ?? 0} color="#eab308" />
        <KpiTile label="Completed" value={(counts.completed ?? 0) + (counts.completed_simulation ?? 0)} color="#22c55e" />
        <KpiTile label="Failed" value={counts.failed ?? 0} color="#ef4444" />
      </div>

      {/* Filter + Search */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={13} className="text-muted" />
          {filterOptions.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                filter === f.key
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                  : 'bg-surface-800 text-muted border-surface-700 hover:text-body'
              }`}
            >
              {f.label} <span className="opacity-60 ml-0.5">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search sessions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-7 pr-3 py-1.5 text-xs bg-surface-900 border border-surface-600 rounded-lg text-body placeholder:text-muted focus:border-indigo-500 focus:outline-none w-56"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-900/15 border border-red-800/40">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bot size={32} className="mx-auto text-surface-600 mb-3" />
          <p className="text-sm text-muted">
            {sessions.length === 0
              ? 'No execution sessions yet. Launch an agent from the Control Detail View to create one.'
              : 'No sessions match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(session => (
            <SessionCard
              key={session.sessionId}
              session={session}
              onClick={() => navigate(`/execution/${session.sessionId}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function SessionCard({ session, onClick }: { session: SessionSummary; onClick: () => void }) {
  const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.planning
  const StatusIcon = cfg.icon

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface-800 border border-surface-700 rounded-xl p-4 hover:border-surface-600 transition-colors group"
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.color}40` }}
        >
          <StatusIcon size={16} style={{ color: cfg.color }} className={session.status === 'executing' ? 'animate-spin' : ''} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </span>
            <span className="text-[10px] text-muted font-mono">{session.sessionId.slice(0, 20)}…</span>
          </div>

          {session.planSummary ? (
            <>
              <p className="text-sm font-semibold text-heading truncate">
                {AGENT_LABELS[session.agentType] ?? session.agentType} — {session.planSummary.applicationName}
              </p>
              <p className="text-xs text-muted mt-0.5 truncate">
                {session.planSummary.controlId} {session.planSummary.controlName} · {session.planSummary.stepsCount} steps
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-heading">
              {AGENT_LABELS[session.agentType] ?? session.agentType}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-4 mt-2 text-[10px] text-muted">
            <span>Created {relativeTime(session.createdAt)}</span>
            {session.approvalsCount > 0 && (
              <span className="flex items-center gap-1">
                <ShieldCheck size={10} />
                {session.approvalsCount - session.approvalsPending}/{session.approvalsCount} approved
              </span>
            )}
            {session.evidenceCount > 0 && (
              <span>{session.evidenceCount} evidence</span>
            )}
            {session.planSummary?.blastRadius && (
              <span
                className="uppercase font-semibold"
                style={{ color: session.planSummary.blastRadius.level === 'high' || session.planSummary.blastRadius.level === 'critical' ? '#ef4444' : '#eab308' }}
              >
                {session.planSummary.blastRadius.level} blast
              </span>
            )}
          </div>

          {session.errorMessage && (
            <p className="text-[11px] text-red-400 mt-1.5 truncate">{session.errorMessage}</p>
          )}
        </div>

        {/* Arrow */}
        <ArrowRight size={16} className="text-surface-600 group-hover:text-body flex-shrink-0 mt-2 transition-colors" />
      </div>
    </button>
  )
}
