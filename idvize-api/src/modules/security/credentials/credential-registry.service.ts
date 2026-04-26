/**
 * Credential Registry Service
 *
 * Manages the lifecycle of CredentialRecord objects.
 * IDVIZE stores only vault references and metadata — not raw secret values.
 *
 * On register: creates a CredentialRecord in pending_vault state.
 * On register-reference: updates the record with the vault path/id, moves to 'vaulted'.
 * On retrieve: routes through VaultAdapterService (never surfaces raw value at this layer).
 * On rotate: marks rotation_required and triggers workflow.
 */

import { v4 as uuidv4 } from 'uuid';
import { CredentialRecord, CredentialStatus, CredentialSensitivity } from './credential.types';
import { VaultProviderType, VaultOperatingMode } from '../vault/vault.types';
import { credentialRepository } from './credential.repository';
import { vaultAdapterService } from '../vault/vault.adapter.service';
import { auditService } from '../audit/audit.service';
import { authRepository } from '../auth/auth.repository';

export interface RegisterCredentialInput {
  name: string;
  description: string;
  credentialType: CredentialRecord['credentialType'];
  targetSystem: string;
  targetEnvironment: string;
  operatingMode: VaultOperatingMode;
  vaultProvider?: VaultProviderType;
  expiresAt?: string;
  rotationIntervalDays?: number;
  ownerId: string;
  teamId?: string;
  applicationId?: string;
  sensitivityLevel?: CredentialSensitivity;
  tags?: string[];
}

export interface RegisterReferenceInput {
  vaultPath: string;
  vaultSecretName: string;
  vaultProvider: VaultProviderType;
  vaultReferenceId?: string;
}

class CredentialRegistryService {

  // ── Register ──────────────────────────────────────────────────────────────

  register(tenantId: string, input: RegisterCredentialInput, actorId: string): CredentialRecord {
    const owner = authRepository.findById(tenantId, input.ownerId);
    const now = new Date().toISOString();

    const record: CredentialRecord = {
      credentialId: `cred-${uuidv4().split('-')[0]}`,
      name: input.name,
      description: input.description,
      credentialType: input.credentialType,
      targetSystem: input.targetSystem,
      targetEnvironment: input.targetEnvironment,
      operatingMode: input.operatingMode,
      vaultProvider: input.vaultProvider ?? (input.operatingMode === 'retrieval' ? vaultAdapterService.getDefaultProvider() : undefined),
      status: 'pending_vault',
      expiresAt: input.expiresAt,
      rotationIntervalDays: input.rotationIntervalDays,
      accessCount: 0,
      ownerId: input.ownerId,
      ownerName: owner?.displayName ?? input.ownerId,
      teamId: input.teamId,
      applicationId: input.applicationId,
      sensitivityLevel: input.sensitivityLevel ?? 'high',
      tags: input.tags ?? [],
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    };

    credentialRepository.save(tenantId, record);

    auditService.log({
      tenantId,
      eventType: 'user.created',
      actorId,
      actorName: owner?.displayName ?? actorId,
      targetId: record.credentialId,
      targetType: 'credential',
      outcome: 'success',
      metadata: {
        credentialName: record.name,
        targetSystem: record.targetSystem,
        operatingMode: record.operatingMode,
        credentialType: record.credentialType,
      },
    });

    console.log(`[CredentialRegistry] Registered: ${record.name} (${record.credentialId}) | mode=${record.operatingMode} | status=${record.status}`);
    return record;
  }

  // ── Register Vault Reference (Handoff completion) ─────────────────────────

