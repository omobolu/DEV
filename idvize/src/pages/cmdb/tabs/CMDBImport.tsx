import { useState } from 'react'
import { FileSpreadsheet, Globe, Download, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react'
import { useCMDB } from '@/context/CMDBContext'
import CSVDropZone from '../components/CSVDropZone'
import APIConnectorForm from '../components/APIConnectorForm'
import FieldMappingTable, { buildInitialMappings } from '../components/FieldMappingTable'
import type { ParsedCSV } from '../components/CSVDropZone'
import type { CMDBApp, FieldMapping, CMDBFieldKey } from '@/types/cmdb'
import { generateSampleCsv } from '@/data/cmdbMock'

type Source = 'csv' | 'api' | null
type Step = 'source' | 'configure' | 'map' | 'preview' | 'done'

function coerceBool(v: string): boolean {
  return ['true','yes','1','enabled','y'].includes(v.toLowerCase())
}

function applyMapping(rows: Record<string, string>[], mappings: FieldMapping[]): CMDBApp[] {
  return rows.map((row, idx) => {
    const app: Partial<CMDBApp> & { appId: string; appName: string } = {
      appId: `IMP-${String(idx + 1).padStart(4, '0')}`,
      appName: `Unknown App ${idx + 1}`,
      department: '', appType: 'SaaS', businessCriticality: 'Medium',
      dataClassification: 'Internal', businessOwner: '', itOwner: '',
      ssoEnabled: false, mfaRequired: false,
      provisioningType: 'Manual', deprovisioningType: 'Manual',
      accessReviewFrequency: 'Annual', pamVaulted: false, rbacEnabled: false,
      jitAccess: false, sodPoliciesDefined: false, complianceFrameworks: '',
      totalAccounts: 0, activeAccounts: 0, orphanAccounts: 0,
      lastAccessReviewDate: '', nextAccessReviewDate: '',
      onboardingStatus: 'Not Started',
    }
    mappings.forEach(({ sourceHeader, targetField }) => {
      if (!targetField || !(sourceHeader in row)) return
      const raw = row[sourceHeader] ?? ''
      const field = targetField as CMDBFieldKey
      const typedApp = app as Record<string, unknown>
      // Boolean fields
      if (['ssoEnabled','mfaRequired','pamVaulted','rbacEnabled','jitAccess','sodPoliciesDefined'].includes(field)) {
        typedApp[field] = coerceBool(raw)
      } else if (['totalAccounts','activeAccounts','orphanAccounts'].includes(field)) {
        typedApp[field] = parseInt(raw, 10) || 0
      } else {
        typedApp[field] = raw
      }
    })
    return app as CMDBApp
  })
}

function downloadSampleCsv() {
  const csv = generateSampleCsv()
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'idvize-cmdb-sample.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function CMDBImport({ onComplete }: { onComplete?: () => void }) {
  const { apiConfig, updateApiConfig, updateMappings, importApps } = useCMDB()
  const [source, setSource] = useState<Source>(null)
  const [step, setStep] = useState<Step>('source')
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null)
  const [localMappings, setLocalMappings] = useState<FieldMapping[]>([])

  const handleCSVParsed = (result: ParsedCSV) => {
    setParsedData({ headers: result.headers, rows: result.rows })
    const initial = buildInitialMappings(result.headers)
    setLocalMappings(initial)
    setStep('map')
  }

  const handleAPIFetched = (rows: Record<string, string>[]) => {
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    setParsedData({ headers, rows })
    const initial = buildInitialMappings(headers)
    setLocalMappings(initial)
    setStep('map')
  }

  const handleImport = () => {
    if (!parsedData) return
    updateMappings(localMappings)
    const apps = applyMapping(parsedData.rows, localMappings)
    importApps(apps, {
      source: source ?? 'csv',
      timestamp: new Date().toISOString(),
      count: apps.length,
      fileName: undefined,
    })
    setStep('done')
  }

  const reset = () => {
    setSource(null); setStep('source')
    setParsedData(null); setLocalMappings([])
  }

  // ── Step: Choose Source ──────────────────────────────────────────────────
  if (step === 'source') return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Choose how to import your CMDB data.</p>
        </div>
        <button
          onClick={downloadSampleCsv}
          className="flex items-center gap-2 text-xs text-a-purple border border-violet-800/50 px-3 py-1.5 rounded-lg hover:bg-violet-900/20 transition-colors"
        >
          <Download size={12} /> Download Sample CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => { setSource('csv'); setStep('configure') }}
          className="flex flex-col items-center gap-4 p-8 bg-surface-800 border-2 border-surface-700
                     rounded-xl hover:border-violet-600 hover:bg-violet-900/10 transition-all group"
        >
          <FileSpreadsheet size={36} className="text-a-purple group-hover:scale-110 transition-transform" />
          <div className="text-center">
            <p className="font-semibold text-heading">CSV File</p>
            <p className="text-xs text-muted mt-1">Upload a .csv file from your system</p>
          </div>
        </button>
        <button
          onClick={() => { setSource('api'); setStep('configure') }}
          className="flex flex-col items-center gap-4 p-8 bg-surface-800 border-2 border-surface-700
                     rounded-xl hover:border-violet-600 hover:bg-violet-900/10 transition-all group"
        >
          <Globe size={36} className="text-a-purple group-hover:scale-110 transition-transform" />
          <div className="text-center">
            <p className="font-semibold text-heading">REST API</p>
            <p className="text-xs text-muted mt-1">Connect to an endpoint with custom headers</p>
          </div>
        </button>
      </div>
    </div>
  )

  // ── Step: Configure source ───────────────────────────────────────────────
  if (step === 'configure') return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep('source')} className="text-muted hover:text-secondary">
          <ArrowLeft size={16} />
        </button>
        <p className="text-sm text-muted">
          {source === 'csv' ? 'Upload your CSV file' : 'Configure API connection'}
        </p>
      </div>

      {source === 'csv' && (
        <CSVDropZone onParsed={handleCSVParsed} />
      )}
      {source === 'api' && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
          <APIConnectorForm
            config={apiConfig}
            onChange={updateApiConfig}
            onFetched={handleAPIFetched}
          />
        </div>
      )}
    </div>
  )

  // ── Step: Map Fields ─────────────────────────────────────────────────────
  if (step === 'map') return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('configure')} className="text-muted hover:text-secondary">
            <ArrowLeft size={16} />
          </button>
          <p className="text-sm text-muted">
            Map the {parsedData?.headers.length} detected columns to CMDB fields
          </p>
        </div>
        <button
          onClick={() => setStep('preview')}
          disabled={!localMappings.some(m => m.targetField !== null)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
        >
          Preview <ArrowRight size={14} />
        </button>
      </div>
      <FieldMappingTable
        headers={parsedData?.headers ?? []}
        sampleRow={parsedData?.rows[0]}
        mappings={localMappings}
        onChange={setLocalMappings}
      />
    </div>
  )

  // ── Step: Preview ────────────────────────────────────────────────────────
  if (step === 'preview') {
    const preview = applyMapping(parsedData?.rows.slice(0, 5) ?? [], localMappings)
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('map')} className="text-muted hover:text-secondary">
              <ArrowLeft size={16} />
            </button>
            <p className="text-sm text-muted">
              Preview — first 5 rows after mapping ({parsedData?.rows.length.toLocaleString()} total)
            </p>
          </div>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Import All {parsedData?.rows.length.toLocaleString()} Records
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-surface-700">
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-surface-900 border-b border-surface-700">
                {['App ID','App Name','Dept','Type','Criticality','SSO','MFA','PAM'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-muted uppercase tracking-wide font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((app, i) => (
                <tr key={i} className={`border-b border-surface-700 ${i % 2 === 0 ? 'bg-surface-800' : 'bg-surface-800/60'}`}>
                  <td className="px-3 py-2 font-mono text-muted">{app.appId}</td>
                  <td className="px-3 py-2 text-body font-medium">{app.appName}</td>
                  <td className="px-3 py-2 text-muted">{app.department}</td>
                  <td className="px-3 py-2 text-muted">{app.appType}</td>
                  <td className="px-3 py-2 text-muted">{app.businessCriticality}</td>
                  <td className="px-3 py-2">{app.ssoEnabled ? '✓' : '✗'}</td>
                  <td className="px-3 py-2">{app.mfaRequired ? '✓' : '✗'}</td>
                  <td className="px-3 py-2">{app.pamVaulted ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Step: Done ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center gap-6 h-64">
      <CheckCircle size={48} className="text-a-green" />
      <div className="text-center">
        <p className="text-xl font-bold text-heading">Import Complete</p>
        <p className="text-muted mt-1">
          {parsedData?.rows.length.toLocaleString()} applications loaded into idvize
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={reset}
          className="px-4 py-2 border border-surface-600 text-secondary hover:bg-surface-700 text-sm rounded-lg transition-colors">
          Import Another File
        </button>
        {onComplete && (
          <button onClick={onComplete}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">
            View Data
          </button>
        )}
      </div>
    </div>
  )
}
