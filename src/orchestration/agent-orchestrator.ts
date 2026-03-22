/**
 * IDVIZE Platform Agent Orchestrator
 * Central coordination service for AI agents
 * Supports sequential, conditional, event-driven flows with approval checkpoints
 */

import type { BaseAgent, AgentOutput, AgentHealthStatus } from '../types/agent'
import type { PlatformEvent, EventType } from '../types/events'
import { createEvent } from '../types/events'
import { recordAudit } from '../types/audit'
import { eventBus } from './event-bus'
import { guardrailEvaluator } from '../guardrails/guardrail-evaluator'
import type { ProposedAction } from '../types/guardrails'

export interface OrchestratorConfig {
  maxRetries: number
  retryDelayMs: number
  enableGuardrails: boolean
  enableAuditLogging: boolean
}

export interface FlowStep {
  agentDomain: string
  condition?: (context: FlowContext) => boolean
  onSuccess?: string // next agent domain
  onFailure?: string // fallback agent domain
  requiresApproval?: boolean
}

export interface FlowDefinition {
  id: string
  name: string
  triggerEventType: EventType
  steps: FlowStep[]
}

export interface FlowContext {
  flowId: string
  correlationId: string
  event: PlatformEvent
  results: Map<string, AgentOutput>
  metadata: Record<string, unknown>
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  enableGuardrails: true,
  enableAuditLogging: true,
}

export class AgentOrchestrator {
  private agents: Map<string, BaseAgent> = new Map()
  private flows: Map<string, FlowDefinition> = new Map()
  private config: OrchestratorConfig
  private activeFlows: Map<string, FlowContext> = new Map()

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Register an agent with the orchestrator */
  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.config.domain, agent)

    // Subscribe agent to its declared event types
    for (const capability of agent.config.capabilities) {
      for (const eventType of capability.inputEventTypes) {
        eventBus.subscribe(
          eventType as EventType,
          `agent:${agent.config.id}`,
          async (event) => { await this.routeEventToAgent(agent, event) },
        )
      }
    }

    if (this.config.enableAuditLogging) {
      recordAudit(
        'configuration_change',
        { type: 'system', id: 'orchestrator', name: 'AgentOrchestrator' },
        'agent_registered',
        agent.config.domain,
        'success',
        { agentId: agent.config.id, agentName: agent.config.name },
      )
    }
  }

  /** Unregister an agent */
  unregisterAgent(domain: string): void {
    const agent = this.agents.get(domain)
    if (agent) {
      eventBus.unsubscribe(`agent:${agent.config.id}`)
      this.agents.delete(domain)
    }
  }

  /** Register a flow definition */
  registerFlow(flow: FlowDefinition): void {
    this.flows.set(flow.id, flow)

    // Subscribe orchestrator to the trigger event
    eventBus.subscribe(
      flow.triggerEventType,
      `flow:${flow.id}`,
      async (event) => { await this.executeFlow(flow, event) },
    )
  }

  /** Route an event directly to an agent */
  private async routeEventToAgent(agent: BaseAgent, event: PlatformEvent): Promise<AgentOutput | null> {
    if (!agent.canHandle(event.type)) return null

    let lastError: Error | null = null
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const startTime = Date.now()
        const output = await agent.process(event)

        if (this.config.enableGuardrails && output.approvalRequired) {
          const action: ProposedAction = {
            agentId: agent.config.id,
            agentDomain: agent.config.domain,
            actionType: event.type,
            description: output.recommendedNextStep,
            targetResource: 'event',
            targetResourceId: event.id,
            riskLevel: output.confidence === 'low' ? 'high' : output.confidence === 'medium' ? 'medium' : 'low',
            parameters: output.result as Record<string, unknown>,
          }
          guardrailEvaluator.evaluate(action)
        }

        if (this.config.enableAuditLogging) {
          recordAudit(
            'agent_decision',
            { type: 'agent', id: agent.config.id, name: agent.config.name },
            'event_processed',
            event.type,
            'success',
            {
              eventId: event.id,
              confidence: output.confidence,
              approvalRequired: output.approvalRequired,
              processingTimeMs: Date.now() - startTime,
            },
          )
        }

        return output
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs * (attempt + 1))
        }
      }
    }

    if (this.config.enableAuditLogging) {
      recordAudit(
        'agent_decision',
        { type: 'agent', id: agent.config.id, name: agent.config.name },
        'event_processing_failed',
        event.type,
        'failure',
        { eventId: event.id, error: lastError?.message ?? 'Unknown' },
        'error',
      )
    }

    return null
  }

  /** Execute a multi-step flow */
  private async executeFlow(flow: FlowDefinition, event: PlatformEvent): Promise<void> {
    const context: FlowContext = {
      flowId: flow.id,
      correlationId: event.correlationId ?? event.id,
      event,
      results: new Map(),
      metadata: {},
    }

    this.activeFlows.set(context.correlationId, context)

    try {
      for (const step of flow.steps) {
        // Check condition
        if (step.condition && !step.condition(context)) {
          continue
        }

        // Check approval requirement
        if (step.requiresApproval) {
          await eventBus.publish(createEvent(
            'APPROVAL_GRANTED', // placeholder — in real system, would pause and wait
            'orchestrator',
            { flowId: flow.id, step: step.agentDomain, correlationId: context.correlationId },
            'high',
            context.correlationId,
          ))
        }

        const agent = this.agents.get(step.agentDomain)
        if (!agent) {
          console.warn(`[Orchestrator] Agent not found for domain: ${step.agentDomain}`)
          continue
        }

        const output = await this.routeEventToAgent(agent, event)
        if (output) {
          context.results.set(step.agentDomain, output)

          // Route to next step based on success/failure
          if (step.onSuccess) {
            const nextAgent = this.agents.get(step.onSuccess)
            if (nextAgent) {
              const nextEvent = createEvent(
                'AGENT_TASK_COMPLETED',
                step.agentDomain,
                { previousOutput: output, originalEvent: event },
                event.priority,
                context.correlationId,
              )
              await this.routeEventToAgent(nextAgent, nextEvent)
            }
          }
        } else if (step.onFailure) {
          const fallbackAgent = this.agents.get(step.onFailure)
          if (fallbackAgent) {
            await this.routeEventToAgent(fallbackAgent, event)
          }
        }
      }
    } finally {
      this.activeFlows.delete(context.correlationId)
    }
  }

  /** Get all registered agents */
  getAgents(): Map<string, BaseAgent> {
    return new Map(this.agents)
  }

  /** Get agent health statuses */
  getAgentHealthStatuses(): AgentHealthStatus[] {
    return Array.from(this.agents.values()).map(a => a.getHealth())
  }

  /** Get active flow count */
  getActiveFlowCount(): number {
    return this.activeFlows.size
  }

  /** Get registered flow definitions */
  getFlows(): FlowDefinition[] {
    return Array.from(this.flows.values())
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/** Singleton orchestrator instance */
export const agentOrchestrator = new AgentOrchestrator()
