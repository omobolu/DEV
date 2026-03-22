import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { AppCriticality, AppRisk } from '../types'

const CRIT_STYLES: Record<AppCriticality, string> = {
  Critical: 'bg-red-500/15 text-red-400 border border-red-500/30',
  High:     'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  Medium:   'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  Low:      'bg-green-500/15 text-green-400 border border-green-500/30',
}

const RISK_STYLES: Record<AppRisk, string> = {
  Critical: 'bg-red-500/15 text-red-400 border border-red-500/30',
  High:     'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  Medium:   'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  Low:      'bg-green-500/15 text-green-400 border border-green-500/30',
}

interface AppDetailHeaderProps {
  appId: string
  name: string
  tags: string[]
  criticality: AppCriticality
  risk: AppRisk
}

export default function AppDetailHeader({ appId, name, tags, criticality, risk }: AppDetailHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/cmdb')}
          className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-surface-700 transition-colors flex-shrink-0"
          aria-label="Back to CMDB"
        >
          <ArrowLeft size={18} />
        </button>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-500">{appId}</span>
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight">{name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {tags.map(tag => (
              <span
                key={tag}
                className="text-xs text-slate-400 bg-surface-700 border border-surface-600 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right">
          <p className="text-xs text-slate-500 mb-1">Criticality</p>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CRIT_STYLES[criticality]}`}>
            {criticality}
          </span>
        </div>
        <div className="w-px h-8 bg-surface-600" />
        <div className="text-right">
          <p className="text-xs text-slate-500 mb-1">Risk</p>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${RISK_STYLES[risk]}`}>
            {risk}
          </span>
        </div>
      </div>
    </div>
  )
}
