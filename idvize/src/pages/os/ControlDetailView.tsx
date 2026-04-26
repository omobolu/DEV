/**
 * Control Detail View — Per-Application Control Assessment
 *
 * Answers: "For THIS app — what controls are failing and how do I fix them?"
 *
 * Shows all 49 controls for a single application with:
 *   - GAP and ATTN controls prioritized first
 *   - Filtering (All, GAP, ATTN, OK)
 *   - Search by control name or ID
 *   - Sorting (outcome, pillar, controlId)
 *   - Slide-out detail drawer with recommended remediation actions
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Filter, Search, ArrowUpDown,
  ShieldAlert, ShieldCheck, AlertTriangle, X, AlertCircle,
  BookOpen, Layers, Clock,
  Bot, Loader2, CheckCircle2, Mail, ListChecks,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

// ── Pillar → friendly agent name (UI-only mapping) ─────────────────────────
//
// The backend's `buildType` is technical (sso_integration, iga_onboarding…).
// CISOs and business stakeholders need a recognizable, function-specific name
// so they understand exactly what the agent will do before approving it.

const AGENT_BY_PILLAR: Record<'AM' | 'IGA' | 'PAM' | 'CIAM', { name: string; verb: string; configures: string }> = {
  AM:   { name: 'SSO Configuration Agent',           verb: 'configure SSO and MFA',                       configures: 'identity provider, protocol, redirect URIs, and MFA policy' },
  IGA:  { name: 'Lifecycle Provisioning Agent',      verb: 'wire up SCIM provisioning and access reviews', configures: 'SCIM endpoint, joiner/mover/leaver triggers, and certification cadence' },
  PAM:  { name: 'Privileged Access Vault Agent',     verb: 'onboard privileged accounts to the vault',    configures: 'vaulted account types, rotation policy, and session recording' },
  CIAM: { name: 'Customer Identity Onboarding Agent', verb: 'configure customer identity flows',           configures: 'customer journey, MFA methods, and external IdPs' },
}

// ── Remediation kickoff (existing backend endpoint, no contract change) ────
//
// The endpoint creates BOTH the approval request and the AI-agent build job
// in one call. The pre-flight modal acts as the operator's confirmation gate
// before this fires (since the backend doesn't currently wait for IAM Manager
// approval before notifying — see PR description for the planned backend gating).

interface RemediationFormField {
  label: string
  hint: string
  required: boolean
}

interface RemediationRecipient {
  role: string
  name: string
  email: string
}

interface RemediationResult {
  approvalId?: string
  buildId?: string
  appName?: string
  controlName?: string
  pillar?: string
  sentTo: RemediationRecipient[]
  formFields: RemediationFormField[]
  nextSteps: string[]
  message: string
}

async function triggerRemediation(appId: string, controlId: string): Promise<RemediationResult> {
  const res  = await apiFetch(`/controls/app/${appId}/${controlId}/remediate`, { method: 'POST' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Agent dispatch failed')
  const data = json.data ?? {}
  return {
    approvalId:  data.approvalId,
    buildId:     data.buildId,
    appName:     data.appName,
    controlName: data.controlName,
    pillar:      data.pillar,
    sentTo:      Array.isArray(data.sentTo)     ? data.sentTo     : [],
    formFields:  Array.isArray(data.formFields) ? data.formFields : [],
    nextSteps:   Array.isArray(data.nextSteps)  ? data.nextSteps  : [],
    message:     data.message ?? 'Agent dispatch submitted',
  }
}

// ── Types (matches GET /os/risks/:appId/controls response) ─────────────────

type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
type Outcome = 'GAP' | 'ATTN' | 'OK'
type Pillar = 'AM' | 'IGA' | 'PAM' | 'CIAM'

interface EnrichedControl {
  controlId: string
  controlName: string
  pillar: Pillar
  outcome: Outcome
  category: string
  description: string
  riskReduction: string
  implementationComplexity: string
  policyDrivers: string[]
  capabilities: string[]
  recommendedActions: string[]
  platformName: string
  evaluatedAt: string
}

interface ControlSummary {
  total: number
  gap: number
  attention: number
  ok: number
}

interface ControlsData {
  applicationId: string
  applicationName: string
  tenantId: string
  riskLevel: RiskLevel
  summary: ControlSummary
  controls: EnrichedControl[]
}

// ── Config ──────────────────────────────────────────────────────────────────

const OUTCOME_CFG: Record<Outcome, { label: string; color: string; bg: string; border: string; dot: string; icon: typeof ShieldAlert }> = {
  GAP:  { label: 'GAP',  color: 'text-a-red',       bg: 'bg-red-900/25',     border: 'border-red-700/50',     dot: 'bg-red-400',     icon: ShieldAlert },
  ATTN: { label: 'ATTN', color: 'text-a-amber',     bg: 'bg-amber-900/20',   border: 'border-amber-700/40',   dot: 'bg-amber-400',   icon: AlertTriangle },
  OK:   { label: 'OK',   color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-700/40', dot: 'bg-emerald-400', icon: ShieldCheck },
}

const RISK_CFG: Record<RiskLevel, { label: string; color: string; bg: string; border: string }> = {
  CRITICAL: { label: 'CRITICAL', color: 'text-a-red',       bg: 'bg-red-900/25',     border: 'border-red-700/50' },
  HIGH:     { label: 'HIGH',     color: 'text-a-orange',    bg: 'bg-orange-900/20',  border: 'border-orange-700/40' },
  MEDIUM:   { label: 'MEDIUM',   color: 'text-a-amber',     bg: 'bg-amber-900/20',   border: 'border-amber-700/40' },
  LOW:      { label: 'LOW',      color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-700/40' },
}

const PILLAR_CFG: Record<Pillar, { label: string; fullName: string; color: string }> = {
  AM:   { label: 'AM',   fullName: 'Access Management',            color: 'text-blue-400' },
  IGA:  { label: 'IGA',  fullName: 'Identity Governance & Admin',  color: 'text-violet-400' },
  PAM:  { label: 'PAM',  fullName: 'Privileged Access Management', color: 'text-rose-400' },
  CIAM: { label: 'CIAM', fullName: 'Customer Identity & Access',   color: 'text-teal-400' },
}

const COMPLEXITY_CFG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Low',    color: 'text-emerald-400' },
  medium: { label: 'Medium', color: 'text-a-amber' },
  high:   { label: 'High',   color: 'text-a-red' },
}

type SortKey = 'outcome' | 'pillar' | 'controlId' | 'riskReduction'
const OUTCOME_ORDER: Record<Outcome, number> = { GAP: 0, ATTN: 1, OK: 2 }

// ── Reusable sub-components ─────────────────────────────────────────────────

function KpiTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
      <p className="text-xs text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const cfg = OUTCOME_CFG[outcome]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <cfg.icon size={10} />
      {cfg.label}
    </span>
  )
}

function PillarBadge({ pillar }: { pillar: Pillar }) {
  const cfg = PILLAR_CFG[pillar]
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-700 border border-surface-600 ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// ── Control table row ───────────────────────────────────────────────────────

function ControlRow({
  ctrl, onSelect, onLaunch,
}: {
  ctrl: EnrichedControl
  onSelect: () => void
  onLaunch: (ctrl: EnrichedControl) => void
}) {
  const outcomeCfg = OUTCOME_CFG[ctrl.outcome]
  const isActionable = ctrl.outcome !== 'OK'
  // OK rows are visually quieter — slightly muted, no action button
  const rowMutedClass = ctrl.outcome === 'OK' ? 'opacity-75 hover:opacity-100' : ''
  const agent = AGENT_BY_PILLAR[ctrl.pillar]

  return (
    <tr
      className={`border-b border-surface-700/60 hover:bg-surface-700/30 cursor-pointer transition-colors group ${rowMutedClass}`}
      onClick={onSelect}
    >
      {/* Control ID */}
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-muted">{ctrl.controlId}</span>
      </td>

      {/* Control Name + Category */}
      <td className="px-4 py-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${outcomeCfg.dot}`} />
            <p className="text-sm font-medium text-body truncate">{ctrl.controlName}</p>
          </div>
          <p className="text-[11px] text-muted pl-4">{ctrl.category}</p>
        </div>
      </td>

      {/* Pillar */}
      <td className="px-4 py-3">
        <PillarBadge pillar={ctrl.pillar} />
      </td>

      {/* Outcome */}
      <td className="px-4 py-3">
        <OutcomeBadge outcome={ctrl.outcome} />
      </td>

      {/* Risk Reduction */}
      <td className="px-4 py-3">
        <span className={`text-xs font-medium ${
          ctrl.riskReduction === 'critical' ? 'text-a-red'
          : ctrl.riskReduction === 'high' ? 'text-a-orange'
          : ctrl.riskReduction === 'medium' ? 'text-a-amber'
          : 'text-muted'
        }`}>
          {ctrl.riskReduction.charAt(0).toUpperCase() + ctrl.riskReduction.slice(1)}
        </span>
      </td>

      {/* Action — single Launch button for GAP/ATTN; quiet "Passing" for OK */}
      <td className="px-4 py-3 text-right">
        {isActionable ? (
          <div className="flex items-center justify-end" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onLaunch(ctrl)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              title={`Launch ${agent.name} for ${ctrl.controlName}`}
              aria-label={`Launch ${agent.name} for ${ctrl.controlName}`}
            >
              <Bot size={11} />
              Launch Agent
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400/90">
            <CheckCircle2 size={11} />
            Passing
          </span>
        )}
      </td>
    </tr>
  )
}

