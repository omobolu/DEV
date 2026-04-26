/**
 * Audit Repository — PostgreSQL-backed
 *
 * Append-only event store. Events are written to PostgreSQL and cached in memory
 * for fast query access. Never deleted.
 */

import { AuditEvent, AuditEventType } from '../security.types';
import pool from '../../../db/pool';

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
    // In-memory append
    this.bucket(tenantId).push(event);

    // PostgreSQL append (fire-and-forget)
    pool.query(
      `INSERT INTO audit_logs (event_id, tenant_id, event_type, actor_id, actor_name, actor_ip, target_id, target_type, permission_id, resource, outcome, reason, metadata, session_id, request_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [event.eventId, event.tenantId, event.eventType, event.actorId, event.actorName, event.actorIp, event.targetId, event.targetType, event.permissionId, event.resource, event.outcome, event.reason, JSON.stringify(event.metadata), event.sessionId, event.requestId, event.timestamp]
    ).catch((err) => {
      console.error('[Audit] PostgreSQL write failed:', err.message);
    });

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

    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 200;
    return results.slice(offset, offset + limit);
  }

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

  countAll(): number {
    let total = 0;
    for (const events of this.log.values()) {
      total += events.length;
    }
    return total;
  }
}

export const auditRepository = new AuditRepository();
