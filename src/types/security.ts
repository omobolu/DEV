/**
 * IDVIZE Platform Security Types
 * RBAC + ABAC models, users, roles, permissions, policies
 */

export type UserRole = 'manager' | 'architect' | 'business_analyst' | 'engineer' | 'developer' | 'admin'

export interface User {
  id: string
  email: string
  displayName: string
  roles: UserRole[]
  department?: string
  title?: string
  active: boolean
  createdAt: string
  lastLoginAt?: string
  scimExternalId?: string
  attributes: Record<string, string>
}

export interface Role {
  id: string
  name: UserRole
  displayName: string
  description: string
  permissions: string[]
}

export interface Permission {
  id: string
  resource: string
  action: string
  description: string
}

export type PolicyEffect = 'allow' | 'deny'

export interface Policy {
  id: string
  name: string
  description: string
  effect: PolicyEffect
  roles: UserRole[]
  permissions: string[]
  conditions?: PolicyCondition[]
}

export interface PolicyCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains'
  value: string | string[]
}

export interface GroupMapping {
  id: string
  externalGroupId: string
  externalGroupName: string
  roles: UserRole[]
  source: 'okta' | 'entra' | 'scim' | 'manual'
}

export interface ApprovalRequest {
  id: string
  requestedBy: string
  requestedAt: string
  action: string
  resource: string
  resourceId?: string
  reason: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  reviewedBy?: string
  reviewedAt?: string
  reviewNotes?: string
}

export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted'

/**
 * Predefined permissions for the platform
 */
export const PLATFORM_PERMISSIONS = {
  // Cost module
  COST_VIEW_SUMMARY: 'cost.view.summary',
  COST_VIEW_SALARY_DETAIL: 'cost.view.salary_detail',
  COST_VIEW_VENDOR_ANALYSIS: 'cost.view.vendor_analysis',

  // Applications
  APPLICATIONS_VIEW_ALL: 'applications.view.all',
  APPLICATIONS_VIEW_ASSIGNED: 'applications.view.assigned',
  APPLICATIONS_EDIT: 'applications.edit',

  // Tasks
  TASKS_VIEW_ASSIGNED: 'tasks.view.assigned',
  TASKS_VIEW_ALL: 'tasks.view.all',

  // Documents
  DOCUMENT_VIEW: 'document.view',
  DOCUMENT_REVIEW: 'document.review',
  DOCUMENT_PUBLISH: 'document.publish',

  // Build
  BUILD_EXECUTE_GUIDED: 'build.execute.guided',
  BUILD_EXECUTE_AUTOMATED: 'build.execute.automated',

  // Approvals
  APPROVAL_GRANT_LOW: 'approval.grant.low_risk',
  APPROVAL_GRANT_HIGH: 'approval.grant.high_risk',

  // Security
  SECURITY_MANAGE_ACCESS: 'security.manage.access',
  SECURITY_VIEW_AUDIT: 'security.view.audit',

  // Secrets
  SECRETS_REQUEST: 'secrets.request',
  SECRETS_REFERENCE: 'secrets.reference',
  SECRETS_VIEW_METADATA: 'secrets.view.metadata',
  SECRETS_REVEAL: 'secrets.reveal',
  SECRETS_ROTATE: 'secrets.rotate',
  SECRETS_APPROVE: 'secrets.approve',
  SECRETS_MANAGE_PROVIDER: 'secrets.manage.provider',
} as const

/**
 * Default role → permission mappings
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  manager: [
    PLATFORM_PERMISSIONS.COST_VIEW_SUMMARY,
    PLATFORM_PERMISSIONS.COST_VIEW_VENDOR_ANALYSIS,
    PLATFORM_PERMISSIONS.APPLICATIONS_VIEW_ALL,
    PLATFORM_PERMISSIONS.TASKS_VIEW_ALL,
    PLATFORM_PERMISSIONS.DOCUMENT_VIEW,
    PLATFORM_PERMISSIONS.APPROVAL_GRANT_LOW,
    PLATFORM_PERMISSIONS.APPROVAL_GRANT_HIGH,
    PLATFORM_PERMISSIONS.SECURITY_VIEW_AUDIT,
  ],
  architect: [
    PLATFORM_PERMISSIONS.COST_VIEW_SUMMARY,
    PLATFORM_PERMISSIONS.APPLICATIONS_VIEW_ALL,
    PLATFORM_PERMISSIONS.TASKS_VIEW_ALL,
    PLATFORM_PERMISSIONS.DOCUMENT_VIEW,
    PLATFORM_PERMISSIONS.DOCUMENT_REVIEW,
    PLATFORM_PERMISSIONS.BUILD_EXECUTE_GUIDED,
    PLATFORM_PERMISSIONS.SECRETS_VIEW_METADATA,
  ],
  business_analyst: [
    PLATFORM_PERMISSIONS.APPLICATIONS_VIEW_ALL,
    PLATFORM_PERMISSIONS.TASKS_VIEW_ALL,
    PLATFORM_PERMISSIONS.DOCUMENT_VIEW,
  ],
  engineer: [
    PLATFORM_PERMISSIONS.APPLICATIONS_VIEW_ASSIGNED,
    PLATFORM_PERMISSIONS.TASKS_VIEW_ASSIGNED,
    PLATFORM_PERMISSIONS.DOCUMENT_VIEW,
    PLATFORM_PERMISSIONS.BUILD_EXECUTE_GUIDED,
    PLATFORM_PERMISSIONS.SECRETS_REQUEST,
    PLATFORM_PERMISSIONS.SECRETS_REFERENCE,
  ],
  developer: [
    PLATFORM_PERMISSIONS.APPLICATIONS_VIEW_ASSIGNED,
    PLATFORM_PERMISSIONS.TASKS_VIEW_ASSIGNED,
    PLATFORM_PERMISSIONS.DOCUMENT_VIEW,
    PLATFORM_PERMISSIONS.BUILD_EXECUTE_GUIDED,
    PLATFORM_PERMISSIONS.SECRETS_REQUEST,
  ],
  admin: Object.values(PLATFORM_PERMISSIONS),
}
