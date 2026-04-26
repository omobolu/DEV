/**
 * Approval Repository
 *
 * In-memory store for approval requests.
 * Phase 2: replace with PostgreSQL.
 */

import { ApprovalRequest, ApprovalStatus } from '../security.types';

class ApprovalRepository {
  private store = new Map<string, Map<string, ApprovalRequest>>();

  private bucket(tenantId: string): Map<string, ApprovalRequest> {
    if (!this.store.has(tenantId)) this.store.set(tenantId, new Map());
    return this.store.get(tenantId)!;
  }

  save(tenantId: string, request: ApprovalRequest): ApprovalRequest {
    this.bucket(tenantId).set(request.requestId, request);
    return request;
  }

  findById(tenantId: string, requestId: string): ApprovalRequest | undefined {
    return this.bucket(tenantId).get(requestId);
  }

  findAll(tenantId: string): ApprovalRequest[] {
    return Array.from(this.bucket(tenantId).values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findByStatus(tenantId: string, status: ApprovalStatus): ApprovalRequest[] {
    return this.findAll(tenantId).filter(r => r.status === status);
  }

  findByRequester(tenantId: string, requesterId: string): ApprovalRequest[] {
    return this.findAll(tenantId).filter(r => r.requesterId === requesterId);
  }

  findPendingForApprover(tenantId: string): ApprovalRequest[] {
    return this.findAll(tenantId).filter(r => r.status === 'pending');
  }

  count(tenantId: string): number {
    return this.bucket(tenantId).size;
  }
}

export const approvalRepository = new ApprovalRepository();
