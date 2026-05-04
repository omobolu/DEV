import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useTheme } from '@/context/ThemeContext'
import { getChartTheme } from '@/constants/colors'

interface HorizontalBarChartProps {
  data: { name: string; value: number }[]
  color?: string
  height?: number
  unit?: string
  colorByValue?: boolean
}

function CustomTooltip({ active, payload, unit: u, ct }: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
  unit?: string
  ct: { tooltipBg: string; tooltipBorder: string }
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}` }}
         className="px-3 py-2 rounded-lg text-sm">
      <p className="text-heading font-bold">{payload[0].value.toLocaleString()}{u ?? ''}</p>
    </div>
  )
}

export default function HorizontalBarChart({ data, color = '#2563eb', height, unit, colorByValue }: HorizontalBarChartProps) {
  const { theme } = useTheme()
  const ct = getChartTheme(theme)

  const calcHeight = height ?? Math.max(200, data.length * 36 + 40)
  return (
    <ResponsiveContainer width="100%" height={calcHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} opacity={0.4} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: ct.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={[0, 'dataMax']}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: ct.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<CustomTooltip unit={unit} ct={ct} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((entry, i) => {
            let fill = color
            if (colorByValue) {
              fill = entry.value >= 90 ? '#22c55e' : entry.value >= 70 ? '#f59e0b' : '#ef4444'
            }
            return <Cell key={i} fill={fill} />
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
