import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCMDB } from '@/context/CMDBContext'
import DataTable from '@/components/common/DataTable'
import Badge from '@/components/common/Badge'
import { Download, RefreshCw, ExternalLink, LayoutDashboard } from 'lucide-react'
import type { CMDBApp, Criticality, OnboardingStatus } from '@/types/cmdb'
import type { Column } from '@/components/common/DataTable'
import { generateSampleCsv } from '@/data/cmdbMock'
import { cmdbDetailService } from '@/features/cmdb/services/cmdbDetailService'

const critVariant: Record<Criticality, 'danger' | 'warning' | 'info' | 'neutral'> = {
  Critical: 'danger', High: 'warning', Medium: 'info', Low: 'neutral',
}
const statusVariant: Record<OnboardingStatus, 'success' | 'info' | 'neutral' | 'warning'> = {
  Onboarded: 'success', 'In Progress': 'info', Planned: 'neutral', 'Not Started': 'warning',
}

const BoolCell = ({ v }: { v: boolean }) => (
  <span className={`text-xs font-semibold ${v ? 'text-a-green' : 'text-faint'}`}>
    {v ? '✓' : '✗'}
  </span>
)

const detailIds = cmdbDetailService.detailIds()

const COLUMNS: Column<CMDBApp>[] = [
  { key: 'appId',               header: 'App ID',
    render: (v) => (
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-xs text-muted">{String(v)}</span>
        {detailIds.has(String(v)) && (
          <ExternalLink size={10} className="text-violet-500" />
        )}
      </span>
    )},
  { key: 'appName',             header: 'Application',
    render: v => <span className="font-medium text-body">{String(v)}</span> },
  { key: 'department',          header: 'Dept' },
  { key: 'appType',             header: 'Type',
    render: v => <span className="text-xs text-muted">{String(v)}</span> },
  { key: 'businessCriticality', header: 'Criticality',
    render: v => <Badge label={String(v)} variant={critVariant[v as Criticality]} /> },
  { key: 'ssoEnabled',   header: 'SSO',  render: v => <BoolCell v={v as boolean} /> },
  { key: 'mfaRequired',  header: 'MFA',  render: v => <BoolCell v={v as boolean} /> },
  { key: 'pamVaulted',   header: 'PAM',  render: v => <BoolCell v={v as boolean} /> },
  { key: 'rbacEnabled',  header: 'RBAC', render: v => <BoolCell v={v as boolean} /> },
  { key: 'orphanAccounts', header: 'Orphans',
    render: v => <span className={Number(v) > 0 ? 'text-a-red font-semibold' : 'text-muted'}>{String(v)}</span> },
  { key: 'onboardingStatus', header: 'Status',
    render: v => <Badge label={String(v)} variant={statusVariant[v as OnboardingStatus]} /> },
]

export default function CMDBDataView() {
  const { apps, resetToMock } = useCMDB()
  const [filter, setFilter] = useState('')
  const navigate = useNavigate()

  const filtered = filter
    ? apps.filter(a =>
        a.appName.toLowerCase().includes(filter.toLowerCase()) ||
        a.department.toLowerCase().includes(filter.toLowerCase()) ||
        a.appType.toLowerCase().includes(filter.toLowerCase()) ||
        a.businessCriticality.toLowerCase().includes(filter.toLowerCase())
      )
    : apps

  const exportCsv = () => {
    const csv = generateSampleCsv()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'idvize-cmdb-export.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by name, department, type, criticality…"
          className="flex-1 max-w-sm bg-surface-900 border border-surface-700 rounded-lg px-3 py-2
                     text-sm text-secondary placeholder-faint focus:outline-none focus:border-violet-500"
        />
        <span className="text-xs text-muted">{filtered.length} of {apps.length} apps</span>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={resetToMock}
            className="flex items-center gap-1.5 text-xs text-muted border border-surface-600 px-3 py-1.5 rounded-lg hover:bg-surface-700 transition-colors"
          >
            <RefreshCw size={11} /> Reset to Mock
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 text-xs text-a-purple border border-violet-800/50 px-3 py-1.5 rounded-lg hover:bg-violet-900/20 transition-colors"
          >
            <Download size={11} /> Export CSV
          </button>
        </div>
      </div>

      <p className="text-xs text-faint -mt-2">
        Apps marked with <span className="text-violet-500">↗</span> have a detailed dashboard — click to open.
      </p>

      <DataTable<CMDBApp>
        columns={COLUMNS}
        data={filtered}
        pageSize={15}
        onRowClick={(app) => {
          if (detailIds.has(app.appId)) navigate(`/cmdb/${app.appId}`)
        }}
        rowClickable={(app) => detailIds.has(app.appId)}
        emptyIcon={LayoutDashboard}
        emptyMessage={apps.length === 0 ? 'No applications onboarded' : 'No applications match your filter'}
        emptyDescription={
          apps.length === 0
            ? 'Get started by importing your application catalog from the Import tab.'
            : 'Try a different search term or clear the filter to see all applications.'
        }
      />
    </div>
  )
}
