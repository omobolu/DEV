/**
 * Audit Service
 *
 * Single write point for all security audit events.
 * Called by auth, SCIM, approval, and authorization services — never directly
 * from controllers. Events are structured, append-only, and immutable.
 */

import { v4 as uuidv4 } from 'uuid';
import { AuditEvent, AuditEventType, PermissionId } from '../security.types';
import { auditRepository, AuditFilter } from './audit.repository';

interface LogInput {
  eventType: AuditEventType;
  actorId: string;
  actorName: string;
  actorIp?: string;
  targetId?: string;
  targetType?: string;
  permissionId?: PermissionId;
  resource?: string;
  outcome: AuditEvent['outcome'];
  reason?: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  requestId?: string;
  tenantId?: string;
}

class AuditService {
  log(input: LogInput): AuditEvent {
    const event: AuditEvent = {
      eventId: uuidv4(),
      ...input,
      metadata: input.metadata ?? {},
      timestamp: new Date().toISOString(),
    };

    auditRepository.append(input.tenantId ?? 'system', event);

    // Console output for observability — Phase 2: ship to SIEM
    const icon = input.outcome === 'failure' ? '✗' : input.outcome === 'masked' ? '⊘' : '✓';
    console.log(`[Audit] ${icon} ${event.eventType} | actor=${event.actorId} | outcome=${event.outcome}${event.reason ? ` | ${event.reason}` : ''}`);

    return event;
  }

  query(tenantId: string, filter: AuditFilter): AuditEvent[] {
    return auditRepository.query(tenantId, filter);
  }

  async queryPg(tenantId: string, filter: AuditFilter): Promise<AuditEvent[]> {
    return auditRepository.queryPg(tenantId, filter);
  }

  findById(eventId: string): AuditEvent | undefined {
    return auditRepository.queryAll({ limit: 10000 }).find(e => e.eventId === eventId);
  }

  async findByIdPg(eventId: string, tenantId: string): Promise<AuditEvent | undefined> {
    return auditRepository.findByIdPg(eventId, tenantId);
  }

  count(tenantId: string): number {
    return auditRepository.count(tenantId);
  }

  async countPg(tenantId: string): Promise<number> {
    return auditRepository.countPg(tenantId);
  }

  countAll(): number {
    return auditRepository.countAll();
  }
}

export const auditService = new AuditService();
