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

  /**
   * Query audit events from PostgreSQL. Falls back to in-memory if PG unavailable.
   */
  async queryPg(tenantId: string, filter: AuditFilter = {}): Promise<AuditEvent[]> {
    try {
      const conditions: string[] = ['tenant_id = $1'];
      const params: unknown[] = [tenantId];
      let idx = 2;

      if (filter.eventType) { conditions.push(`event_type = $${idx}`); params.push(filter.eventType); idx++; }
      if (filter.actorId) { conditions.push(`actor_id = $${idx}`); params.push(filter.actorId); idx++; }
      if (filter.targetId) { conditions.push(`target_id = $${idx}`); params.push(filter.targetId); idx++; }
      if (filter.outcome) { conditions.push(`outcome = $${idx}`); params.push(filter.outcome); idx++; }
      if (filter.dateFrom) { conditions.push(`created_at >= $${idx}`); params.push(filter.dateFrom); idx++; }
      if (filter.dateTo) { conditions.push(`created_at <= $${idx}`); params.push(filter.dateTo); idx++; }

      const limit = filter.limit ?? 200;
      const offset = filter.offset ?? 0;
      const sql = `SELECT * FROM audit_logs WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      const result = await pool.query(sql, params);
      return result.rows.map((row: Record<string, unknown>) => this.rowToEvent(row));
    } catch {
      return this.query(tenantId, filter);
    }
  }

  async findByIdPg(eventId: string, tenantId: string): Promise<AuditEvent | undefined> {
    try {
      const result = await pool.query('SELECT * FROM audit_logs WHERE event_id = $1 AND tenant_id = $2', [eventId, tenantId]);
      if (result.rows.length === 0) return this.findById(tenantId, eventId);
      return this.rowToEvent(result.rows[0]);
    } catch {
      return this.findById(tenantId, eventId);
    }
  }

  async countPg(tenantId: string): Promise<number> {
    try {
      const result = await pool.query('SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1', [tenantId]);
      return parseInt(result.rows[0].count as string, 10);
    } catch {
      return this.count(tenantId);
    }
  }

  private rowToEvent(row: Record<string, unknown>): AuditEvent {
    return {
      eventId:      row.event_id as string,
      tenantId:     row.tenant_id as string | undefined,
      eventType:    row.event_type as AuditEventType,
      actorId:      row.actor_id as string,
      actorName:    row.actor_name as string,
      actorIp:      row.actor_ip as string | undefined,
      targetId:     row.target_id as string | undefined,
      targetType:   row.target_type as string | undefined,
      permissionId: row.permission_id as any,
      resource:     row.resource as string | undefined,
      outcome:      row.outcome as AuditEvent['outcome'],
      reason:       row.reason as string | undefined,
      metadata:     (row.metadata ?? {}) as Record<string, unknown>,
      sessionId:    row.session_id as string | undefined,
      requestId:    row.request_id as string | undefined,
      timestamp:    (row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at as string),
    };
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
