import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TOOLTIP_BG, TOOLTIP_BORDER } from '@/constants/colors'

interface Segment { name: string; value: number; fill: string }

interface DonutChartProps {
  data: Segment[]
  centerLabel?: string
  centerValue?: string | number
  height?: number
  showLegend?: boolean
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: Segment }> }) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div style={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}` }}
         className="px-3 py-2 rounded-lg text-sm">
      <p className="text-slate-300 font-medium">{name}</p>
      <p className="text-white font-bold">{value.toLocaleString()}</p>
    </div>
  )
}

export default function DonutChart({ data, centerLabel, centerValue, height = 260, showLegend = true }: DonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="75%"
          dataKey="value"
          paddingAngle={2}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} stroke="transparent" />
          ))}
        </Pie>
        {(centerLabel || centerValue !== undefined) && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
            {centerValue !== undefined && (
              <tspan x="50%" dy="-6" fill="#ffffff" fontSize={22} fontWeight="700">
                {typeof centerValue === 'number' ? centerValue.toLocaleString() : centerValue}
              </tspan>
            )}
            {centerLabel && (
              <tspan x="50%" dy="20" fill="#94a3b8" fontSize={11}>
                {centerLabel}
              </tspan>
            )}
          </text>
        )}
        <Tooltip content={<CustomTooltip />} />
        {showLegend && (
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  )
}
