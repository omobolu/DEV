import { useRef, useState, type DragEvent } from 'react'
import { Upload, FileText, X } from 'lucide-react'

export interface ParsedCSV {
  headers: string[]
  rows: Record<string, string>[]
  fileName: string
}

interface CSVDropZoneProps {
  onParsed: (result: ParsedCSV) => void
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  // Robust CSV parser — handles quoted fields with embedded commas/newlines
  function parseLine(line: string): string[] {
    const fields: string[] = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        fields.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    fields.push(cur.trim())
    return fields
  }

  const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').replace(/^"|"$/g, '') })
    return obj
  })
  return { headers, rows }
}

export default function CSVDropZone({ onParsed }: CSVDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [parsed, setParsed] = useState<ParsedCSV | null>(null)
  const [error, setError] = useState<string | null>(null)

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) { setError('Please upload a .csv file'); return }
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers, rows } = parseCSV(text)
      if (!headers.length) { setError('Could not parse CSV — check the file format'); return }
      const result: ParsedCSV = { headers, rows, fileName: file.name }
      setParsed(result)
      onParsed(result)
    }
    reader.readAsText(file)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const clear = () => { setParsed(null); setError(null); if (inputRef.current) inputRef.current.value = '' }

  if (parsed) {
    return (
      <div className="flex items-center gap-4 p-4 bg-green-900/20 border border-green-800/50 rounded-xl">
        <FileText size={20} className="text-a-green flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-300 truncate">{parsed.fileName}</p>
          <p className="text-xs text-muted mt-0.5">
            {parsed.rows.length.toLocaleString()} rows · {parsed.headers.length} columns detected
          </p>
        </div>
        <button onClick={clear} className="text-muted hover:text-secondary transition-colors">
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed
          cursor-pointer transition-colors select-none
          ${dragging
            ? 'border-violet-500 bg-violet-900/20'
            : 'border-surface-600 hover:border-surface-500 hover:bg-surface-700/30'}`}
      >
        <Upload size={28} className={dragging ? 'text-a-purple' : 'text-muted'} />
        <div className="text-center">
          <p className="text-sm font-medium text-secondary">
            Drop your CSV here, or <span className="text-a-purple">browse</span>
          </p>
          <p className="text-xs text-muted mt-1">Accepts .csv files</p>
        </div>
      </div>
      {error && <p className="text-xs text-a-red mt-2">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }}
      />
    </div>
  )
}
