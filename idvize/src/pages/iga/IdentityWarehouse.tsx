import { useState } from 'react'
import TabNav from '@/components/common/TabNav'
import KpiCard from '@/components/common/KpiCard'
import ChartCard from '@/components/common/ChartCard'
import DonutChart from '@/components/charts/DonutChart'
import SolidPieChart from '@/components/charts/SolidPieChart'
import ComboChart from '@/components/charts/ComboChart'
import {
  IGA_KPIS, ACTIVE_IDENTITIES_DATA, APP_TYPE_DATA,
  HIRE_TREND_DATA, APPS_PORTFOLIO_DATA, ORPHAN_PIE_DATA
} from '@/data/identityWarehouse'

const TABS = [
  { label: 'Home', value: 'home' },
  { label: 'Identity Warehouse', value: 'warehouse' },
  { label: 'User Lifecycle', value: 'lifecycle' },
  { label: 'Access Requests', value: 'access' },
  { label: 'Governance', value: 'governance' },
]

export default function IdentityWarehouse() {
  const [tab, setTab] = useState('home')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Identity Governance & Administration</h1>
        <p className="text-slate-500 mt-1 text-sm">IGA Dashboard</p>
      </div>

      <TabNav tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'home' && (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {IGA_KPIS.map(kpi => (
              <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} unit={kpi.unit} accentColor={kpi.accentColor} />
            ))}
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Active Identities Portfolio" subtitle="By region">
              <DonutChart
                data={ACTIVE_IDENTITIES_DATA}
                centerLabel="Identities"
                centerValue={338500}
              />
            </ChartCard>
            <ChartCard title="Type of Applications">
              <SolidPieChart data={APP_TYPE_DATA} />
            </ChartCard>
            <ChartCard title="Orphan Accounts">
              <SolidPieChart data={ORPHAN_PIE_DATA} />
            </ChartCard>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Hire Processing Trend" subtitle="Monthly hire vs termination" className="lg:col-span-2">
              <ComboChart
                data={HIRE_TREND_DATA as unknown as Record<string, unknown>[]}
                xKey="month"
                bars={[
                  { key: 'hired',      name: 'Hired',      color: '#6366f1' },
                  { key: 'terminated', name: 'Terminated', color: '#ef4444' },
                ]}
                line={{ key: 'netChange', name: 'Net Change', color: '#22d3ee', yAxisId: 'right' }}
                rightAxisLabel="%"
              />
            </ChartCard>
            <ChartCard title="Applications Portfolio">
              <SolidPieChart data={APPS_PORTFOLIO_DATA} />
            </ChartCard>
          </div>
        </div>
      )}

      {tab !== 'home' && (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-600 text-sm">
            {TABS.find(t => t.value === tab)?.label} — coming soon
          </p>
        </div>
      )}
    </div>
  )
}
