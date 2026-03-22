/**
 * IDVIZE Ticket Intelligence Agent
 * Classifies tickets and IAM requests, suggests owners, flags for review
 */

import type { BaseAgent, AgentConfig, AgentOutput, AgentHealthStatus } from '../../types/agent'
import { createAgentOutput } from '../../types/agent'
import type { PlatformEvent } from '../../types/events'

export type TicketCategory = 'access_request' | 'incident' | 'service_request' | 'change_request' | 'problem' | 'inquiry'

export type IAMSubcategory =
  | 'new_access'
  | 'access_modification'
  | 'access_removal'
  | 'password_reset'
  | 'account_unlock'
  | 'sso_onboarding'
  | 'mfa_enrollment'
  | 'pam_request'
  | 'role_change'
  | 'access_review'
  | 'compliance_inquiry'
  | 'other'

export interface TicketClassification {
  ticketId: string
  category: TicketCategory
  subcategory: IAMSubcategory
  iamDomain: 'iga' | 'am' | 'pam' | 'ciam' | 'general'
  priority: 'critical' | 'high' | 'medium' | 'low'
  suggestedOwner: string
  suggestedAssignee: string
  flagForReview: boolean
  flagReasons: string[]
  keywords: string[]
  summary: string
}

export interface TicketIntelligenceResult {
  classifications: TicketClassification[]
  flaggedCount: number
  categoryBreakdown: Record<TicketCategory, number>
}

const AGENT_CONFIG: AgentConfig = {
  id: 'agent-ticket-intelligence',
  domain: 'ticket-intelligence',
  name: 'Ticket Intelligence Agent',
  description: 'Classifies tickets and IAM email requests, suggests owners and assignees, flags for analyst review',
  enabled: true,
  capabilities: [
    {
      name: 'classify-tickets',
      description: 'Classify incoming tickets and email requests',
      inputEventTypes: ['TICKET_RECEIVED', 'EMAIL_RECEIVED'],
      outputEventTypes: ['APPLICATION_GAP_DETECTED'],
    },
  ],
  maxRetries: 2,
  timeoutMs: 10000,
}

// Keyword-based classification heuristics
const KEYWORD_RULES: Array<{
  keywords: string[]
  category: TicketCategory
  subcategory: IAMSubcategory
  domain: 'iga' | 'am' | 'pam' | 'ciam' | 'general'
}> = [
  { keywords: ['new access', 'provision', 'onboard', 'add user'], category: 'access_request', subcategory: 'new_access', domain: 'iga' },
  { keywords: ['modify access', 'change role', 'update permissions'], category: 'change_request', subcategory: 'access_modification', domain: 'iga' },
  { keywords: ['remove access', 'deprovision', 'offboard', 'terminate'], category: 'access_request', subcategory: 'access_removal', domain: 'iga' },
  { keywords: ['password reset', 'forgot password', 'reset password'], category: 'service_request', subcategory: 'password_reset', domain: 'am' },
  { keywords: ['account locked', 'unlock account', 'locked out'], category: 'incident', subcategory: 'account_unlock', domain: 'am' },
  { keywords: ['sso', 'saml', 'oidc', 'federation', 'single sign'], category: 'change_request', subcategory: 'sso_onboarding', domain: 'am' },
  { keywords: ['mfa', 'multi-factor', 'two-factor', '2fa', 'authenticator'], category: 'service_request', subcategory: 'mfa_enrollment', domain: 'am' },
  { keywords: ['privileged', 'pam', 'vault', 'cyberark', 'admin account'], category: 'access_request', subcategory: 'pam_request', domain: 'pam' },
  { keywords: ['role change', 'transfer', 'mover', 'promotion'], category: 'change_request', subcategory: 'role_change', domain: 'iga' },
  { keywords: ['access review', 'certification', 'recertification', 'attestation'], category: 'service_request', subcategory: 'access_review', domain: 'iga' },
  { keywords: ['compliance', 'audit', 'sox', 'regulatory'], category: 'inquiry', subcategory: 'compliance_inquiry', domain: 'general' },
]

export class TicketIntelligenceAgent implements BaseAgent {
  readonly config = AGENT_CONFIG
  private processedCount = 0
  private errorCount = 0
  private lastProcessedAt?: string
  private totalProcessingTimeMs = 0

  async initialize(): Promise<void> {}

  canHandle(eventType: string): boolean {
    return this.config.capabilities.some(c => c.inputEventTypes.includes(eventType))
  }

