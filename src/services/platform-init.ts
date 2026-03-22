/**
 * IDVIZE Platform Initialization Service
 * Registers all agents, sets up event subscriptions, initializes flows
 */

import { agentOrchestrator } from '../orchestration/agent-orchestrator'
import { eventBus } from '../orchestration/event-bus'
import { ApplicationIntelligenceAgent } from '../agents/application-intelligence'
import { DecisionAgent } from '../agents/decision'
import { TicketIntelligenceAgent } from '../agents/ticket-intelligence'
import { BuildAgent } from '../agents/build'
import { CommunicationAgent } from '../agents/communication'
import { MeetingAgent } from '../agents/meeting'
import { DocumentationAgent } from '../agents/documentation'
import { CostIntelligenceAgent } from '../agents/cost-intelligence'
import type { FlowDefinition } from '../orchestration/agent-orchestrator'

let initialized = false

/**
 * Initialize all platform agents and register them with the orchestrator
 */
export async function initializePlatform(): Promise<void> {
  if (initialized) return

  // Create agent instances
  const agents = [
    new ApplicationIntelligenceAgent(),
    new DecisionAgent(),
    new TicketIntelligenceAgent(),
    new BuildAgent(),
    new CommunicationAgent(),
    new MeetingAgent(),
    new DocumentationAgent(),
    new CostIntelligenceAgent(),
  ]

  // Initialize and register each agent
  for (const agent of agents) {
    await agent.initialize()
    agentOrchestrator.registerAgent(agent)
  }

  // Register default flows
  registerDefaultFlows()

  initialized = true
  console.log('[IDVIZE] Platform initialized with', agents.length, 'agents')
}

/**
 * Register default orchestration flows
 */
function registerDefaultFlows(): void {
  // Flow 1: Application Discovery → Gap Detection → Decision → Build Planning
  const appDiscoveryFlow: FlowDefinition = {
    id: 'flow-app-discovery',
    name: 'Application Discovery and Gap Remediation',
    triggerEventType: 'APPLICATION_DISCOVERED',
    steps: [
      {
        agentDomain: 'application-intelligence',
        onSuccess: 'decision',
      },
      {
        agentDomain: 'decision',
        onSuccess: 'build',
        requiresApproval: true,
      },
      {
        agentDomain: 'build',
        onSuccess: 'communication',
      },
    ],
  }

  // Flow 2: Ticket Received → Classification → Decision
  const ticketFlow: FlowDefinition = {
    id: 'flow-ticket-processing',
    name: 'Ticket Processing and Classification',
    triggerEventType: 'TICKET_RECEIVED',
    steps: [
      {
        agentDomain: 'ticket-intelligence',
        onSuccess: 'decision',
      },
      {
        agentDomain: 'decision',
      },
    ],
  }

  // Flow 3: Build Requested → Build Guidance → Communication → Meeting
  const buildFlow: FlowDefinition = {
    id: 'flow-build-execution',
    name: 'Build Execution Workflow',
    triggerEventType: 'BUILD_REQUESTED',
    steps: [
      {
        agentDomain: 'build',
        onSuccess: 'communication',
      },
      {
        agentDomain: 'communication',
        onSuccess: 'meeting',
      },
      {
        agentDomain: 'meeting',
      },
    ],
  }

  // Flow 4: Document Generation → Documentation Agent
  const docFlow: FlowDefinition = {
    id: 'flow-doc-generation',
    name: 'Documentation Generation',
    triggerEventType: 'DOCUMENT_GENERATION_REQUESTED',
    steps: [
      {
        agentDomain: 'documentation',
      },
    ],
  }

  // Flow 5: Cost Input → Cost Intelligence Agent
  const costFlow: FlowDefinition = {
    id: 'flow-cost-analysis',
    name: 'Cost Analysis',
    triggerEventType: 'COST_INPUT_RECEIVED',
    steps: [
      {
        agentDomain: 'cost-intelligence',
      },
    ],
  }

  agentOrchestrator.registerFlow(appDiscoveryFlow)
  agentOrchestrator.registerFlow(ticketFlow)
  agentOrchestrator.registerFlow(buildFlow)
  agentOrchestrator.registerFlow(docFlow)
  agentOrchestrator.registerFlow(costFlow)
}

/**
 * Get platform status
 */
export function getPlatformStatus() {
  const agents = agentOrchestrator.getAgentHealthStatuses()
  const flows = agentOrchestrator.getFlows()
  const eventTypes = eventBus.getSubscribedEventTypes()

  return {
    initialized,
    agentCount: agents.length,
    agents,
    flowCount: flows.length,
    flows: flows.map(f => ({ id: f.id, name: f.name, trigger: f.triggerEventType, steps: f.steps.length })),
    subscribedEventTypes: eventTypes,
    activeFlows: agentOrchestrator.getActiveFlowCount(),
  }
}
