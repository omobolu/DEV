import { useState, useEffect, useCallback } from 'react'
import { FileText, Plus, RefreshCw, BookOpen, Clock, CheckCircle, Archive } from 'lucide-react'
import Badge from '@/components/common/Badge'
import EmptyState from '@/components/common/EmptyState'
import DocumentDetail from './DocumentDetail'

const API = 'http://localhost:3001'
const HEADERS = { 'Content-Type': 'application/json', 'x-api-key': 'demo-key' }

type DocStatus = 'draft' | 'in_review' | 'published' | 'archived'

interface DocSummary {
  documentId: string
  title: string
  category: string
  owner: string
  status: DocStatus
  currentVersion: number
  tags: string[]
  updatedAt: string
}

interface Stats {
  total: number
  byStatus: Record<DocStatus, number>
  byCategory: Record<string, number>
}

const statusVariant: Record<DocStatus, 'neutral' | 'warning' | 'success' | 'info'> = {
  draft: 'neutral',
  in_review: 'warning',
  published: 'success',
  archived: 'info',
}

const statusLabel: Record<DocStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  published: 'Published',
  archived: 'Archived',
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string
}) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex items-center gap-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg" style={{ background: `${color}20` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-2xl font-bold text-heading">{value}</p>
      </div>
    </div>
  )
}

function CreateDocumentModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: () => void
}) {
  const [form, setForm] = useState({ title: '', category: 'policy', content: '', changeNote: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.title || !form.content) { setError('Title and content are required'); return }
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('idvize_token')
      const res = await fetch(`${API}/documents`, {
        method: 'POST',
        headers: { ...HEADERS, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, owner: 'admin@idvize.io' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      onCreated()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const categories = ['policy', 'procedure', 'standard', 'guideline', 'runbook', 'architecture', 'other']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="create-doc-heading">
      <div className="bg-surface-800 border border-surface-700 rounded-xl w-full max-w-2xl p-6 space-y-4 mx-4">
        <h2 id="create-doc-heading" className="text-lg font-semibold text-heading">New Document</h2>

        <div className="space-y-3">
          <div>
            <label htmlFor="doc-title" className="text-xs text-muted mb-1 block">Title *</label>
            <input
              id="doc-title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Password Policy v2"
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-body
                         placeholder-faint focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label htmlFor="doc-category" className="text-xs text-muted mb-1 block">Category *</label>
            <select
              id="doc-category"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-body
                         focus:outline-none focus:border-violet-500"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="doc-content" className="text-xs text-muted mb-1 block">Content (Markdown) *</label>
            <textarea
              id="doc-content"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={8}
              placeholder="# Title&#10;&#10;## Section&#10;&#10;Your content here..."
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-body
                         placeholder-faint focus:outline-none focus:border-violet-500 font-mono resize-none"
            />
          </div>
          <div>
            <label htmlFor="doc-change-note" className="text-xs text-muted mb-1 block">Change Note</label>
            <input
              id="doc-change-note"
              value={form.changeNote}
              onChange={e => setForm(f => ({ ...f, changeNote: e.target.value }))}
              placeholder="e.g. Initial draft"
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-body
                         placeholder-faint focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {error && <p className="text-xs text-a-red">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted border border-surface-600 rounded-lg hover:bg-surface-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-violet-600 rounded-lg hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : 'Create Document'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<DocStatus | ''>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const getToken = () => localStorage.getItem('idvize_token') ?? ''

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      const [docsRes, statsRes] = await Promise.all([
        fetch(`${API}/documents`, { headers: { ...HEADERS, Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API}/documents/stats`, { headers: { ...HEADERS, Authorization: `Bearer ${getToken()}` } }),
      ])
      const docsJson = await docsRes.json()
      const statsJson = await statsRes.json()
      if (docsJson.success) setDocs(docsJson.data)
      if (statsJson.success) setStats(statsJson.data)
    } catch {
      // silently fail — likely no token yet
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const filtered = docs.filter(d => {
    const matchText = !filter ||
      d.title.toLowerCase().includes(filter.toLowerCase()) ||
      d.category.toLowerCase().includes(filter.toLowerCase()) ||
      d.owner.toLowerCase().includes(filter.toLowerCase())
    const matchStatus = !statusFilter || d.status === statusFilter
    return matchText && matchStatus
  })

  if (selectedId) {
    return (
      <DocumentDetail
        documentId={selectedId}
        onBack={() => { setSelectedId(null); fetchDocs() }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">Document Registry</h1>
          <p className="text-muted mt-1 text-sm">
            Policies, procedures, standards, and runbooks — with versioning &amp; review workflow
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchDocs}
            aria-label="Refresh document list"
            className="flex items-center gap-1.5 text-xs text-muted border border-surface-600 px-3 py-1.5
                       rounded-lg hover:bg-surface-700 transition-colors"
          >
            <RefreshCw size={11} aria-hidden="true" /> Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            aria-label="Create new document"
            className="flex items-center gap-1.5 text-xs text-white bg-violet-600 px-3 py-1.5
                       rounded-lg hover:bg-violet-500 transition-colors"
          >
            <Plus size={11} aria-hidden="true" /> New Document
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FileText}     label="Total Documents" value={stats.total}                       color="#1e40af" />
          <StatCard icon={Clock}        label="In Review"       value={stats.byStatus.in_review ?? 0}    color="#f59e0b" />
          <StatCard icon={CheckCircle}  label="Published"       value={stats.byStatus.published ?? 0}    color="#22c55e" />
          <StatCard icon={Archive}      label="Archived"        value={stats.byStatus.archived ?? 0}     color="#64748b" />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          aria-label="Filter documents by title, category, or owner"
          placeholder="Filter by title, category, owner…"
          className="flex-1 max-w-sm bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm
                     text-secondary placeholder-faint focus:outline-none focus:border-violet-500"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as DocStatus | '')}
          className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-secondary
                     focus:outline-none focus:border-violet-500"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="in_review">In Review</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <span className="text-xs text-muted">{filtered.length} of {docs.length}</span>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-muted text-sm">Loading documents…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={docs.length === 0 ? 'No documents yet' : 'No documents match your filters'}
          description={
            docs.length === 0
              ? 'Policies, runbooks, and standards added to the registry will appear here.'
              : 'Try adjusting the search term or status filter to see more results.'
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <div
              key={doc.documentId}
              onClick={() => setSelectedId(doc.documentId)}
              className="bg-surface-800 border border-surface-700 rounded-xl px-5 py-4 flex items-center gap-4
                         hover:border-violet-700 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-900/30 flex-shrink-0">
                <FileText size={16} className="text-a-purple" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-body group-hover:text-heading truncate">
                  {doc.title}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {doc.category} · v{doc.currentVersion} · {doc.owner}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {doc.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="text-xs text-muted bg-surface-700 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
                <Badge label={statusLabel[doc.status]} variant={statusVariant[doc.status]} />
                <span className="text-xs text-faint">
                  {new Date(doc.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateDocumentModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchDocs}
        />
      )}
    </div>
  )
}
