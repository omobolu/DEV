/**
 * IDVIZE Policy Service
 * Centralized policy management for RBAC + ABAC
 */

import type { Policy, UserRole } from '../../../types/security'
import { authorizationService } from '../authorization/authorization-service'

export interface PolicySummary {
  totalPolicies: number
  allowPolicies: number
  denyPolicies: number
  byRole: Record<string, number>
}

export class PolicyService {
  /** Get all policies */
  getPolicies(): Policy[] {
    return authorizationService.getPolicies()
  }

  /** Add a new policy */
  addPolicy(policy: Policy): void {
    authorizationService.addPolicy(policy)
  }

  /** Get policy summary */
  getSummary(): PolicySummary {
    const policies = this.getPolicies()
    const byRole: Record<string, number> = {}

    for (const policy of policies) {
      for (const role of policy.roles) {
        byRole[role] = (byRole[role] ?? 0) + 1
      }
    }

    return {
      totalPolicies: policies.length,
      allowPolicies: policies.filter(p => p.effect === 'allow').length,
      denyPolicies: policies.filter(p => p.effect === 'deny').length,
      byRole,
    }
  }

  /** Get policies applicable to a specific role */
  getPoliciesForRole(role: UserRole): Policy[] {
    return this.getPolicies().filter(p => p.roles.length === 0 || p.roles.includes(role))
  }
}

/** Singleton policy service */
export const policyService = new PolicyService()
