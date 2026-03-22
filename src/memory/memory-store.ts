/**
 * IDVIZE Platform Memory Store
 * In-memory implementation for v1, interface-ready for future DB integration
 */

import type { MemoryEntry, MemoryQuery, MemoryStore, MemoryType } from '../types/memory'

export class InMemoryStore implements MemoryStore {
  private entries: Map<string, MemoryEntry> = new Map()

  set(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): MemoryEntry {
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const full: MemoryEntry = {
      ...entry,
      id,
      createdAt: new Date().toISOString(),
    }
    this.entries.set(id, full)

    // Also index by composite key for fast lookups
    const compositeKey = `${entry.type}:${entry.key}`
    this.entries.set(compositeKey, full)

    return full
  }

  get(key: string, type?: MemoryType): MemoryEntry | undefined {
    if (type) {
      const compositeKey = `${type}:${key}`
      const entry = this.entries.get(compositeKey)
      if (entry && !this.isExpired(entry)) return entry
    }

    // Fallback: search all entries
    for (const entry of this.entries.values()) {
      if (entry.key === key && (!type || entry.type === type)) {
        if (!this.isExpired(entry)) return entry
      }
    }
    return undefined
  }

  query(query: MemoryQuery): MemoryEntry[] {
    const seen = new Set<string>()
    const results: MemoryEntry[] = []

    for (const entry of this.entries.values()) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)

      if (this.isExpired(entry)) continue
      if (query.type && entry.type !== query.type) continue
      if (query.key && entry.key !== query.key) continue
      if (query.source && entry.source !== query.source) continue
      if (query.tags && !query.tags.every(t => entry.tags.includes(t))) continue

      results.push(entry)
    }

    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return results.slice(0, query.limit ?? 100)
  }

  remove(id: string): boolean {
    return this.entries.delete(id)
  }

  clear(type?: MemoryType): void {
    if (!type) {
      this.entries.clear()
      return
    }

    const toRemove: string[] = []
    for (const [key, entry] of this.entries) {
      if (entry.type === type) toRemove.push(key)
    }
    for (const key of toRemove) {
      this.entries.delete(key)
    }
  }

  private isExpired(entry: MemoryEntry): boolean {
    if (!entry.expiresAt) return false
    return new Date(entry.expiresAt) < new Date()
  }
}

/** Singleton memory store instances */
export const workingMemory = new InMemoryStore()
export const operationalMemory = new InMemoryStore()
export const knowledgeMemory = new InMemoryStore()
