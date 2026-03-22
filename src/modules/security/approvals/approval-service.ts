/**
 * IDVIZE Approval Service
 * Manages approval workflows for risky actions
 */

import type { ApprovalRequest } from '../../../types/security'
import { recordAudit } from '../../../types/audit'

/** In-memory approval store */
const approvals: Map<string, ApprovalRequest> = new Map()

export class ApprovalService {
  /** Create a new approval request */
  createRequest(request: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'status'>): ApprovalRequest {
    const approval: ApprovalRequest = {
      ...request,
      id: `appr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    }

    approvals.set(approval.id, approval)

    recordAudit(
      'approval',
      { type: 'user', id: request.requestedBy, name: request.requestedBy },
      'approval_requested',
      request.resource,
      'success',
      { approvalId: approval.id, action: request.action, riskLevel: request.riskLevel },
    )

    return approval
  }

  /** Approve a request */
  approve(approvalId: string, reviewerId: string, notes?: string): ApprovalRequest | null {
    const approval = approvals.get(approvalId)
    if (!approval || approval.status !== 'pending') return null

    approval.status = 'approved'
    approval.reviewedBy = reviewerId
    approval.reviewedAt = new Date().toISOString()
    approval.reviewNotes = notes

    recordAudit(
      'approval',
      { type: 'user', id: reviewerId, name: reviewerId },
      'approval_granted',
      approval.resource,
      'success',
      { approvalId, action: approval.action, riskLevel: approval.riskLevel },
    )

    return approval
  }

  /** Reject a request */
  reject(approvalId: string, reviewerId: string, notes?: string): ApprovalRequest | null {
    const approval = approvals.get(approvalId)
    if (!approval || approval.status !== 'pending') return null

    approval.status = 'rejected'
    approval.reviewedBy = reviewerId
    approval.reviewedAt = new Date().toISOString()
    approval.reviewNotes = notes

    recordAudit(
      'approval',
      { type: 'user', id: reviewerId, name: reviewerId },
      'approval_rejected',
      approval.resource,
      'success',
      { approvalId, action: approval.action },
    )

    return approval
  }

  /** Get pending approvals */
  getPending(): ApprovalRequest[] {
    return Array.from(approvals.values()).filter(a => a.status === 'pending')
  }

  /** Get all approvals */
  getAll(): ApprovalRequest[] {
    return Array.from(approvals.values())
  }

  /** Get approval by ID */
  getById(id: string): ApprovalRequest | undefined {
    return approvals.get(id)
  }

  /** Get approvals by requestor */
  getByRequestor(requestedBy: string): ApprovalRequest[] {
    return Array.from(approvals.values()).filter(a => a.requestedBy === requestedBy)
  }
}

/** Singleton approval service */
export const approvalService = new ApprovalService()
