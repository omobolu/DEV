/**
 * IDVIZE Decision Agent
 * Determines IAM domain, priority, remediation path, and stakeholders
 */

import type { BaseAgent, AgentConfig, AgentOutput, AgentHealthStatus } from '../../types/agent'
import { createAgentOutput } from '../../types/agent'
import type { PlatformEvent } from '../../types/events'
import type { ApplicationGap } from '../../types/application'

export type IAMDomain = 'iga' | 'am' | 'pam' | 'ciam' | 'cross_domain'

export interface DecisionResult {
  decisions: GapDecision[]
  summary: {
    igaCount: number
    amCount: number
    pamCount: number
    ciamCount: number
    crossDomainCount: number
  }
}

export interface GapDecision {
  gapId: string
  appId: string
  appName: string
  assignedDomain: IAMDomain
  priority: 'critical' | 'high' | 'medium' | 'low'
  remediationPath: string
  estimatedEffortDays: number
  stakeholders: StakeholderAssignment[]
  rationale: string
}

export interface StakeholderAssignment {
  role: string
  responsibility: string
  required: boolean
}

const AGENT_CONFIG: AgentConfig = {
  id: 'agent-decision',
  domain: 'decision',
  name: 'Decision Agent',
  description: 'Determines IAM domain ownership, priority, remediation path, and stakeholders for detected gaps',
  enabled: true,
  capabilities: [
    {
      name: 'classify-gaps',
      description: 'Classify gaps by IAM domain and determine remediation',
      inputEventTypes: ['APPLICATION_GAP_DETECTED', 'AGENT_TASK_COMPLETED'],
      outputEventTypes: ['BUILD_REQUESTED'],
    },
  ],
  maxRetries: 3,
  timeoutMs: 15000,
}

export class DecisionAgent implements BaseAgent {
  readonly config = AGENT_CONFIG
  private processedCount = 0
  private errorCount = 0
  private lastProcessedAt?: string
  private totalProcessingTimeMs = 0

  async initialize(): Promise<void> {}

  canHandle(eventType: string): boolean {
    return this.config.capabilities.some(c => c.inputEventTypes.includes(eventType))
  }

  async process(event: PlatformEvent): Promise<AgentOutput<DecisionResult>> {
    const startTime = Date.now()

    try {
      const gaps = event.payload.gaps as ApplicationGap[] | undefined
      if (!gaps || gaps.length === 0) {
        return createAgentOutput<DecisionResult>(
          this.config.id,
          this.config.domain,
          { decisions: [], summary: { igaCount: 0, amCount: 0, pamCount: 0, ciamCount: 0, crossDomainCount: 0 } },
          { confidence: 'high', warnings: ['No gaps provided'], recommendedNextStep: 'Provide gaps for classification' },
        )
      }

      const decisions = gaps.map(gap => this.classifyGap(gap))

      const summary = {
        igaCount: decisions.filter(d => d.assignedDomain === 'iga').length,
        amCount: decisions.filter(d => d.assignedDomain === 'am').length,
        pamCount: decisions.filter(d => d.assignedDomain === 'pam').length,
        ciamCount: decisions.filter(d => d.assignedDomain === 'ciam').length,
        crossDomainCount: decisions.filter(d => d.assignedDomain === 'cross_domain').length,
      }

      const processingTimeMs = Date.now() - startTime
      this.processedCount++
      this.lastProcessedAt = new Date().toISOString()
      this.totalProcessingTimeMs += processingTimeMs

      return createAgentOutput<DecisionResult>(
        this.config.id,
        this.config.domain,
        { decisions, summary },
        {
          confidence: 'high',
          assumptions: [
            'Domain classification based on gap type heuristics',
            'Priority inherited from gap severity',
            'Effort estimates are approximate',
          ],
          recommendedNextStep: 'Route classified gaps to Build Agent for implementation planning',
          approvalRequired: decisions.some(d => d.priority === 'critical'),
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

  private classifyGap(gap: ApplicationGap): GapDecision {
    const domain = this.determineDomain(gap.gapType)
    const stakeholders = this.determineStakeholders(gap, domain)
    const effortDays = this.estimateEffort(gap.gapType)
    const remediationPath = this.determineRemediationPath(gap, domain)

    return {
      gapId: gap.id,
      appId: gap.appId,
      appName: gap.appName,
      assignedDomain: domain,
      priority: gap.severity,
      remediationPath,
      estimatedEffortDays: effortDays,
      stakeholders,
      rationale: `Gap type "${gap.gapType}" classified under ${domain.toUpperCase()} domain based on control type`,
    }
  }

  private determineDomain(gapType: ApplicationGap['gapType']): IAMDomain {
    const domainMap: Record<string, IAMDomain> = {
      missing_sso: 'am',
      missing_mfa: 'am',
      missing_pam: 'pam',
      manual_provisioning: 'iga',
      overdue_review: 'iga',
      orphan_accounts: 'iga',
      excessive_privileged: 'pam',
    }
    return domainMap[gapType] ?? 'cross_domain'
  }

  private determineStakeholders(gap: ApplicationGap, domain: IAMDomain): StakeholderAssignment[] {
    const stakeholders: StakeholderAssignment[] = [
      { role: 'IAM Engineer', responsibility: 'Technical implementation', required: true },
    ]

    if (gap.severity === 'critical' || gap.severity === 'high') {
      stakeholders.push({ role: 'IAM Architect', responsibility: 'Architecture review and approval', required: true })
      stakeholders.push({ role: 'Application Owner', responsibility: 'Testing and sign-off', required: true })
    }

    if (domain === 'pam') {
      stakeholders.push({ role: 'Security Team', responsibility: 'PAM policy validation', required: true })
    }

    if (domain === 'iga') {
      stakeholders.push({ role: 'Business Analyst', responsibility: 'Access review coordination', required: false })
    }

    return stakeholders
  }

  private estimateEffort(gapType: ApplicationGap['gapType']): number {
    const effortMap: Record<string, number> = {
      missing_sso: 5,
      missing_mfa: 2,
      missing_pam: 8,
      manual_provisioning: 10,
      overdue_review: 3,
      orphan_accounts: 2,
      excessive_privileged: 5,
    }
    return effortMap[gapType] ?? 5
  }

  private determineRemediationPath(gap: ApplicationGap, domain: IAMDomain): string {
    const paths: Record<string, string> = {
      missing_sso: 'Onboard application to SSO via SAML/OIDC federation',
      missing_mfa: 'Enable MFA through conditional access policy or app configuration',
      missing_pam: 'Onboard privileged accounts to CyberArk PAC',
      manual_provisioning: 'Implement SCIM/API-based automated provisioning via SailPoint IIQ',
      overdue_review: 'Schedule and execute access review campaign',
      orphan_accounts: 'Identify, disable, and clean up orphan accounts',
      excessive_privileged: 'Review privileged access, implement least-privilege model',
    }
    return paths[gap.gapType] ?? `Remediate ${gap.gapType} in ${domain.toUpperCase()} domain`
  }
}
