/**
 * IDVIZE Vault Adapter Service
 * Credential governance with vault-aware, secret-minimizing design
 * Raw secrets are NEVER stored in IDVIZE — only vault references
 */

import type {
  CredentialRecord,
  CredentialRequest,
  VaultAccessEvent,
  VaultProviderConfig,
  VaultProvider,
} from '../../../types/credentials'
import { recordAudit } from '../../../types/audit'

/** In-memory stores */
const credentials: Map<string, CredentialRecord> = new Map()
const credentialRequests: Map<string, CredentialRequest> = new Map()
const vaultAccessLog: VaultAccessEvent[] = []
const vaultProviders: Map<string, VaultProviderConfig> = new Map()

// Seed default vault providers
const defaultProviders: VaultProviderConfig[] = [
  {
    id: 'vault-cyberark',
    provider: 'cyberark',
    name: 'CyberArk Privileged Access Cloud',
    enabled: true,
    endpoint: 'https://cyberark.example.com',
    metadata: { type: 'primary_pam' },
  },
  {
    id: 'vault-azure-kv',
    provider: 'azure_key_vault',
    name: 'Azure Key Vault',
    enabled: true,
    endpoint: 'https://idvize-kv.vault.azure.net',
    metadata: { subscription: 'production' },
  },
  {
    id: 'vault-hashicorp',
    provider: 'hashicorp_vault',
    name: 'HashiCorp Vault',
    enabled: false,
    endpoint: 'https://vault.example.com',
    namespace: 'iam',
    metadata: {},
  },
  {
    id: 'vault-aws-sm',
    provider: 'aws_secrets_manager',
    name: 'AWS Secrets Manager',
    enabled: false,
    metadata: { region: 'us-east-1' },
  },
]

for (const p of defaultProviders) {
  vaultProviders.set(p.id, p)
}

export class VaultService {
  /** Register a credential reference (NOT the raw secret) */
  registerCredential(record: Omit<CredentialRecord, 'id' | 'createdAt'>): CredentialRecord {
    const credential: CredentialRecord = {
      ...record,
      id: `cred-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    }

    credentials.set(credential.id, credential)

    recordAudit(
      'secret_access',
      { type: 'system', id: 'vault-service', name: 'VaultService' },
      'credential_registered',
      credential.id,
      'success',
      {
        name: credential.name,
        type: credential.type,
        mode: credential.mode,
        vaultProvider: credential.vaultProvider ?? 'none',
        // CRITICAL: Never log the actual secret value
      },
    )

    return credential
  }

  /** Create a credential request (for vault handoff or retrieval) */
  requestCredential(request: Omit<CredentialRequest, 'id' | 'requestedAt' | 'status'>): CredentialRequest {
    const credRequest: CredentialRequest = {
      ...request,
      id: `creq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    }

    credentialRequests.set(credRequest.id, credRequest)

    recordAudit(
      'secret_access',
      { type: 'user', id: request.requestedBy, name: request.requestedBy },
      'credential_requested',
      credRequest.id,
      'success',
      { type: request.type, reason: request.reason },
    )

    return credRequest
  }

  /** Approve a credential request */
  approveRequest(requestId: string, reviewerId: string, notes?: string): CredentialRequest | null {
    const request = credentialRequests.get(requestId)
    if (!request || request.status !== 'pending') return null

    request.status = 'approved'
    request.reviewedBy = reviewerId
    request.reviewedAt = new Date().toISOString()
    request.reviewNotes = notes

    recordAudit(
      'secret_access',
      { type: 'user', id: reviewerId, name: reviewerId },
      'credential_request_approved',
      requestId,
      'success',
    )

    return request
  }

  /** Reject a credential request */
  rejectRequest(requestId: string, reviewerId: string, notes?: string): CredentialRequest | null {
    const request = credentialRequests.get(requestId)
    if (!request || request.status !== 'pending') return null

    request.status = 'rejected'
    request.reviewedBy = reviewerId
    request.reviewedAt = new Date().toISOString()
    request.reviewNotes = notes

    recordAudit(
      'secret_access',
      { type: 'user', id: reviewerId, name: reviewerId },
      'credential_request_rejected',
      requestId,
      'success',
    )

    return request
  }

  /** Register a vault reference for a credential (vault handoff mode) */
  registerVaultReference(credentialId: string, vaultProvider: VaultProvider, vaultReference: string): CredentialRecord | null {
    const credential = credentials.get(credentialId)
    if (!credential) return null

    credential.vaultProvider = vaultProvider
    credential.vaultReference = vaultReference
    credential.mode = 'vault_retrieval'

    this.logVaultAccess(credentialId, 'register', 'vault-service', vaultProvider, true)

    recordAudit(
      'secret_access',
      { type: 'system', id: 'vault-service', name: 'VaultService' },
      'vault_reference_registered',
      credentialId,
      'success',
      { vaultProvider, hasReference: true },
    )

    return credential
  }

  /** Simulate credential rotation */
  rotateCredential(credentialId: string, actor: string): CredentialRecord | null {
    const credential = credentials.get(credentialId)
    if (!credential) return null

    credential.lastRotatedAt = new Date().toISOString()

    this.logVaultAccess(credentialId, 'rotate', actor, credential.vaultProvider ?? 'cyberark', true)

    recordAudit(
      'secret_access',
      { type: 'user', id: actor, name: actor },
      'credential_rotated',
      credentialId,
      'success',
      { vaultProvider: credential.vaultProvider },
    )

    return credential
  }

  /** Get all credential records (metadata only, never raw secrets) */
  getCredentials(): CredentialRecord[] {
    return Array.from(credentials.values())
  }

  /** Get credential by ID */
  getCredentialById(id: string): CredentialRecord | undefined {
    return credentials.get(id)
  }

  /** Get all credential requests */
  getRequests(): CredentialRequest[] {
    return Array.from(credentialRequests.values())
  }

  /** Get pending credential requests */
  getPendingRequests(): CredentialRequest[] {
    return Array.from(credentialRequests.values()).filter(r => r.status === 'pending')
  }

  /** Get vault providers */
  getProviders(): VaultProviderConfig[] {
    return Array.from(vaultProviders.values())
  }

  /** Get vault access log */
  getAccessLog(credentialId?: string): VaultAccessEvent[] {
    if (credentialId) {
      return vaultAccessLog.filter(e => e.credentialId === credentialId)
    }
    return [...vaultAccessLog]
  }

  private logVaultAccess(
    credentialId: string,
    action: VaultAccessEvent['action'],
    actor: string,
    vaultProvider: VaultProvider,
    success: boolean,
    errorMessage?: string,
  ): void {
    vaultAccessLog.push({
      id: `vae-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      credentialId,
      action,
      actor,
      timestamp: new Date().toISOString(),
      vaultProvider,
      success,
      errorMessage,
    })
  }
}

/** Singleton vault service */
export const vaultService = new VaultService()
