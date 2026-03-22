export type ControlStatusValue = 'OK' | 'ATTN' | 'GAP'
export type AppCriticality = 'Low' | 'Medium' | 'High' | 'Critical'
export type AppRisk = 'Low' | 'Medium' | 'High' | 'Critical'

export interface ControlCheck {
  id: string
  name: string
  status: ControlStatusValue
  description: string
}

export interface AppRecommendation {
  id: string
  text: string
}

export interface AppDetailMetadata {
  authMethod?: string
  dataClassification?: string
  soxApplicable?: boolean
  owner?: string
  businessUnit?: string
  vendor?: string
  supportContact?: string
  supportPage?: string
  hostingType?: string
  userPopulation?: string
  complianceFrameworks?: string[]
  lastAccessReview?: string
  nextAccessReview?: string
  accessReviewFrequency?: string
  provisioningType?: string
  deprovisioningType?: string
}

export interface AppDetail {
  appId: string
  name: string
  tags: string[]
  criticality: AppCriticality
  risk: AppRisk
  users: number
  orphanAccounts: number
  privilegedAccounts: number
  compliance: string
  posture: {
    ok: number
    attention: number
    gap: number
  }
  controls: ControlCheck[]
  recommendations: AppRecommendation[]
  rawControls: string[]
  metadata: AppDetailMetadata
}
