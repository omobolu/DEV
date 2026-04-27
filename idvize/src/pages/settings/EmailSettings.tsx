/**
 * Email Settings — SMTP Configuration Management
 *
 * Allows admins to configure email settings (SMTP, Mailtrap, SendGrid, M365).
 * Passwords are never returned from the backend — only a passwordSet flag.
 * Includes "Send Test Email" and "Verify Connection" functionality.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Mail, Settings, Save, Send, CheckCircle, XCircle,
  Eye, EyeOff, Loader2, Shield, RefreshCw, ArrowLeft,
  ServerCog, AlertTriangle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '@/lib/apiClient'

// ── Types ────────────────────────────────────────────────────────────────────

type Provider = 'smtp' | 'mailtrap' | 'sendgrid' | 'microsoft365'

interface SmtpConfigResponse {
  host: string
  port: number
  username: string
  passwordSet: boolean
  fromEmail: string
  fromDisplayName: string
  useTls: boolean
  provider: Provider
  updatedAt: string
  updatedBy: string
}

interface FormState {
  host: string
  port: string
  username: string
  password: string
  fromEmail: string
  fromDisplayName: string
  useTls: boolean
  provider: Provider
}

const EMPTY_FORM: FormState = {
  host: '',
  port: '587',
  username: '',
  password: '',
  fromEmail: '',
  fromDisplayName: 'IDVIZE',
  useTls: true,
  provider: 'smtp',
}

const PROVIDERS: { value: Provider; label: string; defaultHost: string; defaultPort: string }[] = [
  { value: 'mailtrap',       label: 'Mailtrap (Dev/Test)',  defaultHost: 'sandbox.smtp.mailtrap.io', defaultPort: '2525' },
  { value: 'smtp',           label: 'Generic SMTP',         defaultHost: '',                          defaultPort: '587' },
  { value: 'microsoft365',   label: 'Microsoft 365',        defaultHost: 'smtp.office365.com',        defaultPort: '587' },
  { value: 'sendgrid',       label: 'SendGrid',             defaultHost: 'smtp.sendgrid.net',         defaultPort: '587' },
]

// ── Component ────────────────────────────────────────────────────────────────

export default function EmailSettings() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<SmtpConfigResponse | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/email/config')
      const json = await res.json()
      if (json.success && json.data) {
        setConfig(json.data)
        setForm({
          host: json.data.host,
          port: String(json.data.port),
          username: json.data.username,
          password: '',
          fromEmail: json.data.fromEmail,
          fromDisplayName: json.data.fromDisplayName,
          useTls: json.data.useTls,
          provider: json.data.provider,
        })
      }
    } catch {
      // No config yet — keep empty form
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const handleProviderChange = (provider: Provider) => {
    const p = PROVIDERS.find(pp => pp.value === provider)
    setForm(prev => ({
      ...prev,
      provider,
      host: p?.defaultHost || prev.host,
      port: p?.defaultPort || prev.port,
    }))
  }

  const handleSave = async () => {
    if (!form.host || !form.port || !form.username || !form.fromEmail || !form.fromDisplayName) {
      setMessage({ type: 'error', text: 'All fields except password are required.' })
      return
    }
    if (!config && !form.password) {
      setMessage({ type: 'error', text: 'Password is required for initial setup.' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const body: Record<string, unknown> = {
        host: form.host,
        port: parseInt(form.port, 10),
        username: form.username,
        fromEmail: form.fromEmail,
        fromDisplayName: form.fromDisplayName,
        useTls: form.useTls,
        provider: form.provider,
      }
      if (form.password) body.password = form.password

      const res = await apiFetch('/email/config', {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        setConfig(json.data)
        setForm(prev => ({ ...prev, password: '' }))
        setMessage({ type: 'success', text: 'Email configuration saved successfully.' })
      } else {
        setMessage({ type: 'error', text: json.error ?? 'Failed to save configuration.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save configuration.' })
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setMessage(null)
    try {
      const res = await apiFetch('/email/verify', { method: 'POST' })
      const json = await res.json()
      if (json.success && json.data?.success) {
        setMessage({ type: 'success', text: 'SMTP connection verified successfully.' })
      } else {
        setMessage({ type: 'error', text: `Connection failed: ${json.data?.error ?? json.error ?? 'Unknown error'}` })
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection verification failed.' })
    } finally {
      setVerifying(false)
    }
  }

  const handleTestEmail = async () => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Enter a recipient email address.' })
      return
    }

    setTesting(true)
    setMessage(null)
    try {
      const tenantName = localStorage.getItem('idvize_tenant') ?? ''
      const res = await apiFetch('/email/test', {
        method: 'POST',
        body: JSON.stringify({ recipientEmail: testEmail, tenantName }),
      })
      const json = await res.json()
      if (json.success && json.data?.success) {
        setMessage({ type: 'success', text: `Test email sent to ${testEmail} (Message ID: ${json.data.messageId})` })
      } else {
        setMessage({ type: 'error', text: `Test email failed: ${json.data?.error ?? json.error ?? 'Unknown error'}` })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to send test email.' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
        <span className="ml-2 text-secondary">Loading email configuration...</span>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:bg-surface-700 hover:text-heading transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Mail size={20} className="text-indigo-400" />
          <h1 className="text-xl font-semibold text-heading">Email Configuration</h1>
        </div>
        <div className="flex-1" />
        {config && (
          <span className="text-xs text-muted">
            Last updated: {new Date(config.updatedAt).toLocaleDateString()} by {config.updatedBy}
          </span>
        )}
      </div>

      {/* Status message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${
          message.type === 'success'
            ? 'bg-green-900/20 border-green-700/50 text-green-300'
            : 'bg-red-900/20 border-red-700/50 text-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Provider Selection */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-heading font-medium">
          <ServerCog size={16} className="text-indigo-400" />
          Email Provider
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PROVIDERS.map(p => (
            <button
              key={p.value}
              onClick={() => handleProviderChange(p.value)}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                form.provider === p.value
                  ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300'
                  : 'bg-surface-900 border-surface-600 text-secondary hover:border-surface-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {form.provider === 'mailtrap' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/40">
            <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
            <span className="text-xs text-amber-300">Mailtrap is for development/testing only. Emails are captured and not delivered to real inboxes.</span>
          </div>
        )}
      </div>

      {/* SMTP Configuration */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-heading font-medium">
          <Settings size={16} className="text-indigo-400" />
          SMTP Configuration
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-secondary mb-1.5">SMTP Host</label>
            <input
              type="text"
              value={form.host}
              onChange={e => setForm(prev => ({ ...prev, host: e.target.value }))}
              placeholder="smtp.example.com"
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-heading placeholder:text-muted focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Port</label>
            <input
              type="number"
              value={form.port}
              onChange={e => setForm(prev => ({ ...prev, port: e.target.value }))}
              placeholder="587"
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-heading placeholder:text-muted focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
              placeholder="user@example.com"
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-heading placeholder:text-muted focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">
              Password / Secret
              {config?.passwordSet && (
                <span className="ml-2 text-green-400 text-[10px]">(set)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder={config?.passwordSet ? '••••••• (leave blank to keep)' : 'Enter password'}
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 pr-10 text-sm text-heading placeholder:text-muted focus:border-indigo-500 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-heading transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">From Email</label>
            <input
              type="email"
              value={form.fromEmail}
              onChange={e => setForm(prev => ({ ...prev, fromEmail: e.target.value }))}
              placeholder="no-reply@yourcompany.com"
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-heading placeholder:text-muted focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">From Display Name</label>
            <input
              type="text"
              value={form.fromDisplayName}
              onChange={e => setForm(prev => ({ ...prev, fromDisplayName: e.target.value }))}
              placeholder="IDVIZE"
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-heading placeholder:text-muted focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* TLS Toggle */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setForm(prev => ({ ...prev, useTls: !prev.useTls }))}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              form.useTls ? 'bg-indigo-600' : 'bg-surface-600'
            }`}
            role="switch"
            aria-checked={form.useTls}
            aria-label="Enable TLS/SSL"
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              form.useTls ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`} />
          </button>
          <div>
            <span className="text-sm text-heading">TLS/SSL Encryption</span>
            <span className="text-xs text-muted ml-2">{form.useTls ? 'Enabled' : 'Disabled'}</span>
          </div>
          <Shield size={14} className={form.useTls ? 'text-green-400' : 'text-muted'} />
        </div>

        {/* Save + Verify buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>

          {config && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-700 hover:bg-surface-600 text-secondary hover:text-heading text-sm font-medium rounded-lg border border-surface-600 transition-colors disabled:opacity-50"
            >
              {verifying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {verifying ? 'Verifying...' : 'Verify Connection'}
            </button>
          )}
        </div>
      </div>

      {/* Send Test Email */}
      {config && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-heading font-medium">
            <Send size={16} className="text-indigo-400" />
            Send Test Email
          </div>
          <p className="text-sm text-secondary">
            Send a test email to verify your configuration is working correctly.
          </p>

          <div className="flex items-center gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-heading placeholder:text-muted focus:border-indigo-500 focus:outline-none transition-colors"
            />
            <button
              onClick={handleTestEmail}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {testing ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>
        </div>
      )}

      {/* Security Info */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
        <div className="flex items-center gap-2 text-heading font-medium mb-3">
          <Shield size={16} className="text-indigo-400" />
          Security
        </div>
        <ul className="space-y-2 text-sm text-secondary">
          <li className="flex items-center gap-2">
            <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
            Passwords are stored securely and never returned to the UI
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
            All configuration changes are audit-logged
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
            Email configuration is tenant-scoped — each tenant manages their own settings
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
            Only authorized administrators can view and modify email settings
          </li>
        </ul>
      </div>
    </div>
  )
}