  async process(event: PlatformEvent): Promise<AgentOutput<TicketIntelligenceResult>> {
    const startTime = Date.now()

    try {
      const tickets = event.payload.tickets as TicketInput[] | undefined
      const singleTicket = event.payload.ticket as TicketInput | undefined

      const ticketList = tickets ?? (singleTicket ? [singleTicket] : [])

      if (ticketList.length === 0) {
        return createAgentOutput<TicketIntelligenceResult>(
          this.config.id,
          this.config.domain,
          { classifications: [], flaggedCount: 0, categoryBreakdown: {} as Record<TicketCategory, number> },
          { confidence: 'high', warnings: ['No tickets provided'], recommendedNextStep: 'Provide ticket data' },
        )
      }

      const classifications = ticketList.map(t => this.classifyTicket(t))

      const flaggedCount = classifications.filter(c => c.flagForReview).length
      const categoryBreakdown = classifications.reduce((acc, c) => {
        acc[c.category] = (acc[c.category] ?? 0) + 1
        return acc
      }, {} as Record<TicketCategory, number>)

      const processingTimeMs = Date.now() - startTime
      this.processedCount++
      this.lastProcessedAt = new Date().toISOString()
      this.totalProcessingTimeMs += processingTimeMs

      return createAgentOutput<TicketIntelligenceResult>(
        this.config.id,
        this.config.domain,
        { classifications, flaggedCount, categoryBreakdown },
        {
          confidence: 'medium',
          assumptions: [
            'Classification uses keyword-based heuristics',
            'Owner suggestions are based on domain routing rules',
          ],
          warnings: flaggedCount > 0 ? [`${flaggedCount} ticket(s) flagged for analyst review`] : [],
          recommendedNextStep: flaggedCount > 0
            ? 'Route flagged tickets to analyst for manual review'
            : 'Proceed with automated classification',
          approvalRequired: false,
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
      averageProcessingTimeMs: this.processedCount > 0
        ? this.totalProcessingTimeMs / this.processedCount
        : 0,
    }
  }

  private classifyTicket(ticket: TicketInput): TicketClassification {
    const text = `${ticket.subject ?? ''} ${ticket.description ?? ''}`.toLowerCase()
    const matchedKeywords: string[] = []

    let bestMatch: { category: TicketCategory; subcategory: IAMSubcategory; domain: 'iga' | 'am' | 'pam' | 'ciam' | 'general'; score: number } = { category: 'inquiry', subcategory: 'other', domain: 'general', score: 0 }

    for (const rule of KEYWORD_RULES) {
      let score = 0
      for (const keyword of rule.keywords) {
        if (text.includes(keyword)) {
          score++
          matchedKeywords.push(keyword)
        }
      }
      if (score > bestMatch.score) {
        bestMatch = { ...rule, score }
      }
    }

    const priority = this.determinePriority(ticket, bestMatch.category)
    const suggestedOwner = this.suggestOwner(bestMatch.domain)
    const suggestedAssignee = this.suggestAssignee(bestMatch.domain, bestMatch.subcategory)

    const flagReasons: string[] = []
    if (bestMatch.score === 0) flagReasons.push('No keyword match — manual classification needed')
    if (priority === 'critical') flagReasons.push('Critical priority — requires immediate attention')
    if (text.includes('urgent') || text.includes('emergency')) flagReasons.push('Urgency keywords detected')
    if (text.includes('executive') || text.includes('vip') || text.includes('ceo') || text.includes('cfo')) {
      flagReasons.push('VIP/executive mentioned — flag for priority handling')
    }

    return {
      ticketId: ticket.id ?? `ticket-${Date.now()}`,
      category: bestMatch.category,
      subcategory: bestMatch.subcategory,
      iamDomain: bestMatch.domain,
      priority,
      suggestedOwner,
      suggestedAssignee,
      flagForReview: flagReasons.length > 0,
      flagReasons,
      keywords: [...new Set(matchedKeywords)],
      summary: `${bestMatch.category} / ${bestMatch.subcategory} — ${bestMatch.domain.toUpperCase()}`,
    }
  }

  private determinePriority(ticket: TicketInput, category: TicketCategory): 'critical' | 'high' | 'medium' | 'low' {
    if (ticket.priority) return ticket.priority
    const text = `${ticket.subject ?? ''} ${ticket.description ?? ''}`.toLowerCase()
    if (text.includes('critical') || text.includes('outage') || text.includes('breach')) return 'critical'
    if (text.includes('urgent') || text.includes('asap') || text.includes('emergency')) return 'high'
    if (category === 'incident') return 'high'
    if (category === 'access_request') return 'medium'
    return 'low'
  }

  private suggestOwner(domain: string): string {
    const ownerMap: Record<string, string> = {
      iga: 'IGA Team',
      am: 'Access Management Team',
      pam: 'PAM Team',
      ciam: 'CIAM Team',
      general: 'IAM Operations',
    }
    return ownerMap[domain] ?? 'IAM Operations'
  }

  private suggestAssignee(_domain: string, subcategory: IAMSubcategory): string {
    if (subcategory === 'sso_onboarding' || subcategory === 'pam_request') return 'IAM Engineer'
    if (subcategory === 'access_review' || subcategory === 'compliance_inquiry') return 'IAM Analyst'
    if (subcategory === 'password_reset' || subcategory === 'account_unlock') return 'Service Desk'
    return 'IAM Operations'
  }
}

interface TicketInput {
  id?: string
  subject?: string
  description?: string
  priority?: 'critical' | 'high' | 'medium' | 'low'
  source?: string
  requester?: string
}
