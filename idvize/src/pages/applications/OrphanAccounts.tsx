import { UserX } from 'lucide-react'
import ChartCard from '@/components/common/ChartCard'
import VerticalBarChart from '@/components/charts/VerticalBarChart'
import DataTable from '@/components/common/DataTable'
import Badge from '@/components/common/Badge'
import { ORPHAN_ACCOUNTS_TABLE, ORPHAN_BY_APP_DATA, type OrphanAccount, type AccountStatus, type RiskLevel } from '@/data/orphanAccounts'
import type { Column } from '@/components/common/DataTable'

const statusVariant: Record<AccountStatus, 'danger' | 'neutral' | 'warning' | 'info'> = {
  'Active':         'danger',
  'Disabled':       'neutral',
  'Pending Review': 'warning',
  'Suspended':      'info',
}

const riskVariant: Record<RiskLevel, 'danger' | 'warning' | 'success'> = {
  'High':   'danger',
  'Medium': 'warning',
  'Low':    'success',
}

const COLUMNS: Column<OrphanAccount>[] = [
  { key: 'applicationName', header: 'Application Name' },
  { key: 'accountName',     header: 'Account Name',
    render: (v) => <span className="font-mono text-xs text-secondary">{String(v)}</span> },
  { key: 'accountStatus',   header: 'Account Status',
    render: (v) => <Badge label={String(v)} variant={statusVariant[v as AccountStatus]} /> },
  { key: 'riskLevel',       header: 'Risk Level',
    render: (v) => <Badge label={String(v)} variant={riskVariant[v as RiskLevel]} /> },
  { key: 'lastLogin',       header: 'Last Login',
    render: (v) => <span className="text-muted text-xs">{String(v)}</span> },
]

const barData = ORPHAN_BY_APP_DATA.map(d => ({ name: d.app, value: d.count })) as unknown as Record<string, unknown>[]

export default function OrphanAccounts() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <UserX size={20} className="text-a-red" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-heading">Orphan Accounts</h1>
        </div>
        <p className="text-muted mt-1 text-sm">Applications → Orphan Accounts</p>
      </div>

      <ChartCard title="Orphan Accounts by Application">
        <VerticalBarChart
          data={barData}
          xKey="name"
          series={[{ key: 'value', name: 'Orphan Accounts', color: '#ef4444' }]}
          showLegend={false}
          height={240}
        />
      </ChartCard>

      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
        <p className="text-sm font-semibold text-body mb-4">Account Detail</p>
        <DataTable<OrphanAccount>
          columns={COLUMNS}
          data={ORPHAN_ACCOUNTS_TABLE}
          pageSize={8}
          emptyMessage="No orphan accounts detected"
        />
      </div>
    </div>
  )
}
