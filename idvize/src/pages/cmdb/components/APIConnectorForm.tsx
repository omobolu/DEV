import { useState } from 'react'
import { Plus, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import type { APIConnectionConfig } from '@/types/cmdb'

interface TestResult {
  ok: boolean
  message: string
  rowCount?: number
}

interface APIConnectorFormProps {
  config: APIConnectionConfig
  onChange: (patch: Partial<APIConnectionConfig>) => void
  onFetched: (rows: Record<string, string>[]) => void
}

function dig(obj: unknown, path: string): unknown {
  if (!path) return obj
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export default function APIConnectorForm({ config, onChange, onFetched }: APIConnectorFormProps) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  const addHeader = () => {
    onChange({
      customHeaders: [
        ...config.customHeaders,
        { id: crypto.randomUUID(), key: '', value: '' },
      ],
    })
  }

  const removeHeader = (id: string) => {
    onChange({ customHeaders: config.customHeaders.filter(h => h.id !== id) })
  }

  const updateHeader = (id: string, field: 'key' | 'value', value: string) => {
    onChange({
      customHeaders: config.customHeaders.map(h => h.id === id ? { ...h, [field]: value } : h),
    })
  }

  const buildHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.authType === 'bearer' && config.bearerToken)
      h['Authorization'] = `Bearer ${config.bearerToken}`
    if (config.authType === 'apiKey' && config.apiKeyHeader && config.apiKeyValue)
      h[config.apiKeyHeader] = config.apiKeyValue
    if (config.authType === 'basic' && config.basicUser)
      h['Authorization'] = `Basic ${btoa(`${config.basicUser}:${config.basicPassword}`)}`
    config.customHeaders.forEach(({ key, value }) => { if (key) h[key] = value })
    return h
  }

  const doFetch = async () => {
    if (!config.url) return
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch(config.url, {
        method: config.method,
        headers: buildHeaders(),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      const json: unknown = await res.json()
      const data = config.jsonPath ? dig(json, config.jsonPath) : json
      if (!Array.isArray(data)) throw new Error('Response is not an array (check JSON Path)')
      const rows = data as Record<string, string>[]
      setTestResult({ ok: true, message: `Connected — ${rows.length} records found`, rowCount: rows.length })
      return rows
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
      return undefined
    } finally {
      setTesting(false)
    }
  }

  const handleTest = () => void doFetch()
  const handleImport = async () => {
    const rows = await doFetch()
    if (rows) onFetched(rows)
  }

  const inputCls = 'w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-secondary placeholder-faint focus:outline-none focus:border-violet-500'
  const labelCls = 'block text-xs text-muted mb-1'

  return (
    <div className="space-y-5">
      {/* URL + Method */}
      <div className="flex gap-3">
        <div className="w-28 flex-shrink-0">
          <label className={labelCls}>Method</label>
          <select
            value={config.method}
            onChange={e => onChange({ method: e.target.value as 'GET' | 'POST' })}
            className={inputCls}
          >
            <option>GET</option>
            <option>POST</option>
          </select>
        </div>
        <div className="flex-1">
          <label className={labelCls}>Endpoint URL</label>
          <input
            type="url"
            value={config.url}
            onChange={e => onChange({ url: e.target.value })}
            placeholder="https://api.example.com/cmdb/apps"
            className={inputCls}
          />
        </div>
      </div>

      {/* Auth */}
      <div>
        <label className={labelCls}>Authentication</label>
        <div className="flex gap-2 flex-wrap">
          {(['none', 'bearer', 'apiKey', 'basic'] as const).map(t => (
            <button
              key={t}
              onClick={() => onChange({ authType: t })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                ${config.authType === t
                  ? 'bg-violet-600 border-violet-500 text-white'
                  : 'bg-surface-700 border-surface-600 text-muted hover:text-body'}`}
            >
              {t === 'none' ? 'None' : t === 'bearer' ? 'Bearer Token' : t === 'apiKey' ? 'API Key' : 'Basic Auth'}
            </button>
          ))}
        </div>

        {config.authType === 'bearer' && (
          <div className="mt-3">
            <label className={labelCls}>Bearer Token</label>
            <input type="password" value={config.bearerToken} onChange={e => onChange({ bearerToken: e.target.value })}
              placeholder="eyJ..." className={inputCls} />
          </div>
        )}
        {config.authType === 'apiKey' && (
          <div className="mt-3 flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Header Name</label>
              <input value={config.apiKeyHeader} onChange={e => onChange({ apiKeyHeader: e.target.value })}
                placeholder="X-API-Key" className={inputCls} />
            </div>
            <div className="flex-1">
              <label className={labelCls}>Value</label>
              <input type="password" value={config.apiKeyValue} onChange={e => onChange({ apiKeyValue: e.target.value })}
                placeholder="your-api-key" className={inputCls} />
            </div>
          </div>
        )}
        {config.authType === 'basic' && (
          <div className="mt-3 flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Username</label>
              <input value={config.basicUser} onChange={e => onChange({ basicUser: e.target.value })}
                className={inputCls} />
            </div>
            <div className="flex-1">
              <label className={labelCls}>Password</label>
              <input type="password" value={config.basicPassword} onChange={e => onChange({ basicPassword: e.target.value })}
                className={inputCls} />
            </div>
          </div>
        )}
      </div>

      {/* Custom Headers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls + ' mb-0'}>Custom Headers</label>
          <button onClick={addHeader}
            className="flex items-center gap-1 text-xs text-a-purple hover:text-a-purple transition-colors">
            <Plus size={12} /> Add Header
          </button>
        </div>
        {config.customHeaders.length === 0 && (
          <p className="text-xs text-faint italic">No custom headers — click "Add Header" to add one</p>
        )}
        <div className="space-y-2">
          {config.customHeaders.map(h => (
            <div key={h.id} className="flex gap-2 items-center">
              <input value={h.key} onChange={e => updateHeader(h.id, 'key', e.target.value)}
                placeholder="Header-Name" className={inputCls + ' flex-1'} />
              <input value={h.value} onChange={e => updateHeader(h.id, 'value', e.target.value)}
                placeholder="value" className={inputCls + ' flex-1'} />
              <button onClick={() => removeHeader(h.id)} className="text-faint hover:text-a-red transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* JSON Path */}
      <div>
        <label className={labelCls}>JSON Path <span className="text-faint">(optional — to reach nested array)</span></label>
        <input value={config.jsonPath} onChange={e => onChange({ jsonPath: e.target.value })}
          placeholder="e.g.  data.items  or  results.apps"
          className={inputCls} />
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`flex items-center gap-2 text-sm p-3 rounded-lg border
          ${testResult.ok
            ? 'bg-green-900/20 border-green-800 text-a-green'
            : 'bg-red-900/20 border-red-800 text-a-red'}`}>
          {testResult.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {testResult.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleTest}
          disabled={!config.url || testing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-600 text-sm text-secondary hover:bg-surface-700 disabled:opacity-40 transition-colors"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : null}
          Test Connection
        </button>
        <button
          onClick={handleImport}
          disabled={!config.url || testing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-40 transition-colors"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : null}
          Fetch & Map Fields
        </button>
      </div>
    </div>
  )
}
