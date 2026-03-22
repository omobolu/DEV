/**
 * IDVIZE Documentation Agent
 * Generates architecture docs, process docs, runbooks, and app-specific IAM docs
 */

import type { BaseAgent, AgentConfig, AgentOutput, AgentHealthStatus } from '../../types/agent'
import { createAgentOutput } from '../../types/agent'
import type { PlatformEvent } from '../../types/events'
import type { DocumentType, DocumentRecord, DocumentFact } from '../../types/documentation'

export interface DocumentationResult {
  action: 'generate' | 'review_package' | 'publish_payload'
  document?: Partial<DocumentRecord>
  factsUsed: DocumentFact[]
  diagramMarkdown?: string
}

const AGENT_CONFIG: AgentConfig = {
  id: 'agent-documentation',
  domain: 'documentation',
  name: 'Documentation Agent',
  description: 'Generates architecture docs, process docs, runbooks, and app-specific IAM docs. Prepares architect review packages and publishing payloads.',
  enabled: true,
  capabilities: [
    {
      name: 'generate-documentation',
      description: 'Generate IAM documentation from platform data',
      inputEventTypes: ['DOCUMENT_GENERATION_REQUESTED', 'AGENT_TASK_COMPLETED'],
      outputEventTypes: ['AGENT_TASK_COMPLETED'],
    },
  ],
  maxRetries: 2,
  timeoutMs: 30000,
}

export class DocumentationAgent implements BaseAgent {
  readonly config = AGENT_CONFIG
  private processedCount = 0
  private errorCount = 0
  private lastProcessedAt?: string
  private totalProcessingTimeMs = 0

  async initialize(): Promise<void> {}

  canHandle(eventType: string): boolean {
    return this.config.capabilities.some(c => c.inputEventTypes.includes(eventType))
  }

