/**
 * IDVIZE Platform Build Execution Types
 * Module 4: Build Execution and Delivery Orchestration
 */

export type BuildStatus =
  | 'DETECTED'
  | 'CLASSIFIED'
  | 'ASSIGNED'
  | 'READY_TO_BUILD'
  | 'OUTREACH_SENT'
  | 'MEETING_SCHEDULED'
  | 'DATA_COLLECTED'
  | 'BUILD_IN_PROGRESS'
  | 'TESTING'
  | 'COMPLETED'

export type BuildMode = 'advisory' | 'guided' | 'automated'

export type IntegrationType = 'saml' | 'oidc' | 'scim' | 'rest_api' | 'ldap' | 'radius' | 'other'

export interface BuildCase {
  id: string
  appId: string
  appName: string
  gapId: string
  title: string
  description: string
  status: BuildStatus
  mode: BuildMode
  priority: 'critical' | 'high' | 'medium' | 'low'
  assignedEngineer?: string
  assignedArchitect?: string
  integrationType?: IntegrationType
  integrationDetails?: IntegrationDetails
  stakeholders: Stakeholder[]
  timeline: BuildTimelineEntry[]
  artifacts: BuildArtifact[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface IntegrationDetails {
  type: IntegrationType
  entityId?: string
  acsUrl?: string
  metadataUrl?: string
  clientId?: string
  redirectUris?: string[]
  scimEndpoint?: string
  apiBaseUrl?: string
  notes?: string
}

export interface Stakeholder {
  name: string
  role: string
  email?: string
  contacted: boolean
  lastContactedAt?: string
}

export interface BuildTimelineEntry {
  timestamp: string
  status: BuildStatus
  actor: string
  notes?: string
}

export interface BuildArtifact {
  id: string
  name: string
  type: 'implementation_guide' | 'config_template' | 'test_plan' | 'runbook' | 'architecture_diagram' | 'other'
  createdAt: string
  createdBy: string
  content?: string
}

export interface BuildSummaryStats {
  totalCases: number
  byStatus: Record<BuildStatus, number>
  byMode: Record<BuildMode, number>
  averageCompletionDays: number
  activeCases: number
}
