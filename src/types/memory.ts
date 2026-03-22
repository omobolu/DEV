/**
 * IDVIZE Platform Memory Types
 * Part 9: Memory Layer
 */

export type MemoryType = 'working' | 'operational' | 'knowledge'

export interface MemoryEntry {
  id: string
  type: MemoryType
  key: string
  value: unknown
  source: string
  createdAt: string
  expiresAt?: string
  tags: string[]
  metadata?: Record<string, string>
}

export interface MemoryQuery {
  type?: MemoryType
  key?: string
  source?: string
  tags?: string[]
  limit?: number
}

/**
 * Memory store contract — v1 uses in-memory, future versions can use DB
 */
export interface MemoryStore {
  /** Store a memory entry */
  set(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): MemoryEntry

  /** Retrieve a memory entry by key */
  get(key: string, type?: MemoryType): MemoryEntry | undefined

  /** Query memory entries */
  query(query: MemoryQuery): MemoryEntry[]

  /** Remove a memory entry */
  remove(id: string): boolean

  /** Clear all entries of a specific type */
  clear(type?: MemoryType): void
}
