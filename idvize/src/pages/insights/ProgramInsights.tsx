import GaugeChart from '@/components/charts/GaugeChart'
import ChartCard from '@/components/common/ChartCard'
import { PROGRAM_MATURITY_DATA } from '@/data/programInsights'

export default function ProgramInsights() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Program Maturity</h1>
        <p className="text-slate-500 mt-1 text-sm">Insights → Program Maturity</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {PROGRAM_MATURITY_DATA.map(item => (
          <ChartCard
            key={item.id}
            title={item.title}
            subtitle={`${item.totalCount.toLocaleString()} total items`}
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
