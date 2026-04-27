/**
 * RBAC Permission Matrix — Single Source of Truth
 *
 * Defines which permissions each role is granted.
 * Deny-by-default: any permission not listed here is implicitly denied.
 *
 * Role intent:
 *  Manager        — executive, cost, vendor, and operational views (incl. salary detail)
 *  Architect      — architecture, controls, technical views (NO salary detail)
 *  BusinessAnalyst— intake, documents, process views (NO salary, NO secrets)
 *  Engineer       — tasks, builds, technical docs (NO cost module, NO salary)
 *  Developer      — technical implementation, APIs, assigned work (NO cost, NO salary)
 */

import { Permission, PermissionId, Role, UserRole } from '../security.types';

const now = new Date().toISOString();

// ── Permission Catalogue ──────────────────────────────────────────────────────

export const PERMISSION_CATALOGUE: Permission[] = [
  // Cost
  { permissionId: 'cost.view.summary',        module: 'cost',         action: 'view.summary',        description: 'View cost dashboard totals and program-level breakdown', riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'cost.view.salary_detail',  module: 'cost',         action: 'view.salary_detail',  description: 'View individual salary and compensation data',            riskLevel: 'high',   requiresApproval: true,  dataClassification: 'restricted' },
  { permissionId: 'cost.view.vendor_analysis',module: 'cost',         action: 'view.vendor_analysis',description: 'View vendor impact scores and detailed vendor analysis',   riskLevel: 'medium', requiresApproval: false, dataClassification: 'confidential' },
  { permissionId: 'cost.view.optimization',   module: 'cost',         action: 'view.optimization',   description: 'View cost optimization recommendations',                   riskLevel: 'medium', requiresApproval: false },
  // Applications
  { permissionId: 'applications.view.all',    module: 'applications', action: 'view.all',            description: 'View all applications in the registry',                   riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'applications.view.assigned',module:'applications', action: 'view.assigned',       description: 'View only applications assigned to the user',              riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'applications.manage',      module: 'applications', action: 'manage',              description: 'Create and update application records',                   riskLevel: 'medium', requiresApproval: false },
  // Controls
  { permissionId: 'controls.view',            module: 'controls',     action: 'view',                description: 'View control evaluations and posture reports',             riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'controls.evaluate',        module: 'controls',     action: 'evaluate',            description: 'Run control evaluation against applications',              riskLevel: 'medium', requiresApproval: false },
  // Build
  { permissionId: 'build.view',               module: 'build',        action: 'view',                description: 'View build jobs and their status',                         riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'build.execute.guided',     module: 'build',        action: 'execute.guided',      description: 'Start and advance guided build workflows',                 riskLevel: 'medium', requiresApproval: false },
  { permissionId: 'build.execute.automated',  module: 'build',        action: 'execute.automated',   description: 'Trigger automated end-to-end build execution',             riskLevel: 'high',   requiresApproval: false },
  // Integrations
  { permissionId: 'integrations.view',        module: 'integrations', action: 'view',                description: 'View integration status and connector health',              riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'integrations.manage',      module: 'integrations', action: 'manage',              description: 'Configure integrations and trigger correlation',           riskLevel: 'high',   requiresApproval: false },
  // Tasks
  { permissionId: 'tasks.view.assigned',      module: 'tasks',        action: 'view.assigned',       description: 'View tasks assigned to the current user',                  riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'tasks.view.all',           module: 'tasks',        action: 'view.all',            description: 'View all tasks across the platform',                       riskLevel: 'low',    requiresApproval: false },
  // Documents
  { permissionId: 'document.view',            module: 'documents',    action: 'view',                description: 'View documents and knowledge base',                        riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'document.review',          module: 'documents',    action: 'review',              description: 'Review and comment on documents',                          riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'document.publish',         module: 'documents',    action: 'publish',             description: 'Publish and approve documents',                            riskLevel: 'medium', requiresApproval: false },
  // Approvals
  { permissionId: 'approval.request',         module: 'approvals',    action: 'request',             description: 'Submit an approval request',                               riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'approval.grant.standard',  module: 'approvals',    action: 'grant.standard',      description: 'Approve standard-risk requests',                           riskLevel: 'medium', requiresApproval: false },
  { permissionId: 'approval.grant.high_risk', module: 'approvals',    action: 'grant.high_risk',     description: 'Approve high-risk requests (Manager only)',                riskLevel: 'high',   requiresApproval: false },
  // Security
  { permissionId: 'security.view.audit',      module: 'security',     action: 'view.audit',          description: 'View security audit event log',                            riskLevel: 'medium', requiresApproval: false },
  { permissionId: 'security.manage.access',   module: 'security',     action: 'manage.access',       description: 'Manage users, roles, and permissions',                     riskLevel: 'high',   requiresApproval: true },
  { permissionId: 'security.manage.scim',     module: 'security',     action: 'manage.scim',         description: 'Manage SCIM provisioning configuration',                   riskLevel: 'high',   requiresApproval: false },
  // Vendors
  { permissionId: 'vendors.view',             module: 'vendors',      action: 'view',                description: 'View vendor list and basic details',                       riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'vendors.manage',           module: 'vendors',      action: 'manage',              description: 'Create and update vendor records',                         riskLevel: 'medium', requiresApproval: false },
  // Secrets & Vault
  { permissionId: 'secrets.request',          module: 'secrets',      action: 'request',             description: 'Submit a credential vaulting or access request',           riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'secrets.reference',        module: 'secrets',      action: 'reference',           description: 'Register and verify vault references (handoff completion)', riskLevel: 'medium', requiresApproval: false },
  { permissionId: 'secrets.view.metadata',    module: 'secrets',      action: 'view.metadata',       description: 'View credential metadata (no raw values exposed)',          riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'secrets.reveal',           module: 'secrets',      action: 'reveal',              description: 'Reveal or retrieve the raw secret value from vault',        riskLevel: 'high',   requiresApproval: true,  dataClassification: 'restricted' },
  { permissionId: 'secrets.rotate',           module: 'secrets',      action: 'rotate',              description: 'Trigger credential rotation workflow',                     riskLevel: 'medium', requiresApproval: false },
  { permissionId: 'secrets.approve',          module: 'secrets',      action: 'approve',             description: 'Approve or reject credential requests and revocations',    riskLevel: 'high',   requiresApproval: false },
  { permissionId: 'secrets.manage.provider',  module: 'secrets',      action: 'manage.provider',     description: 'Configure vault provider connections and settings',         riskLevel: 'high',   requiresApproval: true },
  // Tenant management
  { permissionId: 'tenants.manage',           module: 'tenants',      action: 'manage',              description: 'Create, list, and manage tenant organizations (PlatformAdmin only)', riskLevel: 'high', requiresApproval: true },
  // Risk Engine
  { permissionId: 'risks.view',              module: 'risks',        action: 'view',                description: 'View IAM risk assessments across applications',                    riskLevel: 'low',  requiresApproval: false },
  // Agents
  { permissionId: 'agents.invoke',           module: 'agents',       action: 'invoke',              description: 'Invoke IAM control agents for guidance and remediation',           riskLevel: 'low',  requiresApproval: false },
  // Email
  { permissionId: 'email.configure',         module: 'email',        action: 'configure',           description: 'View and update email SMTP configuration',                         riskLevel: 'high', requiresApproval: false },
  { permissionId: 'email.send',              module: 'email',        action: 'send',                description: 'Send test emails and agent notification emails',                   riskLevel: 'medium', requiresApproval: false },
  // Agent Execution
  { permissionId: 'agents.use',              module: 'agents',       action: 'use',                 description: 'View agent capabilities, sessions, and evidence',                  riskLevel: 'low',    requiresApproval: false },
  { permissionId: 'agents.plan',             module: 'agents',       action: 'plan',                description: 'Request agent to generate an execution plan',                      riskLevel: 'medium', requiresApproval: false },
  { permissionId: 'agents.execute.request',  module: 'agents',       action: 'execute.request',     description: 'Request execution of an approved plan',                            riskLevel: 'high',   requiresApproval: false },
  { permissionId: 'agents.execute.approve',  module: 'agents',       action: 'execute.approve',     description: 'Approve or reject execution plans',                                riskLevel: 'high',   requiresApproval: false },
  { permissionId: 'agents.execute.sso',      module: 'agents',       action: 'execute.sso',         description: 'Execute SSO-related tool actions (Entra, SAML, OIDC)',             riskLevel: 'high',   requiresApproval: true },
  { permissionId: 'agents.execute.iga',      module: 'agents',       action: 'execute.iga',         description: 'Execute IGA-related tool actions (SailPoint)',                      riskLevel: 'high',   requiresApproval: true },
  { permissionId: 'agents.execute.servicenow', module: 'agents',     action: 'execute.servicenow',  description: 'Execute ServiceNow tool actions',                                  riskLevel: 'high',   requiresApproval: true },
  { permissionId: 'agents.admin',            module: 'agents',       action: 'admin',               description: 'Full agent administration including adapter configuration',         riskLevel: 'high',   requiresApproval: true },
];

