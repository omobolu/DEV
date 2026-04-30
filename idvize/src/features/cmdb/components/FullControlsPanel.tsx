/**
 * FullControlsPanel — All 49 IAM controls for a given application.
 *
 * Shows each control's auto-detected status, allows marking as
 * Not Applicable, and supports per-control notes.
 */

import { useState, useEffect } from 'react'
import {
  Shield, ShieldCheck, ShieldAlert, UserCheck, Layers,
  CheckCircle, XCircle, MinusCircle, HelpCircle,
  Pencil, X, Save, ChevronDown, ChevronUp, Search,
  Zap, Loader2, Mail, Bot, UserCog, ArrowRight, ClipboardList,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

// ── Types ──────────────────────────────────────────────────────────────────
type IamPillar  = 'AM' | 'IGA' | 'PAM' | 'CIAM'
type CtrlStatus = 'implemented' | 'gap' | 'not_applicable' | 'undetected'

interface FormFieldDef {
  key: string
  label: string
  type: 'text' | 'url' | 'select' | 'multiselect' | 'textarea' | 'toggle' | 'number'
  placeholder?: string
  options?: string[]
  required: boolean
  hint?: string
}

interface PlatformConfig {
  platformId: 'entra' | 'sailpoint' | 'cyberark' | 'okta'
  platformName: string
  featureName: string
  featurePath: string
  agentActions: string[]
}

interface AppControl {
  controlId:              string
  name:                   string
  pillar:                 IamPillar
  category:               string
  description:            string
  capabilities:           string[]
  riskReduction:          'critical' | 'high' | 'medium' | 'low'
  applicableTiers:        string[]
  policyDrivers:          string[]
  implementationComplexity: 'low' | 'medium' | 'high'
  tags:                   string[]
  platform?:              PlatformConfig
  configFormFields?:      FormFieldDef[]
  status:                 CtrlStatus
  notes:                  string
  updatedAt:              string | null
  updatedBy:              string | null
}

interface ControlsSummary {
  total: number; implemented: number; gap: number; not_applicable: number; undetected: number
}

// ── Config ─────────────────────────────────────────────────────────────────
const PILLAR_CFG: Record<IamPillar, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  AM:   { icon: ShieldCheck, color: 'text-a-cyan',   bg: 'bg-cyan-900/20',   border: 'border-cyan-800/40' },
  IGA:  { icon: Shield,      color: 'text-a-indigo', bg: 'bg-indigo-900/20', border: 'border-indigo-800/40' },
  PAM:  { icon: ShieldAlert, color: 'text-a-amber',  bg: 'bg-amber-900/20',  border: 'border-amber-800/40' },
  CIAM: { icon: UserCheck,   color: 'text-a-green',  bg: 'bg-green-900/20',  border: 'border-green-800/40' },
}

const STATUS_CFG: Record<CtrlStatus, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  implemented:    { label: 'Implemented',    icon: CheckCircle,  color: 'text-a-green',  bg: 'bg-green-900/20',  border: 'border-green-800/40' },
  gap:            { label: 'Gap',            icon: XCircle,      color: 'text-a-red',    bg: 'bg-red-900/20',    border: 'border-red-800/40' },
  not_applicable: { label: 'Not Applicable', icon: MinusCircle,  color: 'text-muted',  bg: 'bg-slate-800/40',  border: 'border-slate-700' },
  undetected:     { label: 'Not Assessed',   icon: HelpCircle,   color: 'text-muted',  bg: 'bg-surface-700/40',border: 'border-surface-600' },
}

const RISK_COLOR: Record<string, string> = {
  critical: 'text-a-red', high: 'text-a-amber', medium: 'text-yellow-400', low: 'text-muted',
}

