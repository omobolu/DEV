/**
 * IDVIZE Platform Credential & Vault Types
 * Part 8: Vault, Secrets, and Credential Governance
 */

export type CredentialType =
  | 'api_key'
  | 'bearer_token'
  | 'password'
  | 'client_secret'
  | 'certificate'
  | 'service_account'
  | 'ssh_key'

export type VaultProvider = 'cyberark' | 'azure_key_vault' | 'hashicorp_vault' | 'aws_secrets_manager'

export type CredentialMode = 'vault_retrieval' | 'vault_handoff' | 'vault_push'

export type CredentialRequestStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'expired'

export interface CredentialRecord {
  id: string
  name: string
  type: CredentialType
  appId?: string
  appName?: string
  vaultProvider?: VaultProvider
  vaultReference?: string
  mode: CredentialMode
  owner: string
  createdAt: string
  lastRotatedAt?: string
  expiresAt?: string
  rotationPolicy?: string
  metadata: Record<string, string>
  /** Raw secret is NEVER stored here — only vault references */
}

export interface CredentialRequest {
  id: string
  credentialId?: string
  requestedBy: string
  requestedAt: string
  reason: string
  appId?: string
  type: CredentialType
  status: CredentialRequestStatus
  reviewedBy?: string
  reviewedAt?: string
  reviewNotes?: string
}

export interface VaultAccessEvent {
  id: string
  credentialId: string
  action: 'retrieve' | 'rotate' | 'register' | 'revoke'
  actor: string
  timestamp: string
  vaultProvider: VaultProvider
  success: boolean
  errorMessage?: string
}

export interface VaultProviderConfig {
  id: string
  provider: VaultProvider
  name: string
  enabled: boolean
  endpoint?: string
  namespace?: string
  metadata: Record<string, string>
  /** Connection secrets are retrieved from environment, never stored here */
}
