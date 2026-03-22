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
  private log: VaultAccessEvent[] = [];

  append(event: VaultAccessEvent): VaultAccessEvent {
    this.log.push(event);
    return event;
  }

  findById(eventId: string): VaultAccessEvent | undefined {
    return this.log.find(e => e.eventId === eventId);
  }

  query(filter: VaultEventFilter = {}): VaultAccessEvent[] {
    let results = [...this.log];

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

  count(): number {
    return this.log.length;
  }
}

export const vaultAccessEventRepository = new VaultAccessEventRepository();
