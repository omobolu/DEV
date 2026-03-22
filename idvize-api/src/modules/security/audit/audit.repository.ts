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
  private log: AuditEvent[] = [];

  append(event: AuditEvent): AuditEvent {
    this.log.push(event);
    return event;
  }

  findById(eventId: string): AuditEvent | undefined {
    return this.log.find(e => e.eventId === eventId);
  }

  query(filter: AuditFilter = {}): AuditEvent[] {
    let results = [...this.log];

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

  count(): number {
    return this.log.length;
  }
}

export const auditRepository = new AuditRepository();
