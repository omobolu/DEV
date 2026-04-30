import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/apiClient'

type Status = 'connected' | 'failed' | 'not_configured' | 'mock'

interface PlatformConfig {
  entra:     { tenantId: string; clientId: string; clientSecret: string }
  sailpoint: { baseUrl: string; clientId: string; clientSecret: string }
  cyberark:  { baseUrl: string; username: string; password: string }
  okta:      { domain: string; apiToken: string }
}

interface Statuses {
  entra: Status; sailpoint: Status; cyberark: Status; okta: Status
}

type Platform = keyof PlatformConfig

const PLATFORMS: { key: Platform; label: string; logo: string; color: string; description: string }[] = [
  { key: 'entra',     label: 'Microsoft Entra ID', logo: '🔵', color: '#0078d4', description: 'Access Management · SSO · MFA · Conditional Access · SCIM' },
  { key: 'sailpoint', label: 'SailPoint IdentityNow', logo: '🔷', color: '#0033a0', description: 'IGA · Provisioning · Certifications · Joiner/Mover/Leaver' },
  { key: 'cyberark',  label: 'CyberArk PAM',         logo: '🔐', color: '#e31837', description: 'Privileged Access · Safe Management · Credential Rotation' },
  { key: 'okta',      label: 'Okta',                 logo: '⚪', color: '#007dc1', description: 'CIAM · SSO · MFA · Passwordless · Universal Directory' },
]

