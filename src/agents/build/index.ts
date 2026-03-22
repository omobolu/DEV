/**
 * IDVIZE Build Agent
 * Converts gaps into implementation-ready guidance
 */

import type { BaseAgent, AgentConfig, AgentOutput, AgentHealthStatus } from '../../types/agent'
import { createAgentOutput } from '../../types/agent'
import type { PlatformEvent } from '../../types/events'
import type { BuildCase, BuildMode, IntegrationType } from '../../types/build-execution'

export interface BuildGuidanceResult {
  buildCase: Partial<BuildCase>
  integrationRequirements: IntegrationRequirement[]
  technicalGuidance: string[]
  buildPackageOutline: BuildPackageSection[]
}

export interface IntegrationRequirement {
  type: IntegrationType
  description: string
  prerequisites: string[]
  estimatedEffortHours: number
}

export interface BuildPackageSection {
  title: string
  content: string
  order: number
}

const AGENT_CONFIG: AgentConfig = {
  id: 'agent-build',
  domain: 'build',
  name: 'Build Agent',
  description: 'Converts IAM gaps into implementation-ready guidance, extracts integration needs, generates build packages',
  enabled: true,
  capabilities: [
    {
      name: 'generate-build-guidance',
      description: 'Generate implementation guidance from gap analysis',
      inputEventTypes: ['BUILD_REQUESTED', 'AGENT_TASK_COMPLETED'],
      outputEventTypes: ['AGENT_TASK_COMPLETED'],
    },
  ],
  maxRetries: 2,
  timeoutMs: 20000,
}

export class BuildAgent implements BaseAgent {
  readonly config = AGENT_CONFIG
  private processedCount = 0
  private errorCount = 0
  private lastProcessedAt?: string
  private totalProcessingTimeMs = 0

  async initialize(): Promise<void> {}

  canHandle(eventType: string): boolean {
    return this.config.capabilities.some(c => c.inputEventTypes.includes(eventType))
  }

