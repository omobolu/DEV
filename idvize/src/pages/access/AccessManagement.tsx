import { useState, useEffect } from 'react'
import { ShieldCheck } from 'lucide-react'
import KpiCard from '@/components/common/KpiCard'
import ChartCard from '@/components/common/ChartCard'
import ComboChart from '@/components/charts/ComboChart'
import HorizontalBarChart from '@/components/charts/HorizontalBarChart'
import SolidPieChart from '@/components/charts/SolidPieChart'
import TrendLineChart from '@/components/charts/TrendLineChart'
import {
  AM_KPIS, REGISTRATION_DATA, LOGIN_PERF_DATA,
  APP_INTEGRATION_DATA, LOGIN_TIME_DATA
} from '@/data/accessManagement'

export default function AccessManagement() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  const loginPerfForChart = LOGIN_PERF_DATA.map(d => ({ name: d.app, value: d.successRate }))
  const loginTimeForChart = LOGIN_TIME_DATA as unknown as Record<string, unknown>[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-cyan-400" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-white">Access Management</h1>
          </div>
          <p className="text-slate-500 mt-1 text-sm">Authentication, SSO & MFA analytics</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {AM_KPIS.map(kpi => (
          <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} unit={kpi.unit} accentColor={kpi.accentColor} loading={loading} />
        ))}
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Registration & Proofing" subtitle="Weekly registration vs proofing" loading={loading}>
          <ComboChart
            data={REGISTRATION_DATA as unknown as Record<string, unknown>[]}
            xKey="week"
            bars={[
              { key: 'registrations', name: 'Registrations', color: '#06b6d4' },
              { key: 'proofing',      name: 'Proofing',      color: '#0891b2' },
            ]}
            line={{ key: 'successRate', name: 'Success Rate %', color: '#22c55e', yAxisId: 'right' }}
            rightAxisLabel="%"
          />
        </ChartCard>
        <ChartCard title="Login Performance by App" subtitle="Success rate per application" loading={loading}>
          <HorizontalBarChart
            data={loginPerfForChart}
            unit="%"
            colorByValue
          />
        </ChartCard>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Application Integration Portfolio" loading={loading}>
          <SolidPieChart data={APP_INTEGRATION_DATA} />
        </ChartCard>
        <ChartCard title="Login Time Trend" subtitle="Average login time by hour (ms)" loading={loading}>
          <TrendLineChart
            data={loginTimeForChart}
            xKey="hour"
            yKey="avgMs"
            color="#06b6d4"
            unit="ms"
            showAvgLine
          />
        </ChartCard>
      </div>
    </div>
  )
}
