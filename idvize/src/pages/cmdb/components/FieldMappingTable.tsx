import { CMDB_FIELD_DEFINITIONS, CMDB_HEADER_ALIASES } from '@/types/cmdb'
import type { FieldMapping, CMDBFieldKey } from '@/types/cmdb'

interface FieldMappingTableProps {
  headers: string[]
  sampleRow?: Record<string, string>
  mappings: FieldMapping[]
  onChange: (mappings: FieldMapping[]) => void
}

function autoSuggest(header: string): CMDBFieldKey | null {
  const key = header.toLowerCase().replace(/[\s_\-().]/g, '')
  return CMDB_HEADER_ALIASES[key] ?? null
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildInitialMappings(headers: string[]): FieldMapping[] {
  return headers.map(h => ({ sourceHeader: h, targetField: autoSuggest(h) }))
}

export default function FieldMappingTable({ headers, sampleRow, mappings, onChange }: FieldMappingTableProps) {
  const update = (idx: number, targetField: CMDBFieldKey | null) => {
    const next = mappings.map((m, i) => i === idx ? { ...m, targetField } : m)
    onChange(next)
  }

  const autoFillAll = () => {
    onChange(headers.map(h => ({ sourceHeader: h, targetField: autoSuggest(h) })))
  }

  const clearAll = () => {
    onChange(headers.map(h => ({ sourceHeader: h, targetField: null })))
  }

  const mappedCount = mappings.filter(m => m.targetField !== null).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          {mappedCount} of {headers.length} columns mapped
        </p>
        <div className="flex gap-2">
          <button onClick={autoFillAll}
            className="text-xs text-a-purple hover:text-a-purple px-2 py-1 rounded border border-violet-800/50 hover:bg-violet-900/20 transition-colors">
            Auto-suggest all
          </button>
          <button onClick={clearAll}
            className="text-xs text-muted hover:text-secondary px-2 py-1 rounded border border-surface-600 hover:bg-surface-700 transition-colors">
            Clear all
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-surface-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-900 border-b border-surface-700">
              <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wide w-1/3">Source Column</th>
              <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wide w-1/3">Map To</th>
              <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wide w-1/3">Sample Value</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m, i) => (
              <tr key={m.sourceHeader}
                className={`border-b border-surface-700 last:border-0
                  ${i % 2 === 0 ? 'bg-surface-800' : 'bg-surface-800/60'}`}>
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs text-body bg-surface-700 px-1.5 py-0.5 rounded">
                    {m.sourceHeader}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={m.targetField ?? '__ignore__'}
                    onChange={e => {
                      const v = e.target.value
                      update(i, v === '__ignore__' ? null : v as CMDBFieldKey)
                    }}
                    className="w-full bg-surface-900 border border-surface-600 rounded px-2 py-1 text-xs text-secondary
                               focus:outline-none focus:border-violet-500"
                  >
                    <option value="__ignore__">— Ignore —</option>
                    {CMDB_FIELD_DEFINITIONS.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted truncate max-w-[160px]">
                  {sampleRow?.[m.sourceHeader] ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
