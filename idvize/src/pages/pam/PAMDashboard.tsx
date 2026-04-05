import { useState, useEffect } from 'react'
import { ShieldAlert } from 'lucide-react'
import KpiCard from '@/components/common/KpiCard'
import ChartCard from '@/components/common/ChartCard'
import DonutChart from '@/components/charts/DonutChart'
import ComboChart from '@/components/charts/ComboChart'
import HorizontalBarChart from '@/components/charts/HorizontalBarChart'
import VerticalBarChart from '@/components/charts/VerticalBarChart'
import {
  PAM_KPIS, PAM_ACCOUNT_TYPES, SESSION_ACTIVITY_DATA,
  VAULT_COVERAGE_DATA, POLICY_VIOLATIONS_DATA
} from '@/data/pam'

export default function PAMDashboard() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  const vaultForChart = VAULT_COVERAGE_DATA.map(d => ({ name: d.app, value: d.coverage }))
  const violationsForChart = POLICY_VIOLATIONS_DATA.map(d => ({ type: d.type, count: d.count })) as unknown as Record<string, unknown>[]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldAlert size={20} className="text-amber-400" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-white">Privileged Access Management</h1>
        </div>
        <p className="text-slate-500 mt-1 text-sm">PAM Dashboard — credential vaulting, session monitoring & policy compliance</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {PAM_KPIS.map(kpi => (
          <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} unit={kpi.unit} accentColor={kpi.accentColor} loading={loading} />
        ))}
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Privileged Account Types" loading={loading}>
          <DonutChart
            data={PAM_ACCOUNT_TYPES}
            centerLabel="Accounts"
            centerValue={1247}
          />
        </ChartCard>
        <ChartCard title="Session Activity Trend" subtitle="Opened vs closed per week" className="lg:col-span-2" loading={loading}>
          <ComboChart
            data={SESSION_ACTIVITY_DATA as unknown as Record<string, unknown>[]}
            xKey="week"
            bars={[
              { key: 'opened', name: 'Sessions Opened', color: '#f59e0b' },
              { key: 'closed', name: 'Sessions Closed', color: '#fbbf24' },
            ]}
            line={{ key: 'avgDurationMin', name: 'Avg Duration (min)', color: '#22d3ee', yAxisId: 'right' }}
            rightAxisLabel="min"
          />
        </ChartCard>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Credential Vault Coverage by App" subtitle="% of credentials vaulted" loading={loading}>
          <HorizontalBarChart
            data={vaultForChart}
            unit="%"
            colorByValue
          />
        </ChartCard>
        <ChartCard title="Policy Violations by Type" subtitle="Last 30 days" loading={loading}>
          <VerticalBarChart
            data={violationsForChart}
            xKey="type"
            series={[{ key: 'count', name: 'Violations', color: '#ef4444' }]}
            showLegend={false}
          />
        </ChartCard>
      </div>
    </div>
  )
}
