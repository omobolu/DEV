/**
 * IDVIZE Platform Application Types
 * Module 1: Application Governance Intelligence
 */

export type Criticality = 'critical' | 'high' | 'medium' | 'low'
export type AppRiskLevel = 'critical' | 'high' | 'medium' | 'low'
export type OnboardingStatus = 'onboarded' | 'in_progress' | 'not_started' | 'decommissioning'
export type ControlStatus = 'ok' | 'attention' | 'gap' | 'na'
export type HostingType = 'saas' | 'paas' | 'iaas' | 'on_premise' | 'hybrid' | 'custom'
export type DataClassificationLevel = 'public' | 'internal' | 'confidential' | 'restricted'

export interface ApplicationMetadata {
  appId: string
  name: string
  owner?: string
  businessOwner?: string
  itOwner?: string
  vendor?: string
  supportContact?: string
  supportPage?: string
  supportNumber?: string
  criticality: Criticality
  riskLevel: AppRiskLevel
  dataClassification: DataClassificationLevel
  complianceTags: string[]
  authMethod?: string
  hostingType?: HostingType
  userPopulation?: number
  department?: string
  environment?: string
  applicationType?: string
  soxApplicable?: boolean
}

export interface IAMControlPosture {
  ssoIntegrated: ControlStatus
  mfaEnabled: ControlStatus
  pamManaged: ControlStatus
  provisioningAutomated: ControlStatus
  accessReviewsCurrent: ControlStatus
  orphanAccountPosture: ControlStatus
  privilegedAccountPosture: ControlStatus
}

export interface IAMControlDetail {
  name: string
  status: ControlStatus
  detail: string
  lastAssessedAt?: string
}

export interface ApplicationRecord {
  metadata: ApplicationMetadata
  controls: IAMControlPosture
  controlDetails: IAMControlDetail[]
  onboardingStatus: OnboardingStatus
  iamPlatformCorrelation: IAMPlatformCorrelation
  rawCmdbData?: Record<string, string>
  lastUpdatedAt: string
  source: 'cmdb' | 'risk_platform' | 'manual' | 'api'
}

export interface IAMPlatformCorrelation {
  sailpointIiq?: PlatformCorrelationEntry
  microsoftEntra?: PlatformCorrelationEntry
  cyberarkPac?: PlatformCorrelationEntry
  okta?: PlatformCorrelationEntry
}

export interface PlatformCorrelationEntry {
  onboarded: boolean
  platformAppId?: string
  lastSyncAt?: string
  notes?: string
}

export interface ApplicationGap {
  id: string
  appId: string
  appName: string
  gapType: 'missing_sso' | 'missing_mfa' | 'missing_pam' | 'manual_provisioning' | 'overdue_review' | 'orphan_accounts' | 'excessive_privileged'
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  recommendation: string
  detectedAt: string
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk'
  assignedTo?: string
}

export interface ApplicationSummaryStats {
  totalApplications: number
  criticalApps: number
  highRiskApps: number
  mfaCoverage: number
  ssoCoverage: number
  pamCoverage: number
  automatedProvisioningCoverage: number
  orphanAccountTotal: number
  privilegedAccountTotal: number
  openGaps: number
}
