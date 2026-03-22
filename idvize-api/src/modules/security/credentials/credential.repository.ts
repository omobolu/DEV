/**
 * Credential Repository
 *
 * In-memory store for CredentialRecord objects (vault references + metadata).
 * No raw secret values are stored here.
 * Phase 2: replace with PostgreSQL.
 */

import { CredentialRecord, CredentialStatus, CredentialType } from './credential.types';

class CredentialRepository {
  private store = new Map<string, CredentialRecord>();

  save(record: CredentialRecord): CredentialRecord {
    this.store.set(record.credentialId, record);
    return record;
  }

  findById(credentialId: string): CredentialRecord | undefined {
    return this.store.get(credentialId);
  }

  findAll(): CredentialRecord[] {
    return Array.from(this.store.values())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  findByStatus(status: CredentialStatus): CredentialRecord[] {
    return this.findAll().filter(c => c.status === status);
  }

  findByOwner(ownerId: string): CredentialRecord[] {
    return this.findAll().filter(c => c.ownerId === ownerId);
  }

  findByApplication(applicationId: string): CredentialRecord[] {
    return this.findAll().filter(c => c.applicationId === applicationId);
  }

  findByTargetSystem(targetSystem: string): CredentialRecord[] {
    return this.findAll().filter(c =>
      c.targetSystem.toLowerCase().includes(targetSystem.toLowerCase())
    );
  }

  findExpiring(withinDays: number): CredentialRecord[] {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + withinDays);
    return this.findAll().filter(c => {
      if (!c.expiresAt) return false;
      return new Date(c.expiresAt) <= threshold && c.status !== 'revoked';
    });
  }

  delete(credentialId: string): boolean {
    return this.store.delete(credentialId);
  }

  count(): number {
    return this.store.size;
  }
}

export const credentialRepository = new CredentialRepository();
