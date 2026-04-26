/**
 * Credential Request Repository
 *
 * In-memory store for CredentialRequest workflow objects.
 * Phase 2: replace with PostgreSQL.
 */

import { CredentialRequest, CredentialRequestStatus } from './credential.types';

class CredentialRequestRepository {
  private store = new Map<string, Map<string, CredentialRequest>>();

  private bucket(tenantId: string): Map<string, CredentialRequest> {
    if (!this.store.has(tenantId)) this.store.set(tenantId, new Map());
    return this.store.get(tenantId)!;
  }

  save(tenantId: string, request: CredentialRequest): CredentialRequest {
    this.bucket(tenantId).set(request.requestId, request);
    return request;
  }

  findById(tenantId: string, requestId: string): CredentialRequest | undefined {
    return this.bucket(tenantId).get(requestId);
  }

  findAll(tenantId: string): CredentialRequest[] {
    return Array.from(this.bucket(tenantId).values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findByStatus(tenantId: string, status: CredentialRequestStatus): CredentialRequest[] {
    return this.findAll(tenantId).filter(r => r.status === status);
  }

  findByRequester(tenantId: string, requestedBy: string): CredentialRequest[] {
    return this.findAll(tenantId).filter(r => r.requestedBy === requestedBy);
  }

  findByAssignee(tenantId: string, assignedTo: string): CredentialRequest[] {
    return this.findAll(tenantId).filter(r => r.assignedTo === assignedTo);
  }

  findByCredential(tenantId: string, credentialId: string): CredentialRequest[] {
    return this.findAll(tenantId).filter(r => r.credentialId === credentialId);
  }

  count(tenantId: string): number {
    return this.bucket(tenantId).size;
  }
}

export const credentialRequestRepository = new CredentialRequestRepository();
