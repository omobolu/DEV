import { AlertTriangle } from 'lucide-react'
import type { AppRecommendation } from '../types'

interface RecommendationsCardProps {
  recommendations: AppRecommendation[]
  rawControls: string[]
}

export default function RecommendationsCard({ recommendations, rawControls }: RecommendationsCardProps) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 flex flex-col gap-4">
      <p className="text-sm font-semibold text-slate-200">Recommendations</p>

      <ul className="flex flex-col gap-3">
        {recommendations.map(rec => (
          <li key={rec.id} className="flex items-start gap-2.5">
            <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300 leading-relaxed">{rec.text}</p>
          </li>
        ))}
      </ul>

      {rawControls.length > 0 && (
        <div className="pt-3 border-t border-surface-700">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">
            IAM Controls (raw)
          </p>
          <p className="text-sm text-slate-300">{rawControls.join('; ')}</p>
        </div>
      )}
    </div>
  )
}
