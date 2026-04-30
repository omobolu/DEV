import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { useTheme } from '@/context/ThemeContext'
import { getChartTheme } from '@/constants/colors'

interface TrendLineChartProps {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  color?: string
  height?: number
  unit?: string
  showAvgLine?: boolean
}

function CustomTooltip({ active, payload, label, unit, ct }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string
  unit: string; ct: { tooltipBg: string; tooltipBorder: string }
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}` }}
         className="px-3 py-2 rounded-lg text-sm">
      <p className="text-muted text-xs">{label}</p>
      <p className="text-heading font-bold">{payload[0].value.toLocaleString()}{unit}</p>
    </div>
  )
}

export default function TrendLineChart({ data, xKey, yKey, color = '#2563eb', height = 240, unit = '', showAvgLine }: TrendLineChartProps) {
  const { theme } = useTheme()
  const ct = getChartTheme(theme)
  const avg = showAvgLine
    ? data.reduce((s, d) => s + Number(d[yKey]), 0) / data.length
    : undefined

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} opacity={0.5} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip unit={unit} ct={ct} />} />
        {avg !== undefined && (
          <ReferenceLine
            y={avg}
            stroke={color}
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{ value: 'Avg', fill: ct.axis, fontSize: 10 }}
          />
        )}
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${yKey})`}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
