import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

type MaturityLevel = string  // 'Level 1 - Initial' ... 'Level 5 - Optimized'

interface DomainSummary {
  domainId: string; name: string; score: number
  level: MaturityLevel; confidence: number; trend?: string
}
interface Recommendation {
  domainId: string; domainName: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string; description: string; effort: string; impact: number
}
interface Summary {
  runId: string; overall: number; level: MaturityLevel; confidence: number
  triggeredAt: string; domains: DomainSummary[]
  topRecommendations: Recommendation[]; aiNarrative?: string
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
const PRIORITY_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6366f1' }
const EFFORT_LABEL = { quick_win: 'Quick Win', medium_term: 'Medium Term', strategic: 'Strategic' }

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const cls = pct >= 70 ? 'bg-green-500/20 text-green-400' : pct >= 40 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{pct}% confidence</span>
}

function ScoreGauge({ score, level }: { score: number; level: MaturityLevel }) {
  const color = levelColor(score)
  const circumference = 2 * Math.PI * 54
  const filled = circumference * (score / 100)
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#1e293b" strokeWidth="12" />
        <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-100">{score}</span>
        <span className="text-xs font-medium mt-0.5" style={{ color }}>{levelShort(level)}</span>
      </div>
    </div>
  )
}

function DomainCard({ domain, onClick }: { domain: DomainSummary; onClick: () => void }) {
  const color = levelColor(domain.score)
  const lnum  = levelNumber(domain.level)
  return (
    <button onClick={onClick}
      className="text-left rounded-xl border border-surface-600 bg-surface-800 p-4 hover:border-indigo-500/50 transition-all group">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-sm font-medium text-slate-200 leading-tight">{domain.name}</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: color + '25', color }}>{levelShort(domain.level)}</span>
      </div>
      {/* Score bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold" style={{ color }}>{domain.score}</span>
            <span className="text-xs text-slate-500">/100</span>
          </div>
          <div className="flex items-center gap-0.5">
            {[1,2,3,4,5].map(n => (
              <div key={n} className="w-2 h-2 rounded-full"
                style={{ backgroundColor: n <= lnum ? color : '#334155' }} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mb-1">
          <ConfidencePill value={domain.confidence} />
        </div>
        <div className="h-1.5 rounded-full bg-surface-700">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${domain.score}%`, backgroundColor: color }} />
        </div>
      </div>
      <div className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
        Click for drill-down →
      </div>
    </button>
  )
}

export default function MaturityPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await apiFetch('/maturity/summary')
      const json = await res.json()
      if (json.success) setSummary(json.data)
      else setError(json.error)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const recalculate = async () => {
    setRecalculating(true)
    try {
      const res  = await apiFetch('/maturity/recalculate', { method: 'POST' })
      const json = await res.json()
      if (json.success) setSummary(json.data)
    } finally { setRecalculating(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
      Running maturity assessment…
    </div>
  )

  if (error) return (
    <div className="p-6 text-red-400 text-sm">Error: {error}</div>
  )

  if (!summary) return null

  const criticalRecs   = summary.topRecommendations.filter(r => r.priority === 'critical')
  const highRecs       = summary.topRecommendations.filter(r => r.priority === 'high')
  const otherRecs      = summary.topRecommendations.filter(r => r.priority !== 'critical' && r.priority !== 'high')
  const weakDomains    = [...summary.domains].sort((a, b) => a.score - b.score).slice(0, 3)
  const strongDomains  = [...summary.domains].sort((a, b) => b.score - a.score).slice(0, 3)
  const lowConfDomains = summary.domains.filter(d => d.confidence < 0.5)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">IAM Program Maturity</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Last assessed {new Date(summary.triggeredAt).toLocaleString()} · Run ID: {summary.runId.slice(0, 8)}
          </p>
        </div>
        <button onClick={recalculate} disabled={recalculating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors">
          <RefreshCw size={14} className={recalculating ? 'animate-spin' : ''} />
          {recalculating ? 'Recalculating…' : 'Recalculate'}
        </button>
      </div>

      {/* Overall score + top stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 rounded-xl border border-surface-600 bg-surface-800 p-6 flex flex-col items-center">
          <ScoreGauge score={summary.overall} level={summary.level} />
          <div className="mt-3 text-center">
            <p className="text-sm text-slate-400">Overall Programme Maturity</p>
            <ConfidencePill value={summary.confidence} />
          </div>
        </div>

        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-400" />
              <span className="text-sm font-medium text-slate-300">Weakest Domains</span>
            </div>
            {weakDomains.map(d => (
              <div key={d.domainId} className="flex items-center justify-between py-1 border-b border-surface-700 last:border-0">
                <span className="text-xs text-slate-400 truncate">{d.name}</span>
                <span className="text-xs font-semibold text-red-400 ml-2">{d.score}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-sm font-medium text-slate-300">Strongest Domains</span>
            </div>
            {strongDomains.map(d => (
              <div key={d.domainId} className="flex items-center justify-between py-1 border-b border-surface-700 last:border-0">
                <span className="text-xs text-slate-400 truncate">{d.name}</span>
                <span className="text-xs font-semibold text-green-400 ml-2">{d.score}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info size={16} className="text-amber-400" />
              <span className="text-sm font-medium text-slate-300">Low Confidence</span>
            </div>
            {lowConfDomains.length === 0
              ? <p className="text-xs text-slate-500">All domains have acceptable confidence</p>
              : lowConfDomains.map(d => (
                <div key={d.domainId} className="flex items-center justify-between py-1 border-b border-surface-700 last:border-0">
                  <span className="text-xs text-slate-400 truncate">{d.name}</span>
                  <span className="text-xs font-semibold text-amber-400 ml-2">{Math.round(d.confidence * 100)}%</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* AI Narrative */}
      {summary.aiNarrative && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-indigo-400" />
            <span className="text-sm font-semibold text-indigo-300">AI Executive Narrative</span>
            <span className="text-xs text-slate-500 ml-2">Powered by Claude — evidence-grounded analysis</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{summary.aiNarrative}</p>
        </div>
      )}

      {/* Domain Cards */}
      <div>
        <h2 className="text-base font-semibold text-slate-200 mb-3">Domain Scores</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {summary.domains.map(d => (
            <DomainCard key={d.domainId} domain={d}
              onClick={() => navigate(`/maturity/domains/${d.domainId}`)} />
          ))}
        </div>
      </div>

      {/* Top Recommendations */}
      <div>
        <h2 className="text-base font-semibold text-slate-200 mb-3">Top Recommendations</h2>
        <div className="space-y-2">
          {[...criticalRecs, ...highRecs, ...otherRecs].map((rec, i) => (
            <div key={i} className="rounded-lg border border-surface-600 bg-surface-800 p-4 flex gap-4">
              <div className="shrink-0 w-2 rounded-full self-stretch"
                style={{ backgroundColor: PRIORITY_COLOR[rec.priority] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-medium text-slate-200">{rec.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: PRIORITY_COLOR[rec.priority] + '25', color: PRIORITY_COLOR[rec.priority] }}>
                    {rec.priority}
                  </span>
                  <span className="text-xs text-slate-500">{EFFORT_LABEL[rec.effort as keyof typeof EFFORT_LABEL] ?? rec.effort}</span>
                  <span className="text-xs text-indigo-400 ml-auto">+{rec.impact} pts impact</span>
                </div>
                <p className="text-xs text-slate-400">{rec.description}</p>
                <p className="text-xs text-slate-500 mt-1">Domain: {rec.domainName}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
