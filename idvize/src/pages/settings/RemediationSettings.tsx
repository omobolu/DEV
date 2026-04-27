/**
 * Remediation Workflow Settings — Tenant-level approval toggles.
 *
 * Controls whether remediation actions require IAM Manager and/or App Owner approval.
 * Settings are tenant-scoped and persisted to PostgreSQL via PATCH /tenants/me/settings.
 */

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Save, Loader2, Shield, CheckCircle, Users, UserCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '@/lib/apiClient'

interface RemediationConfig {
  requireIamManagerApproval: boolean
  requireAppOwnerApproval: boolean
}

const DEFAULT_CONFIG: RemediationConfig = {
  requireIamManagerApproval: true,
  requireAppOwnerApproval: true,
}

export default function RemediationSettings() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<RemediationConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/tenants/me/settings')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.remediation) {
          setConfig(json.data.remediation)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await apiFetch('/tenants/me/settings', {
        method: 'PATCH',
        body: JSON.stringify({ remediation: config }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to save')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }, [config])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-400" size={24} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-surface-700 text-muted">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-body flex items-center gap-2">
            <Shield size={20} className="text-indigo-400" />
            Remediation Workflow
          </h1>
          <p className="text-xs text-muted mt-0.5">Configure approval requirements for remediation actions</p>
        </div>
      </div>

      {/* Approval Toggles */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-body">Approval Requirements</h2>
        <p className="text-xs text-muted -mt-3">
          When enabled, remediation workflows require the specified approvals before execution begins.
        </p>

        {/* IAM Manager Approval */}
        <label className="flex items-start gap-4 p-4 rounded-lg border border-surface-600 hover:border-surface-500 cursor-pointer transition-colors">
          <div className="mt-0.5">
            <input
              type="checkbox"
              checked={config.requireIamManagerApproval}
              onChange={e => setConfig(c => ({ ...c, requireIamManagerApproval: e.target.checked }))}
              className="w-4 h-4 rounded border-surface-500 text-indigo-500 focus:ring-indigo-500 bg-surface-900"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-indigo-400" />
              <span className="text-sm font-medium text-body">Require IAM Manager Approval</span>
            </div>
            <p className="text-xs text-muted mt-1">
              An IAM program manager must approve remediation actions before the agent executes.
              This ensures IAM governance oversight on all configuration changes.
            </p>
          </div>
        </label>

        {/* App Owner Approval */}
        <label className="flex items-start gap-4 p-4 rounded-lg border border-surface-600 hover:border-surface-500 cursor-pointer transition-colors">
          <div className="mt-0.5">
            <input
              type="checkbox"
              checked={config.requireAppOwnerApproval}
              onChange={e => setConfig(c => ({ ...c, requireAppOwnerApproval: e.target.checked }))}
              className="w-4 h-4 rounded border-surface-500 text-indigo-500 focus:ring-indigo-500 bg-surface-900"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-amber-400" />
              <span className="text-sm font-medium text-body">Require App Owner Approval</span>
            </div>
            <p className="text-xs text-muted mt-1">
              The application&apos;s business owner must approve before remediation proceeds.
              Ensures business stakeholders are aware of changes to their applications.
            </p>
          </div>
        </label>
      </div>

      {/* Summary */}
      <div className="bg-surface-800/50 border border-surface-700 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Current Policy</h3>
        <ul className="space-y-1.5 text-xs text-muted">
          <li className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${config.requireIamManagerApproval ? 'bg-green-500' : 'bg-surface-500'}`} />
            IAM Manager Approval: <span className="font-medium text-body">{config.requireIamManagerApproval ? 'Required' : 'Not Required'}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${config.requireAppOwnerApproval ? 'bg-green-500' : 'bg-surface-500'}`} />
            App Owner Approval: <span className="font-medium text-body">{config.requireAppOwnerApproval ? 'Required' : 'Not Required'}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Approvals needed: <span className="font-medium text-body">{(config.requireIamManagerApproval ? 1 : 0) + (config.requireAppOwnerApproval ? 1 : 0)}</span>
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Settings
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle size={14} /> Saved
          </span>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  )
}
