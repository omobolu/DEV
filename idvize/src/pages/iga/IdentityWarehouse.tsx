import { useState, useEffect } from 'react'
import { BarChart2, Construction } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <BarChart2 size={20} className="text-indigo-400" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-white">Identity Governance & Administration</h1>
        </div>
        <p className="text-slate-500 mt-1 text-sm">IGA Dashboard</p>
      </div>

      <TabNav tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'home' && (
        <div className="space-y-6" role="tabpanel" aria-label="Home">
          {/* KPI row */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {IGA_KPIS.map(kpi => (
              <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} unit={kpi.unit} accentColor={kpi.accentColor} loading={loading} />
            ))}
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Active Identities Portfolio" subtitle="By region" loading={loading}>
              <DonutChart
                data={ACTIVE_IDENTITIES_DATA}
                centerLabel="Identities"
                centerValue={338500}
              />
            </ChartCard>
            <ChartCard title="Type of Applications" loading={loading}>
              <SolidPieChart data={APP_TYPE_DATA} />
            </ChartCard>
            <ChartCard title="Orphan Accounts" loading={loading}>
              <SolidPieChart data={ORPHAN_PIE_DATA} />
            </ChartCard>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Hire Processing Trend" subtitle="Monthly hire vs termination" className="lg:col-span-2" loading={loading}>
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
            <ChartCard title="Applications Portfolio" loading={loading}>
              <SolidPieChart data={APPS_PORTFOLIO_DATA} />
            </ChartCard>
          </div>
        </div>
      )}

      {tab !== 'home' && (
        <div className="flex items-center justify-center h-64" role="tabpanel" aria-label={TABS.find(t => t.value === tab)?.label}>
          <div className="text-center max-w-sm">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-800 border border-surface-700 mb-3">
              <Construction size={24} className="text-slate-500" aria-hidden="true" />
            </div>
            <p className="text-base font-medium text-slate-400">
              {TABS.find(t => t.value === tab)?.label}
            </p>
            <p className="text-sm text-slate-600 mt-1">
              This view is under development and will be available in a future release.
            </p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-xs text-slate-600">In development</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