const EMPTY_CONFIG: PlatformConfig = {
  entra:     { tenantId: '', clientId: '', clientSecret: '' },
  sailpoint: { baseUrl: '', clientId: '', clientSecret: '' },
  cyberark:  { baseUrl: '', username: '', password: '' },
  okta:      { domain: '', apiToken: '' },
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    connected:     { label: 'Connected',     cls: 'bg-green-500/20 text-a-green border-green-500/30' },
    failed:        { label: 'Failed',        cls: 'bg-red-500/20 text-a-red border-red-500/30' },
    not_configured:{ label: 'Not Configured', cls: 'bg-slate-500/20 text-muted border-slate-500/30' },
    mock:          { label: 'Mock Mode',     cls: 'bg-amber-500/20 text-a-amber border-amber-500/30' },
  }
  const { label, cls } = map[status] ?? map.not_configured
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === 'connected' ? 'bg-green-400' : status === 'failed' ? 'bg-red-400' : status === 'mock' ? 'bg-amber-400' : 'bg-slate-400'}`} />
      {label}
    </span>
  )
}

export default function IntegrationsPage() {
  const [statuses, setStatuses]   = useState<Statuses>({ entra: 'not_configured', sailpoint: 'not_configured', cyberark: 'not_configured', okta: 'not_configured' })
  const [config, setConfig]       = useState<PlatformConfig>(EMPTY_CONFIG)
  const [active, setActive]       = useState<Platform>('entra')
  const [saving, setSaving]       = useState(false)
  const [testing, setTesting]     = useState(false)
  const [testResult, setTestResult] = useState<{ status: Status; message: string } | null>(null)
  const [saveMsg, setSaveMsg]     = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    try {
      const res = await apiFetch('/integrations/config')
      const json = await res.json()
      if (json.success) {
        setStatuses(json.data.statuses)
        const c = json.data.config
        setConfig({
          entra:     { tenantId: c.entra.tenantId, clientId: c.entra.clientId, clientSecret: c.entra.clientSecret },
          sailpoint: { baseUrl: c.sailpoint.baseUrl, clientId: c.sailpoint.clientId, clientSecret: c.sailpoint.clientSecret },
          cyberark:  { baseUrl: c.cyberark.baseUrl, username: c.cyberark.username, password: c.cyberark.password },
          okta:      { domain: c.okta.domain, apiToken: c.okta.apiToken },
        })
      }
    } catch { /* backend unreachable */ }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const updateField = (platform: Platform, field: string, value: string) => {
    setConfig(prev => ({ ...prev, [platform]: { ...prev[platform], [field]: value } }))
    setTestResult(null)
    setSaveMsg(null)
  }

  const handleSave = async () => {
    setSaving(true); setSaveMsg(null)
    try {
      const res = await apiFetch('/integrations/configure', {
        method: 'POST',
        body: JSON.stringify({ [active]: config[active] }),
      })
      const json = await res.json()
      if (json.success) {
        setStatuses(json.data.statuses)
        setSaveMsg('Credentials saved successfully')
      } else {
        setSaveMsg('Save failed — ' + json.error)
      }
    } catch { setSaveMsg('Network error — could not save') }
    finally { setSaving(false) }
  }

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      // Always send the current form values — never rely on previously saved credentials
      const res = await apiFetch(`/integrations/test/${active}`, {
        method: 'POST',
        body: JSON.stringify({ [active]: config[active] }),
      })
      const json = await res.json()
      if (json.success) {
        setTestResult({ status: json.data.status, message: json.data.message })
        if (json.data.status === 'connected') {
          setStatuses(prev => ({ ...prev, [active]: 'connected' }))
        }
      } else {
        setTestResult({ status: 'failed', message: json.error ?? 'Test failed' })
      }
    } catch { setTestResult({ status: 'failed', message: 'Network error — could not reach API' }) }
    finally { setTesting(false) }
  }

  const renderForm = () => {
    const c = config[active]
    const inp = 'w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-body placeholder-muted focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
    const lbl = 'block text-xs font-medium text-muted mb-1'

    if (active === 'entra') {
      const v = c as PlatformConfig['entra']
      return (
        <div className="space-y-4">
          <div>
            <label htmlFor="entra-tenant-id" className={lbl}>Tenant ID <span className="text-a-red">*</span></label>
            <input id="entra-tenant-id" className={inp} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={v.tenantId} onChange={e => updateField('entra', 'tenantId', e.target.value)} />
            <p className="text-xs text-muted mt-1">Found in Azure Portal → Entra ID → Overview</p>
          </div>
          <div>
            <label htmlFor="entra-client-id" className={lbl}>Client ID (App Registration) <span className="text-a-red">*</span></label>
            <input id="entra-client-id" className={inp} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={v.clientId} onChange={e => updateField('entra', 'clientId', e.target.value)} />
            <p className="text-xs text-muted mt-1">Azure Portal → App Registrations → your app → Application (client) ID</p>
          </div>
          <div>
            <label htmlFor="entra-client-secret" className={lbl}>Client Secret <span className="text-a-red">*</span></label>
            <input id="entra-client-secret" className={inp} type="password" placeholder="Enter client secret value"
              value={v.clientSecret} onChange={e => updateField('entra', 'clientSecret', e.target.value)} />
            <p className="text-xs text-muted mt-1">Azure Portal → App Registrations → Certificates & Secrets → New client secret</p>
          </div>
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-a-indigo">
            <strong>Required API permissions:</strong> Application.Read.All · Policy.Read.All · Directory.Read.All
            (Microsoft Graph, Application type)
          </div>
        </div>
      )
    }

    if (active === 'sailpoint') {
      const v = c as PlatformConfig['sailpoint']
      return (
        <div className="space-y-4">
          <div>
            <label htmlFor="sailpoint-base-url" className={lbl}>IdentityNow Base URL <span className="text-a-red">*</span></label>
            <input id="sailpoint-base-url" className={inp} placeholder="https://tenant.api.identitynow.com"
              value={v.baseUrl} onChange={e => updateField('sailpoint', 'baseUrl', e.target.value)} />
          </div>
          <div>
            <label htmlFor="sailpoint-client-id" className={lbl}>Client ID <span className="text-a-red">*</span></label>
            <input id="sailpoint-client-id" className={inp} placeholder="SailPoint OAuth client ID"
              value={v.clientId} onChange={e => updateField('sailpoint', 'clientId', e.target.value)} />
          </div>
          <div>
            <label htmlFor="sailpoint-client-secret" className={lbl}>Client Secret <span className="text-a-red">*</span></label>
            <input id="sailpoint-client-secret" className={inp} type="password" placeholder="SailPoint OAuth client secret"
              value={v.clientSecret} onChange={e => updateField('sailpoint', 'clientSecret', e.target.value)} />
          </div>
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-a-indigo">
            <strong>Setup:</strong> Admin → API Management → Create OAuth client with client_credentials grant
          </div>
        </div>
      )
    }

    if (active === 'cyberark') {
      const v = c as PlatformConfig['cyberark']
      return (
        <div className="space-y-4">
          <div>
            <label htmlFor="cyberark-base-url" className={lbl}>CyberArk PVWA Base URL <span className="text-a-red">*</span></label>
            <input id="cyberark-base-url" className={inp} placeholder="https://cyberark.yourcompany.com"
              value={v.baseUrl} onChange={e => updateField('cyberark', 'baseUrl', e.target.value)} />
          </div>
          <div>
            <label htmlFor="cyberark-username" className={lbl}>Username <span className="text-a-red">*</span></label>
            <input id="cyberark-username" className={inp} placeholder="API service account username"
              value={v.username} onChange={e => updateField('cyberark', 'username', e.target.value)} />
          </div>
          <div>
            <label htmlFor="cyberark-password" className={lbl}>Password <span className="text-a-red">*</span></label>
            <input id="cyberark-password" className={inp} type="password" placeholder="Service account password"
              value={v.password} onChange={e => updateField('cyberark', 'password', e.target.value)} />
          </div>
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-a-indigo">
            <strong>Required:</strong> CyberArk user with Safe List, Account List, and Vault permissions
          </div>
        </div>
      )
    }

    if (active === 'okta') {
      const v = c as PlatformConfig['okta']
      return (
        <div className="space-y-4">
          <div>
            <label htmlFor="okta-domain" className={lbl}>Okta Domain <span className="text-a-red">*</span></label>
            <input id="okta-domain" className={inp} placeholder="yourorg.okta.com"
              value={v.domain} onChange={e => updateField('okta', 'domain', e.target.value)} />
            <p className="text-xs text-muted mt-1">Without https:// — e.g. dev-12345.okta.com</p>
          </div>
          <div>
            <label htmlFor="okta-api-token" className={lbl}>API Token <span className="text-a-red">*</span></label>
            <input id="okta-api-token" className={inp} type="password" placeholder="Okta API token (SSWS ...)"
              value={v.apiToken} onChange={e => updateField('okta', 'apiToken', e.target.value)} />
            <p className="text-xs text-muted mt-1">Okta Admin → Security → API → Tokens → Create Token</p>
          </div>
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-a-indigo">
            <strong>Required scopes:</strong> okta.apps.read · okta.policies.read · okta.groups.read
          </div>
        </div>
      )
    }

    return null
  }

  const activePlatform = PLATFORMS.find(p => p.key === active)!

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-heading">IAM Platform Integrations</h1>
        <p className="text-sm text-muted mt-1">Connect idvize to your IAM tools. Credentials are saved to the API server's .env file.</p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {PLATFORMS.map(p => (
          <button
            key={p.key}
            onClick={() => { setActive(p.key); setTestResult(null); setSaveMsg(null) }}
            aria-label={`Configure ${p.label}`}
            aria-pressed={active === p.key}
            className={`text-left rounded-xl border p-4 transition-all ${active === p.key ? 'border-indigo-500 bg-indigo-500/10' : 'border-surface-600 bg-surface-800 hover:border-surface-500'}`}
          >
            <div className="text-2xl mb-2">{p.logo}</div>
            <div className="text-sm font-medium text-body leading-tight">{p.label}</div>
            <div className="mt-2">
              <StatusBadge status={statuses[p.key]} />
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-surface-600 bg-surface-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-700 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-heading">{activePlatform.logo} {activePlatform.label}</h2>
            <p className="text-xs text-muted mt-0.5">{activePlatform.description}</p>
          </div>
          <StatusBadge status={statuses[active]} />
        </div>

        <div className="p-6">
          {renderForm()}

          {testResult && (
            <div role="alert" className={`mt-4 rounded-lg border p-3 text-sm ${testResult.status === 'connected' ? 'bg-green-500/10 border-green-500/30 text-a-green' : 'bg-red-500/10 border-red-500/30 text-a-red'}`}>
              {testResult.status === 'connected' ? '✓' : '✗'} {testResult.message}
            </div>
          )}

          {saveMsg && (
            <div role="alert" className={`mt-4 rounded-lg border p-3 text-sm ${saveMsg.includes('success') ? 'bg-green-500/10 border-green-500/30 text-a-green' : 'bg-red-500/10 border-red-500/30 text-a-red'}`}>
              {saveMsg}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              aria-label={`Save ${activePlatform.label} credentials`}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Credentials'}
            </button>
            <button
              onClick={handleTest}
              disabled={testing}
              aria-label={`Test ${activePlatform.label} connection`}
              className="px-4 py-2 rounded-lg border border-surface-500 hover:border-surface-400 text-secondary text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-a-amber">
        <strong>Note:</strong> Credentials are saved to the server's <code>.env</code> file and applied immediately at runtime.
        They persist across server restarts. Never commit your <code>.env</code> file to source control.
      </div>
    </div>
  )
}
