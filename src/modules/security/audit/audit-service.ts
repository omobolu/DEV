/**
 * IDVIZE Audit Service
 * Centralized audit logging and query service
 */

import type { AuditEvent, AuditQuery, AuditCategory, AuditActor, AuditSeverity } from '../../../types/audit'
import { recordAudit, queryAuditLog, getAuditLog } from '../../../types/audit'

export interface AuditSummary {
  totalEvents: number
  byCategory: Record<string, number>
  bySeverity: Record<string, number>
  recentCritical: AuditEvent[]
  recentFailures: AuditEvent[]
}

export class AuditService {
  /** Record an audit event */
  record(
    category: AuditCategory,
    actor: AuditActor,
    action: string,
    resource: string,
    outcome: 'success' | 'failure' | 'denied',
    details: Record<string, unknown> = {},
    severity: AuditSeverity = 'info',
  ): AuditEvent {
    return recordAudit(category, actor, action, resource, outcome, details, severity)
  }

  /** Query audit events */
  query(query: AuditQuery): AuditEvent[] {
    return queryAuditLog(query)
  }

  /** Get audit summary */
  getSummary(): AuditSummary {
    const allEvents = getAuditLog()

    const byCategory: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}

    for (const event of allEvents) {
      byCategory[event.category] = (byCategory[event.category] ?? 0) + 1
      bySeverity[event.severity] = (bySeverity[event.severity] ?? 0) + 1
    }

    const recentCritical = allEvents
      .filter(e => e.severity === 'critical')
      .slice(-10)
      .reverse()

    const recentFailures = allEvents
      .filter(e => e.outcome === 'failure' || e.outcome === 'denied')
      .slice(-10)
      .reverse()

    return {
      totalEvents: allEvents.length,
      byCategory,
      bySeverity,
      recentCritical,
      recentFailures,
    }
  }

  /** Get events for a specific resource */
  getResourceHistory(resource: string, limit = 50): AuditEvent[] {
    return this.query({ resource, limit })
  }

  /** Get events for a specific actor */
  getActorHistory(actorId: string, limit = 50): AuditEvent[] {
    return this.query({ actorId, limit })
  }
}

/** Singleton audit service */
export const auditService = new AuditService()
