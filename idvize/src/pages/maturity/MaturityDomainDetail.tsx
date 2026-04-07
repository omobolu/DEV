import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

type MaturityLevel = string  // 'Level 1 - Initial' ... 'Level 5 - Optimized'

interface EvidenceItem {
  evidenceId: string; source: string; quality: string
  collectedAt: string; description: string; rawValue: unknown
}
interface Indicator {
  indicatorId: string; name: string; description: string
  score: number; confidence: number; weight: number
  rationale: string; evidenceItems: EvidenceItem[]
}
interface DomainDetail {
  domainId: string; name: string; score: number
  level: MaturityLevel; confidence: number
  indicators: Indicator[]; topGaps: string[]
}
interface Explanation {
  narrative: string; keyFactors: string[]; limitations: string[]
}
interface Recommendation {
  priority: string; title: string; description: string; effort: string; impact: number
}

function levelColor(score: number): string {
  if (score >= 81) return '#6366f1'
  if (score >= 61) return '#22c55e'
  if (score >= 41) return '#eab308'
  if (score >= 21) return '#f97316'
  return '#ef4444'
}
function levelNumber(level: string): number {
  const m = level.match(/Level (\d)/); return m ? parseInt(m[1]) : 0
}
function levelShort(level: string): string {
  return level.replace('Level ', 'L').replace(' - ', ' · ')
}
const QUALITY_COLOR: Record<string, string> = {
  live: 'text-a-green bg-green-500/10', mock: 'text-a-amber bg-amber-500/10',
  estimated: 'text-a-indigo bg-blue-500/10', missing: 'text-a-red bg-red-500/10',
}

