/**
 * Module 7 — Security, Identity, and Access Governance
 * Master type definitions for all security data models.
 */

// ── User ─────────────────────────────────────────────────────────────────────

export type UserRole = 'PlatformAdmin' | 'Manager' | 'Architect' | 'BusinessAnalyst' | 'Engineer' | 'Developer';
export type UserStatus = 'active' | 'suspended' | 'deprovisioned' | 'pending';
export type AuthProvider = 'oidc' | 'saml' | 'local';

export interface User {
  userId: string;                       // e.g. "usr-<uuid>"
  tenantId: string;                     // owning tenant — e.g. "ten-acme"
  externalId?: string;                  // IdP subject or SCIM externalId
  scimId?: string;                      // SCIM resource id
  username: string;                     // login identity (email)
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  title?: string;
  managerId?: string;                   // userId of direct manager
  roles: UserRole[];                    // assigned platform roles (multi-role supported)
  groups: string[];                     // groupId references
  status: UserStatus;
  authProvider: AuthProvider;
  mfaEnrolled: boolean;
  lastLoginAt?: string;
  passwordHash?: string;                // mock only — Phase 2: delegate to IdP
  attributes: Record<string, unknown>;  // extensible ABAC attributes
  createdAt: string;
  updatedAt: string;
}

// ── Role ─────────────────────────────────────────────────────────────────────

export interface Role {
  roleId: string;                       // e.g. "role-manager"
  name: UserRole;
  displayName: string;
  description: string;
  permissions: PermissionId[];
  isSystemRole: boolean;                // system roles cannot be deleted
  createdAt: string;
  updatedAt: string;
}

// ── Permission ───────────────────────────────────────────────────────────────

export type PermissionId =
  | 'cost.view.summary'
  | 'cost.view.salary_detail'
  | 'cost.view.vendor_analysis'
  | 'cost.view.optimization'
  | 'applications.view.all'
  | 'applications.view.assigned'
  | 'applications.manage'
  | 'controls.view'
  | 'controls.evaluate'
  | 'build.view'
  | 'build.execute.guided'
  | 'build.execute.automated'
  | 'integrations.view'
  | 'integrations.manage'
  | 'tasks.view.assigned'
  | 'tasks.view.all'
  | 'document.view'
  | 'document.review'
  | 'document.publish'
  | 'approval.request'
  | 'approval.grant.standard'
  | 'approval.grant.high_risk'
  | 'security.view.audit'
  | 'security.manage.access'
  | 'security.manage.scim'
  | 'vendors.view'
  | 'vendors.manage'
  // Secrets & Vault
  | 'secrets.request'
  | 'secrets.reference'
  | 'secrets.view.metadata'
  | 'secrets.reveal'
  | 'secrets.rotate'
  | 'secrets.approve'
  | 'secrets.manage.provider'
  // Tenant management (PlatformAdmin only)
  | 'tenants.manage'
  // Risk Engine
  | 'risks.view'
  // Agents
  | 'agents.invoke';

export interface Permission {
  permissionId: PermissionId;
  module: string;
  action: string;
  description: string;
  riskLevel: 'high' | 'medium' | 'low';
  requiresApproval: boolean;
  dataClassification?: DataClassificationLevel;
}

// ── Policy (RBAC + ABAC) ─────────────────────────────────────────────────────

export type PolicyEffect = 'allow' | 'deny';

export interface PolicyCondition {
  attribute: string;          // e.g. "user.department", "resource.owner"
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'gt' | 'lt' | 'contains';
  value: unknown;
}

