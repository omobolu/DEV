/**
 * Approval Repository
 *
 * In-memory store for approval requests.
 * Phase 2: replace with PostgreSQL.
 */

import { ApprovalRequest, ApprovalStatus } from '../security.types';

class ApprovalRepository {
  private store = new Map<string, ApprovalRequest>();

  save(request: ApprovalRequest): ApprovalRequest {
    this.store.set(request.requestId, request);
    return request;
  }

  findById(requestId: string): ApprovalRequest | undefined {
    return this.store.get(requestId);
  }

  findAll(): ApprovalRequest[] {
    return Array.from(this.store.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findByStatus(status: ApprovalStatus): ApprovalRequest[] {
    return this.findAll().filter(r => r.status === status);
  }

  findByRequester(requesterId: string): ApprovalRequest[] {
    return this.findAll().filter(r => r.requesterId === requesterId);
  }

  findPendingForApprover(): ApprovalRequest[] {
    return this.findAll().filter(r => r.status === 'pending');
  }

  count(): number {
    return this.store.size;
  }
}

export const approvalRepository = new ApprovalRepository();