function IndicatorRow({ ind }: { ind: Indicator }) {
  const [open, setOpen] = useState(false)
  const color = ind.score >= 61 ? '#22c55e' : ind.score >= 41 ? '#eab308' : ind.score >= 21 ? '#f97316' : '#ef4444'
  return (
    <div className="border border-surface-600 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 bg-surface-800 hover:bg-surface-700 transition-colors text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-body">{ind.name}</span>
            <span className="text-xs text-muted">weight {ind.weight}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${Math.round(ind.confidence * 100) >= 70 ? 'bg-green-500/15 text-a-green' : Math.round(ind.confidence * 100) >= 40 ? 'bg-amber-500/15 text-a-amber' : 'bg-red-500/15 text-a-red'}`}>
              {Math.round(ind.confidence * 100)}% conf
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">{ind.rationale}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold" style={{ color }}>{ind.score}</div>
          <div className="w-16 h-1.5 rounded-full bg-surface-600 mt-1">
            <div className="h-full rounded-full" style={{ width: `${ind.score}%`, backgroundColor: color }} />
          </div>
        </div>
        {open ? <ChevronDown size={14} className="text-muted shrink-0" />
               : <ChevronRight size={14} className="text-muted shrink-0" />}
      </button>

      {open && (
        <div className="bg-surface-900 border-t border-surface-700 p-4 space-y-3">
          <p className="text-xs text-muted">{ind.description}</p>
          {ind.evidenceItems.length === 0
            ? <p className="text-xs text-a-red">⚠ No evidence collected for this indicator</p>
            : (
              <div>
                <p className="text-xs font-medium text-muted mb-2">Evidence ({ind.evidenceItems.length} items)</p>
                <div className="space-y-1.5">
                  {ind.evidenceItems.map(e => (
                    <div key={e.evidenceId} className="flex items-start gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-xs shrink-0 ${QUALITY_COLOR[e.quality] ?? 'text-muted bg-slate-500/10'}`}>
                        {e.quality}
                      </span>
                      <span className="text-muted shrink-0">{e.source}</span>
                      <span className="text-secondary">{e.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}

export default function MaturityDomainDetail() {
  const { domainId } = useParams<{ domainId: string }>()
  const navigate     = useNavigate()
  const [domain, setDomain] = useState<DomainDetail | null>(null)
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!domainId) return
    setLoading(true)
    apiFetch(`/maturity/domains/${domainId}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setDomain(j.data.domain)
          setExplanation(j.data.explanation ?? null)
          setRecommendations(j.data.recommendations ?? [])
        }
      })
      .finally(() => setLoading(false))
  }, [domainId])

  if (loading) return <div className="p-6 text-muted text-sm">Loading domain…</div>
  if (!domain)  return <div className="p-6 text-a-red text-sm">Domain not found</div>

  const color   = levelColor(domain.score)
  const lnum    = levelNumber(domain.level)
  const sortedIndicators = [...domain.indicators].sort((a, b) => a.score - b.score)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Back + Header */}
      <div>
        <button onClick={() => navigate('/maturity')}
          className="flex items-center gap-1 text-sm text-muted hover:text-body mb-4 transition-colors">
          <ArrowLeft size={14} /> Back to Maturity
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-heading">{domain.name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-3xl font-bold" style={{ color }}>{domain.score}</span>
              <span className="text-xs text-muted">/100</span>
              <span className="text-sm px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: color + '25', color }}>{levelShort(domain.level)}</span>
              {/* 5-level dots */}
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(n => (
                  <div key={n} className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: color, backgroundColor: n <= lnum ? color : 'transparent' }}>
                    {n <= lnum && <div className="w-1.5 h-1.5 rounded-full bg-white/60" />}
                  </div>
                ))}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${Math.round(domain.confidence * 100) >= 70 ? 'bg-green-500/20 text-a-green' : 'bg-amber-500/20 text-a-amber'}`}>
                {Math.round(domain.confidence * 100)}% confidence
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted mb-1">Score progress</p>
            <div className="w-48 h-3 rounded-full bg-surface-700">
              <div className="h-full rounded-full transition-all" style={{ width: `${domain.score}%`, backgroundColor: color }} />
            </div>
          </div>
        </div>
      </div>

      {/* Top Gaps */}
      {domain.topGaps.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-a-amber" />
            <span className="text-sm font-medium text-a-amber">Top Gaps in this Domain</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {domain.topGaps.map(g => (
              <span key={g} className="text-xs bg-amber-500/10 border border-amber-500/20 text-a-amber px-2 py-1 rounded">
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Explainability */}
      {explanation && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <h2 className="text-sm font-semibold text-a-indigo mb-3">How This Score Was Calculated</h2>
          <p className="text-sm text-secondary mb-4 leading-relaxed">{explanation.narrative}</p>
          {explanation.limitations.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-a-amber mb-1">Confidence Limitations</p>
              <ul className="space-y-1">
                {explanation.limitations.map((l, i) => (
                  <li key={i} className="text-xs text-a-amber/80">{l}</li>
                ))}
              </ul>
            </div>
          )}
          <details className="text-xs">
            <summary className="text-muted cursor-pointer hover:text-secondary">
              Show all scoring factors ({explanation.keyFactors.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {explanation.keyFactors.map((f, i) => (
                <li key={i} className="text-muted font-mono pl-2 border-l border-surface-600">{f}</li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {/* Indicators */}
      <div>
        <h2 className="text-base font-semibold text-body mb-3">
          Indicators ({domain.indicators.length}) — sorted by score ascending
        </h2>
        <div className="space-y-2">
          {sortedIndicators.map(ind => <IndicatorRow key={ind.indicatorId} ind={ind} />)}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-body mb-3">Recommendations for this Domain</h2>
          <div className="space-y-2">
            {recommendations.map((r, i) => {
              const pc = r.priority === 'critical' ? '#ef4444' : r.priority === 'high' ? '#f97316' : r.priority === 'medium' ? '#eab308' : '#6366f1'
              return (
                <div key={i} className="rounded-lg border border-surface-600 bg-surface-800 p-4 flex gap-3">
                  <div className="w-1 rounded-full shrink-0 self-stretch" style={{ backgroundColor: pc }} />
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-body">{r.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: pc + '25', color: pc }}>
                        {r.priority}
                      </span>
                      <span className="text-xs text-a-indigo">+{r.impact} pts</span>
                    </div>
                    <p className="text-xs text-muted">{r.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
