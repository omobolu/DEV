/**
 * Authorization Service
 *
 * Orchestrates RBAC (permission-matrix) + ABAC (policy-engine) evaluation.
 * Seeded with system policies derived from the permission matrix on startup.
 * Deny-by-default: if no matching allow policy → deny.
 */

import { v4 as uuidv4 } from 'uuid';
import { Policy, PermissionId, EvaluationContext, AuthzDecision, UserRole, User } from '../security.types';
import { SYSTEM_ROLES, PERMISSION_CATALOGUE, resolvePermissions } from './permission-matrix';
import { evaluate } from './policy-engine';
import { authRepository } from '../auth/auth.repository';

const now = new Date().toISOString();

class AuthzService {
  private policies = new Map<string, Policy>();

  constructor() {
    this.seedSystemPolicies();
  }

  // ── System Policy Seeding ─────────────────────────────────────────────────

  private seedSystemPolicies(): void {
    for (const role of SYSTEM_ROLES) {
      const policy: Policy = {
        policyId: `sys-policy-${role.name.toLowerCase()}`,
        name: `System: ${role.displayName} Base Permissions`,
        description: `Auto-generated allow policy for ${role.displayName} role. Derived from permission matrix.`,
        effect: 'allow',
        subjects: [`role:${role.name}`],
        permissions: role.permissions,
        conditions: [],   // pure RBAC — no ABAC conditions
        priority: 10,
        enabled: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      };
      this.policies.set(policy.policyId, policy);
    }

    // ── ABAC Override: deny salary detail outside Manager role ───────────────
    // This demonstrates the field-level restriction:
    //   Architect, BusinessAnalyst, Engineer, Developer cannot see salary_detail
    //   even if they somehow have the permission through a future custom policy.
    const denySalaryPolicy: Policy = {
      policyId: 'sys-deny-salary-non-manager',
      name: 'System: Deny Salary Detail to Non-Managers',
      description: 'ABAC deny: users without Manager role cannot access salary detail data regardless of other grants.',
      effect: 'deny',
      subjects: ['role:Architect', 'role:BusinessAnalyst', 'role:Engineer', 'role:Developer'],
      permissions: ['cost.view.salary_detail'],
      conditions: [],   // unconditional deny for these roles
      priority: 100,    // highest priority — deny wins before any allow is checked
      enabled: true,
      createdBy: 'system',
      createdAt: now,
      updatedAt: now,
    };
    this.policies.set(denySalaryPolicy.policyId, denySalaryPolicy);

    console.log(`[AuthzService] Seeded ${this.policies.size} system policies`);
  }

  // ── Authorization Check ───────────────────────────────────────────────────

  /**
   * Tenant-scoped authorization check. tenantId is REQUIRED — no global fallback
   * for request-time checks. All callers must provide the tenant context.
   */
  check(userId: string, tenantId: string, permission: PermissionId, context: EvaluationContext = {}): AuthzDecision {
    const user = authRepository.findById(tenantId, userId);
    if (!user) {
      return { allowed: false, reason: 'User not found', permissionId: permission, userId };
    }
    if (user.status !== 'active') {
      return { allowed: false, reason: `User is ${user.status}`, permissionId: permission, userId };
    }
    return evaluate(user, permission, Array.from(this.policies.values()), context);
  }

  /**
   * Evaluate multiple permissions at once — returns a map of decisions.
   */
  checkBulk(userId: string, tenantId: string, permissions: PermissionId[], context: EvaluationContext = {}): Record<string, AuthzDecision> {
    const result: Record<string, AuthzDecision> = {};
    for (const perm of permissions) {
      result[perm] = this.check(userId, tenantId, perm, context);
    }
    return result;
  }

  /**
   * Return the effective permissions for a user (union of all roles).
   * tenantId is REQUIRED — no global fallback.
   */
  getUserPermissions(userId: string, tenantId: string): PermissionId[] {
    const user = authRepository.findById(tenantId, userId);
    if (!user || user.status !== 'active') return [];
    return resolvePermissions(user.roles);
  }

  // ── Policy Management ─────────────────────────────────────────────────────

  createPolicy(input: Omit<Policy, 'policyId' | 'createdAt' | 'updatedAt'>): Policy {
    const policy: Policy = {
      ...input,
      policyId: `policy-${uuidv4().split('-')[0]}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.policies.set(policy.policyId, policy);
    return policy;
  }

  listPolicies(): Policy[] {
    return Array.from(this.policies.values()).sort((a, b) => b.priority - a.priority);
  }

  getPolicy(policyId: string): Policy | undefined {
    return this.policies.get(policyId);
  }

  // ── Role & Permission Catalogue ───────────────────────────────────────────

  listRoles() { return SYSTEM_ROLES; }
  listPermissions() { return PERMISSION_CATALOGUE; }

  getRolePermissions(role: UserRole): PermissionId[] {
    return resolvePermissions([role]);
  }

  /**
   * Return a permission matrix view: for each role, which permissions are granted.
   */
  getPermissionMatrix(): Record<UserRole, PermissionId[]> {
    const roles: UserRole[] = ['Manager', 'Architect', 'BusinessAnalyst', 'Engineer', 'Developer'];
    const matrix = {} as Record<UserRole, PermissionId[]>;
    for (const role of roles) {
      matrix[role] = resolvePermissions([role]);
    }
    return matrix;
  }
}

export const authzService = new AuthzService();
