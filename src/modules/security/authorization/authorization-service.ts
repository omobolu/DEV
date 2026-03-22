/**
 * IDVIZE Authorization Service
 * RBAC + ABAC policy evaluation, field-level access control
 */

import type { User, UserRole, Policy, PolicyCondition, DataClassification } from '../../../types/security'
import { DEFAULT_ROLE_PERMISSIONS } from '../../../types/security'
import { recordAudit } from '../../../types/audit'

export interface AuthorizationDecision {
  allowed: boolean
  reason: string
  matchedPolicies: string[]
  deniedBy?: string
}

export interface FieldAccessResult {
  field: string
  visible: boolean
  masked: boolean
  maskedValue?: string
}

/** In-memory policy store */
const policies: Policy[] = [
  // Default deny-by-default policy
  {
    id: 'policy-deny-default',
    name: 'Deny by Default',
    description: 'All access is denied unless explicitly allowed',
    effect: 'deny',
    roles: [],
    permissions: ['*'],
  },
  // Manager policies
  {
    id: 'policy-manager-cost',
    name: 'Manager Cost Access',
    description: 'Managers can view cost summaries and vendor analysis but not salary details',
    effect: 'allow',
    roles: ['manager'],
    permissions: ['cost.view.summary', 'cost.view.vendor_analysis'],
  },
  // Architect policies
  {
    id: 'policy-architect-no-salary',
    name: 'Architect Salary Restriction',
    description: 'Architects cannot view salary details',
    effect: 'deny',
    roles: ['architect'],
    permissions: ['cost.view.salary_detail'],
  },
  // Engineer policies
  {
    id: 'policy-engineer-no-cost',
    name: 'Engineer Cost Restriction',
    description: 'Engineers cannot access cost module',
    effect: 'deny',
    roles: ['engineer'],
    permissions: ['cost.view.summary', 'cost.view.salary_detail', 'cost.view.vendor_analysis'],
  },
  // Developer policies
  {
    id: 'policy-developer-no-salary',
    name: 'Developer Salary Restriction',
    description: 'Developers cannot view salary or executive data',
    effect: 'deny',
    roles: ['developer'],
    permissions: ['cost.view.salary_detail', 'cost.view.vendor_analysis'],
  },
  // Business Analyst policies
  {
    id: 'policy-ba-no-secrets',
    name: 'BA Secrets Restriction',
    description: 'Business analysts cannot view secrets or salary data',
    effect: 'deny',
    roles: ['business_analyst'],
    permissions: ['cost.view.salary_detail', 'secrets.reveal', 'secrets.rotate'],
  },
]

/** Field classification rules */
const FIELD_CLASSIFICATIONS: Record<string, { classification: DataClassification; requiredPermission: string }> = {
  'salary': { classification: 'restricted', requiredPermission: 'cost.view.salary_detail' },
  'annualSalary': { classification: 'restricted', requiredPermission: 'cost.view.salary_detail' },
  'contractValue': { classification: 'confidential', requiredPermission: 'cost.view.vendor_analysis' },
  'totalValue': { classification: 'confidential', requiredPermission: 'cost.view.vendor_analysis' },
  'apiKey': { classification: 'restricted', requiredPermission: 'secrets.reveal' },
  'password': { classification: 'restricted', requiredPermission: 'secrets.reveal' },
  'clientSecret': { classification: 'restricted', requiredPermission: 'secrets.reveal' },
  'vaultReference': { classification: 'confidential', requiredPermission: 'secrets.view.metadata' },
}

