/**
 * IDVIZE Platform Agent Types
 * BaseAgent contract and agent output types
 */

import type { PlatformEvent } from './events'

export type AgentDomain =
  | 'application-intelligence'
  | 'decision'
  | 'ticket-intelligence'
  | 'build'
  | 'communication'
  | 'meeting'
  | 'documentation'
  | 'cost-intelligence'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface AgentOutput<T = Record<string, unknown>> {
  agentId: string
  agentDomain: AgentDomain
  timestamp: string
  result: T
  confidence: ConfidenceLevel
  assumptions: string[]
  warnings: string[]
  recommendedNextStep: string
  approvalRequired: boolean
  processingTimeMs: number
  correlationId?: string
}

export interface AgentCapability {
  name: string
  description: string
  inputEventTypes: string[]
  outputEventTypes: string[]
}

export interface AgentConfig {
  id: string
  domain: AgentDomain
  name: string
  description: string
  enabled: boolean
  capabilities: AgentCapability[]
  maxRetries: number
  timeoutMs: number
}

/**
 * BaseAgent contract — all agents must implement this interface
 */
export interface BaseAgent {
  readonly config: AgentConfig

  /** Initialize the agent */
  initialize(): Promise<void>

  /** Process an event and return a typed output */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process(event: PlatformEvent): Promise<AgentOutput<any>>

  /** Check if agent can handle a specific event type */
  canHandle(eventType: string): boolean

  /** Get the agent's current health status */
  getHealth(): AgentHealthStatus
}

export interface AgentHealthStatus {
  agentId: string
  status: 'healthy' | 'degraded' | 'offline'
  lastProcessedAt?: string
  totalProcessed: number
  totalErrors: number
  averageProcessingTimeMs: number
}

export function createAgentOutput<T>(
  agentId: string,
  domain: AgentDomain,
  result: T,
  options: {
    confidence?: ConfidenceLevel
    assumptions?: string[]
    warnings?: string[]
    recommendedNextStep?: string
    approvalRequired?: boolean
    processingTimeMs?: number
    correlationId?: string
  } = {},
): AgentOutput<T> {
  return {
    agentId,
    agentDomain: domain,
    timestamp: new Date().toISOString(),
    result,
    confidence: options.confidence ?? 'medium',
    assumptions: options.assumptions ?? [],
    warnings: options.warnings ?? [],
    recommendedNextStep: options.recommendedNextStep ?? 'Review output',
    approvalRequired: options.approvalRequired ?? false,
    processingTimeMs: options.processingTimeMs ?? 0,
    correlationId: options.correlationId,
  }
}
