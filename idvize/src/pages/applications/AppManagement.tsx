import { useState, useEffect } from 'react'
import { LayoutDashboard } from 'lucide-react'
import ChartCard from '@/components/common/ChartCard'
import DonutChart from '@/components/charts/DonutChart'
import VerticalBarChart from '@/components/charts/VerticalBarChart'
import TrendLineChart from '@/components/charts/TrendLineChart'
import {
  ORPHAN_DONUT_DATA, LOGIN_FAILURE_DATA,
  TERMINATED_TREND_DATA, COMPLETION_RATE_DATA
} from '@/data/appManagement'

export default function AppManagement() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} className="text-indigo-400" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-white">Application Management</h1>
        </div>
        <p className="text-slate-500 mt-1 text-sm">Key Risk & Performance Indicators</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Orphan Accounts" subtitle="Current status breakdown" loading={loading}>
          <DonutChart
            data={ORPHAN_DONUT_DATA}
            centerLabel="Total"
            centerValue={100}
          />
        </ChartCard>
        <ChartCard title="Login Failure Trend" subtitle="Failures vs resolved per month" loading={loading}>
          <VerticalBarChart
            data={LOGIN_FAILURE_DATA as unknown as Record<string, unknown>[]}
            xKey="month"
            series={[
              { key: 'failures', name: 'Failures', color: '#ef4444' },
              { key: 'resolved', name: 'Resolved', color: '#22c55e' },
            ]}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Terminated Accounts Trend" subtitle="Weekly terminated account count" loading={loading}>
          <TrendLineChart
            data={TERMINATED_TREND_DATA as unknown as Record<string, unknown>[]}
            xKey="week"
            yKey="count"
            color="#f97316"
            showAvgLine
          />
        </ChartCard>
        <ChartCard title="User Termination Completion Rate" subtitle="Monthly completion rate (%)" loading={loading}>
          <VerticalBarChart
            data={COMPLETION_RATE_DATA as unknown as Record<string, unknown>[]}
            xKey="month"
            series={[{ key: 'rate', name: 'Completion Rate %', color: '#6366f1' }]}
            colorByValue
            showLegend={false}
          />
        </ChartCard>
      </div>
    </div>
  )
}
