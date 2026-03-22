/**
 * Approval Service
 *
 * Manages approval request lifecycle for high-risk actions.
 * High-risk approvals require the approver to have `approval.grant.high_risk`
 * (Manager only). Standard approvals require `approval.grant.standard`.
 */

import { v4 as uuidv4 } from 'uuid';
import { ApprovalRequest, ApprovalRiskLevel, PermissionId } from '../security.types';
import { approvalRepository } from './approval.repository';
import { authzService } from '../authz/authz.service';
import { authRepository } from '../auth/auth.repository';
import { auditService } from '../audit/audit.service';

const EXPIRY_HOURS = 48;

class ApprovalService {

  requestApproval(input: {
    requesterId: string;
    targetUserId?: string;
    permissionId?: PermissionId;
    action: string;
    resource?: string;
    riskLevel: ApprovalRiskLevel;
    justification: string;
  }): ApprovalRequest {
    const requester = authRepository.findById(input.requesterId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + EXPIRY_HOURS * 3600 * 1000).toISOString();

    const request: ApprovalRequest = {
      requestId: `apr-${uuidv4().split('-')[0]}`,
      requesterId: input.requesterId,
      requesterName: requester?.displayName ?? input.requesterId,
      targetUserId: input.targetUserId,
      permissionId: input.permissionId,
      action: input.action,
      resource: input.resource,
      riskLevel: input.riskLevel,
      status: 'pending',
      justification: input.justification,
      expiresAt,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    approvalRepository.save(request);

    auditService.log({
      eventType: 'approval.requested',
      actorId: input.requesterId,
      actorName: requester?.displayName ?? input.requesterId,
      targetId: input.targetUserId,
      targetType: 'approval_request',
      resource: input.resource,
      outcome: 'success',
      metadata: { requestId: request.requestId, riskLevel: input.riskLevel, action: input.action },
    });

    console.log(`[ApprovalService] ${request.riskLevel.toUpperCase()} approval requested: ${request.requestId} — "${input.action}"`);
    return request;
  }

  resolve(
    requestId: string,
    approverId: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ): ApprovalRequest {
    const request = approvalRepository.findById(requestId);
    if (!request) throw new Error(`Approval request "${requestId}" not found`);
    if (request.status !== 'pending') throw new Error(`Request "${requestId}" is already ${request.status}`);

    // Enforce approver permission based on risk level
    const requiredPermission: PermissionId = request.riskLevel === 'high_risk'
      ? 'approval.grant.high_risk'
      : 'approval.grant.standard';

    const authzDecision = authzService.check(approverId, requiredPermission);
    if (!authzDecision.allowed) {
      throw new Error(`Approver lacks "${requiredPermission}": ${authzDecision.reason}`);
    }

    const approver = authRepository.findById(approverId);
    const now = new Date().toISOString();

    request.status = decision;
    request.approverId = approverId;
    request.approverName = approver?.displayName ?? approverId;
    request.approverComment = comment;
    request.resolvedAt = now;
    request.updatedAt = now;

    approvalRepository.save(request);

    auditService.log({
      eventType: decision === 'approved' ? 'approval.granted' : 'approval.rejected',
      actorId: approverId,
      actorName: approver?.displayName ?? approverId,
      targetId: request.requesterId,
      targetType: 'approval_request',
      permissionId: request.permissionId,
      resource: request.resource,
      outcome: 'success',
      metadata: { requestId, decision, comment },
    });

    return request;
  }

  listPending(): ApprovalRequest[] {
    return approvalRepository.findByStatus('pending');
  }

  listAll(filters: { status?: ApprovalRequest['status']; requesterId?: string } = {}): ApprovalRequest[] {
    let results = approvalRepository.findAll();
    if (filters.status) results = results.filter(r => r.status === filters.status);
    if (filters.requesterId) results = results.filter(r => r.requesterId === filters.requesterId);
    return results;
  }

  getRequest(requestId: string): ApprovalRequest | undefined {
    return approvalRepository.findById(requestId);
  }

  /**
   * Expire all pending requests past their expiresAt timestamp.
   * Call periodically (e.g. via a cron job or on-request).
   */
  expireStale(): number {
    const now = new Date().toISOString();
    const stale = approvalRepository.findByStatus('pending')
      .filter(r => r.expiresAt < now);

    for (const r of stale) {
      r.status = 'expired';
      r.updatedAt = now;
      approvalRepository.save(r);

      auditService.log({
        eventType: 'approval.expired',
        actorId: 'system',
        actorName: 'System',
        targetId: r.requesterId,
        targetType: 'approval_request',
        outcome: 'success',
        metadata: { requestId: r.requestId },
      });
    }

    return stale.length;
  }
}

export const approvalService = new ApprovalService();
