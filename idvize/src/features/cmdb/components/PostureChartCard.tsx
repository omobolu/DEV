import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TOOLTIP_BG, TOOLTIP_BORDER } from '@/constants/colors'

interface PostureChartCardProps {
  ok: number
  attention: number
  gap: number
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
}) => {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}` }}
      className="px-3 py-2 rounded-lg text-sm"
    >
      <p className="text-slate-300 font-medium">{payload[0].name}</p>
      <p className="text-white font-bold">{payload[0].value} controls</p>
    </div>
  )
}

export default function PostureChartCard({ ok, attention, gap }: PostureChartCardProps) {
  const total = ok + attention + gap
  const data = [
    { name: 'OK',   value: ok,        fill: '#22c55e' },
    { name: 'ATTN', value: attention,  fill: '#f59e0b' },
    { name: 'GAP',  value: gap,        fill: '#ef4444' },
  ].filter(d => d.value > 0)

  const score = total > 0 ? Math.round((ok / total) * 100) : 0

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-200">IAM Control Posture</p>
        <p className="text-xs text-slate-500 mt-0.5">{total} controls evaluated</p>
      </div>

      <div className="flex-1" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="72%"
              dataKey="value"
              paddingAngle={2}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="transparent" />
              ))}
            </Pie>
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
              <tspan x="50%" dy="-6" fill="#ffffff" fontSize={24} fontWeight="700">
                {score}%
              </tspan>
              <tspan x="50%" dy="18" fill="#94a3b8" fontSize={11}>
                posture score
              </tspan>
            </text>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-surface-700">
        <div className="text-center">
          <p className="text-lg font-bold text-green-400">{ok}</p>
          <p className="text-xs text-slate-500">OK</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-amber-400">{attention}</p>
          <p className="text-xs text-slate-500">ATTN</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-red-400">{gap}</p>
          <p className="text-xs text-slate-500">GAP</p>
        </div>
      </div>
    </div>
  )
}
