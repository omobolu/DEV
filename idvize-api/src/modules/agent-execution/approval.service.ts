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
 */

import { v4 as uuidv4 } from 'uuid';
import { auditService } from '../security/audit/audit.service';
import type {
  ExecutionApproval,
  ExecutionPlan,
  ApprovalRole,
  BlastRadiusLevel,
} from './agent-execution.types';

const APPROVAL_EXPIRY_HOURS = 24;

class ExecutionApprovalService {
  private approvals = new Map<string, Map<string, ExecutionApproval>>(); // tenantId → approvalId → approval

  /**
   * Determine which approvals are required for a given plan.
   * Returns the approval records that must be resolved before execution.
   */
  generateRequiredApprovals(plan: ExecutionPlan): ExecutionApproval[] {
    const now = new Date();
    const requiredBy = new Date(now.getTime() + APPROVAL_EXPIRY_HOURS * 3600 * 1000).toISOString();
    const approvals: ExecutionApproval[] = [];

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

    // App owner must approve app-side configuration changes
    if (hasAppSideChanges) {
      approvals.push(this.createApproval(plan.sessionId, 'app_owner', requiredBy));
    }

    // IAM admin must approve identity platform changes
    if (hasEntraChanges || hasSailPointChanges || hasServiceNowChanges) {
      approvals.push(this.createApproval(plan.sessionId, 'iam_admin', requiredBy));
    }

    // Platform admin approval required for high/critical blast radius
    if (isHighBlastRadius) {
      approvals.push(this.createApproval(plan.sessionId, 'platform_admin', requiredBy));
    }

    return approvals;
  }

  /**
   * Store approvals for a session.
   */
  saveApprovals(tenantId: string, approvals: ExecutionApproval[]): void {
    if (!this.approvals.has(tenantId)) {
      this.approvals.set(tenantId, new Map());
    }
    const tenantApprovals = this.approvals.get(tenantId)!;
    for (const approval of approvals) {
      tenantApprovals.set(approval.approvalId, approval);
    }
  }

  /**
   * Resolve (approve or reject) an approval.
   */
  async resolve(
    tenantId: string,
    approvalId: string,
    sessionId: string,
    approverId: string,
    approverName: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ): Promise<ExecutionApproval> {
    const tenantApprovals = this.approvals.get(tenantId);
    if (!tenantApprovals) throw new Error('No approvals found for tenant');

    const approval = tenantApprovals.get(approvalId);
    if (!approval) throw new Error(`Approval ${approvalId} not found`);

    if (approval.sessionId !== sessionId) {
      throw new Error(`Approval ${approvalId} does not belong to session ${sessionId}`);
    }

    if (approval.status !== 'pending') {
      throw new Error(`Approval ${approvalId} is already ${approval.status}`);
    }

    // Check expiry
    if (new Date() > new Date(approval.requiredBy)) {
      approval.status = 'expired';
      tenantApprovals.set(approvalId, approval);
      throw new Error(`Approval ${approvalId} has expired`);
    }

    approval.approverId = approverId;
    approval.approverName = approverName;
    approval.status = decision;
    approval.comment = comment;
    approval.resolvedAt = new Date().toISOString();
    tenantApprovals.set(approvalId, approval);

    await auditService.log({
      tenantId,
      eventType: decision === 'approved' ? 'approval.granted' : 'approval.rejected',
      actorId: approverId,
      actorName: approverName,
      targetType: 'execution_plan',
      targetId: approval.sessionId,
      resource: 'agent_execution',
      outcome: 'success',
      metadata: {
        approvalId,
        sessionId: approval.sessionId,
        role: approval.role,
        decision,
        comment,
      },
    });

    return approval;
  }

  /**
   * Check if all required approvals for a session have been granted.
   */
  isFullyApproved(tenantId: string, sessionId: string): boolean {
    const tenantApprovals = this.approvals.get(tenantId);
    if (!tenantApprovals) return false;

    const sessionApprovals = Array.from(tenantApprovals.values())
      .filter(a => a.sessionId === sessionId);

    if (sessionApprovals.length === 0) return false;

    return sessionApprovals.every(a => a.status === 'approved');
  }

  /**
   * Check if any approval for a session was rejected.
   */
  isRejected(tenantId: string, sessionId: string): boolean {
    const tenantApprovals = this.approvals.get(tenantId);
    if (!tenantApprovals) return false;

    return Array.from(tenantApprovals.values())
      .filter(a => a.sessionId === sessionId)
      .some(a => a.status === 'rejected');
  }

  /**
   * Get all approvals for a session.
   */
  getSessionApprovals(tenantId: string, sessionId: string): ExecutionApproval[] {
    const tenantApprovals = this.approvals.get(tenantId);
    if (!tenantApprovals) return [];

    return Array.from(tenantApprovals.values())
      .filter(a => a.sessionId === sessionId);
  }

  /**
   * Expire stale approvals.
   */
  async expireStale(tenantId: string): Promise<number> {
    const tenantApprovals = this.approvals.get(tenantId);
    if (!tenantApprovals) return 0;

    const now = new Date();
    let expired = 0;

    for (const approval of tenantApprovals.values()) {
      if (approval.status === 'pending' && new Date(approval.requiredBy) < now) {
        approval.status = 'expired';
        tenantApprovals.set(approval.approvalId, approval);
        expired++;
      }
    }

    return expired;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private createApproval(sessionId: string, role: ApprovalRole, requiredBy: string): ExecutionApproval {
    return {
      approvalId: `eappr-${uuidv4().split('-')[0]}`,
      sessionId,
      role,
      status: 'pending',
      requiredBy,
      createdAt: new Date().toISOString(),
    };
  }
}

export const executionApprovalService = new ExecutionApprovalService();
