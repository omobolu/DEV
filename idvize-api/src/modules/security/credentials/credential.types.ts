/**
 * Credential Types
 *
 * Defines the credential registry data models.
 * IDVIZE stores only vault references and metadata — not raw secret values.
 * Raw values flow through the VaultAdapter and are wrapped in SecretValue
 * to prevent leakage into logs or agent context.
 */

import { VaultOperatingMode, VaultProviderType } from '../vault/vault.types';

// ── Credential Classification ─────────────────────────────────────────────────

export type CredentialType =
  | 'api_key'
  | 'bearer_token'
  | 'password'
  | 'client_secret'
  | 'certificate'
  | 'service_account'
  | 'ssh_key'
  | 'connection_string'
  | 'oauth_token';

export type CredentialStatus =
  | 'pending_vault'         // registered, not yet vaulted
  | 'pending_approval'      // push mode: awaiting approval before vaulting
  | 'vaulted'               // vault reference registered, operational
  | 'active'                // active and verified reachable
  | 'expired'               // past expiry date
  | 'rotation_required'     // flagged by rotation monitor
  | 'revoked'               // explicitly revoked
  | 'error';                // vault reference invalid or unreachable

export type CredentialSensitivity = 'low' | 'medium' | 'high' | 'critical';

// ── Credential Record ─────────────────────────────────────────────────────────
//
// What IDVIZE stores:
//   ✓ vault provider, path, and reference id
//   ✓ credential type, metadata, expiry, rotation schedule
//   ✓ ownership, application linkage, and audit fields
//   ✗ raw secret values (stored in vault, not here)

export interface CredentialRecord {
  credentialId: string;             // e.g. "cred-<uuid>"
  name: string;                     // e.g. "Okta SSWS API Key — Production"
  description: string;
  credentialType: CredentialType;
  targetSystem: string;             // e.g. "Okta", "SailPoint IdentityNow"
  targetEnvironment: string;        // e.g. "prod", "uat", "dev"

  // ── Operating mode ────────────────────────────────────────────────────────
  operatingMode: VaultOperatingMode;

  // ── Vault reference (preferred storage — no raw value here) ───────────────
  vaultProvider?: VaultProviderType;
  vaultPath?: string;               // e.g. "secret/iam/okta/prod/api-key"
  vaultSecretName?: string;         // key within the vault secret object
  vaultReferenceId?: string;        // provider-specific ID (CyberArk account, KV secret ID)
  vaultVerifiedAt?: string;         // last time reference was confirmed valid

  // ── Status & lifecycle ────────────────────────────────────────────────────
  status: CredentialStatus;
  expiresAt?: string;               // ISO 8601
  rotationIntervalDays?: number;
  lastRotatedAt?: string;
  lastAccessedAt?: string;
  accessCount: number;
  rotationDue?: boolean;            // set by rotation monitor

  // ── Ownership & linkage ───────────────────────────────────────────────────
  ownerId: string;
  ownerName: string;
  teamId?: string;
  applicationId?: string;           // link to Application module (Module 1)

  // ── Classification ────────────────────────────────────────────────────────
  sensitivityLevel: CredentialSensitivity;
  tags: string[];

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Credential Request ────────────────────────────────────────────────────────

export type CredentialRequestType =
  | 'new_credential'      // register a new credential + vault it
  | 'rotate'              // rotate an existing credential
  | 'reveal'              // temporary reveal for emergency use
  | 'register_reference'  // engineer provides vault path after manual vaulting
  | 'revoke';             // decommission a credential

export type CredentialRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface CredentialRequest {
  requestId: string;
  credentialId?: string;            // links to existing record (if rotating/revealing)
  requestType: CredentialRequestType;
  requestedBy: string;
  requestedByName: string;
  targetSystem: string;
  credentialType: CredentialType;
  targetEnvironment: string;
  operatingMode: VaultOperatingMode;
  vaultProvider?: VaultProviderType;
  justification: string;
  status: CredentialRequestStatus;
  assignedTo?: string;              // userId of engineer who will vault the credential
  assignedToName?: string;
  workInstructions?: string;        // generated handoff instructions (Markdown)
  approvedBy?: string;
  approvedByName?: string;
  approverComment?: string;
  completedAt?: string;
  expiresAt: string;                // request expires after 72 hours if not actioned
  createdAt: string;
  updatedAt: string;
}

// ── Rotation Monitor Report ───────────────────────────────────────────────────

export interface RotationCheckResult {
  credentialId: string;
  credentialName: string;
  status: CredentialStatus;
  expiresAt?: string;
  daysUntilExpiry?: number;
  rotationDue: boolean;
  flaggedReason?: string;
}

export interface RotationMonitorReport {
  reportId: string;
  checkedAt: string;
  totalCredentials: number;
  expiringSoon: RotationCheckResult[];    // ≤ 30 days
  expired: RotationCheckResult[];
  rotationRequired: RotationCheckResult[];
  healthy: number;
}
