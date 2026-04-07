import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer, Legend } from 'recharts'
import { useTheme } from '@/context/ThemeContext'
import { getChartTheme } from '@/constants/colors'

interface GaugeSegment { name: string; value: number; fill: string }

interface GaugeChartProps {
  segments: GaugeSegment[]
  totalCount: number
  height?: number
}

export default function GaugeChart({ segments, totalCount, height = 280 }: GaugeChartProps) {
  const { theme } = useTheme()
  const ct = getChartTheme(theme)
  // RadialBarChart: each entry is one arc, values represent percentage 0-100
  const chartData = segments.map(s => ({ ...s }))

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={height}>
        <RadialBarChart
          cx="50%"
          cy="70%"
          innerRadius="30%"
          outerRadius="90%"
          startAngle={180}
          endAngle={0}
          data={chartData}
          barSize={10}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={4}
            background={{ fill: ct.grid }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>}
          />
          {/* Center label */}
          <text
            x="50%"
            y="68%"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fill: '#ffffff', fontSize: 28, fontWeight: 700 }}
          >
            {totalCount.toLocaleString()}
          </text>
          <text
            x="50%"
            y="78%"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fill: '#64748b', fontSize: 11 }}
          >
            Total
          </text>
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  )
}
