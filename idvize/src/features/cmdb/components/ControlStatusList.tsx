import type { ControlCheck, ControlStatusValue } from '../types'

const STATUS_CONFIG: Record<ControlStatusValue, { label: string; dot: string; badge: string }> = {
  OK:   { label: 'OK',   dot: 'bg-green-500', badge: 'bg-green-500/15 text-green-400 border border-green-500/30' },
  ATTN: { label: 'ATTN', dot: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  GAP:  { label: 'GAP',  dot: 'bg-red-500',   badge: 'bg-red-500/15  text-red-400   border border-red-500/30'   },
}

interface ControlStatusListProps {
  controls: ControlCheck[]
}

export default function ControlStatusList({ controls }: ControlStatusListProps) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 flex flex-col gap-4">
      <p className="text-sm font-semibold text-slate-200">Control Status</p>

      <div className="flex flex-col divide-y divide-surface-700">
        {controls.map(control => {
          const cfg = STATUS_CONFIG[control.status]
          return (
            <div key={control.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 leading-tight">{control.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{control.description}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.badge}`}>
                {cfg.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
