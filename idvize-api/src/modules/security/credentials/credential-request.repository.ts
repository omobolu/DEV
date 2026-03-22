/**
 * Credential Request Repository
 *
 * In-memory store for CredentialRequest workflow objects.
 * Phase 2: replace with PostgreSQL.
 */

import { CredentialRequest, CredentialRequestStatus } from './credential.types';

class CredentialRequestRepository {
  private store = new Map<string, CredentialRequest>();

  save(request: CredentialRequest): CredentialRequest {
    this.store.set(request.requestId, request);
    return request;
  }

  findById(requestId: string): CredentialRequest | undefined {
    return this.store.get(requestId);
  }

  findAll(): CredentialRequest[] {
    return Array.from(this.store.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findByStatus(status: CredentialRequestStatus): CredentialRequest[] {
    return this.findAll().filter(r => r.status === status);
  }

  findByRequester(requestedBy: string): CredentialRequest[] {
    return this.findAll().filter(r => r.requestedBy === requestedBy);
  }

  findByAssignee(assignedTo: string): CredentialRequest[] {
    return this.findAll().filter(r => r.assignedTo === assignedTo);
  }

  findByCredential(credentialId: string): CredentialRequest[] {
    return this.findAll().filter(r => r.credentialId === credentialId);
  }

  count(): number {
    return this.store.size;
  }
}

export const credentialRequestRepository = new CredentialRequestRepository();
