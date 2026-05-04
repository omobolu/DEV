/**
 * Execution Approval Service — Human approval gates for agent execution plans.
 *
 * Execution MUST NOT begin without explicit human approval.
 * Different roles approve different aspects:
 *   - app_owner: approves app-side changes
 *   - iam_admin: approves Entra/SailPoint/ServiceNow changes
 *   - platform_admin: approves high blast-radius plans
 *
 * All approval decisions are audit-logged.
 * Backed by PostgreSQL — fails closed when PG is unavailable.
 */

import { v4 as uuidv4 } from 'uuid';
import { auditService } from '../security/audit/audit.service';
import { tenantService } from '../tenant/tenant.service';
import * as repo from './agent-execution.repository';
import type {
  ExecutionApproval,
  ExecutionPlan,
  ApprovalRole,
} from './agent-execution.types';

const APPROVAL_EXPIRY_HOURS = 24;

/**
 * Maps approval roles to the RBAC roles that can fulfill them.
 * Only users with matching RBAC roles can resolve the corresponding approval.
 */
const ROLE_ELIGIBILITY: Record<ApprovalRole, string[]> = {
  app_owner: ['Manager', 'PlatformAdmin'],
  iam_admin: ['Manager', 'PlatformAdmin'],
  platform_admin: ['PlatformAdmin'],
  security_admin: ['Manager', 'PlatformAdmin'],
};

class ExecutionApprovalService {

  /**
   * Determine which approvals are required for a given plan.
   * Reads the tenant's remediation workflow settings to decide which approval
   * roles are enabled. Only generates approvals for roles the tenant requires.
   *
   * Tenant settings mapping:
   *   requireAppOwnerApproval  → app_owner approval
   *   requireIamManagerApproval → iam_admin approval
   *   platform_admin is always generated for high/critical blast-radius plans
   *     (not configurable — this is a safety control)
   *
   * If no approvals are required by settings AND none by blast-radius,
   * returns an empty array so the session can skip the approval gate.
   */
  async generateRequiredApprovals(tenantId: string, plan: ExecutionPlan): Promise<ExecutionApproval[]> {
    const now = new Date();
    const requiredBy = new Date(now.getTime() + APPROVAL_EXPIRY_HOURS * 3600 * 1000).toISOString();
    const approvals: ExecutionApproval[] = [];

    // Load tenant remediation settings (default to both required if not configured)
    const tenant = await tenantService.getTenant(tenantId);
    const remediationSettings = tenant?.settings?.remediation;
    const requireAppOwner = remediationSettings?.requireAppOwnerApproval ?? true;
    const requireIamManager = remediationSettings?.requireIamManagerApproval ?? true;

    const hasAppSideChanges = plan.steps.some(s =>
      s.targetSystem.systemType === 'app_connector',
    );
    const hasEntraChanges = plan.steps.some(s =>
      s.actionType.startsWith('entra.'),
    );
    const hasSailPointChanges = plan.steps.some(s =>
      s.actionType.startsWith('sailpoint.'),
    );
    const hasServiceNowChanges = plan.steps.some(s =>
      s.actionType.startsWith('servicenow.'),
    );
    const isHighBlastRadius = plan.blastRadius.level === 'high' || plan.blastRadius.level === 'critical';

    if (requireAppOwner && hasAppSideChanges) {
      approvals.push(this.createApproval(plan.sessionId, 'app_owner', requiredBy));
    }

    if (requireIamManager && (hasEntraChanges || hasSailPointChanges || hasServiceNowChanges)) {
      approvals.push(this.createApproval(plan.sessionId, 'iam_admin', requiredBy));
    }

    // platform_admin for high blast-radius is always required (safety control)
    if (isHighBlastRadius) {
      approvals.push(this.createApproval(plan.sessionId, 'platform_admin', requiredBy));
    }

    return approvals;
  }

  /**
   * Save approvals to PostgreSQL.
   */
  async saveApprovals(tenantId: string, approvals: ExecutionApproval[]): Promise<void> {
    await repo.saveApprovals(tenantId, approvals);
  }

  /**
   * Resolve (approve or reject) an approval.
   * Validates: session ownership, role eligibility, expiry.
   */
  async resolve(
    tenantId: string,
    approvalId: string,
    sessionId: string,
    approverId: string,
    approverName: string,
    approverRoles: string[],
    decision: 'approved' | 'rejected',
    comment?: string,
  ): Promise<ExecutionApproval> {
    const approval = await repo.getApproval(tenantId, approvalId);
    if (!approval) throw new Error(`Approval ${approvalId} not found`);

    if (approval.sessionId !== sessionId) {
      throw new Error(`Approval ${approvalId} does not belong to session ${sessionId}`);
    }

    if (approval.status !== 'pending') {
      throw new Error(`Approval ${approvalId} is already ${approval.status}`);
    }

    // Enforce role eligibility
    const eligible = ROLE_ELIGIBILITY[approval.role] ?? [];
    const hasEligibleRole = approverRoles.some(r => eligible.includes(r));
    if (!hasEligibleRole) {
      throw new Error(
        `User does not have a role eligible to resolve ${approval.role} approvals. ` +
        `Required one of: ${eligible.join(', ')}`,
      );
    }

    // Check expiry
    if (new Date() > new Date(approval.requiredBy)) {
      approval.status = 'expired';
      await repo.saveApproval(tenantId, approval);
      throw new Error(`Approval ${approvalId} has expired`);
    }

    approval.approverId = approverId;
    approval.approverName = approverName;
    approval.status = decision;
    approval.comment = comment;
    approval.resolvedAt = new Date().toISOString();
    await repo.saveApproval(tenantId, approval);

    await auditService.log({
      tenantId,
      eventType: decision === 'approved' ? 'approval.granted' : 'approval.rejected',
      actorId: approverId,
      actorName: approverName,
      targetType: 'execution_plan',
      targetId: sessionId,
      resource: 'agent_execution',
      outcome: 'success',
      metadata: {
        approvalId,
        sessionId,
        role: approval.role,
        decision,
        comment,
      },
    });

    return approval;
  }

  /**
   * Get all approvals for a session.
   */
  async getSessionApprovals(tenantId: string, sessionId: string): Promise<ExecutionApproval[]> {
    return repo.getSessionApprovals(tenantId, sessionId);
  }

  /**
   * Check if all required approvals for a session have been granted.
   */
  async isFullyApproved(tenantId: string, sessionId: string): Promise<boolean> {
    return repo.isFullyApproved(tenantId, sessionId);
  }

  /**
   * Check if any approval has been rejected.
   */
  async hasRejection(tenantId: string, sessionId: string): Promise<boolean> {
    const approvals = await repo.getSessionApprovals(tenantId, sessionId);
    return approvals.some(a => a.status === 'rejected');
  }

  /**
   * Check if any approval has expired — prevents sessions stuck in pending_approval.
   */
  async hasExpiredApprovals(tenantId: string, sessionId: string): Promise<boolean> {
    return repo.hasExpiredApprovals(tenantId, sessionId);
  }

  // ── Private ────────────────────────────────────────────────────────────

  private createApproval(sessionId: string, role: ApprovalRole, requiredBy: string): ExecutionApproval {
    return {
      approvalId: `apv-${uuidv4()}`,
      sessionId,
      role,
      status: 'pending',
      requiredBy,
      createdAt: new Date().toISOString(),
    };
  }
}

export const executionApprovalService = new ExecutionApprovalService();
