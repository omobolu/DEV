/**
 * Audit Repository
 *
 * Append-only in-memory event store. Events are never deleted.
 * Phase 2: replace with PostgreSQL, SIEM, or immutable object store.
 */

import { AuditEvent, AuditEventType } from '../security.types';

export interface AuditFilter {
  eventType?: AuditEventType;
  actorId?: string;
  targetId?: string;
  outcome?: AuditEvent['outcome'];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

class AuditRepository {
  private log = new Map<string, AuditEvent[]>();

  private bucket(tenantId: string): AuditEvent[] {
    if (!this.log.has(tenantId)) this.log.set(tenantId, []);
    return this.log.get(tenantId)!;
  }

  append(tenantId: string, event: AuditEvent): AuditEvent {
    this.bucket(tenantId).push(event);
    return event;
  }

  findById(tenantId: string, eventId: string): AuditEvent | undefined {
    return this.bucket(tenantId).find(e => e.eventId === eventId);
  }

  query(tenantId: string, filter: AuditFilter = {}): AuditEvent[] {
    let results = [...this.bucket(tenantId)];

    if (filter.eventType) results = results.filter(e => e.eventType === filter.eventType);
    if (filter.actorId) results = results.filter(e => e.actorId === filter.actorId);
    if (filter.targetId) results = results.filter(e => e.targetId === filter.targetId);
    if (filter.outcome) results = results.filter(e => e.outcome === filter.outcome);
    if (filter.dateFrom) results = results.filter(e => e.timestamp >= filter.dateFrom!);
    if (filter.dateTo) results = results.filter(e => e.timestamp <= filter.dateTo!);

    // Most recent first
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 200;
    return results.slice(offset, offset + limit);
  }

  /**
   * Query across ALL tenant buckets — for cross-tenant admin views.
   */
  queryAll(filter: AuditFilter = {}): AuditEvent[] {
    let results: AuditEvent[] = [];
    for (const events of this.log.values()) {
      results = results.concat(events);
    }

    if (filter.eventType) results = results.filter(e => e.eventType === filter.eventType);
    if (filter.actorId) results = results.filter(e => e.actorId === filter.actorId);
    if (filter.targetId) results = results.filter(e => e.targetId === filter.targetId);
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

  /**
   * Count across ALL tenant buckets — for cross-tenant admin views.
   */
  countAll(): number {
    let total = 0;
    for (const events of this.log.values()) {
      total += events.length;
    }
    return total;
  }
}

export const auditRepository = new AuditRepository();
