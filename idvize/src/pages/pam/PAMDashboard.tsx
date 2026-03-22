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
  const vaultForChart = VAULT_COVERAGE_DATA.map(d => ({ name: d.app, value: d.coverage }))
  const violationsForChart = POLICY_VIOLATIONS_DATA.map(d => ({ type: d.type, count: d.count })) as unknown as Record<string, unknown>[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Privileged Access Management</h1>
        <p className="text-slate-500 mt-1 text-sm">PAM Dashboard — credential vaulting, session monitoring & policy compliance</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {PAM_KPIS.map(kpi => (
          <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} unit={kpi.unit} accentColor={kpi.accentColor} />
        ))}
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Privileged Account Types">
          <DonutChart
            data={PAM_ACCOUNT_TYPES}
            centerLabel="Accounts"
            centerValue={1247}
          />
        </ChartCard>
        <ChartCard title="Session Activity Trend" subtitle="Opened vs closed per week" className="lg:col-span-2">
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
        <ChartCard title="Credential Vault Coverage by App" subtitle="% of credentials vaulted">
          <HorizontalBarChart
            data={vaultForChart}
            unit="%"
            colorByValue
          />
        </ChartCard>
        <ChartCard title="Policy Violations by Type" subtitle="Last 30 days">
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