export class AuthorizationService {
  /** Check if a user has a specific permission */
  checkPermission(user: User, permission: string): AuthorizationDecision {
    const userPermissions = this.resolvePermissions(user.roles)
    const matchedPolicies: string[] = []

    // Check explicit deny policies first
    for (const policy of policies) {
      if (policy.effect === 'deny' && this.policyAppliesToUser(policy, user)) {
        if (policy.permissions.includes(permission) || policy.permissions.includes('*')) {
          // Check if there's a more specific allow for admin
          if (user.roles.includes('admin') && policy.id !== 'policy-deny-default') continue

          recordAudit(
            'authorization',
            { type: 'user', id: user.id, name: user.displayName, roles: user.roles },
            'permission_check',
            permission,
            'denied',
            { policy: policy.id, reason: policy.description },
          )
          return {
            allowed: false,
            reason: `Denied by policy: ${policy.name}`,
            matchedPolicies: [policy.id],
            deniedBy: policy.id,
          }
        }
      }
    }

    // Check allow via role permissions
    if (userPermissions.includes(permission)) {
      // Check allow policies
      for (const policy of policies) {
        if (policy.effect === 'allow' && this.policyAppliesToUser(policy, user)) {
          if (policy.permissions.includes(permission)) {
            matchedPolicies.push(policy.id)
          }
        }
      }

      // Check ABAC conditions
      for (const policy of policies) {
        if (policy.conditions && this.policyAppliesToUser(policy, user)) {
          const conditionsMet = policy.conditions.every(c => this.evaluateCondition(c, user))
          if (!conditionsMet && policy.effect === 'allow') {
            return {
              allowed: false,
              reason: `ABAC conditions not met for policy: ${policy.name}`,
              matchedPolicies: [policy.id],
              deniedBy: policy.id,
            }
          }
        }
      }

      recordAudit(
        'authorization',
        { type: 'user', id: user.id, name: user.displayName, roles: user.roles },
        'permission_check',
        permission,
        'success',
        { matchedPolicies },
      )
      return { allowed: true, reason: 'Allowed by role permissions', matchedPolicies }
    }

    recordAudit(
      'authorization',
      { type: 'user', id: user.id, name: user.displayName, roles: user.roles },
      'permission_check',
      permission,
      'denied',
      { reason: 'No matching permission found' },
    )
    return {
      allowed: false,
      reason: 'Permission not granted to any of the user\'s roles',
      matchedPolicies: [],
    }
  }

  /** Check field-level access for a user */
  checkFieldAccess(user: User, fieldName: string): FieldAccessResult {
    const classification = FIELD_CLASSIFICATIONS[fieldName]
    if (!classification) {
      return { field: fieldName, visible: true, masked: false }
    }

    const decision = this.checkPermission(user, classification.requiredPermission)
    if (decision.allowed) {
      return { field: fieldName, visible: true, masked: false }
    }

    // Field is restricted but visible in masked form
    return {
      field: fieldName,
      visible: true,
      masked: true,
      maskedValue: classification.classification === 'restricted' ? '********' : '[RESTRICTED]',
    }
  }

  /** Get all permissions for a set of roles */
  resolvePermissions(roles: UserRole[]): string[] {
    const permissions = new Set<string>()
    for (const role of roles) {
      const rolePermissions = DEFAULT_ROLE_PERMISSIONS[role]
      if (rolePermissions) {
        for (const p of rolePermissions) permissions.add(p)
      }
    }
    return Array.from(permissions)
  }

  /** Add a custom policy */
  addPolicy(policy: Policy): void {
    const existing = policies.findIndex(p => p.id === policy.id)
    if (existing >= 0) {
      policies[existing] = policy
    } else {
      policies.push(policy)
    }
  }

  /** Get all policies */
  getPolicies(): Policy[] {
    return [...policies]
  }

  private policyAppliesToUser(policy: Policy, user: User): boolean {
    if (policy.roles.length === 0) return true
    return policy.roles.some(r => user.roles.includes(r))
  }

  private evaluateCondition(condition: PolicyCondition, user: User): boolean {
    const value = user.attributes[condition.field] ?? ''
    switch (condition.operator) {
      case 'equals':
        return value === condition.value
      case 'not_equals':
        return value !== condition.value
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value)
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value)
      case 'contains':
        return value.includes(String(condition.value))
      default:
        return false
    }
  }
}

/** Singleton authorization service */
export const authorizationService = new AuthorizationService()