// ── Role → Permission Matrix ───────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, PermissionId[]> = {
  PlatformAdmin: [
    // All Manager permissions + tenant management. This is a super-admin role
    // for the SaaS platform operator, NOT a per-tenant role.
    'cost.view.summary', 'cost.view.salary_detail', 'cost.view.vendor_analysis', 'cost.view.optimization',
    'applications.view.all', 'applications.view.assigned', 'applications.manage',
    'controls.view', 'controls.evaluate',
    'build.view', 'build.execute.guided', 'build.execute.automated',
    'integrations.view', 'integrations.manage',
    'tasks.view.assigned', 'tasks.view.all',
    'document.view', 'document.review', 'document.publish',
    'approval.request', 'approval.grant.standard', 'approval.grant.high_risk',
    'security.view.audit', 'security.manage.access', 'security.manage.scim',
    'vendors.view', 'vendors.manage',
    'secrets.request', 'secrets.reference', 'secrets.view.metadata', 'secrets.reveal', 'secrets.rotate', 'secrets.approve', 'secrets.manage.provider',
    'tenants.manage',
    'risks.view',
    'agents.invoke',
    'email.configure', 'email.send',
    'agents.use', 'agents.plan', 'agents.execute.request', 'agents.execute.approve', 'agents.execute.sso', 'agents.execute.iga', 'agents.execute.servicenow', 'agents.admin',
  ],
  Manager: [
    'cost.view.summary', 'cost.view.salary_detail', 'cost.view.vendor_analysis', 'cost.view.optimization',
    'applications.view.all', 'applications.view.assigned', 'applications.manage',
    'controls.view', 'controls.evaluate',
    'build.view', 'build.execute.guided', 'build.execute.automated',
    'integrations.view', 'integrations.manage',
    'tasks.view.assigned', 'tasks.view.all',
    'document.view', 'document.review', 'document.publish',
    'approval.request', 'approval.grant.standard', 'approval.grant.high_risk',
    'security.view.audit', 'security.manage.access', 'security.manage.scim',
    'vendors.view', 'vendors.manage',
    'secrets.request', 'secrets.reference', 'secrets.view.metadata', 'secrets.reveal', 'secrets.rotate', 'secrets.approve', 'secrets.manage.provider',
    'risks.view',
    'agents.invoke',
    'email.configure', 'email.send',
    'agents.use', 'agents.plan', 'agents.execute.request', 'agents.execute.approve', 'agents.execute.sso', 'agents.execute.iga', 'agents.execute.servicenow', 'agents.admin',
  ],
  Architect: [
    // NO: cost.view.salary_detail, approval.grant.high_risk, security.manage.access/scim, secrets.reveal, secrets.approve, secrets.manage.provider
    'cost.view.summary', 'cost.view.vendor_analysis', 'cost.view.optimization',
    'applications.view.all', 'applications.view.assigned', 'applications.manage',
    'controls.view', 'controls.evaluate',
    'build.view', 'build.execute.guided', 'build.execute.automated',
    'integrations.view', 'integrations.manage',
    'tasks.view.assigned', 'tasks.view.all',
    'document.view', 'document.review', 'document.publish',
    'approval.request', 'approval.grant.standard',
    'security.view.audit',
    'vendors.view', 'vendors.manage',
    'secrets.request', 'secrets.reference', 'secrets.view.metadata', 'secrets.rotate',
    'risks.view',
    'agents.invoke',
    'email.configure', 'email.send',
    'agents.use', 'agents.plan', 'agents.execute.request',
  ],
  BusinessAnalyst: [
    // NO: cost.view.salary_detail, controls.evaluate, build.execute.*, integrations.manage, approval.grant.*, secrets.reference, secrets.reveal, secrets.rotate, secrets.approve
    'cost.view.summary', 'cost.view.vendor_analysis',
    'applications.view.all', 'applications.view.assigned',
    'controls.view',
    'build.view',
    'integrations.view',
    'tasks.view.assigned', 'tasks.view.all',
    'document.view', 'document.review', 'document.publish',
    'approval.request',
    'vendors.view',
    'secrets.request', 'secrets.view.metadata',
    'risks.view',
    'agents.invoke',
    'email.send',
    'agents.use',
  ],
  Engineer: [
    // NO: cost module, salary data, tasks.view.all, document.publish, approval.grant.*, security.manage.*, secrets.reveal, secrets.approve, secrets.manage.provider
    'applications.view.assigned',
    'controls.view', 'controls.evaluate',
    'build.view', 'build.execute.guided',
    'integrations.view', 'integrations.manage',
    'tasks.view.assigned',
    'document.view',
    'approval.request',
    'secrets.request', 'secrets.reference', 'secrets.view.metadata', 'secrets.rotate',
    'risks.view',
    'agents.invoke',
    'email.send',
    'agents.use', 'agents.plan',
  ],
  Developer: [
    // NO: cost module, salary data, tasks.view.all, document.review/publish, approval.grant.*, security.*, integrations.manage, secrets.*reference/reveal/rotate/approve/manage
    'applications.view.assigned',
    'build.view', 'build.execute.guided',
    'integrations.view',
    'tasks.view.assigned',
    'document.view',
    'approval.request',
    'secrets.request',
    'risks.view',
    'agents.invoke',
    'agents.use',
  ],
};