// ── Edit Modal ─────────────────────────────────────────────────────────────
function EditModal({
  control, appId, onSave, onClose,
}: {
  control: AppControl; appId: string; onSave: (c: AppControl) => void; onClose: () => void
}) {
  const [notApplicable, setNotApplicable] = useState(control.status === 'not_applicable')
  const [notes, setNotes]                 = useState(control.notes ?? '')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const res  = await apiFetch(`/controls/app/${appId}/${control.controlId}`, {
        method: 'PATCH',
        body:   JSON.stringify({ notApplicable, notes }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      onSave({
        ...control,
        status: notApplicable ? 'not_applicable' : control.status === 'not_applicable' ? 'undetected' : control.status,
        notes,
        updatedAt: json.data.override.updatedAt,
        updatedBy: json.data.override.updatedBy,
      })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const pillar = PILLAR_CFG[control.pillar]
  const PIcon  = pillar.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-surface-700">
          <PIcon size={18} className={`mt-0.5 flex-shrink-0 ${pillar.color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-heading">{control.name}</h3>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${pillar.color} ${pillar.bg} ${pillar.border}`}>
                {control.pillar}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">{control.controlId} · {control.category}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-secondary transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-muted leading-relaxed">{control.description}</p>

          {/* Not Applicable toggle */}
          <div className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors
            ${notApplicable ? 'bg-slate-800/60 border-slate-600' : 'bg-surface-700/30 border-surface-600 hover:border-surface-500'}`}
            onClick={() => setNotApplicable(v => !v)}
          >
            <div className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
              ${notApplicable ? 'bg-indigo-600 border-indigo-600' : 'border-slate-500'}`}>
              {notApplicable && <span className="text-white text-[10px] font-bold">✓</span>}
            </div>
            <div>
              <p className="text-sm font-medium text-body">Mark as Not Applicable</p>
              <p className="text-xs text-muted mt-0.5">
                Use when this control does not apply to this application (e.g. PAM for a read-only reporting tool).
                This excludes the control from gap calculations.
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Notes / Justification</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Add context, justification, or remediation notes…"
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-body
                         placeholder-faint focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-a-red bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-muted border border-surface-600 rounded-lg hover:bg-surface-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg
                       hover:bg-indigo-500 disabled:opacity-60 transition-colors"
          >
            <Save size={12} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Types for configure response ─────────────────────────────────────────────
interface ConfigureResult {
  approvalId: string
  buildId: string
  controlName: string
  pillar: string
  appName: string
  sentTo: Array<{ role: string; name: string; email: string }>
  formFields: Array<{ label: string; hint: string; required: boolean }>
  nextSteps: string[]
  message: string
}

// ── Configure Modal ──────────────────────────────────────────────────────────
function ConfigureModal({ control, appId, onClose }: {
  control: AppControl; appId: string; onClose: () => void
}) {
  const [phase, setPhase]     = useState<'preview' | 'sending' | 'done'>('preview')
  const [result, setResult]   = useState<ConfigureResult | null>(null)
  const [error, setError]     = useState('')

  const pillar  = PILLAR_CFG[control.pillar]
  const PIcon   = pillar.icon

  const send = async () => {
    setPhase('sending')
    setError('')
    try {
      const res  = await apiFetch(`/controls/app/${appId}/${control.controlId}/remediate`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setResult(json.data)
      setPhase('done')
    } catch (e) {
      setError((e as Error).message)
      setPhase('preview')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className={`flex items-start gap-3 px-5 pt-5 pb-4 border-b border-surface-700 ${pillar.bg} rounded-t-2xl`}>
          <PIcon size={18} className={`mt-0.5 flex-shrink-0 ${pillar.color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-heading">Configure {control.name}</h3>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${pillar.color} ${pillar.bg} ${pillar.border}`}>
                {control.pillar}
              </span>
              {control.platform && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-600 bg-slate-800/50 text-secondary">
                  {control.platform.platformName}
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">{control.controlId} · {control.category}</p>
            {control.platform && (
              <p className="text-[11px] text-a-indigo mt-0.5 font-medium">{control.platform.featureName}</p>
            )}
          </div>
          <button onClick={onClose} className="text-muted hover:text-secondary transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {phase !== 'done' ? (
            <>
              {/* Description */}
              <p className="text-xs text-muted leading-relaxed">{control.description}</p>

              {/* Workflow steps */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Configuration Workflow</p>
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center flex-shrink-0">
                      <Mail size={11} className="text-a-indigo" />
                    </div>
                    <div className="w-px h-4 bg-surface-600" />
                    <div className="w-6 h-6 rounded-full bg-violet-600/30 border border-violet-500/50 flex items-center justify-center flex-shrink-0">
                      <ClipboardList size={11} className="text-a-purple" />
                    </div>
                    <div className="w-px h-4 bg-surface-600" />
                    <div className="w-6 h-6 rounded-full bg-cyan-600/30 border border-cyan-500/50 flex items-center justify-center flex-shrink-0">
                      <Bot size={11} className="text-cyan-300" />
                    </div>
                    <div className="w-px h-4 bg-surface-600" />
                    <div className="w-6 h-6 rounded-full bg-amber-600/30 border border-amber-500/50 flex items-center justify-center flex-shrink-0">
                      <UserCog size={11} className="text-amber-300" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3 pt-0.5">
                    <div>
                      <p className="text-xs font-medium text-body">Email sent to Business Owner & Technical Admin</p>
                      <p className="text-[11px] text-muted mt-0.5">A configuration form is sent to the app owner and IAM team requesting the required technical details</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-body">Owner completes configuration form</p>
                      <p className="text-[11px] text-muted mt-0.5">They provide the {control.pillar}-specific information listed below</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-body">AI agent configures and builds</p>
                      <p className="text-[11px] text-muted mt-0.5">The agent uses the submitted data to configure {control.name} automatically</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-body">Engineer review &amp; sign-off</p>
                      <p className="text-[11px] text-muted mt-0.5">An alert is sent to the assigned engineer to review and approve the configuration</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Platform agent actions */}
              {control.platform && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wider">
                    AI Agent Actions in {control.platform.platformName}
                  </p>
                  <div className="p-2.5 bg-surface-800 border border-surface-700 rounded-lg space-y-1.5">
                    <p className="text-[11px] text-a-indigo font-medium">{control.platform.featurePath}</p>
                    {control.platform.agentActions.map((action, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-[10px] text-muted font-mono mt-0.5 flex-shrink-0">{i + 1}.</span>
                        <span className="text-[11px] text-muted">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form fields that will be requested */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider">
                  Information Requested from App / IAM Team
                </p>
                <div className="space-y-1.5">
                  {(control.configFormFields ?? []).map((f, i) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 bg-surface-800 border border-surface-700 rounded-lg">
                      <div className={`mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full ${f.required ? 'bg-red-400' : 'bg-slate-600'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-body">{f.label}</span>
                          {f.required && <span className="text-[10px] text-a-red">required</span>}
                          <span className="text-[10px] text-faint bg-surface-700 px-1 py-0.5 rounded font-mono">{f.type}</span>
                        </div>
                        {f.placeholder && <p className="text-[11px] text-faint mt-0.5 italic">{f.placeholder}</p>}
                        {f.hint && <p className="text-[11px] text-muted mt-0.5">{f.hint}</p>}
                        {f.options && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {f.options.map(opt => (
                              <span key={opt} className="text-[10px] px-1.5 py-0.5 bg-surface-700 border border-surface-600 rounded text-muted">{opt}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs text-a-red bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
              )}
            </>
          ) : result && (
            /* Done state */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-800/40 rounded-xl">
                <CheckCircle size={20} className="text-a-green flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-300">Configuration request sent</p>
                  <p className="text-xs text-muted mt-0.5">{result.message}</p>
                </div>
              </div>

              {/* Who was notified */}
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

              {/* Process IDs */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Processes Created</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs text-a-purple bg-violet-900/20 border border-violet-800/40 px-2.5 py-1.5 rounded-lg">
                    <ClipboardList size={11} /> Approval: {result.approvalId}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-cyan-300 bg-cyan-900/20 border border-cyan-800/40 px-2.5 py-1.5 rounded-lg">
                    <Bot size={11} /> Build: {result.buildId}
                  </span>
                </div>
              </div>

              {/* Next steps */}
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
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-muted border border-surface-600 rounded-lg hover:bg-surface-700 transition-colors"
          >
            {phase === 'done' ? 'Close' : 'Cancel'}
          </button>
          {phase !== 'done' && (
            <button
              onClick={send}
              disabled={phase === 'sending'}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg
                         hover:bg-indigo-500 disabled:opacity-60 transition-colors"
            >
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

// ── Control Row ─────────────────────────────────────────────────────────────
function ControlRow({
  control, appId, onUpdate,
}: {
  control: AppControl; appId: string; onUpdate: (c: AppControl) => void
}) {
  const [expanded, setExpanded]   = useState(false)
  const [editing, setEditing]     = useState(false)
  const [configuring, setConfiguring] = useState(false)
  const pillar  = PILLAR_CFG[control.pillar]
  const status  = STATUS_CFG[control.status]
  const PIcon   = pillar.icon
  const SIcon   = status.icon

  return (
    <>
      {editing && (
        <EditModal
          control={control}
          appId={appId}
          onSave={onUpdate}
          onClose={() => setEditing(false)}
        />
      )}
      {configuring && (
        <ConfigureModal
          control={control}
          appId={appId}
          onClose={() => setConfiguring(false)}
        />
      )}
      <div className="border border-surface-700 rounded-xl bg-surface-800 hover:border-surface-600 transition-colors">
        <div className="flex items-center gap-3 px-4 py-2.5">
          {/* Pillar icon */}
          <PIcon size={14} className={`flex-shrink-0 ${pillar.color}`} />

          {/* Name + meta */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-1 flex items-center gap-2 text-left min-w-0"
          >
            <span className="text-sm text-body font-medium truncate">{control.name}</span>
            <span className={`hidden sm:inline text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${pillar.color} ${pillar.bg} ${pillar.border}`}>
              {control.pillar}
            </span>
            <span className="hidden md:inline text-[10px] text-faint flex-shrink-0">{control.controlId}</span>
          </button>

          {/* Risk reduction */}
          <span className={`hidden lg:block text-xs flex-shrink-0 capitalize ${RISK_COLOR[control.riskReduction]}`}>
            {control.riskReduction}
          </span>

          {/* Status badge */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium flex-shrink-0 ${status.color} ${status.bg} ${status.border}`}>
            <SIcon size={11} />
            <span className="hidden sm:inline">{status.label}</span>
          </div>

          {/* Notes indicator */}
          {control.notes && (
            <span className="text-[10px] text-muted bg-surface-700 px-1.5 py-0.5 rounded hidden md:block">note</span>
          )}

          {/* Configure — only shown for gap controls */}
          {control.status === 'gap' && (
            <button
              onClick={e => { e.stopPropagation(); setConfiguring(true) }}
              className="flex items-center gap-1 text-[11px] font-medium text-a-indigo bg-indigo-900/20 border border-indigo-800/40
                         hover:bg-indigo-900/40 hover:border-indigo-700/60 px-2 py-0.5 rounded-full flex-shrink-0 transition-colors"
              title={`Configure ${control.name} on this application`}
            >
              <Zap size={10} /> Configure
            </button>
          )}

          {/* Edit */}
          <button
            onClick={() => setEditing(true)}
            className="flex-shrink-0 p-1.5 text-muted hover:text-secondary hover:bg-surface-700 rounded transition-colors"
            title="Edit status / notes"
          >
            <Pencil size={12} />
          </button>

          {/* Expand */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-shrink-0 text-faint hover:text-muted transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="px-4 pb-4 pt-2 border-t border-surface-700/60 space-y-3">
            <p className="text-xs text-muted leading-relaxed">{control.description}</p>

            <div className="flex flex-wrap gap-1">
              {control.capabilities.map(cap => (
                <span key={cap} className="text-[11px] text-muted bg-surface-700 border border-surface-600 px-2 py-0.5 rounded-full">
                  {cap}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted uppercase tracking-wider text-[10px] font-semibold mb-1">Policy Drivers</p>
                <div className="flex flex-wrap gap-1">
                  {control.policyDrivers.map(pd => (
                    <span key={pd} className="text-a-purple bg-violet-900/20 border border-violet-800/40 px-1.5 py-0.5 rounded text-[10px]">{pd}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-muted uppercase tracking-wider text-[10px] font-semibold mb-1">Applicable Tiers</p>
                <div className="flex flex-wrap gap-1">
                  {control.applicableTiers.map(t => (
                    <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${
                      t === 'critical' ? 'text-red-300 bg-red-900/20 border-red-800/40' :
                      t === 'high'     ? 'text-amber-300 bg-amber-900/20 border-amber-800/40' :
                      t === 'medium'   ? 'text-yellow-300 bg-yellow-900/20 border-yellow-800/40' :
                                        'text-muted bg-slate-800/40 border-slate-700'
                    }`}>{t}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-muted uppercase tracking-wider text-[10px] font-semibold mb-1">Complexity</p>
                <span className={`text-xs capitalize ${
                  control.implementationComplexity === 'high' ? 'text-a-red' :
                  control.implementationComplexity === 'medium' ? 'text-a-amber' : 'text-a-green'
                }`}>{control.implementationComplexity}</span>
              </div>
            </div>

            {control.notes && (
              <div className="bg-surface-700/40 border border-surface-600 rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">Notes</p>
                <p className="text-xs text-secondary">{control.notes}</p>
                {control.updatedBy && (
                  <p className="text-[10px] text-faint mt-1">Updated by {control.updatedBy} · {control.updatedAt ? new Date(control.updatedAt).toLocaleDateString() : ''}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function FullControlsPanel({ appId }: { appId: string }) {
  const [controls, setControls] = useState<AppControl[]>([])
  const [summary, setSummary]   = useState<ControlsSummary | null>(null)
  const [loading, setLoading]   = useState(true)
  const [pillar, setPillar]     = useState<IamPillar | 'ALL'>('ALL')
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState<CtrlStatus | 'ALL'>('ALL')

  useEffect(() => {
    let cancelled = false
    apiFetch(`/controls/app/${appId}`)
      .then(r => r.json())
      .then(j => {
        if (!cancelled && j.success) {
          setControls(j.data.controls)
          setSummary(j.data.summary)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [appId])

  const updateControl = (updated: AppControl) => {
    setControls(prev => prev.map(c => c.controlId === updated.controlId ? updated : c))
    setSummary(prev => {
      if (!prev) return prev
      // Recalculate summary
      const all = controls.map(c => c.controlId === updated.controlId ? updated : c)
      return {
        total:          all.length,
        implemented:    all.filter(c => c.status === 'implemented').length,
        gap:            all.filter(c => c.status === 'gap').length,
        not_applicable: all.filter(c => c.status === 'not_applicable').length,
        undetected:     all.filter(c => c.status === 'undetected').length,
      }
    })
  }

  const filtered = controls.filter(c => {
    const matchPillar  = pillar === 'ALL' || c.pillar === pillar
    const matchStatus  = statusFilter === 'ALL' || c.status === statusFilter
    const q            = search.toLowerCase()
    const matchSearch  = !q || c.name.toLowerCase().includes(q) ||
                         c.category.toLowerCase().includes(q) ||
                         c.tags.some(t => t.includes(q)) ||
                         c.controlId.toLowerCase().includes(q)
    return matchPillar && matchStatus && matchSearch
  })

  const pillars: IamPillar[] = ['AM', 'IGA', 'PAM', 'CIAM']

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-muted text-sm">Loading controls…</div>
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            { key: 'implemented',    label: 'Implemented',    color: 'text-a-green border-green-800/40 bg-green-900/10' },
            { key: 'gap',            label: 'Gap',            color: 'text-a-red border-red-800/40 bg-red-900/10' },
            { key: 'not_applicable', label: 'Not Applicable', color: 'text-muted border-slate-700 bg-slate-800/20' },
            { key: 'undetected',     label: 'Not Assessed',   color: 'text-muted border-surface-600 bg-surface-700/20' },
          ] as const).map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? 'ALL' : key)}
              className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-colors text-left ${color}
                ${statusFilter === key ? 'ring-1 ring-inset ring-current' : 'opacity-80 hover:opacity-100'}`}
            >
              <span className="text-xs font-medium">{label}</span>
              <span className="text-lg font-bold">{summary[key]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-44">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search controls…"
            className="w-full bg-surface-900 border border-surface-700 rounded-lg pl-8 pr-3 py-1.5 text-xs
                       text-body placeholder-faint focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setPillar('ALL')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border
              ${pillar === 'ALL' ? 'bg-indigo-600 border-indigo-600 text-white' : 'text-muted border-surface-700 hover:border-surface-500'}`}
          >
            <Layers size={11} /> All
          </button>
          {pillars.map(p => {
            const cfg  = PILLAR_CFG[p]
            const Icon = cfg.icon
            return (
              <button key={p} onClick={() => setPillar(pillar === p ? 'ALL' : p)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border
                  ${pillar === p ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'text-muted border-surface-700 hover:border-surface-500'}`}
              >
                <Icon size={11} /> {p}
              </button>
            )
          })}
        </div>
        <span className="text-xs text-faint">{filtered.length} of {controls.length}</span>
      </div>

      {/* Control list */}
      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted text-sm">No controls match your filters</div>
        ) : (
          filtered.map(c => (
            <ControlRow key={c.controlId} control={c} appId={appId} onUpdate={updateControl}  />
          ))
        )}
      </div>
    </div>
  )
}
