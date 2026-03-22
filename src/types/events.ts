/**
 * IDVIZE Platform Event Types
 * Core event model for the AI Agent Orchestration Layer
 */

export type EventType =
  | 'APPLICATION_DISCOVERED'
  | 'APPLICATION_GAP_DETECTED'
  | 'TICKET_RECEIVED'
  | 'EMAIL_RECEIVED'
  | 'MEETING_NOTES_CAPTURED'
  | 'BUILD_REQUESTED'
  | 'DOCUMENT_GENERATION_REQUESTED'
  | 'COST_INPUT_RECEIVED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'AGENT_TASK_COMPLETED'
  | 'AGENT_TASK_FAILED'
  | 'SECURITY_EVENT'
  | 'CREDENTIAL_REQUESTED'
  | 'CREDENTIAL_ROTATED'

export type EventPriority = 'critical' | 'high' | 'medium' | 'low'

export interface PlatformEvent {
  id: string
  type: EventType
  timestamp: string
  source: string
  priority: EventPriority
  payload: Record<string, unknown>
  correlationId?: string
  metadata?: Record<string, string>
}

export interface EventSubscription {
  eventType: EventType
  handlerId: string
  handler: (event: PlatformEvent) => Promise<void>
}

export function createEvent(
  type: EventType,
  source: string,
  payload: Record<string, unknown>,
  priority: EventPriority = 'medium',
  correlationId?: string,
): PlatformEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: new Date().toISOString(),
    source,
    priority,
    payload,
    correlationId,
  }
}