  async registerReference(
    tenantId: string,
    credentialId: string,
    input: RegisterReferenceInput,
    actorId: string,
  ): Promise<CredentialRecord> {
    const record = credentialRepository.findById(tenantId, credentialId);
    if (!record) throw Object.assign(new Error(`Credential "${credentialId}" not found`), { statusCode: 404 });

    // Validate the reference is reachable before accepting it
    const validation = await vaultAdapterService.validateReference(
      tenantId,
      input.vaultProvider,
      input.vaultPath,
      input.vaultSecretName,
      credentialId,
      record.name,
    );

    const now = new Date().toISOString();
    record.vaultProvider = input.vaultProvider;
    record.vaultPath = input.vaultPath;
    record.vaultSecretName = input.vaultSecretName;
    record.vaultReferenceId = input.vaultReferenceId;
    record.vaultVerifiedAt = validation.valid ? now : undefined;
    record.status = validation.valid ? 'vaulted' : 'error';
    record.updatedAt = now;

    credentialRepository.save(tenantId, record);

    vaultAdapterService.logEvent(tenantId, {
      credentialId,
      credentialName: record.name,
      eventType: 'register_reference',
      actorId,
      actorName: authRepository.findById(tenantId, actorId)?.displayName ?? actorId,
      vaultProvider: input.vaultProvider,
      vaultPath: input.vaultPath,
      outcome: validation.valid ? 'success' : 'failure',
      reason: validation.error ?? (validation.valid ? undefined : 'Reference validation failed'),
      metadata: { secretName: input.vaultSecretName, status: record.status },
    });

    console.log(`[CredentialRegistry] Reference registered: ${record.name} → ${input.vaultPath} | valid=${validation.valid}`);
    return record;
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  findById(tenantId: string, credentialId: string): CredentialRecord | undefined {
    return credentialRepository.findById(tenantId, credentialId);
  }

  listAll(tenantId: string, filters: {
    status?: CredentialStatus;
    targetSystem?: string;
    ownerId?: string;
    applicationId?: string;
  } = {}): CredentialRecord[] {
    let results = credentialRepository.findAll(tenantId);
    if (filters.status) results = results.filter(c => c.status === filters.status);
    if (filters.targetSystem) results = credentialRepository.findByTargetSystem(tenantId, filters.targetSystem);
    if (filters.ownerId) results = results.filter(c => c.ownerId === filters.ownerId);
    if (filters.applicationId) results = results.filter(c => c.applicationId === filters.applicationId);
    return results;
  }

  // ── Retrieve (runtime — vault retrieval mode only) ────────────────────────

  async retrieve(tenantId: string, credentialId: string, actorId: string) {
    const record = credentialRepository.findById(tenantId, credentialId);
    if (!record) throw Object.assign(new Error(`Credential "${credentialId}" not found`), { statusCode: 404 });
    if (record.operatingMode !== 'retrieval') {
      throw Object.assign(new Error(`Credential "${record.name}" is in "${record.operatingMode}" mode — runtime retrieval not supported`), { statusCode: 400 });
    }
    if (!record.vaultPath || !record.vaultProvider || !record.vaultSecretName) {
      throw Object.assign(new Error(`Credential "${record.name}" has no vault reference — register a reference first`), { statusCode: 400 });
    }

    const actor = authRepository.findById(tenantId, actorId);
    const result = await vaultAdapterService.retrieve(
      tenantId,
      record.vaultProvider,
      record.vaultPath,
      record.vaultSecretName,
      actorId,
      actor?.displayName ?? actorId,
      credentialId,
      record.name,
    );

    if (result.success) {
      record.lastAccessedAt = new Date().toISOString();
      record.accessCount += 1;
      credentialRepository.save(tenantId, record);
    }

    return result;
  }

  // ── Revoke ────────────────────────────────────────────────────────────────

  revoke(tenantId: string, credentialId: string, actorId: string, reason?: string): CredentialRecord {
    const record = credentialRepository.findById(tenantId, credentialId);
    if (!record) throw Object.assign(new Error(`Credential "${credentialId}" not found`), { statusCode: 404 });

    record.status = 'revoked';
    record.updatedAt = new Date().toISOString();
    credentialRepository.save(tenantId, record);

    const actor = authRepository.findById(tenantId, actorId);
    auditService.log({
      tenantId,
      eventType: 'user.updated',
      actorId,
      actorName: actor?.displayName ?? actorId,
      targetId: credentialId,
      targetType: 'credential',
      outcome: 'success',
      reason,
      metadata: { action: 'revoke', credentialName: record.name },
    });

    return record;
  }

  count(tenantId: string): number {
    return credentialRepository.count(tenantId);
  }
}

export const credentialRegistryService = new CredentialRegistryService();