export interface Policy {
  policyId: string;
  name: string;
  description: string;
  effect: PolicyEffect;
  subjects: string[];         // "role:Manager" | "user:usr-xxx"
  permissions: PermissionId[];
  conditions: PolicyCondition[];  // empty = pure RBAC; non-empty = ABAC overlay
  priority: number;           // higher = evaluated first; deny wins over allow at same priority
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Group & Group Mapping ────────────────────────────────────────────────────

export interface GroupMember {
  userId: string;
  displayName: string;
}

export interface Group {
  groupId: string;
  scimId?: string;
  externalId?: string;
  displayName: string;
  members: GroupMember[];
  mappedRoles: UserRole[];        // roles auto-assigned when user joins this group
  source: 'scim' | 'manual' | 'oidc_claim';
  createdAt: string;
  updatedAt: string;
}

export interface GroupMapping {
  mappingId: string;
  externalGroupName: string;      // name from IdP (e.g. "IAM-Architects")
  externalGroupId?: string;
  internalGroupId: string;
  mappedRoles: UserRole[];
  provider: 'okta' | 'entra' | 'saml' | 'manual';
  enabled: boolean;
  createdAt: string;
}

// ── Approval Request ─────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
export type ApprovalRiskLevel = 'standard' | 'high_risk';

export interface ApprovalRequest {
  requestId: string;
  requesterId: string;
  requesterName: string;
  targetUserId?: string;
  permissionId?: PermissionId;
  action: string;
  resource?: string;
  riskLevel: ApprovalRiskLevel;
  status: ApprovalStatus;
  justification: string;
  approverId?: string;
  approverName?: string;
  approverComment?: string;
  expiresAt: string;              // ISO 8601 — auto-expire after 48 hours
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Audit Event ──────────────────────────────────────────────────────────────

export type AuditEventType =
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout'
  | 'auth.token.issued'
  | 'authz.allow'
  | 'authz.deny'
  | 'authz.field_masked'
  | 'user.created'
  | 'user.updated'
  | 'user.deprovisioned'
  | 'user.role.assigned'
  | 'user.role.removed'
  | 'group.created'
  | 'group.member.added'
  | 'group.member.removed'
  | 'scim.user.create'
  | 'scim.user.update'
  | 'scim.user.delete'
  | 'scim.group.create'
  | 'scim.group.update'
  | 'scim.group.delete'
  | 'approval.requested'
  | 'approval.granted'
  | 'approval.rejected'
  | 'approval.expired'
  | 'policy.created'
  | 'policy.updated'
  | 'policy.deleted'
  | 'secret.accessed'
  | 'tenant.created'
  | 'tenant.updated'
  | 'tenant.suspended';

export interface AuditEvent {
  eventId: string;
  tenantId?: string;              // scoped to tenant when known; absent for pre-login events
  eventType: AuditEventType;
  actorId: string;                // userId or "system"
  actorName: string;
  actorIp?: string;
  targetId?: string;
  targetType?: string;            // "user" | "group" | "permission" | "policy"
  permissionId?: PermissionId;
  resource?: string;
  outcome: 'success' | 'failure' | 'masked';
  reason?: string;
  metadata: Record<string, unknown>;
  sessionId?: string;
  requestId?: string;
  timestamp: string;              // ISO 8601, append-only
}

// ── Data Classification ──────────────────────────────────────────────────────

export type DataClassificationLevel =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted';

/**
 * Named DataClassificationPolicy to avoid collision with application.types.ts
 * DataClassification string union.
 */
export interface DataClassificationPolicy {
  classificationId: string;
  name: DataClassificationLevel;
  displayLabel: string;
  description: string;
  requiredPermissions: PermissionId[];
  maskedFields: string[];             // dot-notation field paths to redact
  allowedRoles: UserRole[];
  requiresApproval: boolean;
  auditOnAccess: boolean;
  retentionDays: number;
}

// ── Token Claims (JWT payload) ────────────────────────────────────────────────

export interface TokenClaims {
  sub: string;              // userId
  email: string;
  name: string;
  roles: UserRole[];
  permissions: PermissionId[];
  sessionId: string;
  tenantId: string;         // owning tenant
  tenantName: string;       // display name for UI header
  iat?: number;
  exp?: number;
}

// ── Authorization ────────────────────────────────────────────────────────────

export interface EvaluationContext {
  resource?: string;
  resourceOwner?: string;
  resourceDepartment?: string;
  requestTime?: Date;
  [key: string]: unknown;
}

export interface AuthzDecision {
  allowed: boolean;
  reason: string;
  matchedPolicy?: string;
  permissionId: PermissionId;
  userId: string;
}
