import { useEffect, useState, useCallback } from 'react'
import { Activity, RefreshCw, Filter, Search } from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

interface OsEvent {
  eventId: string
  type: string
  severity: string
  actor: string
  resource: string
  outcome: string
  timestamp: string
  driver: string
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function severityColor(sev: string): string {
  return sev === 'critical' ? '#ef4444' : sev === 'high' ? '#f97316' : sev === 'medium' ? '#eab308' : '#64748b'
}

function outcomeColor(outcome: string): string {
  return outcome === 'success' ? '#22c55e' : outcome === 'failure' ? '#ef4444' : '#64748b'
}

function EventRow({ event }: { event: OsEvent }) {
  const sc = severityColor(event.severity)
  const oc = outcomeColor(event.outcome)
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 border-b border-surface-700/50 last:border-0 text-xs hover:bg-surface-700/30 transition-colors">
      <span className="text-muted font-mono shrink-0 w-20">{fmtTime(event.timestamp)}</span>
      <span className="text-muted font-mono shrink-0 w-24">{fmtDate(event.timestamp)}</span>
      <span className="px-1.5 py-0.5 rounded text-xs shrink-0 font-medium"
        style={{ backgroundColor: sc + '20', color: sc }}>{event.severity}</span>
      <span className="text-muted shrink-0 w-16 truncate">[{event.driver}]</span>
      <span className="text-muted font-mono shrink-0 w-40 truncate">{event.type}</span>
      <span className="text-secondary flex-1 truncate">{event.actor} &rarr; {event.resource}</span>
      <span className="shrink-0 font-mono" style={{ color: oc }}>
        {event.outcome === 'success' ? '\u2713' : event.outcome === 'failure' ? '\u2717' : '\u2014'}
      </span>
    </div>
  )
}

export default function SystemEventsPage() {
  const [events, setEvents] = useState<OsEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/os/events')
      const data = await res.json()
      setEvents(data.data ?? [])
    } catch {
      // silently degrade
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const filtered = events.filter(e => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return e.type.toLowerCase().includes(q) ||
             e.actor.toLowerCase().includes(q) ||
             e.resource.toLowerCase().includes(q) ||
             e.driver.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-500/10">
            <Activity size={18} className="text-a-indigo" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-heading">System Events</h1>
            <p className="text-xs text-muted">Live IAM event stream from all drivers and services</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
            live
          </span>
          <button
            onClick={fetchEvents}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-700 text-body hover:bg-surface-600 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs bg-surface-900 border border-surface-600 text-body placeholder-muted focus:border-indigo-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-muted" />
          {['all', 'critical', 'high', 'medium', 'info'].map(sev => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                severityFilter === sev
                  ? 'bg-indigo-600/20 text-a-indigo border border-indigo-500/40'
                  : 'bg-surface-700 text-muted hover:text-body'
              }`}
            >
              {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted ml-auto">
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Events Table */}
      <div className="rounded-xl border border-surface-700 bg-surface-800 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-3 py-2 px-3 border-b border-surface-600 bg-surface-900/50 text-xs font-semibold text-muted">
          <span className="w-20">Time</span>
          <span className="w-24">Date</span>
          <span className="w-16">Severity</span>
          <span className="w-16">Driver</span>
          <span className="w-40">Event Type</span>
          <span className="flex-1">Details</span>
          <span className="w-6">Ok</span>
        </div>
        {/* Rows */}
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-xs text-muted">Loading events...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              {search || severityFilter !== 'all'
                ? 'No events match the current filter.'
                : 'No events recorded yet. Events appear as IAM activity occurs.'}
            </div>
          ) : (
            filtered.map(e => <EventRow key={e.eventId} event={e} />)
          )}
        </div>
      </div>
    </div>
  )
}