// ── System Role Records ───────────────────────────────────────────────────────

export const SYSTEM_ROLES: Role[] = (Object.keys(ROLE_PERMISSIONS) as UserRole[]).map(roleName => ({
  roleId: `role-${roleName.toLowerCase()}`,
  name: roleName,
  displayName: roleName === 'BusinessAnalyst' ? 'Business Analyst' : roleName === 'PlatformAdmin' ? 'Platform Admin' : roleName,
  description: getRoleDescription(roleName),
  permissions: ROLE_PERMISSIONS[roleName],
  isSystemRole: true,
  createdAt: now,
  updatedAt: now,
}));

function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    PlatformAdmin:   'SaaS platform super-admin. All Manager permissions plus tenant/organization management.',
    Manager:         'Executive, cost, vendor, and full operational visibility. Approves high-risk actions.',
    Architect:       'Architecture, controls, technical views, and design authority. No salary detail.',
    BusinessAnalyst: 'Intake, tickets, documents, and process views. No salary or secrets access.',
    Engineer:        'Assigned tasks, build execution, integrations, and technical docs. No cost data.',
    Developer:       'Technical implementation, APIs, build work, and assigned tasks. No cost or executive views.',
  };
  return descriptions[role];
}

/**
 * Resolve effective permissions for a set of roles (union, deduplicated).
 */
export function resolvePermissions(roles: UserRole[]): PermissionId[] {
  const set = new Set<PermissionId>();
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role] ?? [];
    perms.forEach(p => set.add(p));
  }
  return Array.from(set);
}

/**
 * Check if a given role has a specific permission.
 */
export function roleHasPermission(role: UserRole, permission: PermissionId): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}
