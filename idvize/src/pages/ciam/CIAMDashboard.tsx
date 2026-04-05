import { useState, useEffect } from 'react'
import { UserCheck } from 'lucide-react'
import KpiCard from '@/components/common/KpiCard'
import ChartCard from '@/components/common/ChartCard'
import ComboChart from '@/components/charts/ComboChart'
import DonutChart from '@/components/charts/DonutChart'
import HorizontalBarChart from '@/components/charts/HorizontalBarChart'
import SolidPieChart from '@/components/charts/SolidPieChart'
import {
  CIAM_KPIS, CIAM_REGISTRATION_DATA, LOGIN_METHOD_DATA,
  CUSTOMER_JOURNEY_DATA, GEO_DISTRIBUTION_DATA
} from '@/data/ciam'

export default function CIAMDashboard() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  const journeyForChart = CUSTOMER_JOURNEY_DATA.map(d => ({
    name: d.stage,
    value: Math.round(d.count / 1000),
  }))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <UserCheck size={20} className="text-green-400" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-white">Customer Identity & Access Management</h1>
        </div>
        <p className="text-slate-500 mt-1 text-sm">CIAM Dashboard — registration, login methods & customer journey</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {CIAM_KPIS.map(kpi => (
          <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} unit={kpi.unit} accentColor={kpi.accentColor} loading={loading} />
        ))}
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Customer Registration Trend" subtitle="Monthly new registrations" className="lg:col-span-2" loading={loading}>
          <ComboChart
            data={CIAM_REGISTRATION_DATA as unknown as Record<string, unknown>[]}
            xKey="month"
            bars={[{ key: 'newUsers', name: 'New Registrations', color: '#22c55e' }]}
            line={{ key: 'cumulative', name: 'Cumulative Total', color: '#4ade80', yAxisId: 'right' }}
            rightAxisLabel="Total"
          />
        </ChartCard>
        <ChartCard title="Login Method Distribution" loading={loading}>
          <DonutChart
            data={LOGIN_METHOD_DATA}
            centerLabel="Methods"
            centerValue="5"
          />
        </ChartCard>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Customer Journey Funnel" subtitle="Users (thousands) per stage" loading={loading}>
          <HorizontalBarChart
            data={journeyForChart}
            color="#22c55e"
            unit="k"
          />
        </ChartCard>
        <ChartCard title="Geographic Distribution" loading={loading}>
          <SolidPieChart data={GEO_DISTRIBUTION_DATA} />
        </ChartCard>
      </div>
    </div>
  )
}