  async process(event: PlatformEvent): Promise<AgentOutput<DocumentationResult>> {
    const startTime = Date.now()

    try {
      const action = event.payload.action as string ?? 'generate'
      const docType = event.payload.documentType as DocumentType ?? 'knowledge_article'
      const appName = event.payload.appName as string
      const title = event.payload.title as string ?? `${docType.replace(/_/g, ' ')} Document`

      const facts = this.gatherFacts(event)
      let result: DocumentationResult

      if (action === 'review_package') {
        result = this.prepareReviewPackage(event, facts)
      } else if (action === 'publish_payload') {
        result = this.preparePublishPayload(event)
      } else {
        result = this.generateDocument(docType, title, appName, facts)
      }

      const processingTimeMs = Date.now() - startTime
      this.processedCount++
      this.lastProcessedAt = new Date().toISOString()
      this.totalProcessingTimeMs += processingTimeMs

      return createAgentOutput<DocumentationResult>(
        this.config.id,
        this.config.domain,
        result,
        {
          confidence: 'medium',
          assumptions: [
            'Document content generated from available platform data',
            'Mermaid diagrams used for basic visualization',
          ],
          warnings: facts.length === 0 ? ['No facts available — document may be incomplete'] : [],
          recommendedNextStep: action === 'generate'
            ? 'Route document to architect for review'
            : action === 'review_package'
              ? 'Submit for architect approval'
              : 'Publish to target system',
          approvalRequired: action === 'publish_payload',
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

  private gatherFacts(event: PlatformEvent): DocumentFact[] {
    const facts: DocumentFact[] = []
    const now = new Date().toISOString()

    if (event.payload.appName) {
      facts.push({ source: 'event', module: 'application-governance', key: 'appName', value: event.payload.appName as string, collectedAt: now })
    }
    if (event.payload.gapType) {
      facts.push({ source: 'event', module: 'application-governance', key: 'gapType', value: event.payload.gapType as string, collectedAt: now })
    }
    if (event.payload.controls) {
      facts.push({ source: 'event', module: 'application-governance', key: 'controls', value: JSON.stringify(event.payload.controls), collectedAt: now })
    }

    const additionalFacts = event.payload.facts as DocumentFact[] | undefined
    if (additionalFacts) facts.push(...additionalFacts)

    return facts
  }

  private generateDocument(type: DocumentType, title: string, appName: string | undefined, facts: DocumentFact[]): DocumentationResult {
    const contentSections = this.getDocumentSections(type, appName, facts)
    const content = contentSections.join('\n\n')
    const diagram = this.generateDiagram(type, appName)

    return {
      action: 'generate',
      document: {
        title,
        type,
        status: 'draft',
        version: 1,
        content: diagram ? `${content}\n\n## Diagram\n\n\`\`\`mermaid\n${diagram}\n\`\`\`` : content,
        summary: `Auto-generated ${type.replace(/_/g, ' ')} document${appName ? ` for ${appName}` : ''}`,
        tags: [type, ...(appName ? [appName.toLowerCase()] : [])],
        facts,
        reviewHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      factsUsed: facts,
      diagramMarkdown: diagram,
    }
  }

  private getDocumentSections(type: DocumentType, appName: string | undefined, facts: DocumentFact[]): string[] {
    const sections: string[] = []
    const app = appName ?? 'the application'

    switch (type) {
      case 'solution_design':
        sections.push(`# Solution Design — ${app}`)
        sections.push('## 1. Overview\nThis document describes the IAM solution design.')
        sections.push('## 2. Current State\nDescription of the current authentication and authorization posture.')
        sections.push('## 3. Target State\nDesired IAM integration target state.')
        sections.push('## 4. Architecture\nIntegration architecture and components.')
        sections.push('## 5. Implementation Plan\nStep-by-step implementation approach.')
        sections.push('## 6. Testing Strategy\nValidation and testing approach.')
        sections.push('## 7. Rollback Plan\nContingency and rollback procedures.')
        break

      case 'runbook':
        sections.push(`# Runbook — ${app}`)
        sections.push('## Prerequisites\nList of prerequisites and access requirements.')
        sections.push('## Procedures\nStep-by-step operational procedures.')
        sections.push('## Troubleshooting\nCommon issues and resolution steps.')
        sections.push('## Escalation\nEscalation contacts and procedures.')
        break

      case 'process_design':
        sections.push(`# Process Design — ${app}`)
        sections.push('## 1. Process Overview\nHigh-level process description.')
        sections.push('## 2. Actors and Roles\nStakeholders and their responsibilities.')
        sections.push('## 3. Process Flow\nDetailed process flow steps.')
        sections.push('## 4. Exceptions\nException handling procedures.')
        sections.push('## 5. Metrics\nProcess success metrics and KPIs.')
        break

      default:
        sections.push(`# ${type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} — ${app}`)
        sections.push('## Overview\nDocument overview and purpose.')
        sections.push('## Details\nDetailed content.')
        sections.push('## References\nRelated documents and resources.')
    }

    if (facts.length > 0) {
      sections.push('## Collected Facts')
      for (const fact of facts) {
        sections.push(`- **${fact.key}**: ${fact.value} _(source: ${fact.source}, module: ${fact.module})_`)
      }
    }

    return sections
  }

  private generateDiagram(type: DocumentType, appName: string | undefined): string | undefined {
    const app = appName ?? 'Application'

    if (type === 'solution_design' || type === 'logical_architecture') {
      return `graph TD
  A[User] --> B[Identity Provider]
  B --> C{SSO Protocol}
  C -->|SAML| D[${app}]
  C -->|OIDC| D
  B --> E[MFA Service]
  E --> B
  F[SailPoint IIQ] --> D
  G[CyberArk PAC] --> D`
    }

    if (type === 'process_design') {
      return `graph LR
  A[Request] --> B[Classify]
  B --> C[Route]
  C --> D[Assign]
  D --> E[Execute]
  E --> F[Review]
  F --> G[Complete]`
    }

    return undefined
  }

  private prepareReviewPackage(_event: PlatformEvent, facts: DocumentFact[]): DocumentationResult {
    return {
      action: 'review_package',
      document: {
        status: 'in_review',
        updatedAt: new Date().toISOString(),
      },
      factsUsed: facts,
    }
  }

  private preparePublishPayload(event: PlatformEvent): DocumentationResult {
    return {
      action: 'publish_payload',
      document: {
        status: 'published',
        publishedAt: new Date().toISOString(),
        publishedTo: event.payload.destination as string ?? 'confluence',
        updatedAt: new Date().toISOString(),
      },
      factsUsed: [],
    }
  }
}
