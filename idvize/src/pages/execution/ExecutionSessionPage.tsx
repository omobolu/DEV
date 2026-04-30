/**
 * Execution Session Detail — Full lifecycle view for a single execution session.
 *
 * Shows: plan review, approval workflow, credential handoff, execution progress,
 * and evidence trail. Users can approve/reject plans, submit credentials,
 * trigger execution, and cancel sessions from this page.
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Clock, CheckCircle2, XCircle,
  AlertTriangle, PlayCircle, PauseCircle, Loader2, ShieldCheck,
  Layers, Lock, Eye, FileText, Send, X,
  ChevronDown, ChevronRight, Timer, AlertCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

// ── Types (matches backend response) ─────────────────────────────────────────

interface ExecutionStep {
  stepId: string
  order: number
  actionType: string
  targetSystem: { systemType: string; systemName: string; operations: string[] }
  description: string
  status: string
  requiresCredential: boolean
  credentialHandle?: string
  result?: { success: boolean; output: Record<string, unknown>; errorMessage?: string; evidenceIds: string[] }
  startedAt?: string
  completedAt?: string
}

interface BlastRadius {
  level: string
  affectedUsers: number
  affectedSystems: number
  reversible: boolean
  justification: string
}

interface ExecutionPlan {
  planId: string
  applicationId: string
  applicationName: string
  controlId: string
  controlName: string
  summary: string
  systemsTouched: { systemType: string; systemName: string; operations: string[] }[]
  blastRadius: BlastRadius
  steps: ExecutionStep[]
  prerequisites: { prerequisiteId: string; type: string; description: string; status: string }[]
  estimatedDuration: string
  rollbackSteps: ExecutionStep[]
}

interface Approval {
  approvalId: string
  sessionId: string
  role: string
  approverId?: string
  approverName?: string
  status: string
  requiredBy: string
  comment?: string
  createdAt: string
  resolvedAt?: string
}

interface EvidenceRecord {
  evidenceId: string
  sessionId: string
  stepId?: string
  type: string
  title: string
  description: string
  data: Record<string, unknown>
  createdAt: string
}

interface ExecutionSession {
  sessionId: string
  tenantId: string
  agentType: string
  status: string
  plan?: ExecutionPlan
  approvals: Approval[]
  evidence: EvidenceRecord[]
  credentialHandles: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  errorMessage?: string
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

const STEP_STATUS: Record<string, { color: string; icon: React.ElementType }> = {
  pending:      { color: '#64748b', icon: Clock },
  in_progress:  { color: '#3b82f6', icon: Loader2 },
  succeeded:    { color: '#22c55e', icon: CheckCircle2 },
  failed:       { color: '#ef4444', icon: XCircle },
  skipped:      { color: '#64748b', icon: X },
  rolled_back:  { color: '#f97316', icon: AlertTriangle },
}

const AGENT_LABELS: Record<string, string> = {
  sso: 'SSO Configuration Agent',
  mfa: 'MFA Enforcement Agent',
  lifecycle: 'Lifecycle Provisioning Agent',
  'access-review': 'Access Review Agent',
  pam: 'Privileged Access Agent',
}

const BLAST_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ExecutionSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<ExecutionSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'plan' | 'approvals' | 'execution' | 'evidence'>('plan')

  const fetchSession = useCallback(async () => {
    if (!sessionId) return
    try {
      const res = await apiFetch(`/agent-execution/sessions/${sessionId}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSession(json.data)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { fetchSession() }, [fetchSession])

  // Auto-refresh for active sessions
  useEffect(() => {
    if (!session) return
    const active = ['planning', 'pending_approval', 'executing', 'paused'].includes(session.status)
    if (!active) return
    const interval = setInterval(fetchSession, 5000)
    return () => clearInterval(interval)
  }, [session?.status, fetchSession])

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleApprove = useCallback(async (approvalId: string, decision: 'approved' | 'rejected', comment?: string) => {
    if (!sessionId) return
    setActionLoading(`approve-${approvalId}`)
    try {
      const res = await apiFetch(`/agent-execution/sessions/${sessionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvalId, decision, comment }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSession(json.data)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setActionLoading(null)
    }
  }, [sessionId])

  const handleExecute = useCallback(async () => {
    if (!sessionId) return
    setActionLoading('execute')
    try {
      const res = await apiFetch(`/agent-execution/sessions/${sessionId}/execute`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSession(json.data)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setActionLoading(null)
    }
  }, [sessionId])

  const handleCancel = useCallback(async () => {
    if (!sessionId) return
    if (!confirm('Cancel this execution session? This cannot be undone.')) return
    setActionLoading('cancel')
    try {
      const res = await apiFetch(`/agent-execution/sessions/${sessionId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'User cancelled from UI' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSession(json.data)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setActionLoading(null)
    }
  }, [sessionId])

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-blue-400" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/execution')} className="flex items-center gap-1.5 text-xs text-muted hover:text-body transition-colors">
          <ArrowLeft size={14} /> Back to Sessions
        </button>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-a-red/10 border border-a-red/30">
          <AlertTriangle size={16} className="text-a-red flex-shrink-0" />
          <p className="text-sm text-a-red font-medium">{error ?? 'Session not found'}</p>
        </div>
      </div>
    )
  }

  const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.planning
  const StatusIcon = cfg.icon
  const canExecute = session.status === 'approved'
  const canCancel = ['planning', 'pending_approval', 'approved', 'paused'].includes(session.status)

  return (
    <div className="space-y-5">
      {/* Back + Refresh */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/execution')} className="flex items-center gap-1.5 text-xs text-muted hover:text-body transition-colors">
          <ArrowLeft size={14} /> Back to Sessions
        </button>
        <button onClick={fetchSession} className="flex items-center gap-1.5 text-xs text-muted hover:text-body transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Session Header */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.color}40` }}>
            <StatusIcon size={22} style={{ color: cfg.color }} className={session.status === 'executing' ? 'animate-spin' : ''} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </span>
              <span className="text-[10px] text-muted font-mono">{session.sessionId}</span>
            </div>
            <h1 className="text-lg font-bold text-heading">
              {AGENT_LABELS[session.agentType] ?? session.agentType}
            </h1>
            {session.plan && (
              <p className="text-sm text-muted mt-0.5">
                {session.plan.applicationName} — {session.plan.controlId} {session.plan.controlName}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted">
              <span>Created {fmtDateTime(session.createdAt)}</span>
              <span>Updated {relativeTime(session.updatedAt)}</span>
              {session.completedAt && <span>Completed {fmtDateTime(session.completedAt)}</span>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canExecute && (
              <button
                onClick={handleExecute}
                disabled={actionLoading === 'execute'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading === 'execute' ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
                Execute Plan
              </button>
            )}
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={actionLoading === 'cancel'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted hover:text-red-400 bg-surface-700 border border-surface-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading === 'cancel' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
        {session.errorMessage && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-a-red/10 border border-a-red/30">
            <AlertCircle size={14} className="text-a-red flex-shrink-0 mt-0.5" />
            <p className="text-xs text-a-red font-medium">{session.errorMessage}</p>
          </div>
        )}

        {/* Simulation notice */}
        {session.status === 'completed_simulation' && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-cyan-900/15 border border-cyan-800/40">
            <AlertTriangle size={14} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-cyan-300">
              This session completed in <strong>simulation mode</strong>. No external systems were modified.
              Tool adapters returned simulated results. Phase 2 will enable real API integrations.
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-surface-700 pb-px">
        {(['plan', 'approvals', 'execution', 'evidence'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-muted hover:text-body'
            }`}
          >
            {tab === 'approvals' && session.approvals.some(a => a.status === 'pending') && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 mr-1.5" />
            )}
            {tab}
            {tab === 'approvals' && ` (${session.approvals.length})`}
            {tab === 'execution' && session.plan && ` (${session.plan.steps.length})`}
            {tab === 'evidence' && ` (${session.evidence.length})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'plan' && session.plan && <PlanTab plan={session.plan} />}
      {activeTab === 'plan' && !session.plan && (
        <div className="text-center py-12 text-muted text-sm">Plan is still being generated…</div>
      )}
      {activeTab === 'approvals' && (
        <ApprovalsTab
          approvals={session.approvals}
          sessionStatus={session.status}
          onApprove={handleApprove}
          actionLoading={actionLoading}
        />
      )}
      {activeTab === 'execution' && session.plan && (
        <ExecutionTab steps={session.plan.steps} rollbackSteps={session.plan.rollbackSteps} sessionStatus={session.status} />
      )}
      {activeTab === 'evidence' && <EvidenceTab evidence={session.evidence} />}
    </div>
  )
}

// ── Plan Tab ─────────────────────────────────────────────────────────────────

function PlanTab({ plan }: { plan: ExecutionPlan }) {
  const blastColor = BLAST_COLORS[plan.blastRadius.level] ?? '#64748b'

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-heading mb-2">Plan Summary</h3>
        <p className="text-xs text-body leading-relaxed">{plan.summary}</p>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted">
          <span>{plan.steps.length} execution steps</span>
          <span>{plan.rollbackSteps.length} rollback steps</span>
          <span>Est. duration: {plan.estimatedDuration}</span>
        </div>
      </div>

      {/* Blast Radius */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-heading mb-2 flex items-center gap-2">
          <AlertTriangle size={14} style={{ color: blastColor }} />
          Blast Radius Assessment
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-muted uppercase">Level</p>
            <p className="text-sm font-bold uppercase" style={{ color: blastColor }}>{plan.blastRadius.level}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted uppercase">Affected Users</p>
            <p className="text-sm font-bold text-heading">{plan.blastRadius.affectedUsers.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted uppercase">Systems</p>
            <p className="text-sm font-bold text-heading">{plan.blastRadius.affectedSystems}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted uppercase">Reversible</p>
            <p className="text-sm font-bold" style={{ color: plan.blastRadius.reversible ? '#22c55e' : '#ef4444' }}>
              {plan.blastRadius.reversible ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted">{plan.blastRadius.justification}</p>
      </div>

      {/* Systems Touched */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-heading mb-2 flex items-center gap-2">
          <Layers size={14} className="text-blue-400" />
          Systems Touched
        </h3>
        <div className="space-y-2">
          {plan.systemsTouched.map((sys, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="px-1.5 py-0.5 rounded bg-surface-700 text-muted font-mono text-[10px] flex-shrink-0">{sys.systemType}</span>
              <div>
                <p className="text-body font-medium">{sys.systemName}</p>
                <p className="text-muted">{sys.operations.join(', ')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prerequisites */}
      {plan.prerequisites.length > 0 && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-heading mb-2 flex items-center gap-2">
            <Lock size={14} className="text-a-amber" />
            Prerequisites
          </h3>
          <div className="space-y-2">
            {plan.prerequisites.map(pr => (
              <div key={pr.prerequisiteId} className="flex items-start gap-2 text-xs">
                {pr.status === 'fulfilled' ? (
                  <CheckCircle2 size={14} className="text-a-green flex-shrink-0 mt-0.5" />
                ) : (
                  <Clock size={14} className="text-a-amber flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-body">{pr.description}</p>
                  <p className="text-muted mt-0.5">{pr.type.replace(/_/g, ' ')} — {pr.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution Steps Preview */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-heading mb-2">Execution Steps</h3>
        <div className="space-y-1.5">
          {plan.steps.map(step => (
            <StepRow key={step.stepId} step={step} compact />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Approvals Tab ────────────────────────────────────────────────────────────

function ApprovalsTab({ approvals, sessionStatus, onApprove, actionLoading }: {
  approvals: Approval[]
  sessionStatus: string
  onApprove: (approvalId: string, decision: 'approved' | 'rejected', comment?: string) => void
  actionLoading: string | null
}) {
  const [rejectComment, setRejectComment] = useState<Record<string, string>>({})
  const canApprove = sessionStatus === 'pending_approval'

  const ROLE_LABELS: Record<string, string> = {
    app_owner: 'Application Owner',
    iam_admin: 'IAM Administrator',
    platform_admin: 'Platform Administrator',
    security_admin: 'Security Administrator',
  }

  const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
    pending: { color: '#eab308', bg: '#eab30815' },
    approved: { color: '#22c55e', bg: '#22c55e15' },
    rejected: { color: '#ef4444', bg: '#ef444415' },
    expired: { color: '#f97316', bg: '#f9731615' },
  }

  return (
    <div className="space-y-3">
      {approvals.length === 0 ? (
        <div className="text-center py-12 text-muted text-sm">No approvals required for this session.</div>
      ) : (
        approvals.map(approval => {
          const sc = STATUS_COLORS[approval.status] ?? STATUS_COLORS.pending
          const isLoading = actionLoading === `approve-${approval.approvalId}`

          return (
            <div key={approval.approvalId} className="bg-surface-800 border border-surface-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: sc.bg, border: `1px solid ${sc.color}40` }}>
                    <ShieldCheck size={16} style={{ color: sc.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-heading">
                      {ROLE_LABELS[approval.role] ?? approval.role}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
                        style={{ backgroundColor: sc.bg, color: sc.color }}>
                        {approval.status}
                      </span>
                      <span className="text-[10px] text-muted">Required by {fmtDateTime(approval.requiredBy)}</span>
                    </div>
                    {approval.approverName && (
                      <p className="text-xs text-muted mt-1">
                        {approval.status === 'approved' ? 'Approved' : 'Resolved'} by {approval.approverName}
                        {approval.resolvedAt && ` — ${fmtDateTime(approval.resolvedAt)}`}
                      </p>
                    )}
                    {approval.comment && (
                      <p className="text-xs text-body mt-1 italic">"{approval.comment}"</p>
                    )}
                  </div>
                </div>

                {/* Approve/Reject buttons */}
                {canApprove && approval.status === 'pending' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onApprove(approval.approvalId, 'approved')}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-a-green/15 text-a-green border border-a-green/40 rounded-lg hover:bg-a-green/25 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const comment = rejectComment[approval.approvalId]
                        if (!comment) {
                          setRejectComment(prev => ({ ...prev, [approval.approvalId]: ' ' }))
                          return
                        }
                        onApprove(approval.approvalId, 'rejected', comment.trim() || undefined)
                      }}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-a-red border border-a-red/40 rounded-lg hover:bg-a-red/15 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={12} />
                      Reject
                    </button>
                  </div>
                )}
              </div>

              {/* Reject comment input */}
              {rejectComment[approval.approvalId] !== undefined && approval.status === 'pending' && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Reason for rejection (optional)"
                    value={rejectComment[approval.approvalId]}
                    onChange={e => setRejectComment(prev => ({ ...prev, [approval.approvalId]: e.target.value }))}
                    className="flex-1 px-3 py-1.5 text-xs bg-surface-900 border border-surface-600 rounded-lg text-body focus:border-red-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => onApprove(approval.approvalId, 'rejected', rejectComment[approval.approvalId]?.trim() || undefined)}
                    className="px-3 py-1.5 text-xs font-semibold bg-a-red/15 text-a-red border border-a-red/40 rounded-lg hover:bg-a-red/25"
                  >
                    <Send size={12} />
                  </button>
                  <button
                    onClick={() => setRejectComment(prev => { const n = { ...prev }; delete n[approval.approvalId]; return n })}
                    className="px-2 py-1.5 text-xs text-muted hover:text-body"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Execution Tab ────────────────────────────────────────────────────────────

function ExecutionTab({ steps, rollbackSteps, sessionStatus }: {
  steps: ExecutionStep[]
  rollbackSteps: ExecutionStep[]
  sessionStatus: string
}) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const isActive = ['executing', 'paused'].includes(sessionStatus)

  return (
    <div className="space-y-4">
      {isActive && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-a-cyan/10 border border-a-cyan/30 text-xs text-a-cyan font-medium">
          <Loader2 size={14} className="animate-spin" />
          Execution in progress — this page auto-refreshes every 5 seconds.
        </div>
      )}

      <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-heading mb-3">Execution Steps</h3>
        <div className="space-y-1">
          {steps.map(step => (
            <StepRow
              key={step.stepId}
              step={step}
              expanded={expandedStep === step.stepId}
              onToggle={() => setExpandedStep(prev => prev === step.stepId ? null : step.stepId)}
            />
          ))}
        </div>
      </div>

      {rollbackSteps.length > 0 && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-heading mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-a-amber" />
            Rollback Steps
          </h3>
          <div className="space-y-1">
            {rollbackSteps.map(step => (
              <StepRow key={step.stepId} step={step} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step Row ─────────────────────────────────────────────────────────────────

function StepRow({ step, compact, expanded, onToggle }: {
  step: ExecutionStep
  compact?: boolean
  expanded?: boolean
  onToggle?: () => void
}) {
  const sc = STEP_STATUS[step.status] ?? STEP_STATUS.pending
  const Icon = sc.icon

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        disabled={compact}
        className={`w-full text-left flex items-start gap-2.5 py-2 px-2 rounded-lg transition-colors ${
          compact ? 'cursor-default' : 'hover:bg-surface-700/50'
        }`}
      >
        <span className="text-[10px] text-muted font-mono w-4 text-right flex-shrink-0 mt-0.5">{step.order}</span>
        <Icon size={14} style={{ color: sc.color }} className={`flex-shrink-0 mt-0.5 ${step.status === 'in_progress' ? 'animate-spin' : ''}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-body">{step.description}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted">
            <span className="font-mono">{step.targetSystem.systemName}</span>
            <span className="font-mono opacity-60">{step.actionType}</span>
            {step.requiresCredential && (
              <span className="flex items-center gap-0.5 text-a-amber font-semibold">
                <Lock size={9} /> credential required
              </span>
            )}
          </div>
        </div>
        {!compact && (
          expanded ? <ChevronDown size={14} className="text-muted flex-shrink-0 mt-1" /> : <ChevronRight size={14} className="text-muted flex-shrink-0 mt-1" />
        )}
      </button>

      {expanded && step.result && (
        <div className="ml-8 mb-2 p-3 rounded-lg bg-surface-900 border border-surface-700 text-xs">
          <div className="flex items-center gap-2 mb-2">
            {step.result.success ? (
              <span className="text-a-green font-semibold">Succeeded</span>
            ) : (
              <span className="text-a-red font-semibold">Failed</span>
            )}
            {step.startedAt && <span className="text-muted">{fmtDateTime(step.startedAt)}</span>}
            {step.completedAt && <span className="text-muted">→ {fmtDateTime(step.completedAt)}</span>}
          </div>
          {step.result.errorMessage && (
            <p className="text-a-red font-medium mb-2">{step.result.errorMessage}</p>
          )}
          {Object.keys(step.result.output).length > 0 && (
            <pre className="text-[10px] text-muted font-mono bg-surface-950 rounded p-2 overflow-x-auto max-h-40">
              {JSON.stringify(step.result.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── Evidence Tab ─────────────────────────────────────────────────────────────

function EvidenceTab({ evidence }: { evidence: EvidenceRecord[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const TYPE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
    screenshot: { icon: Eye, color: '#3b82f6' },
    api_response: { icon: FileText, color: '#22c55e' },
    configuration_snapshot: { icon: Layers, color: '#06b6d4' },
    test_result: { icon: CheckCircle2, color: '#eab308' },
    approval_record: { icon: ShieldCheck, color: '#a855f7' },
    error_log: { icon: AlertCircle, color: '#ef4444' },
  }

  if (evidence.length === 0) {
    return <div className="text-center py-12 text-muted text-sm">No evidence collected yet.</div>
  }

  return (
    <div className="space-y-2">
      {evidence.map(ev => {
        const typeInfo = TYPE_ICONS[ev.type] ?? { icon: FileText, color: '#64748b' }
        const TypeIcon = typeInfo.icon
        const isOpen = expanded === ev.evidenceId

        return (
          <div key={ev.evidenceId} className="bg-surface-800 border border-surface-700 rounded-xl">
            <button
              type="button"
              onClick={() => setExpanded(prev => prev === ev.evidenceId ? null : ev.evidenceId)}
              className="w-full text-left flex items-start gap-3 p-4"
            >
              <TypeIcon size={16} style={{ color: typeInfo.color }} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-heading">{ev.title}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted">
                  <span className="px-1.5 py-0.5 rounded bg-surface-700 font-mono">{ev.type.replace(/_/g, ' ')}</span>
                  <span>{fmtDateTime(ev.createdAt)}</span>
                  {ev.stepId && <span className="font-mono">step: {ev.stepId.slice(0, 12)}</span>}
                </div>
              </div>
              {isOpen ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-0">
                {ev.description && <p className="text-xs text-body mb-2">{ev.description}</p>}
                <pre className="text-[10px] text-muted font-mono bg-surface-900 border border-surface-700 rounded p-3 overflow-x-auto max-h-60">
                  {JSON.stringify(ev.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
