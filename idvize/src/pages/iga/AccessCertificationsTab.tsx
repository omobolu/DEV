import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, ArrowLeft, RefreshCw, Loader2, ChevronRight,
  CheckCircle, XCircle, Clock, AlertTriangle, X, BarChart2
} from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'
import Badge from '@/components/common/Badge'
import EmptyState from '@/components/common/EmptyState'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface CertificationItem {
  id: string
  identity: string
  entitlement: string
  application: string
  decision: 'certified' | 'revoked' | 'pending' | 'exception'
  reviewer: string
}

interface Campaign {
  id: string
  name: string
  type: string
  status: 'active' | 'completed' | 'scheduled' | 'cancelled'
  owner: string
  startDate: string
  endDate: string
  totalItems: number
  certifiedCount: number
  revokedCount: number
  pendingCount: number
  items?: CertificationItem[]
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const TYPE_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'neutral'> = {
  'user-access': 'info',
  'role-based': 'warning',
  'privileged': 'danger' as any,
  'application': 'success',
  'sod': 'neutral',
}

const STATUS_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
  active: 'info',
  completed: 'success',
  scheduled: 'warning',
  cancelled: 'neutral',
}

const DECISION_CONFIG: Record<string, { variant: 'success' | 'danger' | 'warning' | 'neutral'; icon: typeof CheckCircle }> = {
  certified: { variant: 'success', icon: CheckCircle },
  revoked:   { variant: 'danger',  icon: XCircle },
  pending:   { variant: 'warning', icon: Clock },
  exception: { variant: 'neutral', icon: AlertTriangle },
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function progressPercent(c: Campaign): number {
  if (c.totalItems === 0) return 0
  return Math.round(((c.certifiedCount + c.revokedCount) / c.totalItems) * 100)
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

export default function AccessCertificationsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selected, setSelected] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ---- Fetch campaigns ---- */
  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/iga/certifications')
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load campaigns')
      setCampaigns(json.data)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  /* ---- Fetch campaign detail ---- */
  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await apiFetch(`/iga/certifications/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load campaign')
      setSelected(json.data)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load campaign detail')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const selectCampaign = (c: Campaign) => {
    setError(null)
    setSelected(c)
    fetchDetail(c.id)
  }

  const goBack = () => {
    setSelected(null)
    setError(null)
    fetchCampaigns()
  }

  /* ---- KPI computation ---- */
  const totalCampaigns = campaigns.length
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length
  const totalPending = campaigns.reduce((sum, c) => sum + c.pendingCount, 0)

  /* ---- Error banner ---- */
  const errorBanner = error && (
    <div className="flex items-center gap-2 bg-red-950/40 border border-red-900/60 text-a-red rounded-lg px-4 py-2 text-sm">
      <AlertTriangle size={16} aria-hidden="true" />
      <span className="flex-1">{error}</span>
      <button onClick={() => setError(null)} className="hover:text-white" aria-label="Dismiss error">
        <X size={14} />
      </button>
    </div>
  )

  /* ================================================================ */
  /*  Loading                                                         */
  /* ================================================================ */

  if (loading && !selected) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-a-indigo" aria-label="Loading certifications" />
      </div>
    )
  }

  /* ================================================================ */
  /*  Detail View                                                     */
  /* ================================================================ */

  if (selected) {
    const pct = progressPercent(selected)
    return (
      <div className="space-y-5">
        {errorBanner}

        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors"
          aria-label="Back to campaign list"
        >
          <ArrowLeft size={16} /> Back to Campaigns
        </button>

        {detailLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-a-indigo" aria-label="Loading detail" />
          </div>
        )}

        {!detailLoading && (
          <>
            {/* Header */}
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
              <div className="flex flex-wrap items-start gap-3 mb-3">
                <ShieldCheck size={20} className="text-a-indigo" aria-hidden="true" />
                <h2 className="text-lg font-bold text-heading flex-1">{selected.name}</h2>
                <Badge label={selected.type} variant={TYPE_VARIANT[selected.type] ?? 'neutral'} />
                <Badge label={selected.status} variant={STATUS_VARIANT[selected.status] ?? 'neutral'} />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                <span><strong className="text-body">Owner:</strong> {selected.owner}</span>
                <span><strong className="text-body">Period:</strong> {formatDate(selected.startDate)} - {formatDate(selected.endDate)}</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="bg-surface-900 rounded-lg p-3 border border-surface-700 text-center">
                  <p className="text-lg font-bold text-heading">{selected.totalItems}</p>
                  <p className="text-xs text-muted">Total Items</p>
                </div>
                <div className="bg-surface-900 rounded-lg p-3 border border-surface-700 text-center">
                  <p className="text-lg font-bold text-a-green">{selected.certifiedCount}</p>
                  <p className="text-xs text-muted">Certified</p>
                </div>
                <div className="bg-surface-900 rounded-lg p-3 border border-surface-700 text-center">
                  <p className="text-lg font-bold text-a-red">{selected.revokedCount}</p>
                  <p className="text-xs text-muted">Revoked</p>
                </div>
                <div className="bg-surface-900 rounded-lg p-3 border border-surface-700 text-center">
                  <p className="text-lg font-bold text-a-amber">{selected.pendingCount}</p>
                  <p className="text-xs text-muted">Pending</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-muted mb-1">
                  <span>Progress</span>
                  <span className="font-semibold text-heading">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>

            {/* Items table */}
            {selected.items && selected.items.length > 0 && (
              <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-heading mb-3">
                  Certification Items ({selected.items.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-700 text-left">
                        <th className="px-3 py-2 text-xs font-semibold text-muted">Identity</th>
                        <th className="px-3 py-2 text-xs font-semibold text-muted">Entitlement</th>
                        <th className="px-3 py-2 text-xs font-semibold text-muted">Application</th>
                        <th className="px-3 py-2 text-xs font-semibold text-muted">Decision</th>
                        <th className="px-3 py-2 text-xs font-semibold text-muted">Reviewer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items.map(item => {
                        const cfg = DECISION_CONFIG[item.decision] ?? DECISION_CONFIG.pending
                        const Icon = cfg.icon
                        return (
                          <tr key={item.id} className="border-b border-surface-700/50 hover:bg-surface-900/50">
                            <td className="px-3 py-2 text-body">{item.identity}</td>
                            <td className="px-3 py-2 text-heading font-medium">{item.entitlement}</td>
                            <td className="px-3 py-2 text-body">{item.application}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1">
                                <Icon size={12} aria-hidden="true" />
                                <Badge label={item.decision} variant={cfg.variant} />
                              </span>
                            </td>
                            <td className="px-3 py-2 text-muted">{item.reviewer}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty items state */}
            {(!selected.items || selected.items.length === 0) && (
              <div className="flex flex-col items-center justify-center h-32 text-center bg-surface-800 border border-surface-700 rounded-xl">
                <p className="text-sm text-muted">No certification items loaded.</p>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  /* ================================================================ */
  /*  List View                                                       */
  /* ================================================================ */

  return (
    <div className="space-y-4">
      {errorBanner}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Campaigns', value: totalCampaigns, icon: BarChart2, color: 'text-a-indigo' },
          { label: 'Active', value: activeCampaigns, icon: ShieldCheck, color: 'text-a-cyan' },
          { label: 'Completed', value: completedCampaigns, icon: CheckCircle, color: 'text-a-green' },
          { label: 'Items Pending', value: totalPending, icon: Clock, color: 'text-a-amber' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-900 border border-surface-700 flex items-center justify-center shrink-0">
              <kpi.icon size={18} className={kpi.color} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-bold text-heading">{kpi.value}</p>
              <p className="text-xs text-muted">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-heading flex items-center gap-2">
          <ShieldCheck size={18} className="text-a-indigo" aria-hidden="true" />
          Certification Campaigns
        </h2>
        <button
          onClick={fetchCampaigns}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-sm text-muted hover:text-heading transition-colors disabled:opacity-50"
          aria-label="Refresh campaigns"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Empty state */}
      {campaigns.length === 0 && !loading && (
        <EmptyState
          icon={ShieldCheck}
          title="No certification campaigns yet"
          description="Launch a campaign to review user access against entitlements and ensure least-privilege compliance."
        />
      )}

      {/* Campaign cards */}
      <div className="grid gap-3">
        {campaigns.map(c => {
          const pct = progressPercent(c)
          return (
            <button
              key={c.id}
              onClick={() => selectCampaign(c)}
              className="w-full text-left bg-surface-800 border border-surface-700 rounded-xl p-4 hover:border-indigo-500/50 hover:bg-surface-800/80 transition-all group"
              aria-label={`Campaign: ${c.name}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-heading">{c.name}</span>
                    <Badge label={c.type} variant={TYPE_VARIANT[c.type] ?? 'neutral'} />
                    <Badge label={c.status} variant={STATUS_VARIANT[c.status] ?? 'neutral'} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted">
                    <span><strong className="text-body">Owner:</strong> {c.owner}</span>
                    <span>{formatDate(c.startDate)} - {formatDate(c.endDate)}</span>
                  </div>

                  {/* Progress */}
                  <div className="mt-3 max-w-md">
                    <div className="flex items-center justify-between text-xs text-muted mb-1">
                      <span>
                        <span className="text-a-green">{c.certifiedCount} certified</span>
                        {' / '}
                        <span className="text-a-red">{c.revokedCount} revoked</span>
                        {' / '}
                        <span className="text-a-amber">{c.pendingCount} pending</span>
                      </span>
                      <span className="font-semibold text-heading">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-faint group-hover:text-a-indigo transition-colors mt-1 shrink-0" aria-hidden="true" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
