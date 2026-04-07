import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, Clock, CheckCircle, XCircle, Send, Globe, Archive,
  ChevronDown, ChevronUp, User,
} from 'lucide-react'
import Badge from '@/components/common/Badge'

const API = 'http://localhost:3001'
const HEADERS = { 'Content-Type': 'application/json', 'x-api-key': 'demo-key' }

type DocStatus = 'draft' | 'in_review' | 'published' | 'archived'

interface DocumentVersion {
  version: number
  content: string
  changedBy: string
  changedAt: string
  changeNote: string
}

interface ReviewRecord {
  reviewId: string
  version: number
  reviewedBy: string
  reviewedAt: string
  outcome: 'approved' | 'rejected' | 'pending'
  comments?: string
}

interface Document {
  documentId: string
  title: string
  category: string
  owner: string
  tags: string[]
  status: DocStatus
  currentVersion: number
  versions: DocumentVersion[]
  reviews: ReviewRecord[]
  createdAt: string
  updatedAt: string
  publishedAt?: string
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

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown rendering for headers, bold, code blocks, lists
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, i) => {
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-sm font-semibold text-body mt-4 mb-1">{line.slice(4)}</h3>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-base font-semibold text-heading mt-5 mb-2">{line.slice(3)}</h2>)
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-lg font-bold text-heading mt-4 mb-3">{line.slice(2)}</h1>)
    } else if (line.startsWith('```')) {
      // skip fence markers (simplified)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const text = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      elements.push(
        <li key={i} className="text-sm text-secondary ml-4 list-disc"
          dangerouslySetInnerHTML={{ __html: text }} />
      )
    } else if (line.match(/^\d+\. /)) {
      const text = line.replace(/^\d+\. /, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      elements.push(
        <li key={i} className="text-sm text-secondary ml-4 list-decimal"
          dangerouslySetInnerHTML={{ __html: text }} />
      )
    } else if (line.startsWith('|')) {
      // Simple table row
      const cells = line.split('|').filter(c => c.trim())
      const isHeader = lines[i + 1]?.includes('---')
      elements.push(
        <div key={i} className={`flex gap-px text-xs ${isHeader ? 'font-semibold text-secondary' : 'text-muted'}`}>
          {cells.map((c, j) => (
            <div key={j} className="flex-1 bg-surface-700/50 px-3 py-1.5">{c.trim()}</div>
          ))}
        </div>
      )
    } else if (line.trim() === '' || line.startsWith('---')) {
      elements.push(<div key={i} className="h-2" />)
    } else {
      const text = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.*?)`/g, '<code class="bg-surface-700 px-1 rounded text-xs font-mono text-a-purple">$1</code>')
      elements.push(
        <p key={i} className="text-sm text-secondary leading-relaxed"
          dangerouslySetInnerHTML={{ __html: text }} />
      )
    }
  })

  return <div className="space-y-0.5">{elements}</div>
}

export default function DocumentDetail({ documentId, onBack }: {
  documentId: string; onBack: () => void
}) {
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'content' | 'versions' | 'reviews'>('content')
  const [reviewingVersion, setReviewingVersion] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const token = () => localStorage.getItem('idvize_token') ?? ''

  const fetchDoc = useCallback(async () => {
    try {
      const res = await fetch(`${API}/documents/${documentId}`, {
        headers: { ...HEADERS, Authorization: `Bearer ${token()}` },
      })
      const json = await res.json()
      if (json.success) setDoc(json.data)
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => { fetchDoc() }, [fetchDoc])

  const doAction = async (path: string, method = 'POST', body?: object) => {
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch(`${API}/documents/${documentId}/${path}`, {
        method,
        headers: { ...HEADERS, Authorization: `Bearer ${token()}` },
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      await fetchDoc()
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm">Loading…</div>
    )
  }

  if (!doc) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Document not found.</p>
        <button onClick={onBack} className="mt-4 text-sm text-a-purple hover:underline">← Back</button>
      </div>
    )
  }

  const currentVersionContent = doc.versions.find(v => v.version === doc.currentVersion)
  const latestReview = doc.reviews.filter(r => r.version === doc.currentVersion).at(-1)

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-body mb-4 transition-colors"
        >
          <ArrowLeft size={12} /> Back to Documents
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-heading">{doc.title}</h1>
              <Badge label={statusLabel[doc.status]} variant={statusVariant[doc.status]} />
            </div>
            <p className="text-muted mt-1 text-sm">
              {doc.category} · v{doc.currentVersion} · Owner: {doc.owner}
            </p>
          </div>

          {/* Workflow Actions */}
          <div className="flex gap-2 flex-wrap">
            {doc.status === 'draft' && (
              <button
                onClick={() => doAction('submit')}
                disabled={actionLoading}
                className="flex items-center gap-1.5 text-xs text-a-amber border border-amber-800/50
                           px-3 py-1.5 rounded-lg hover:bg-amber-900/20 disabled:opacity-50 transition-colors"
              >
                <Send size={11} /> Submit for Review
              </button>
            )}
            {doc.status === 'in_review' && (
              <>
                <button
                  onClick={() => doAction('review', 'POST', { outcome: 'approved', comments: 'Approved' })}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 text-xs text-a-green border border-green-800/50
                             px-3 py-1.5 rounded-lg hover:bg-green-900/20 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle size={11} /> Approve
                </button>
                <button
                  onClick={() => doAction('review', 'POST', { outcome: 'rejected', comments: 'Needs revision' })}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 text-xs text-a-red border border-red-800/50
                             px-3 py-1.5 rounded-lg hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                >
                  <XCircle size={11} /> Reject
                </button>
                {latestReview?.outcome === 'approved' && (
                  <button
                    onClick={() => doAction('publish')}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 text-xs text-white bg-violet-600
                               px-3 py-1.5 rounded-lg hover:bg-violet-500 disabled:opacity-50 transition-colors"
                  >
                    <Globe size={11} /> Publish
                  </button>
                )}
              </>
            )}
            {(doc.status === 'published' || doc.status === 'draft') && (
              <button
                onClick={() => doAction('archive')}
                disabled={actionLoading}
                className="flex items-center gap-1.5 text-xs text-muted border border-surface-600
                           px-3 py-1.5 rounded-lg hover:bg-surface-700 disabled:opacity-50 transition-colors"
              >
                <Archive size={11} /> Archive
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <p className="mt-2 text-xs text-a-red bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
            {actionError}
          </p>
        )}

        {/* Tags */}
        {doc.tags.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {doc.tags.map(tag => (
              <span key={tag} className="text-xs text-muted bg-surface-700 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-700">
        {(['content', 'versions', 'reviews'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize
              ${activeTab === tab
                ? 'text-a-purple border-violet-400'
                : 'text-muted border-transparent hover:text-secondary'}`}
          >
            {tab === 'versions' ? `Versions (${doc.versions.length})` :
             tab === 'reviews' ? `Reviews (${doc.reviews.length})` : 'Content'}
          </button>
        ))}
      </div>

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-6">
          {currentVersionContent ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted">
                  Version {currentVersionContent.version} · {currentVersionContent.changedBy} ·{' '}
                  {new Date(currentVersionContent.changedAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-faint italic">{currentVersionContent.changeNote}</p>
              </div>
              <MarkdownContent content={currentVersionContent.content} />
            </>
          ) : (
            <p className="text-muted text-sm">No content available</p>
          )}
        </div>
      )}

      {/* Versions Tab */}
      {activeTab === 'versions' && (
        <div className="space-y-3">
          {[...doc.versions].reverse().map(v => (
            <div key={v.version} className="bg-surface-800 border border-surface-700 rounded-xl">
              <button
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-700/30 transition-colors"
                onClick={() => setReviewingVersion(reviewingVersion === v.version ? null : v.version)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-surface-700 text-secondary px-2 py-0.5 rounded">v{v.version}</span>
                  <span className="text-sm text-secondary">{v.changeNote}</span>
                  {v.version === doc.currentVersion && (
                    <span className="text-xs text-a-purple border border-violet-700 px-1.5 py-0.5 rounded">current</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{v.changedBy}</span>
                  <span>{new Date(v.changedAt).toLocaleDateString()}</span>
                  {reviewingVersion === v.version ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>
              {reviewingVersion === v.version && (
                <div className="px-5 pb-5 border-t border-surface-700">
                  <div className="mt-4">
                    <MarkdownContent content={v.content} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="space-y-3">
          {doc.reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted">
              <User size={24} />
              <p className="text-sm">No reviews yet</p>
              {doc.status === 'draft' && (
                <p className="text-xs text-faint">Submit for review first</p>
              )}
            </div>
          ) : (
            [...doc.reviews].reverse().map(r => (
              <div key={r.reviewId}
                className="bg-surface-800 border border-surface-700 rounded-xl px-5 py-4 flex items-start gap-4">
                <div className={`mt-0.5 flex-shrink-0 ${
                  r.outcome === 'approved' ? 'text-a-green' :
                  r.outcome === 'rejected' ? 'text-a-red' : 'text-a-amber'
                }`}>
                  {r.outcome === 'approved' ? <CheckCircle size={16} /> :
                   r.outcome === 'rejected' ? <XCircle size={16} /> :
                   <Clock size={16} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-body">{r.reviewedBy}</span>
                    <span className="text-xs text-muted">v{r.version}</span>
                    <span className={`text-xs capitalize ${
                      r.outcome === 'approved' ? 'text-a-green' :
                      r.outcome === 'rejected' ? 'text-a-red' : 'text-a-amber'
                    }`}>{r.outcome}</span>
                  </div>
                  {r.comments && (
                    <p className="text-sm text-muted mt-1">{r.comments}</p>
                  )}
                  <p className="text-xs text-faint mt-1">
                    {new Date(r.reviewedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
