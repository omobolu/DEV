/**
 * IDVIZE Application Intelligence Agent
 * Interprets CMDB data, correlates with IAM platforms, identifies gaps
 */

import type { BaseAgent, AgentConfig, AgentOutput, AgentHealthStatus } from '../../types/agent'
import { createAgentOutput } from '../../types/agent'
import type { PlatformEvent } from '../../types/events'
import type {
  ApplicationRecord,
  ApplicationGap,
  ControlStatus,
  IAMControlPosture,
} from '../../types/application'

export interface AppIntelligenceResult {
  gaps: ApplicationGap[]
  riskSummary: {
    criticalGaps: number
    highGaps: number
    mediumGaps: number
    lowGaps: number
  }
  recommendations: string[]
  appsAnalyzed: number
}

const AGENT_CONFIG: AgentConfig = {
  id: 'agent-app-intelligence',
  domain: 'application-intelligence',
  name: 'Application Intelligence Agent',
  description: 'Interprets CMDB and risk platform data, correlates apps with IAM platforms, identifies onboarding gaps and missing controls',
  enabled: true,
  capabilities: [
    {
      name: 'analyze-cmdb',
      description: 'Analyze CMDB application data for IAM gaps',
      inputEventTypes: ['APPLICATION_DISCOVERED'],
      outputEventTypes: ['APPLICATION_GAP_DETECTED'],
    },
  ],
  maxRetries: 3,
  timeoutMs: 30000,
}

export class ApplicationIntelligenceAgent implements BaseAgent {
  readonly config = AGENT_CONFIG
  private processedCount = 0
  private errorCount = 0
  private lastProcessedAt?: string
  private totalProcessingTimeMs = 0

  async initialize(): Promise<void> {
    // Agent initialization — load any cached knowledge
  }

  canHandle(eventType: string): boolean {
    return this.config.capabilities.some(c =>
      c.inputEventTypes.includes(eventType)
    )
  }

  async process(event: PlatformEvent): Promise<AgentOutput<AppIntelligenceResult>> {
    const startTime = Date.now()

    try {
      const apps = event.payload.applications as ApplicationRecord[] | undefined
      if (!apps || apps.length === 0) {
        return createAgentOutput<AppIntelligenceResult>(
          this.config.id,
          this.config.domain,
          { gaps: [], riskSummary: { criticalGaps: 0, highGaps: 0, mediumGaps: 0, lowGaps: 0 }, recommendations: [], appsAnalyzed: 0 },
          { confidence: 'high', warnings: ['No applications provided for analysis'], recommendedNextStep: 'Provide CMDB data' },
        )
      }

      const allGaps: ApplicationGap[] = []
      for (const app of apps) {
        const gaps = this.analyzeApplication(app)
        allGaps.push(...gaps)
      }

      const riskSummary = {
        criticalGaps: allGaps.filter(g => g.severity === 'critical').length,
        highGaps: allGaps.filter(g => g.severity === 'high').length,
        mediumGaps: allGaps.filter(g => g.severity === 'medium').length,
        lowGaps: allGaps.filter(g => g.severity === 'low').length,
      }

      const recommendations = this.generateRecommendations(allGaps, apps.length)

      const processingTimeMs = Date.now() - startTime
      this.processedCount++
      this.lastProcessedAt = new Date().toISOString()
      this.totalProcessingTimeMs += processingTimeMs

      return createAgentOutput<AppIntelligenceResult>(
        this.config.id,
        this.config.domain,
        { gaps: allGaps, riskSummary, recommendations, appsAnalyzed: apps.length },
        {
          confidence: apps.length > 10 ? 'high' : 'medium',
          assumptions: [
            'Control status is derived from CMDB fields',
            'Gap severity is based on app criticality and control type',
          ],
          warnings: riskSummary.criticalGaps > 0
            ? [`${riskSummary.criticalGaps} critical gap(s) detected requiring immediate attention`]
            : [],
          recommendedNextStep: allGaps.length > 0
            ? 'Route gaps to Decision Agent for classification and prioritization'
            : 'No gaps detected — continue monitoring',
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

  private analyzeApplication(app: ApplicationRecord): ApplicationGap[] {
    const gaps: ApplicationGap[] = []
    const controls = app.controls
    const meta = app.metadata
    const now = new Date().toISOString()

    const severityForApp = meta.criticality === 'critical' ? 'critical' as const
      : meta.criticality === 'high' ? 'high' as const
      : 'medium' as const

    const checkControl = (
      controlName: keyof IAMControlPosture,
      gapType: ApplicationGap['gapType'],
      description: string,
      recommendation: string,
    ) => {
      const status: ControlStatus = controls[controlName]
      if (status === 'gap' || status === 'attention') {
        gaps.push({
          id: `gap-${meta.appId}-${gapType}-${Date.now()}`,
          appId: meta.appId,
          appName: meta.name,
          gapType,
          severity: status === 'gap' ? severityForApp : 'medium',
          description,
          recommendation,
          detectedAt: now,
          status: 'open',
        })
      }
    }

    checkControl('ssoIntegrated', 'missing_sso',
      `${meta.name} does not have SSO integration`,
      `Onboard ${meta.name} to SSO via SAML or OIDC`)

    checkControl('mfaEnabled', 'missing_mfa',
      `${meta.name} does not have MFA enabled`,
      `Enable MFA for ${meta.name} through conditional access policies`)

    checkControl('pamManaged', 'missing_pam',
      `${meta.name} privileged accounts are not PAM-managed`,
      `Onboard ${meta.name} to CyberArk PAC for privileged access management`)

    checkControl('provisioningAutomated', 'manual_provisioning',
      `${meta.name} uses manual provisioning`,
      `Implement automated provisioning via SCIM or API for ${meta.name}`)

    checkControl('accessReviewsCurrent', 'overdue_review',
      `${meta.name} has overdue access reviews`,
      `Schedule and complete access review campaign for ${meta.name}`)

    checkControl('orphanAccountPosture', 'orphan_accounts',
      `${meta.name} has orphan accounts detected`,
      `Remediate orphan accounts for ${meta.name} — disable or reassign`)

    checkControl('privilegedAccountPosture', 'excessive_privileged',
      `${meta.name} has excessive privileged accounts`,
      `Review and reduce privileged accounts for ${meta.name}`)

    return gaps
  }

  private generateRecommendations(gaps: ApplicationGap[], appCount: number): string[] {
    const recommendations: string[] = []
    const gapTypes = new Map<string, number>()

    for (const gap of gaps) {
      gapTypes.set(gap.gapType, (gapTypes.get(gap.gapType) ?? 0) + 1)
    }

    if (gapTypes.has('missing_sso') && (gapTypes.get('missing_sso') ?? 0) > appCount * 0.3) {
      recommendations.push('Over 30% of applications lack SSO — prioritize SSO onboarding campaign')
    }
    if (gapTypes.has('missing_mfa') && (gapTypes.get('missing_mfa') ?? 0) > appCount * 0.3) {
      recommendations.push('Over 30% of applications lack MFA — implement org-wide MFA policy')
    }
    if (gapTypes.has('orphan_accounts')) {
      recommendations.push(`${gapTypes.get('orphan_accounts')} application(s) have orphan accounts — schedule cleanup`)
    }
    if (gapTypes.has('overdue_review')) {
      recommendations.push(`${gapTypes.get('overdue_review')} application(s) have overdue access reviews`)
    }

    const criticalGaps = gaps.filter(g => g.severity === 'critical')
    if (criticalGaps.length > 0) {
      recommendations.unshift(`${criticalGaps.length} critical gap(s) require immediate remediation`)
    }

    return recommendations
  }
}
