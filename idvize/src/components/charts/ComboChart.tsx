import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { CHART_GRID, CHART_AXIS, TOOLTIP_BG, TOOLTIP_BORDER } from '@/constants/colors'

interface ComboChartProps {
  data: Record<string, unknown>[]
  xKey: string
  bars: { key: string; name: string; color: string }[]
  line: { key: string; name: string; color: string; yAxisId?: string }
  height?: number
  rightAxisLabel?: string
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
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-semibold">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export default function ComboChart({ data, xKey, bars, line, height = 280, rightAxisLabel }: ComboChartProps) {
  const hasRightAxis = !!line.yAxisId
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 5, right: hasRightAxis ? 20 : 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} opacity={0.5} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        {hasRightAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={rightAxisLabel ? { value: rightAxisLabel, angle: 90, position: 'insideRight', fill: CHART_AXIS, fontSize: 10 } : undefined}
          />
        )}
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>}
        />
        {bars.map(b => (
          <Bar key={b.key} yAxisId="left" dataKey={b.key} name={b.name} fill={b.color} radius={[2, 2, 0, 0]} maxBarSize={32} />
        ))}
        <Line
          yAxisId={line.yAxisId ?? 'left'}
          type="monotone"
          dataKey={line.key}
          name={line.name}
          stroke={line.color}
          strokeWidth={2}
          dot={{ r: 3, fill: line.color }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
