/**
 * Vault Access Event Repository
 *
 * Dedicated append-only store for vault-specific access events.
 * Separate from the general audit log to enable vault-specific reporting
 * and compliance queries (e.g. "all secret retrievals in the last 30 days").
 *
 * CRITICAL: no raw secret values are ever stored in these events.
 * Phase 2: replace with PostgreSQL or SIEM-specific sink.
 */

import { VaultAccessEvent, VaultAccessEventType } from './vault.types';

export interface VaultEventFilter {
  credentialId?: string;
  actorId?: string;
  eventType?: VaultAccessEventType;
  outcome?: VaultAccessEvent['outcome'];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

class VaultAccessEventRepository {
  private log = new Map<string, VaultAccessEvent[]>();

  private bucket(tenantId: string): VaultAccessEvent[] {
    if (!this.log.has(tenantId)) this.log.set(tenantId, []);
    return this.log.get(tenantId)!;
  }

  append(tenantId: string, event: VaultAccessEvent): VaultAccessEvent {
    this.bucket(tenantId).push(event);
    return event;
  }

  findById(tenantId: string, eventId: string): VaultAccessEvent | undefined {
    return this.bucket(tenantId).find(e => e.eventId === eventId);
  }

  query(tenantId: string, filter: VaultEventFilter = {}): VaultAccessEvent[] {
    let results = [...this.bucket(tenantId)];

    if (filter.credentialId) results = results.filter(e => e.credentialId === filter.credentialId);
    if (filter.actorId) results = results.filter(e => e.actorId === filter.actorId);
    if (filter.eventType) results = results.filter(e => e.eventType === filter.eventType);
    if (filter.outcome) results = results.filter(e => e.outcome === filter.outcome);
    if (filter.dateFrom) results = results.filter(e => e.timestamp >= filter.dateFrom!);
    if (filter.dateTo) results = results.filter(e => e.timestamp <= filter.dateTo!);

    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 200;
    return results.slice(offset, offset + limit);
  }

  count(tenantId: string): number {
    return this.bucket(tenantId).length;
  }
}

export const vaultAccessEventRepository = new VaultAccessEventRepository();
