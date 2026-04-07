import { useState, useEffect } from 'react'
import { Rocket } from 'lucide-react'
import KpiCard from '@/components/common/KpiCard'
import ChartCard from '@/components/common/ChartCard'
import SolidPieChart from '@/components/charts/SolidPieChart'
import VerticalBarChart from '@/components/charts/VerticalBarChart'
import { ONBOARDING_KPIS, APP_PRIORITY_DATA, QUARTERLY_STATUS_DATA } from '@/data/appOnboarding'

export default function AppOnboarding() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Rocket size={20} className="text-a-indigo" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-heading">Application Onboarding Analytics</h1>
        </div>
        <p className="text-muted mt-1 text-sm">Applications → Onboarding</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {ONBOARDING_KPIS.map(kpi => (
          <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} accentColor={kpi.accentColor} loading={loading} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Application Priority Scale" subtitle="By criticality level" loading={loading}>
          <SolidPieChart data={APP_PRIORITY_DATA} />
        </ChartCard>
        <ChartCard title="Quarterly Status Distribution" subtitle="Planning, In Progress, Completed, On Hold" loading={loading}>
          <VerticalBarChart
            data={QUARTERLY_STATUS_DATA as unknown as Record<string, unknown>[]}
            xKey="quarter"
            series={[
              { key: 'completed',  name: 'Completed',   color: '#22c55e', stackId: 'a' },
              { key: 'inProgress', name: 'In Progress',  color: '#6366f1', stackId: 'a' },
              { key: 'planning',   name: 'Planning',     color: '#06b6d4', stackId: 'a' },
              { key: 'onHold',     name: 'On Hold',      color: '#f97316', stackId: 'a' },
            ]}
          />
        </ChartCard>
      </div>
    </div>
  )
}
