import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'
import { CHART_GRID, CHART_AXIS, TOOLTIP_BG, TOOLTIP_BORDER } from '@/constants/colors'

interface BarSeries {
  key: string
  name: string
  color: string
  stackId?: string
}

interface VerticalBarChartProps {
  data: Record<string, unknown>[]
  xKey: string
  series: BarSeries[]
  height?: number
  colorByValue?: boolean
  showLegend?: boolean
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}` }}
         className="px-3 py-2 rounded-lg text-sm space-y-1">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-semibold">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export default function VerticalBarChart({ data, xKey, series, height = 280, colorByValue, showLegend = true }: VerticalBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} opacity={0.5} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        {showLegend && series.length > 1 && (
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>}
          />
        )}
        {series.map(s => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color}
               stackId={s.stackId} radius={s.stackId ? undefined : [2, 2, 0, 0]} maxBarSize={36}>
            {colorByValue && data.map((d, i) => {
              const v = Number(d[s.key])
              const fill = v >= 90 ? '#22c55e' : v >= 70 ? '#f59e0b' : '#ef4444'
              return <Cell key={i} fill={fill} />
            })}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
