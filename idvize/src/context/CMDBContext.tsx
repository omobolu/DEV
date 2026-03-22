import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react'
import type { CMDBApp, FieldMapping, APIConnectionConfig, ImportMeta } from '@/types/cmdb'
import { DEFAULT_API_CONFIG } from '@/types/cmdb'
import { CMDB_MOCK_APPS } from '@/data/cmdbMock'

// ── State ────────────────────────────────────────────────────────────────────
interface CMDBState {
  apps: CMDBApp[]
  fieldMappings: FieldMapping[]
  apiConfig: APIConnectionConfig
  lastImportMeta: ImportMeta | null
}

const STORAGE_KEYS = {
  apps: 'idvize_cmdb_apps',
  mappings: 'idvize_cmdb_mappings',
  apiConfig: 'idvize_cmdb_api_config',
  meta: 'idvize_cmdb_meta',
}

function loadFromStorage(): Partial<CMDBState> {
  try {
    const apps = localStorage.getItem(STORAGE_KEYS.apps)
    const mappings = localStorage.getItem(STORAGE_KEYS.mappings)
    const apiConfig = localStorage.getItem(STORAGE_KEYS.apiConfig)
    const meta = localStorage.getItem(STORAGE_KEYS.meta)
    return {
      apps: apps ? (JSON.parse(apps) as CMDBApp[]) : undefined,
      fieldMappings: mappings ? (JSON.parse(mappings) as FieldMapping[]) : undefined,
      apiConfig: apiConfig ? (JSON.parse(apiConfig) as APIConnectionConfig) : undefined,
      lastImportMeta: meta ? (JSON.parse(meta) as ImportMeta) : undefined,
    }
  } catch {
    return {}
  }
}

function initialState(): CMDBState {
  const stored = loadFromStorage()
  return {
    apps: stored.apps ?? CMDB_MOCK_APPS,
    fieldMappings: stored.fieldMappings ?? [],
    apiConfig: stored.apiConfig ?? DEFAULT_API_CONFIG,
    lastImportMeta: stored.lastImportMeta ?? {
      source: 'mock', timestamp: new Date().toISOString(), count: CMDB_MOCK_APPS.length,
    },
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────
type Action =
  | { type: 'IMPORT_APPS'; apps: CMDBApp[]; meta: ImportMeta }
  | { type: 'UPDATE_MAPPINGS'; mappings: FieldMapping[] }
  | { type: 'UPDATE_API_CONFIG'; config: Partial<APIConnectionConfig> }
  | { type: 'RESET_TO_MOCK' }

function reducer(state: CMDBState, action: Action): CMDBState {
  switch (action.type) {
    case 'IMPORT_APPS':
      return { ...state, apps: action.apps, lastImportMeta: action.meta }
    case 'UPDATE_MAPPINGS':
      return { ...state, fieldMappings: action.mappings }
    case 'UPDATE_API_CONFIG':
      return { ...state, apiConfig: { ...state.apiConfig, ...action.config } }
    case 'RESET_TO_MOCK':
      return {
        ...state,
        apps: CMDB_MOCK_APPS,
        lastImportMeta: { source: 'mock', timestamp: new Date().toISOString(), count: CMDB_MOCK_APPS.length },
      }
    default:
      return state
  }
}

// ── Context ──────────────────────────────────────────────────────────────────
interface CMDBContextValue extends CMDBState {
  importApps: (apps: CMDBApp[], meta: ImportMeta) => void
  updateMappings: (mappings: FieldMapping[]) => void
  updateApiConfig: (config: Partial<APIConnectionConfig>) => void
  resetToMock: () => void
}

const CMDBContext = createContext<CMDBContextValue | null>(null)

export function CMDBProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  // Persist to localStorage on every state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.apps, JSON.stringify(state.apps))
      localStorage.setItem(STORAGE_KEYS.mappings, JSON.stringify(state.fieldMappings))
      // Omit passwords from API config storage
      const safeConfig = { ...state.apiConfig, bearerToken: '', basicPassword: '', apiKeyValue: '' }
      localStorage.setItem(STORAGE_KEYS.apiConfig, JSON.stringify(safeConfig))
      if (state.lastImportMeta) {
        localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify(state.lastImportMeta))
      }
    } catch {/* storage full or unavailable */}
  }, [state])

  const value: CMDBContextValue = {
    ...state,
    importApps: (apps, meta) => dispatch({ type: 'IMPORT_APPS', apps, meta }),
    updateMappings: (mappings) => dispatch({ type: 'UPDATE_MAPPINGS', mappings }),
    updateApiConfig: (config) => dispatch({ type: 'UPDATE_API_CONFIG', config }),
    resetToMock: () => dispatch({ type: 'RESET_TO_MOCK' }),
  }

  return <CMDBContext.Provider value={value}>{children}</CMDBContext.Provider>
}

export function useCMDB(): CMDBContextValue {
  const ctx = useContext(CMDBContext)
  if (!ctx) throw new Error('useCMDB must be used within <CMDBProvider>')
  return ctx
}
