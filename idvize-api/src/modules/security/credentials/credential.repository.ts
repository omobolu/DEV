/**
 * Credential Repository
 *
 * In-memory store for CredentialRecord objects (vault references + metadata).
 * No raw secret values are stored here.
 * Phase 2: replace with PostgreSQL.
 */

import { CredentialRecord, CredentialStatus, CredentialType } from './credential.types';

class CredentialRepository {
  private store = new Map<string, Map<string, CredentialRecord>>();

  private bucket(tenantId: string): Map<string, CredentialRecord> {
    if (!this.store.has(tenantId)) this.store.set(tenantId, new Map());
    return this.store.get(tenantId)!;
  }

  save(tenantId: string, record: CredentialRecord): CredentialRecord {
    this.bucket(tenantId).set(record.credentialId, record);
    return record;
  }

  findById(tenantId: string, credentialId: string): CredentialRecord | undefined {
    return this.bucket(tenantId).get(credentialId);
  }

  findAll(tenantId: string): CredentialRecord[] {
    return Array.from(this.bucket(tenantId).values())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  findByStatus(tenantId: string, status: CredentialStatus): CredentialRecord[] {
    return this.findAll(tenantId).filter(c => c.status === status);
  }

  findByOwner(tenantId: string, ownerId: string): CredentialRecord[] {
    return this.findAll(tenantId).filter(c => c.ownerId === ownerId);
  }

  findByApplication(tenantId: string, applicationId: string): CredentialRecord[] {
    return this.findAll(tenantId).filter(c => c.applicationId === applicationId);
  }

  findByTargetSystem(tenantId: string, targetSystem: string): CredentialRecord[] {
    return this.findAll(tenantId).filter(c =>
      c.targetSystem.toLowerCase().includes(targetSystem.toLowerCase())
    );
  }

  findExpiring(tenantId: string, withinDays: number): CredentialRecord[] {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + withinDays);
    return this.findAll(tenantId).filter(c => {
      if (!c.expiresAt) return false;
      return new Date(c.expiresAt) <= threshold && c.status !== 'revoked';
    });
  }

  delete(tenantId: string, credentialId: string): boolean {
    return this.bucket(tenantId).delete(credentialId);
  }

  count(tenantId: string): number {
    return this.bucket(tenantId).size;
  }
}

export const credentialRepository = new CredentialRepository();