  async process(event: PlatformEvent): Promise<AgentOutput<BuildGuidanceResult>> {
    const startTime = Date.now()

    try {
      const gapType = event.payload.gapType as string ?? 'missing_sso'
      const appName = event.payload.appName as string ?? 'Unknown Application'
      const mode = event.payload.mode as BuildMode ?? 'advisory'

      const integrationRequirements = this.determineIntegrationRequirements(gapType)
      const technicalGuidance = this.generateTechnicalGuidance(gapType, appName, mode)
      const buildPackageOutline = this.generateBuildPackage(gapType, appName)

      const buildCase: Partial<BuildCase> = {
        appName,
        title: `${this.getGapLabel(gapType)} — ${appName}`,
        description: `Remediate ${gapType.replace(/_/g, ' ')} for ${appName}`,
        status: 'CLASSIFIED',
        mode,
        integrationType: this.getIntegrationType(gapType),
        timeline: [{
          timestamp: new Date().toISOString(),
          status: 'CLASSIFIED',
          actor: this.config.name,
          notes: 'Build guidance generated',
        }],
        artifacts: [],
      }

      const processingTimeMs = Date.now() - startTime
      this.processedCount++
      this.lastProcessedAt = new Date().toISOString()
      this.totalProcessingTimeMs += processingTimeMs

      return createAgentOutput<BuildGuidanceResult>(
        this.config.id,
        this.config.domain,
        { buildCase, integrationRequirements, technicalGuidance, buildPackageOutline },
        {
          confidence: 'medium',
          assumptions: [
            'Integration type determined by gap type heuristics',
            'Effort estimates are approximate',
            `Build mode: ${mode}`,
          ],
          warnings: mode === 'automated'
            ? ['Automated mode not yet fully supported — falling back to guided']
            : [],
          recommendedNextStep: 'Initiate stakeholder outreach and schedule technical discovery',
          approvalRequired: mode === 'automated',
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

  private getGapLabel(gapType: string): string {
    const labels: Record<string, string> = {
      missing_sso: 'SSO Onboarding',
      missing_mfa: 'MFA Enablement',
      missing_pam: 'PAM Onboarding',
      manual_provisioning: 'Provisioning Automation',
      overdue_review: 'Access Review',
      orphan_accounts: 'Orphan Account Cleanup',
      excessive_privileged: 'Privileged Access Review',
    }
    return labels[gapType] ?? 'IAM Remediation'
  }

  private getIntegrationType(gapType: string): IntegrationType {
    const map: Record<string, IntegrationType> = {
      missing_sso: 'saml',
      missing_mfa: 'oidc',
      missing_pam: 'rest_api',
      manual_provisioning: 'scim',
    }
    return map[gapType] ?? 'rest_api'
  }

  private determineIntegrationRequirements(gapType: string): IntegrationRequirement[] {
    const requirements: IntegrationRequirement[] = []

    if (gapType === 'missing_sso') {
      requirements.push({
        type: 'saml',
        description: 'SAML 2.0 federation with identity provider',
        prerequisites: ['Application supports SAML', 'IdP metadata available', 'ACS URL configured'],
        estimatedEffortHours: 16,
      })
      requirements.push({
        type: 'oidc',
        description: 'Alternative OIDC integration if SAML not supported',
        prerequisites: ['Application supports OIDC', 'Client ID/Secret provisioned', 'Redirect URIs configured'],
        estimatedEffortHours: 12,
      })
    }

    if (gapType === 'manual_provisioning') {
      requirements.push({
        type: 'scim',
        description: 'SCIM 2.0 automated provisioning',
        prerequisites: ['Application exposes SCIM endpoint', 'Bearer token authentication', 'User/Group schema mapping'],
        estimatedEffortHours: 24,
      })
    }

    if (gapType === 'missing_pam') {
      requirements.push({
        type: 'rest_api',
        description: 'CyberArk PAC integration for privileged account management',
        prerequisites: ['CyberArk safe created', 'Platform configured', 'API credentials provisioned'],
        estimatedEffortHours: 20,
      })
    }

    return requirements
  }

  private generateTechnicalGuidance(gapType: string, appName: string, mode: BuildMode): string[] {
    const guidance: string[] = []

    if (mode === 'advisory') {
      guidance.push(`Advisory: Review the following guidance for ${appName} before proceeding`)
    }

    if (gapType === 'missing_sso') {
      guidance.push(`1. Obtain SAML/OIDC metadata from ${appName} vendor or admin portal`)
      guidance.push('2. Configure IdP (Okta/Entra) with application metadata')
      guidance.push('3. Configure application with IdP metadata')
      guidance.push('4. Test SSO login flow with test user')
      guidance.push('5. Enable conditional access policies')
      guidance.push('6. Cutover users from local authentication to SSO')
    } else if (gapType === 'missing_mfa') {
      guidance.push('1. Verify application authentication flow supports MFA')
      guidance.push('2. Configure conditional access policy in IdP')
      guidance.push('3. Set MFA enforcement scope (all users vs. privileged)')
      guidance.push('4. Enable MFA enrollment campaign')
      guidance.push('5. Monitor enrollment completion rate')
    } else if (gapType === 'manual_provisioning') {
      guidance.push(`1. Verify ${appName} supports SCIM or REST API provisioning`)
      guidance.push('2. Configure source system (SailPoint IIQ) connector')
      guidance.push('3. Map user attributes and group memberships')
      guidance.push('4. Configure provisioning rules and approval workflows')
      guidance.push('5. Test with pilot group')
      guidance.push('6. Enable full provisioning')
    }

    return guidance
  }

  private generateBuildPackage(gapType: string, appName: string): BuildPackageSection[] {
    return [
      { title: 'Overview', content: `Build package for ${this.getGapLabel(gapType)} — ${appName}`, order: 1 },
      { title: 'Prerequisites', content: 'List of prerequisites and dependencies', order: 2 },
      { title: 'Architecture', content: 'Integration architecture and data flow', order: 3 },
      { title: 'Implementation Steps', content: 'Detailed step-by-step implementation guide', order: 4 },
      { title: 'Testing Plan', content: 'Test cases and validation criteria', order: 5 },
      { title: 'Rollback Plan', content: 'Rollback procedures if issues are detected', order: 6 },
      { title: 'Sign-off', content: 'Stakeholder approval and sign-off checklist', order: 7 },
    ]
  }
}
