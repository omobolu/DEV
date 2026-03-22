import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export interface Column<T> {
  key: keyof T
  header: string
  render?: (value: T[keyof T], row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  pageSize?: number
  onRowClick?: (row: T) => void
  rowClickable?: (row: T) => boolean
}

export default function DataTable<T>({ columns, data, pageSize = 10, onRowClick, rowClickable }: DataTableProps<T>) {
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<keyof T | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey]
        if (av == null) return 1
        if (bv == null) return -1
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  const total = sorted.length
  const pages = Math.ceil(total / pageSize)
  const slice = sorted.slice(page * pageSize, (page + 1) * pageSize)

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-surface-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-900 border-b border-surface-700">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  onClick={() => handleSort(col.key)}
                  className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-200 select-none"
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {sortKey === col.key
                      ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      : <ChevronUp size={12} className="opacity-20" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => {
              const clickable = onRowClick && (!rowClickable || rowClickable(row))
              return (
              <tr
                key={i}
                onClick={clickable ? () => onRowClick(row) : undefined}
                className={`border-b border-surface-700 last:border-0 hover:bg-surface-700/30 transition-colors
                  ${i % 2 === 0 ? 'bg-surface-800' : 'bg-surface-800/60'}
                  ${clickable ? 'cursor-pointer' : ''}`}
              >
                {columns.map(col => (
                  <td key={String(col.key)} className="px-4 py-3 text-slate-300">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}</span>
          <div className="flex gap-1">
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-7 h-7 rounded text-xs font-medium transition-colors
                  ${page === i ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-surface-700'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
