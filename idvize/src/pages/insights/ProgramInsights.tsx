import { useState, useEffect } from 'react'
import { DollarSign } from 'lucide-react'
import GaugeChart from '@/components/charts/GaugeChart'
import ChartCard from '@/components/common/ChartCard'
import { PROGRAM_MATURITY_DATA } from '@/data/programInsights'

export default function ProgramInsights() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <DollarSign size={20} className="text-a-orange" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-heading">Program Maturity</h1>
        </div>
        <p className="text-muted mt-1 text-sm">Insights → Program Maturity</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {PROGRAM_MATURITY_DATA.map(item => (
          <ChartCard
            key={item.id}
            title={item.title}
            subtitle={`${item.totalCount.toLocaleString()} total items`}
            loading={loading}
          >
            <GaugeChart
              segments={item.segments}
              totalCount={item.totalCount}
              height={300}
            />
          </ChartCard>
        ))}
      </div>
    </div>
  )
}