// ── Control Detail Drawer ───────────────────────────────────────────────────

function ControlDrawer({
  ctrl, onClose, onLaunch,
}: {
  ctrl: EnrichedControl
  onClose: () => void
  onLaunch: (ctrl: EnrichedControl) => void
}) {
  const outcomeCfg = OUTCOME_CFG[ctrl.outcome]
  const pillarCfg = PILLAR_CFG[ctrl.pillar]
  const complexityCfg = COMPLEXITY_CFG[ctrl.implementationComplexity] ?? COMPLEXITY_CFG.medium
  const agent = AGENT_BY_PILLAR[ctrl.pillar]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative w-full max-w-lg bg-surface-900 border-l border-surface-700 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface-900 border-b border-surface-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${outcomeCfg.dot}`} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-heading truncate">{ctrl.controlName}</p>
                <p className="text-xs text-muted font-mono">{ctrl.controlId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-muted hover:text-body hover:bg-surface-700 rounded-lg transition-colors flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <OutcomeBadge outcome={ctrl.outcome} />
            <PillarBadge pillar={ctrl.pillar} />
            <span className="text-[10px] text-muted px-1.5 py-0.5 bg-surface-700 border border-surface-600 rounded">
              {ctrl.category}
            </span>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Description</p>
            <p className="text-sm text-secondary leading-relaxed">{ctrl.description}</p>
          </div>

          {/* Risk & Complexity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-800 border border-surface-700 rounded-lg p-3">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Risk Reduction</p>
              <p className={`text-sm font-semibold ${
                ctrl.riskReduction === 'critical' ? 'text-a-red'
                : ctrl.riskReduction === 'high' ? 'text-a-orange'
                : ctrl.riskReduction === 'medium' ? 'text-a-amber'
                : 'text-muted'
              }`}>
                {ctrl.riskReduction.charAt(0).toUpperCase() + ctrl.riskReduction.slice(1)}
              </p>
            </div>
            <div className="bg-surface-800 border border-surface-700 rounded-lg p-3">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Implementation</p>
              <p className={`text-sm font-semibold ${complexityCfg.color}`}>{complexityCfg.label} Complexity</p>
            </div>
          </div>

          {/* Pillar */}
          <div className="bg-surface-800 border border-surface-700 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Layers size={14} className={pillarCfg.color} />
              <div>
                <p className="text-xs font-semibold text-body">{pillarCfg.fullName}</p>
                <p className="text-[10px] text-muted">{ctrl.platformName}</p>
              </div>
            </div>
          </div>

          {/* Capabilities */}
          {ctrl.capabilities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Capabilities</p>
              <div className="flex flex-wrap gap-1.5">
                {ctrl.capabilities.map(cap => (
                  <span key={cap} className="text-[11px] text-secondary px-2 py-1 bg-surface-800 border border-surface-700 rounded-lg">
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Policy Drivers */}
          {ctrl.policyDrivers.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen size={12} className="text-muted" />
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Policy Drivers</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ctrl.policyDrivers.map(pd => (
                  <span key={pd} className="text-[11px] text-a-indigo px-2 py-0.5 bg-indigo-900/20 border border-indigo-700/30 rounded">
                    {pd}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Remediation — single Launch button + recommended steps (GAP/ATTN only) */}
          {ctrl.outcome !== 'OK' && (
            <div className={`rounded-xl p-4 border ${
              ctrl.outcome === 'GAP'
                ? 'bg-red-900/10 border-red-800/30'
                : 'bg-amber-900/10 border-amber-800/30'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <Bot size={14} className={ctrl.outcome === 'GAP' ? 'text-a-red' : 'text-a-amber'} />
                <p className={`text-xs font-bold uppercase tracking-wider ${
                  ctrl.outcome === 'GAP' ? 'text-a-red' : 'text-a-amber'
                }`}>
                  Remediation
                </p>
              </div>

              <button
                type="button"
                onClick={() => onLaunch(ctrl)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors mb-2"
              >
                <Bot size={15} />
                Launch {agent.name}
              </button>
              <p className="text-[11px] text-muted mb-4 leading-relaxed">
                The agent will {agent.verb} on this app. You'll confirm the workflow and recipients in the next step.
              </p>

              {ctrl.recommendedActions.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">What the agent will do</p>
                  <ol className="space-y-2">
                    {ctrl.recommendedActions.map((action, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-secondary">
                        <span className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                          ctrl.outcome === 'GAP'
                            ? 'bg-red-900/30 text-red-300'
                            : 'bg-amber-900/30 text-amber-300'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{action}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          )}

          {/* OK state — no remediation needed */}
          {ctrl.outcome === 'OK' && (
            <div className="bg-emerald-900/10 border border-emerald-800/30 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-400" />
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Control Passing
                </p>
              </div>
              <p className="text-sm text-secondary mt-2">
                This control is currently detected and implemented. No remediation action required.
              </p>
            </div>
          )}

          {/* Evaluated timestamp */}
          <div className="flex items-center gap-2 text-[11px] text-muted pt-2 border-t border-surface-700">
            <Clock size={11} />
            <span>Last evaluated: {new Date(ctrl.evaluatedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Launch Agent Modal — pre-flight confirmation, then result view ─────────
//
// State machine:
//   confirm  — show what will happen, [Cancel] [Confirm Launch]
//   loading  — POST in flight
//   result   — show actual approval/build IDs, recipients, form fields, next steps
//   error    — show failure message, [Close] [Retry]

type ModalState =
  | { kind: 'confirm' }
  | { kind: 'loading' }
  | { kind: 'result'; data: RemediationResult }
  | { kind: 'error'; message: string }

function LaunchAgentModal({
  ctrl, appId, appName, onClose,
}: {
  ctrl: EnrichedControl
  appId: string
  appName: string | undefined
  onClose: () => void
}) {
  const [state, setState] = useState<ModalState>({ kind: 'confirm' })
  const agent = AGENT_BY_PILLAR[ctrl.pillar]

  const handleConfirm = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const data = await triggerRemediation(appId, ctrl.controlId)
      setState({ kind: 'result', data })
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message })
    }
  }, [appId, ctrl.controlId])

  // Close on Escape (only allowed when not in flight)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.kind !== 'loading') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, state.kind])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => state.kind !== 'loading' && onClose()}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-agent-modal-title"
        className="relative w-full max-w-xl bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-surface-700">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0">
              <Bot size={18} className="text-blue-400" />
            </div>
            <div className="min-w-0">
              <h2 id="launch-agent-modal-title" className="text-base font-bold text-heading">
                {agent.name}
              </h2>
              <p className="text-xs text-muted mt-0.5 truncate">
                {appName ?? 'Application'} · {ctrl.controlId} {ctrl.controlName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => state.kind !== 'loading' && onClose()}
            disabled={state.kind === 'loading'}
            className="p-1.5 text-muted hover:text-body hover:bg-surface-700 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {state.kind === 'confirm' && (
            <ConfirmStep ctrl={ctrl} agent={agent} appName={appName} />
          )}

          {state.kind === 'loading' && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 size={28} className="animate-spin text-blue-400 mb-3" />
              <p className="text-sm font-medium text-body">Dispatching {agent.name}…</p>
              <p className="text-xs text-muted mt-1">Creating approval and queueing build job</p>
            </div>
          )}

          {state.kind === 'result' && (
            <ResultStep result={state.data} agent={agent} />
          )}

          {state.kind === 'error' && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-900/15 border border-red-800/40">
              <AlertCircle size={18} className="text-a-red flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-a-red">Dispatch failed</p>
                <p className="text-xs text-muted mt-1">{state.message}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-surface-700 bg-surface-800/40">
          {state.kind === 'confirm' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-muted hover:text-body hover:bg-surface-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                <Bot size={13} />
                Launch {agent.name}
              </button>
            </>
          )}
          {state.kind === 'loading' && (
            <span className="text-xs text-muted">Please wait…</span>
          )}
          {state.kind === 'result' && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          )}
          {state.kind === 'error' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-muted hover:text-body hover:bg-surface-700 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfirmStep({
  ctrl, agent, appName,
}: {
  ctrl: EnrichedControl
  agent: { name: string; verb: string; configures: string }
  appName: string | undefined
}) {
  return (
    <div className="space-y-4">
      <div className="bg-surface-800 border border-surface-700 rounded-lg p-4">
        <p className="text-xs text-muted leading-relaxed">
          The <strong className="text-body">{agent.name}</strong> will {agent.verb} on
          {' '}<strong className="text-body">{appName ?? 'this application'}</strong>. It will configure
          the {agent.configures}.
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
          Workflow that will be triggered
        </p>
        <ol className="space-y-2">
          {[
            'Approval queued for IAM Manager review (visible in their work list)',
            'Notifications sent to Business Owner (from CMDB) and Technical Admin',
            'Configuration form delivered to the App Owner with required SSO/IAM fields',
            `Build job queued — ${agent.name} will run once the form is submitted`,
          ].map((line, i) => (
            <li key={i} className="flex gap-2.5 text-xs text-secondary">
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-900/30 text-blue-300 text-[10px] font-bold">
                {i + 1}
              </span>
              <span className="leading-relaxed">{line}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Honest framing — backend doesn't yet gate on approval before notifying */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-900/10 border border-amber-800/30">
        <AlertCircle size={14} className="text-a-amber flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted leading-relaxed">
          <strong className="text-a-amber">Note:</strong> in this version, notifications and the
          form are sent in parallel with creating the IAM Manager approval. The
          approver-gates-first ordering and the App Owner approval toggle are tracked as a
          backend follow-up.
        </p>
      </div>
    </div>
  )
}

function ResultStep({
  result, agent,
}: {
  result: RemediationResult
  agent: { name: string }
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-900/15 border border-emerald-700/40">
        <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
        <p className="text-sm font-medium text-emerald-300">{result.message}</p>
      </div>

      {/* IDs */}
      <div className="grid grid-cols-2 gap-3">
        {result.approvalId && (
          <div className="bg-surface-800 border border-surface-700 rounded-lg p-3">
            <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Approval</p>
            <p className="text-xs font-mono text-body break-all">{result.approvalId}</p>
          </div>
        )}
        {result.buildId && (
          <div className="bg-surface-800 border border-surface-700 rounded-lg p-3">
            <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Build job</p>
            <p className="text-xs font-mono text-body break-all">{result.buildId}</p>
          </div>
        )}
      </div>

      {/* Sent to */}
      {result.sentTo.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Mail size={12} className="text-muted" />
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">
              Notifications sent to
            </p>
          </div>
          <ul className="space-y-1.5">
            {result.sentTo.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-xs px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg">
                <div className="min-w-0">
                  <p className="font-medium text-body truncate">{r.name}</p>
                  <p className="text-[10px] text-muted truncate">{r.email}</p>
                </div>
                <span className="text-[10px] text-blue-300 font-semibold flex-shrink-0">{r.role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Form fields the SME will see */}
      {result.formFields.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ListChecks size={12} className="text-muted" />
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">
              Form fields the App Owner will receive
            </p>
          </div>
          <div className="space-y-1.5">
            {result.formFields.map((f, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-body">
                    {f.label}
                    {f.required && <span className="text-a-red ml-1">*</span>}
                  </p>
                  <p className="text-[10px] text-muted truncate">{f.hint}</p>
                </div>
                <span className="text-[10px] text-muted flex-shrink-0">{f.required ? 'required' : 'optional'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next steps */}
      {result.nextSteps.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Next steps</p>
          <ol className="space-y-1.5">
            {result.nextSteps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-secondary">
                <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full bg-blue-900/30 text-blue-300 text-[9px] font-bold">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="text-[11px] text-muted">
        {agent.name} will pick up this build automatically once the configuration form is submitted.
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ControlDetailView() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()

  const [data,     setData]     = useState<ControlsData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [filter,   setFilter]   = useState<Outcome | 'ALL'>('ALL')
  const [search,   setSearch]   = useState('')
  const [sortBy,   setSortBy]   = useState<SortKey>('outcome')
  const [selected, setSelected] = useState<EnrichedControl | null>(null)
  // The control currently being launched via the agent modal (null = closed)
  const [launching, setLaunching] = useState<EnrichedControl | null>(null)

  const load = useCallback(async () => {
    if (!appId) return
    setLoading(true)
    setError('')
    try {
      const res  = await apiFetch(`/os/risks/${appId}/controls`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setData(json.data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [appId])

  useEffect(() => { load() }, [load])

  // Close drawer on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleLaunch = useCallback((ctrl: EnrichedControl) => {
    setLaunching(ctrl)
  }, [])

  const visible = useMemo(() => {
    if (!data) return []
    let controls = data.controls

    // Filter by outcome
    if (filter !== 'ALL') {
      controls = controls.filter(c => c.outcome === filter)
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      controls = controls.filter(c =>
        c.controlName.toLowerCase().includes(q) ||
        c.controlId.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.pillar.toLowerCase().includes(q)
      )
    }

    // Sort
    controls = [...controls].sort((a, b) => {
      if (sortBy === 'outcome') {
        const diff = OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome]
        if (diff !== 0) return diff
        return a.controlId.localeCompare(b.controlId)
      }
      if (sortBy === 'pillar') {
        const diff = a.pillar.localeCompare(b.pillar)
        if (diff !== 0) return diff
        return OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome]
      }
      if (sortBy === 'controlId') {
        return a.controlId.localeCompare(b.controlId)
      }
      if (sortBy === 'riskReduction') {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        const diff = (order[a.riskReduction] ?? 2) - (order[b.riskReduction] ?? 2)
        if (diff !== 0) return diff
        return OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome]
      }
      return 0
    })

    return controls
  }, [data, filter, search, sortBy])

  const riskCfg = data ? RISK_CFG[data.riskLevel] : null

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

      {/* Back navigation */}
      <button
        onClick={() => navigate('/risks')}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-body transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Top IAM Risks
      </button>

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <ShieldAlert size={18} className="text-a-red" />
            <div>
              <h1 className="text-lg font-bold text-heading">
                {loading ? 'Loading…' : data?.applicationName ?? 'Application'}
              </h1>
              <p className="text-sm text-muted mt-0.5">
                Control assessment detail — understand what's failing and how to fix it
              </p>
            </div>
          </div>
          {data && riskCfg && (
            <div className="mt-2 ml-7">
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${riskCfg.color} ${riskCfg.bg} ${riskCfg.border}`}>
                {riskCfg.label} RISK
              </span>
            </div>
          )}
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
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile label="Total Controls" value={String(data.summary.total)} color="text-body" />
          <KpiTile label="GAP Controls" value={String(data.summary.gap)} color="text-a-red" />
          <KpiTile label="ATTN Controls" value={String(data.summary.attention)} color="text-a-amber" />
          <KpiTile label="OK Controls" value={String(data.summary.ok)} color="text-emerald-400" />
        </div>
      )}

      {/* Pillar strip — compact, no charts. Click to filter the table. */}
      {data && (() => {
        const pillarCounts: Record<Pillar, { gap: number; attn: number; ok: number; total: number }> = {
          AM: { gap: 0, attn: 0, ok: 0, total: 0 },
          IGA: { gap: 0, attn: 0, ok: 0, total: 0 },
          PAM: { gap: 0, attn: 0, ok: 0, total: 0 },
          CIAM: { gap: 0, attn: 0, ok: 0, total: 0 },
        }
        for (const c of data.controls) {
          pillarCounts[c.pillar].total++
          if (c.outcome === 'GAP') pillarCounts[c.pillar].gap++
          else if (c.outcome === 'ATTN') pillarCounts[c.pillar].attn++
          else pillarCounts[c.pillar].ok++
        }
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider mr-1">By pillar</span>
            {(Object.entries(pillarCounts) as [Pillar, { gap: number; attn: number; ok: number; total: number }][])
              .map(([pillar, counts]) => {
                const pcfg = PILLAR_CFG[pillar]
                const hasIssue = counts.gap > 0 || counts.attn > 0
                return (
                  <span
                    key={pillar}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-800 border border-surface-700"
                    title={`${pcfg.fullName} — ${counts.total} controls`}
                  >
                    <span className={`text-[11px] font-bold ${pcfg.color}`}>{pcfg.label}</span>
                    <span className="text-[10px] text-muted">{counts.total}</span>
                    {hasIssue && <span className="w-px h-3 bg-surface-600" />}
                    {counts.gap > 0 && <span className="text-[10px] font-semibold text-a-red">{counts.gap} GAP</span>}
                    {counts.attn > 0 && <span className="text-[10px] font-semibold text-a-amber">{counts.attn} ATTN</span>}
                    {!hasIssue && <span className="text-[10px] font-semibold text-emerald-400">all OK</span>}
                  </span>
                )
              })}
          </div>
        )
      })()}


      {/* Filter + Search + Sort bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Outcome filters */}
          <div className="flex items-center gap-1">
            <Filter size={13} className="text-muted mr-1" />
            {(['ALL', 'GAP', 'ATTN', 'OK'] as const).map(f => {
              const active = filter === f
              const cfg = f !== 'ALL' ? OUTCOME_CFG[f as Outcome] : null
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors
                    ${active
                      ? cfg
                        ? `${cfg.color} ${cfg.bg} ${cfg.border} font-semibold`
                        : 'bg-indigo-600/30 text-a-indigo border-indigo-500/50 font-semibold'
                      : 'text-muted border-surface-600 hover:bg-surface-700'}`}
                >
                  {f}
                  {data && f !== 'ALL' && (
                    <span className="ml-1 opacity-60">
                      {f === 'GAP'  ? data.summary.gap
                       : f === 'ATTN' ? data.summary.attention
                       : data.summary.ok}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search controls…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-surface-900 border border-surface-600 rounded-lg text-body placeholder:text-muted focus:border-indigo-500 focus:outline-none w-52"
            />
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown size={12} className="text-muted" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="text-xs bg-surface-900 border border-surface-600 rounded-lg px-2.5 py-1.5 text-body focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="outcome">Sort: Outcome (GAP first)</option>
            <option value="pillar">Sort: Pillar</option>
            <option value="controlId">Sort: Control ID</option>
            <option value="riskReduction">Sort: Risk Reduction</option>
          </select>
        </div>
      </div>

      {/* Controls table */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> Loading controls…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700 bg-surface-900/40">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider w-24">ID</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider">Control</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider w-20">Pillar</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider w-20">Status</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider w-28">Risk Impact</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody>
                {visible.map(ctrl => (
                  <ControlRow
                    key={ctrl.controlId}
                    ctrl={ctrl}
                    onSelect={() => setSelected(ctrl)}
                    onLaunch={handleLaunch}
                  />
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted text-sm">
                      {filter === 'ALL' && !search
                        ? 'No control assessments found for this application.'
                        : `No controls match the current filter${search ? ` and search "${search}"` : ''}.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && visible.length > 0 && (
        <p className="text-xs text-faint text-center">
          Showing {visible.length} of {data?.summary.total ?? 0} controls. Click any row to view details and remediation steps.
        </p>
      )}

      {/* Detail drawer */}
      {selected && (
        <ControlDrawer
          ctrl={selected}
          onClose={() => setSelected(null)}
          onLaunch={handleLaunch}
        />
      )}

      {/* Launch agent modal — pre-flight confirmation + result view */}
      {launching && appId && (
        <LaunchAgentModal
          ctrl={launching}
          appId={appId}
          appName={data?.applicationName}
          onClose={() => setLaunching(null)}
        />
      )}
    </div>
  )
}
