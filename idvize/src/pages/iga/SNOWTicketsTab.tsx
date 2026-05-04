import { useState, useEffect, useCallback } from 'react'
import {
  Ticket, ArrowLeft, RefreshCw, CheckCircle, AlertTriangle,
  Info, Search, Shield, Database, Globe, UserCheck, Bot,
  Play, MessageSquare, ChevronRight, Loader2, Send, X,
  Clock, XCircle
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'
import Badge from '@/components/common/Badge'
import EmptyState from '@/components/common/EmptyState'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Finding {
  source: string
  type: string
  detail: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
}

interface Investigation {
  problem: string
  rootCause: string
  findings: Finding[]
  recommendedSolution: string
  confidence: number
}

interface PlannedAction {
  step: number
  system: string
  action: string
  detail: string
  risk: 'high' | 'medium' | 'low'
  status: 'pending' | 'running' | 'completed' | 'failed'
}

interface AgentPlan {
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed'
  actions: PlannedAction[]
}

interface ExecutionResult {
  step: number
  action: string
  status: 'success' | 'failure'
  output: string
  timestamp: string
}

interface SNOWTicket {
  id: string
  number: string
  shortDescription: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  state: string
  caller: string
  category: string
  createdAt: string
  updatedAt: string
  investigation?: Investigation
  agentPlan?: AgentPlan
  executionResults?: ExecutionResult[]
  feedback?: string
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const WORKFLOW_STEPS = [
  'new', 'accepted', 'investigating', 'solution_ready',
  'agent_planning', 'approved', 'executing', 'resolved', 'closed',
]

const WORKFLOW_LABELS: Record<string, string> = {
  new: 'New',
  accepted: 'Accepted',
  investigating: 'Investigating',
  solution_ready: 'Solution Ready',
  agent_planning: 'Agent Planning',
  approved: 'Approved',
  executing: 'Executing',
  resolved: 'Resolved',
  closed: 'Closed',
}

const PRIORITY_CONFIG: Record<string, { class: string; variant: 'danger' | 'warning' | 'neutral' }> = {
  critical: { class: 'text-a-red', variant: 'danger' },
  high:     { class: 'text-a-orange', variant: 'warning' },
  medium:   { class: 'text-a-amber', variant: 'warning' },
  low:      { class: 'text-muted', variant: 'neutral' },
}

const STATE_CONFIG: Record<string, { variant: 'info' | 'success' | 'warning' | 'danger' | 'neutral' }> = {
  new:             { variant: 'info' },
  accepted:        { variant: 'info' },
  investigating:   { variant: 'warning' },
  solution_ready:  { variant: 'success' },
  agent_planning:  { variant: 'info' },
  approved:        { variant: 'success' },
  executing:       { variant: 'info' },
  resolved:        { variant: 'success' },
  closed:          { variant: 'neutral' },
}

const SEVERITY_VARIANT: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'info',
  info: 'neutral',
}

const SOURCE_ICONS: Record<string, typeof Shield> = {
  security: Shield,
  database: Database,
  network: Globe,
  identity: UserCheck,
  default: Info,
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function stateIndex(state: string): number {
  return WORKFLOW_STEPS.indexOf(state)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function riskVariant(risk: string): 'danger' | 'warning' | 'success' {
  if (risk === 'high') return 'danger'
  if (risk === 'medium') return 'warning'
  return 'success'
}

function actionStatusVariant(status: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'info'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function WorkflowProgress({ currentState }: { currentState: string }) {
  const current = stateIndex(currentState)
  return (
    <div className="bg-surface-900 border border-surface-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-heading mb-4">Workflow Progress</h3>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {WORKFLOW_STEPS.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <div key={step} className="flex items-center shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                    ${done ? 'bg-indigo-600 border-indigo-500 text-white' : ''}
                    ${active ? 'bg-indigo-500/20 border-indigo-400 text-a-indigo ring-2 ring-indigo-500/30' : ''}
                    ${!done && !active ? 'bg-surface-800 border-surface-600 text-faint' : ''}`}
                >
                  {done ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className={`text-[10px] whitespace-nowrap ${active ? 'text-a-indigo font-semibold' : done ? 'text-body' : 'text-faint'}`}>
                  {WORKFLOW_LABELS[step]}
                </span>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className={`w-6 h-0.5 mx-0.5 mt-[-14px] ${i < current ? 'bg-indigo-500' : 'bg-surface-700'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InvestigationSection({ investigation }: { investigation: Investigation }) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-heading flex items-center gap-2">
        <Search size={16} className="text-a-indigo" aria-hidden="true" />
        Investigation Results
      </h3>

      {/* Problem */}
      <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-a-red mb-1 flex items-center gap-1.5">
          <AlertTriangle size={14} aria-hidden="true" /> Problem Identified
        </h4>
        <p className="text-sm text-body">{investigation.problem}</p>
      </div>

      {/* Root Cause */}
      <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-a-amber mb-1 flex items-center gap-1.5">
          <Info size={14} aria-hidden="true" /> Root Cause
        </h4>
        <p className="text-sm text-body">{investigation.rootCause}</p>
      </div>

      {/* Findings */}
      {investigation.findings.length > 0 && (
        <div className="bg-surface-900 border border-surface-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-heading mb-3">Findings ({investigation.findings.length})</h4>
          <div className="space-y-2">
            {investigation.findings.map((f, i) => {
              const Icon = SOURCE_ICONS[f.source] || SOURCE_ICONS.default
              return (
                <div key={i} className="flex items-start gap-3 p-3 bg-surface-800 rounded-lg border border-surface-700">
                  <div className="mt-0.5 shrink-0">
                    <Icon size={16} className="text-muted" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-heading">{f.type}</span>
                      <Badge label={f.severity} variant={SEVERITY_VARIANT[f.severity] ?? 'neutral'} />
                    </div>
                    <p className="text-sm text-body">{f.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommended Solution */}
      <div className="bg-green-950/30 border border-green-900/50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-a-green mb-1 flex items-center gap-1.5">
          <CheckCircle size={14} aria-hidden="true" /> Recommended Solution
        </h4>
        <p className="text-sm text-body">{investigation.recommendedSolution}</p>
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Confidence:</span>
        <div className="flex-1 max-w-xs h-2 rounded-full bg-surface-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${investigation.confidence}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-heading">{investigation.confidence}%</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

export default function SNOWTicketsTab() {
  const [tickets, setTickets] = useState<SNOWTicket[]>([])
  const [selected, setSelected] = useState<SNOWTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [instructions, setInstructions] = useState('')
  const [feedbackText, setFeedbackText] = useState('')

  /* ---- Fetch ticket list ---- */
  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/iga/snow/tickets')
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load tickets')
      setTickets(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  /* ---- Fetch single ticket detail ---- */
  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await apiFetch(`/iga/snow/tickets/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load ticket')
      setSelected(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket detail')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  /* ---- Actions ---- */
  const doAction = useCallback(async (
    endpoint: string,
    body?: Record<string, unknown>,
    actionName?: string,
  ) => {
    if (!selected) return
    setActionLoading(actionName ?? endpoint)
    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Action failed')
      // Refresh detail
      await fetchDetail(selected.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }, [selected, fetchDetail])

  const acceptTicket = () => doAction(`/iga/snow/tickets/${selected!.id}/accept`, undefined, 'accept')
  const runInvestigation = () => doAction(`/iga/snow/tickets/${selected!.id}/investigate`, undefined, 'investigate')
  const generatePlan = () => doAction(`/iga/snow/tickets/${selected!.id}/agent/plan`, { instructions }, 'plan')
  const approveAndExecute = async () => {
    await doAction(`/iga/snow/tickets/${selected!.id}/agent/approve`, undefined, 'approve')
    await doAction(`/iga/snow/tickets/${selected!.id}/agent/execute`, undefined, 'execute')
  }
  const submitFeedback = () => doAction(`/iga/snow/tickets/${selected!.id}/feedback`, { feedback: feedbackText }, 'feedback')

  const goBack = () => {
    setSelected(null)
    setError(null)
    setInstructions('')
    setFeedbackText('')
    fetchTickets()
  }

  const selectTicket = (t: SNOWTicket) => {
    setError(null)
    setInstructions('')
    setFeedbackText('')
    setSelected(t)
    fetchDetail(t.id)
  }

  /* ================================================================ */
  /*  RENDER — Error banner                                           */
  /* ================================================================ */

  const errorBanner = error && (
    <div className="flex items-center gap-2 bg-red-950/40 border border-red-900/60 text-a-red rounded-lg px-4 py-2 text-sm">
      <AlertTriangle size={16} aria-hidden="true" />
      <span className="flex-1">{error}</span>
      <button onClick={() => setError(null)} className="hover:text-white" aria-label="Dismiss error">
        <X size={14} />
      </button>
    </div>
  )

  /* ================================================================ */
  /*  RENDER — Loading                                                */
  /* ================================================================ */

  if (loading && !selected) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-a-indigo" aria-label="Loading tickets" />
      </div>
    )
  }

  /* ================================================================ */
  /*  RENDER — Detail View                                            */
  /* ================================================================ */

  if (selected) {
    const si = stateIndex(selected.state)
    const priorityCfg = PRIORITY_CONFIG[selected.priority] ?? PRIORITY_CONFIG.low
    const stateCfg = STATE_CONFIG[selected.state] ?? STATE_CONFIG.new

    return (
      <div className="space-y-5">
        {errorBanner}

        {/* Back button */}
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors"
          aria-label="Back to ticket list"
        >
          <ArrowLeft size={16} /> Back to Tickets
        </button>

        {detailLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-a-indigo" aria-label="Loading detail" />
          </div>
        )}

        {!detailLoading && (
          <>
            {/* Header */}
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex items-center gap-2">
                  <Ticket size={20} className="text-a-indigo" aria-hidden="true" />
                  <span className="text-lg font-bold text-heading">{selected.number}</span>
                </div>
                <Badge label={selected.priority.toUpperCase()} variant={priorityCfg.variant} />
                <Badge label={WORKFLOW_LABELS[selected.state] ?? selected.state} variant={stateCfg.variant} />
              </div>
              <h2 className="text-base font-semibold text-heading mt-3">{selected.shortDescription}</h2>
              <p className="text-sm text-body mt-2">{selected.description}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-xs text-muted">
                <span><strong className="text-body">Caller:</strong> {selected.caller}</span>
                <span><strong className="text-body">Category:</strong> {selected.category}</span>
                <span><strong className="text-body">Created:</strong> {formatDate(selected.createdAt)}</span>
                <span><strong className="text-body">Updated:</strong> {formatDate(selected.updatedAt)}</span>
              </div>
            </div>

            {/* Workflow progress */}
            <WorkflowProgress currentState={selected.state} />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {selected.state === 'new' && (
                <button
                  onClick={acceptTicket}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'accept' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Accept Ticket
                </button>
              )}
              {selected.state === 'accepted' && (
                <button
                  onClick={runInvestigation}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'investigate' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Run Investigation
                </button>
              )}
            </div>

            {/* Investigation Results */}
            {si >= stateIndex('investigating') && selected.investigation && (
              <InvestigationSection investigation={selected.investigation} />
            )}

            {/* Agent Instructions & Plan */}
            {si >= stateIndex('solution_ready') && (
              <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-4">
                <h3 className="text-base font-semibold text-heading flex items-center gap-2">
                  <Bot size={16} className="text-a-purple" aria-hidden="true" />
                  Agent Instructions
                </h3>
                <div>
                  <label htmlFor="agent-instructions" className="text-xs text-muted block mb-1">
                    Provide instructions for the remediation agent (Markdown supported)
                  </label>
                  <textarea
                    id="agent-instructions"
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    rows={4}
                    placeholder="Describe the steps the agent should take..."
                    className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-body placeholder:text-faint focus:outline-none focus:border-indigo-500 resize-y"
                  />
                </div>
                <button
                  onClick={generatePlan}
                  disabled={!instructions.trim() || !!actionLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'plan' ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  Generate Plan
                </button>

                {/* Plan table */}
                {selected.agentPlan && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-heading">
                        Planned Actions
                        <Badge label={selected.agentPlan.status} variant={selected.agentPlan.status === 'draft' ? 'warning' : 'info'} />
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-surface-700 text-left">
                            <th className="px-3 py-2 text-xs font-semibold text-muted">#</th>
                            <th className="px-3 py-2 text-xs font-semibold text-muted">System</th>
                            <th className="px-3 py-2 text-xs font-semibold text-muted">Action</th>
                            <th className="px-3 py-2 text-xs font-semibold text-muted">Detail</th>
                            <th className="px-3 py-2 text-xs font-semibold text-muted">Risk</th>
                            <th className="px-3 py-2 text-xs font-semibold text-muted">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.agentPlan.actions.map(a => (
                            <tr key={a.step} className="border-b border-surface-700/50 hover:bg-surface-900/50">
                              <td className="px-3 py-2 text-body font-mono">{a.step}</td>
                              <td className="px-3 py-2 text-body">{a.system}</td>
                              <td className="px-3 py-2 text-heading font-medium">{a.action}</td>
                              <td className="px-3 py-2 text-body max-w-xs truncate">{a.detail}</td>
                              <td className="px-3 py-2"><Badge label={a.risk} variant={riskVariant(a.risk)} /></td>
                              <td className="px-3 py-2"><Badge label={a.status} variant={actionStatusVariant(a.status)} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {selected.agentPlan.status === 'draft' && (
                      <button
                        onClick={approveAndExecute}
                        disabled={!!actionLoading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {(actionLoading === 'approve' || actionLoading === 'execute')
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Play size={14} />}
                        Approve &amp; Execute
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Execution Results */}
            {si >= stateIndex('executing') && selected.executionResults && selected.executionResults.length > 0 && (
              <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-3">
                <h3 className="text-base font-semibold text-heading flex items-center gap-2">
                  <Play size={16} className="text-a-cyan" aria-hidden="true" />
                  Execution Results
                </h3>
                <div className="space-y-2">
                  {selected.executionResults.map((r, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-surface-900 rounded-lg border border-surface-700">
                      {r.status === 'success'
                        ? <CheckCircle size={16} className="text-a-green mt-0.5 shrink-0" aria-label="Success" />
                        : <XCircle size={16} className="text-a-red mt-0.5 shrink-0" aria-label="Failure" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-heading">Step {r.step}: {r.action}</span>
                          <span className="text-xs text-faint">{formatDateTime(r.timestamp)}</span>
                        </div>
                        <p className="text-sm text-body font-mono bg-surface-800 rounded px-2 py-1">{r.output}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback */}
            {selected.state === 'resolved' && (
              <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-3">
                <h3 className="text-base font-semibold text-heading flex items-center gap-2">
                  <MessageSquare size={16} className="text-a-green" aria-hidden="true" />
                  Resolution Feedback
                </h3>
                <textarea
                  id="feedback"
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  rows={3}
                  placeholder="Provide feedback on the resolution quality..."
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-body placeholder:text-faint focus:outline-none focus:border-indigo-500 resize-y"
                />
                <button
                  onClick={submitFeedback}
                  disabled={!feedbackText.trim() || !!actionLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'feedback' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Submit &amp; Close
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  /* ================================================================ */
  /*  RENDER — List View                                              */
  /* ================================================================ */

  return (
    <div className="space-y-4">
      {errorBanner}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-heading flex items-center gap-2">
          <Ticket size={18} className="text-a-indigo" aria-hidden="true" />
          ServiceNow Tickets
          <span className="text-sm font-normal text-muted">({tickets.length})</span>
        </h2>
        <button
          onClick={fetchTickets}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-sm text-muted hover:text-heading transition-colors disabled:opacity-50"
          aria-label="Refresh tickets"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Empty state */}
      {tickets.length === 0 && !loading && (
        <EmptyState
          icon={Ticket}
          title="No ServiceNow tickets yet"
          description="Tickets created from access reviews, certifications, or remediation actions will appear here."
        />
      )}

      {/* Ticket cards */}
      <div className="grid gap-3">
        {tickets.map(t => {
          const priorityCfg = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.low
          const stateCfg = STATE_CONFIG[t.state] ?? STATE_CONFIG.new
          return (
            <button
              key={t.id}
              onClick={() => selectTicket(t)}
              className="w-full text-left bg-surface-800 border border-surface-700 rounded-xl p-4 hover:border-indigo-500/50 hover:bg-surface-800/80 transition-all group"
              aria-label={`Ticket ${t.number}: ${t.shortDescription}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-heading font-mono">{t.number}</span>
                    <Badge label={t.priority.toUpperCase()} variant={priorityCfg.variant} />
                    <Badge label={WORKFLOW_LABELS[t.state] ?? t.state} variant={stateCfg.variant} />
                  </div>
                  <p className="text-sm text-body truncate">{t.shortDescription}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted">
                    <span className="flex items-center gap-1"><UserCheck size={12} aria-hidden="true" /> {t.caller}</span>
                    <span className="flex items-center gap-1"><Database size={12} aria-hidden="true" /> {t.category}</span>
                    <span className="flex items-center gap-1"><Clock size={12} aria-hidden="true" /> {formatDate(t.createdAt)}</span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-faint group-hover:text-a-indigo transition-colors mt-1 shrink-0" aria-hidden="true" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
