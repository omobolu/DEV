/**
 * IDVIZE Platform Audit Types
 * Every action, decision, and change is auditable
 */

export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'role_change'
  | 'permission_change'
  | 'scim_event'
  | 'approval'
  | 'secret_access'
  | 'agent_decision'
  | 'agent_recommendation'
  | 'human_override'
  | 'publication'
  | 'build_execution'
  | 'data_access'
  | 'configuration_change'

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface AuditEvent {
  id: string
  timestamp: string
  category: AuditCategory
  severity: AuditSeverity
  actor: AuditActor
  action: string
  resource: string
  resourceId?: string
  outcome: 'success' | 'failure' | 'denied'
  details: Record<string, unknown>
  metadata?: Record<string, string>
  correlationId?: string
}

export interface AuditActor {
  type: 'user' | 'agent' | 'system' | 'scim'
  id: string
  name: string
  roles?: string[]
}

export interface AuditQuery {
  category?: AuditCategory
  severity?: AuditSeverity
  actorId?: string
  resource?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

/** In-memory audit store for v1 */
const auditLog: AuditEvent[] = []

export function recordAudit(
  category: AuditCategory,
  actor: AuditActor,
  action: string,
  resource: string,
  outcome: 'success' | 'failure' | 'denied',
  details: Record<string, unknown> = {},
  severity: AuditSeverity = 'info',
): AuditEvent {
  const event: AuditEvent = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    category,
    severity,
    actor,
    action,
    resource,
    outcome,
    details,
  }
  auditLog.push(event)
  return event
}

export function queryAuditLog(query: AuditQuery): AuditEvent[] {
  let results = [...auditLog]

  if (query.category) results = results.filter(e => e.category === query.category)
  if (query.severity) results = results.filter(e => e.severity === query.severity)
  if (query.actorId) results = results.filter(e => e.actor.id === query.actorId)
  if (query.resource) results = results.filter(e => e.resource === query.resource)
  if (query.startDate) results = results.filter(e => e.timestamp >= query.startDate!)
  if (query.endDate) results = results.filter(e => e.timestamp <= query.endDate!)

  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const offset = query.offset ?? 0
  const limit = query.limit ?? 100
  return results.slice(offset, offset + limit)
}

export function getAuditLog(): readonly AuditEvent[] {
  return auditLog
}
