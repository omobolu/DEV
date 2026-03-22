/**
 * IDVIZE Prompt Templates
 * Isolated AI prompt templates — not tightly coupled to any LLM provider
 * Templates use {{variable}} placeholders for injection
 */

export interface PromptTemplate {
  id: string
  name: string
  description: string
  agentDomain: string
  template: string
  variables: string[]
  version: number
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // Application Intelligence Prompts
  {
    id: 'prompt-app-gap-analysis',
    name: 'Application Gap Analysis',
    description: 'Analyze an application for IAM control gaps',
    agentDomain: 'application-intelligence',
    template: `Analyze the following application for IAM control gaps:

Application: {{appName}}
Criticality: {{criticality}}
Risk Level: {{riskLevel}}
Auth Method: {{authMethod}}
Hosting: {{hostingType}}

Current Controls:
- SSO: {{ssoStatus}}
- MFA: {{mfaStatus}}
- PAM: {{pamStatus}}
- Provisioning: {{provisioningStatus}}
- Access Reviews: {{accessReviewStatus}}

Identify gaps, assess severity, and recommend remediation steps.
Output structured JSON with: gaps[], recommendations[], riskScore.`,
    variables: ['appName', 'criticality', 'riskLevel', 'authMethod', 'hostingType', 'ssoStatus', 'mfaStatus', 'pamStatus', 'provisioningStatus', 'accessReviewStatus'],
    version: 1,
  },

  // Decision Agent Prompts
  {
    id: 'prompt-gap-classification',
    name: 'Gap Classification',
    description: 'Classify a gap by IAM domain, priority, and remediation path',
    agentDomain: 'decision',
    template: `Classify the following IAM gap:

Gap Type: {{gapType}}
Application: {{appName}}
Criticality: {{criticality}}
Description: {{description}}

Determine:
1. IAM Domain (IGA, AM, PAM, CIAM, or Cross-Domain)
2. Priority (Critical, High, Medium, Low)
3. Remediation Path
4. Required Stakeholders
5. Estimated Effort (days)

Output structured JSON.`,
    variables: ['gapType', 'appName', 'criticality', 'description'],
    version: 1,
  },

  // Ticket Intelligence Prompts
  {
    id: 'prompt-ticket-classification',
    name: 'Ticket Classification',
    description: 'Classify an IAM ticket or email request',
    agentDomain: 'ticket-intelligence',
    template: `Classify the following IAM request:

Subject: {{subject}}
Description: {{description}}
Requester: {{requester}}

Determine:
1. Category (access_request, incident, service_request, change_request, problem, inquiry)
2. IAM Subcategory
3. IAM Domain
4. Priority
5. Suggested Owner Team
6. Suggested Assignee Role
7. Whether it should be flagged for manual review

Output structured JSON.`,
    variables: ['subject', 'description', 'requester'],
    version: 1,
  },

  // Build Agent Prompts
  {
    id: 'prompt-build-guidance',
    name: 'Build Implementation Guidance',
    description: 'Generate implementation guidance for an IAM gap',
    agentDomain: 'build',
    template: `Generate implementation guidance for the following IAM integration:

Application: {{appName}}
Gap Type: {{gapType}}
Integration Type: {{integrationType}}
Build Mode: {{buildMode}}

Provide:
1. Prerequisites
2. Step-by-step implementation guide
3. Configuration requirements
4. Testing plan
5. Rollback procedure

Output structured guidance document.`,
    variables: ['appName', 'gapType', 'integrationType', 'buildMode'],
    version: 1,
  },

  // Communication Agent Prompts
  {
    id: 'prompt-stakeholder-email',
    name: 'Stakeholder Outreach Email',
    description: 'Draft a stakeholder outreach email for IAM integration',
    agentDomain: 'communication',
    template: `Draft a professional email for IAM stakeholder outreach:

Recipient: {{recipientName}} ({{recipientRole}})
Application: {{appName}}
Integration Need: {{integrationNeed}}
Urgency: {{urgency}}

The email should:
1. Introduce the IAM team and purpose
2. Explain the identified gap
3. Request a meeting for technical discovery
4. Be professional and concise

Output the email subject and body.`,
    variables: ['recipientName', 'recipientRole', 'appName', 'integrationNeed', 'urgency'],
    version: 1,
  },

  // Documentation Agent Prompts
  {
    id: 'prompt-doc-generation',
    name: 'Document Generation',
    description: 'Generate IAM documentation from platform data',
    agentDomain: 'documentation',
    template: `Generate a {{documentType}} document:

Title: {{title}}
Application: {{appName}}
Context: {{context}}

Facts:
{{facts}}

Generate a comprehensive document following the {{documentType}} template structure.
Include relevant diagrams in Mermaid format where applicable.

Output the full document content in Markdown format.`,
    variables: ['documentType', 'title', 'appName', 'context', 'facts'],
    version: 1,
  },

  // Cost Intelligence Prompts
  {
    id: 'prompt-cost-analysis',
    name: 'Cost Optimization Analysis',
    description: 'Analyze IAM costs and identify optimization opportunities',
    agentDomain: 'cost-intelligence',
    template: `Analyze the following IAM cost data:

Total Cost: {{totalCost}}
People Cost: {{peopleCost}}
Contract Cost: {{contractCost}}

Vendors: {{vendorSummary}}
Partners: {{partnerSummary}}
Staff Augmentation: {{staffAugSummary}}

Identify:
1. Cost optimization opportunities
2. Vendor consolidation recommendations
3. Staffing efficiency improvements
4. Risk areas
5. Strategic recommendations

IMPORTANT: Do NOT include any salary amounts, specific compensation, or personally identifiable financial data in the output.

Output structured JSON with recommendations.`,
    variables: ['totalCost', 'peopleCost', 'contractCost', 'vendorSummary', 'partnerSummary', 'staffAugSummary'],
    version: 1,
  },
]

/**
 * Fill a prompt template with variables
 */
export function fillTemplate(templateId: string, variables: Record<string, string>): string | null {
  const template = PROMPT_TEMPLATES.find(t => t.id === templateId)
  if (!template) return null

  let result = template.template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }

  return result
}

/**
 * Get templates for a specific agent domain
 */
export function getTemplatesForAgent(agentDomain: string): PromptTemplate[] {
  return PROMPT_TEMPLATES.filter(t => t.agentDomain === agentDomain)
}
