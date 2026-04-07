import { useState } from 'react'
import { Save, CheckCircle } from 'lucide-react'
import { useCMDB } from '@/context/CMDBContext'
import FieldMappingTable, { buildInitialMappings } from '../components/FieldMappingTable'
import { CMDB_CSV_HEADERS } from '@/data/cmdbMock'

export default function CMDBFieldMapper() {
  const { fieldMappings, updateMappings } = useCMDB()
  const [saved, setSaved] = useState(false)

  // If no saved mappings yet, show defaults from the canonical CSV headers
  const activeMappings = fieldMappings.length
    ? fieldMappings
    : buildInitialMappings(CMDB_CSV_HEADERS)

  const [localMappings, setLocalMappings] = useState(activeMappings)

  const handleSave = () => {
    updateMappings(localMappings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">
            Configure how incoming CSV columns or API fields map to idvize CMDB fields.
            These mappings are saved and reused on every import.
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ml-4
            ${saved
              ? 'bg-green-700 text-white'
              : 'bg-violet-600 hover:bg-violet-500 text-white'}`}
        >
          {saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save Mappings'}
        </button>
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
        <p className="text-sm font-semibold text-body mb-4">Field Mappings</p>
        <FieldMappingTable
          headers={localMappings.map(m => m.sourceHeader)}
          mappings={localMappings}
          onChange={setLocalMappings}
        />
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
        <p className="text-xs text-muted font-medium mb-2">Tips</p>
        <ul className="text-xs text-muted space-y-1 list-disc list-inside">
          <li>Use <span className="text-muted font-mono">Auto-suggest all</span> to let idvize fuzzy-match column names automatically</li>
          <li>Set unmapped columns to <span className="text-muted font-mono">— Ignore —</span> to skip them on import</li>
          <li>Boolean fields (SSO, MFA, PAM…) accept: Yes/No, True/False, 1/0, Enabled/Disabled</li>
          <li>Numeric fields (Total Accounts…) accept plain integers</li>
          <li>Mappings are stored in your browser and persist across sessions</li>
        </ul>
      </div>
    </div>
  )
}
