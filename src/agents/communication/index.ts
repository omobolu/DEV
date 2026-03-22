/**
 * IDVIZE Communication Agent
 * Drafts emails, parses responses, extracts metadata, recommends follow-ups
 */

import type { BaseAgent, AgentConfig, AgentOutput, AgentHealthStatus } from '../../types/agent'
import { createAgentOutput } from '../../types/agent'
import type { PlatformEvent } from '../../types/events'

export interface CommunicationResult {
  action: 'draft_email' | 'parse_response' | 'recommend_followup'
  emailDraft?: EmailDraft
  parsedMetadata?: ParsedEmailMetadata
  followUpRecommendations?: FollowUpRecommendation[]
}

export interface EmailDraft {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  templateUsed?: string
  attachments?: string[]
}

export interface ParsedEmailMetadata {
  sender: string
  technicalDetails: Record<string, string>
  actionItems: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
  requiresResponse: boolean
}

export interface FollowUpRecommendation {
  action: string
  priority: 'high' | 'medium' | 'low'
  suggestedDate: string
  recipient: string
  reason: string
}

const AGENT_CONFIG: AgentConfig = {
  id: 'agent-communication',
  domain: 'communication',
  name: 'Communication Agent',
  description: 'Drafts and sends emails, parses inbound responses, extracts technical metadata, recommends follow-ups',
  enabled: true,
  capabilities: [
    {
      name: 'draft-email',
      description: 'Draft stakeholder communication emails',
      inputEventTypes: ['EMAIL_RECEIVED', 'AGENT_TASK_COMPLETED'],
      outputEventTypes: ['AGENT_TASK_COMPLETED'],
    },
  ],
  maxRetries: 2,
  timeoutMs: 10000,
}

export class CommunicationAgent implements BaseAgent {
  readonly config = AGENT_CONFIG
  private processedCount = 0
  private errorCount = 0
  private lastProcessedAt?: string
  private totalProcessingTimeMs = 0

  async initialize(): Promise<void> {}

  canHandle(eventType: string): boolean {
    return this.config.capabilities.some(c => c.inputEventTypes.includes(eventType))
  }

  async process(event: PlatformEvent): Promise<AgentOutput<CommunicationResult>> {
    const startTime = Date.now()

    try {
      const action = event.payload.action as string ?? 'draft_email'
      let result: CommunicationResult

      if (action === 'parse_response') {
        result = this.parseInboundEmail(event)
      } else if (action === 'recommend_followup') {
        result = this.recommendFollowUps(event)
      } else {
        result = this.draftEmail(event)
      }

      const processingTimeMs = Date.now() - startTime
      this.processedCount++
      this.lastProcessedAt = new Date().toISOString()
      this.totalProcessingTimeMs += processingTimeMs

      return createAgentOutput<CommunicationResult>(
        this.config.id,
        this.config.domain,
        result,
        {
          confidence: 'medium',
          assumptions: ['Email templates are generic — customize before sending'],
          recommendedNextStep: result.action === 'draft_email'
            ? 'Review and send the drafted email'
            : 'Process extracted metadata and action items',
          approvalRequired: result.action === 'draft_email',
          processingTimeMs,
          correlationId: event.correlationId,
        },
      )
    } catch (error) {
      this.errorCount++
      throw error
    }
  }

  getHealth(): AgentHealthStatus {
    return {
      agentId: this.config.id,
      status: this.errorCount > this.processedCount * 0.5 ? 'degraded' : 'healthy',
      lastProcessedAt: this.lastProcessedAt,
      totalProcessed: this.processedCount,
      totalErrors: this.errorCount,
      averageProcessingTimeMs: this.processedCount > 0 ? this.totalProcessingTimeMs / this.processedCount : 0,
    }
  }

  private draftEmail(event: PlatformEvent): CommunicationResult {
    const appName = event.payload.appName as string ?? 'Application'
    const gapType = event.payload.gapType as string ?? 'IAM gap'
    const recipient = event.payload.recipient as string ?? 'stakeholder@company.com'
    const stakeholderName = event.payload.stakeholderName as string ?? 'Application Owner'

    return {
      action: 'draft_email',
      emailDraft: {
        to: [recipient],
        subject: `[IDVIZE] IAM Integration Request — ${appName}`,
        body: `Dear ${stakeholderName},\n\nOur IAM governance platform has identified that ${appName} requires attention regarding ${gapType.replace(/_/g, ' ')}.\n\nWe would like to schedule a brief technical discovery session to discuss the integration requirements and timeline.\n\nPlease let us know your availability for a 30-minute meeting in the next two weeks.\n\nBest regards,\nIDVIZE Platform`,
        templateUsed: 'stakeholder-outreach-v1',
      },
    }
  }

  private parseInboundEmail(event: PlatformEvent): CommunicationResult {
    const body = event.payload.emailBody as string ?? ''
    const sender = event.payload.sender as string ?? 'unknown'

    const technicalDetails: Record<string, string> = {}
    if (body.toLowerCase().includes('saml')) technicalDetails['protocol'] = 'SAML'
    if (body.toLowerCase().includes('oidc')) technicalDetails['protocol'] = 'OIDC'
    if (body.toLowerCase().includes('scim')) technicalDetails['provisioning'] = 'SCIM'

    const actionItems: string[] = []
    if (body.toLowerCase().includes('meeting') || body.toLowerCase().includes('schedule')) {
      actionItems.push('Schedule meeting with stakeholder')
    }
    if (body.toLowerCase().includes('document') || body.toLowerCase().includes('send')) {
      actionItems.push('Prepare and send requested documentation')
    }

    return {
      action: 'parse_response',
      parsedMetadata: {
        sender,
        technicalDetails,
        actionItems,
        sentiment: body.toLowerCase().includes('no') || body.toLowerCase().includes('cannot') ? 'negative' : 'neutral',
        requiresResponse: actionItems.length > 0,
      },
    }
  }

  private recommendFollowUps(event: PlatformEvent): CommunicationResult {
    const appName = event.payload.appName as string ?? 'Application'
    const daysSinceLastContact = event.payload.daysSinceLastContact as number ?? 7

    const recommendations: FollowUpRecommendation[] = []

    if (daysSinceLastContact >= 7) {
      recommendations.push({
        action: 'Send follow-up email',
        priority: daysSinceLastContact >= 14 ? 'high' : 'medium',
        suggestedDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        recipient: event.payload.recipient as string ?? 'stakeholder',
        reason: `No response received for ${appName} in ${daysSinceLastContact} days`,
      })
    }

    return {
      action: 'recommend_followup',
      followUpRecommendations: recommendations,
    }
  }
}
