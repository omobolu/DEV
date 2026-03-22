/**
 * Vault Types
 *
 * Defines the vault provider abstraction, operating modes, and the
 * SecretValue safe-wrapper class that prevents raw secrets from leaking
 * into logs, serialized output, or agent context.
 *
 * AI/Agent safety rule enforced here:
 *   - SecretValue.toString() and toJSON() always return '[REDACTED]'
 *   - Raw value is only accessible via the .use() callback pattern
 *   - Raw values must never appear in audit records, logs, or memory
 */

// ── Provider Types ────────────────────────────────────────────────────────────

export type VaultProviderType =
  | 'cyberark'
  | 'azure_keyvault'
  | 'hashicorp'
  | 'aws_secretsmanager'
  | 'mock';

export type VaultCapability =
  | 'retrieve'      // can pull secrets from this vault
  | 'push'          // can write secrets into this vault
  | 'rotate'        // can rotate secrets within this vault
  | 'list'          // can enumerate paths
  | 'validate';     // can confirm a reference is valid without reading it

export type VaultProviderStatus = 'healthy' | 'degraded' | 'unreachable' | 'unconfigured' | 'mock';

// ── Operating Modes ───────────────────────────────────────────────────────────

export type VaultOperatingMode =
  | 'retrieval'   // IDVIZE retrieves at runtime (vault must be configured and reachable)
  | 'handoff'     // IDVIZE generates work instructions; human vaults the credential
  | 'push';       // IDVIZE pushes credential into vault after approval (future)

// ── Vault Provider Config ─────────────────────────────────────────────────────

export interface VaultProviderConfig {
  providerId: string;
  providerType: VaultProviderType;
  displayName: string;
  status: VaultProviderStatus;
  baseUrl?: string;               // resolved from env — never stored
  authMethod?: string;            // e.g. 'app-role', 'managed-identity', 'access-key'
  capabilities: VaultCapability[];
  isDefault: boolean;
  configuredVia: 'env' | 'manual' | 'auto';
  healthCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Vault Access Event ────────────────────────────────────────────────────────

export type VaultAccessEventType =
  | 'retrieve'
  | 'reveal_attempt'
  | 'reveal_success'
  | 'reveal_denied'
  | 'push'
  | 'rotate'
  | 'register_reference'
  | 'validate_reference'
  | 'provider_health_check'
  | 'access_denied';

export interface VaultAccessEvent {
  eventId: string;
  credentialId: string;
  credentialName: string;         // human name — NOT the raw secret value
  eventType: VaultAccessEventType;
  actorId: string;
  actorName: string;
  vaultProvider?: VaultProviderType;
  vaultPath?: string;             // path in vault (safe to log — not a secret)
  outcome: 'success' | 'failure' | 'denied';
  reason?: string;
  // CRITICAL: raw secret values are NEVER included in this record
  // Any field named 'value', 'secret', 'password', 'token' must not appear here
  metadata: Record<string, string>;
  timestamp: string;              // ISO 8601
}

// ── Vault Adapter Interface ───────────────────────────────────────────────────

export interface VaultRetrieveResult {
  success: boolean;
  value?: SecretValue;            // opaque wrapper — never serializable
  vaultPath: string;
  secretName: string;
  accessedAt: string;
  metadata?: Record<string, string>;
  error?: string;
}

export interface VaultPushResult {
  success: boolean;
  vaultPath: string;
  secretName: string;
  vaultReferenceId?: string;
  pushedAt: string;
  error?: string;
}

export interface VaultValidateResult {
  valid: boolean;
  vaultPath: string;
  secretName: string;
  checkedAt: string;
  error?: string;
}

export interface VaultStatusResult {
  providerType: VaultProviderType;
  status: VaultProviderStatus;
  latencyMs?: number;
  checkedAt: string;
  error?: string;
}

/**
 * VaultAdapter — interface every provider must implement.
 */
export interface VaultAdapter {
  readonly providerType: VaultProviderType;
  isConfigured(): boolean;
  getStatus(): Promise<VaultStatusResult>;
  retrieve(path: string, secretName: string): Promise<VaultRetrieveResult>;
  push(path: string, secretName: string, value: SecretValue, metadata?: Record<string, string>): Promise<VaultPushResult>;
  validateReference(path: string, secretName: string): Promise<VaultValidateResult>;
}

// ── SecretValue — Safe Secret Wrapper ─────────────────────────────────────────
//
// Prevents raw secret values from leaking into:
//   - JSON serialization (JSON.stringify → '[REDACTED]')
//   - console.log output (toString → '[REDACTED]')
//   - template literals (Symbol.toPrimitive → '[REDACTED]')
//   - agent context or audit records
//
// Raw value is only accessible via the .use() callback pattern,
// making accidental exposure visible in code review.

const _secretStore = new WeakMap<SecretValue, string>();

export class SecretValue {
  constructor(rawValue: string) {
    // Store in WeakMap — not on the object itself, so not serializable or enumerable
    _secretStore.set(this, rawValue);
    // Freeze to prevent extension
    Object.freeze(this);
  }

  /**
   * Use the raw secret value within a callback.
   * The value never leaves the callback scope.
   *
   * Example:
   *   const header = secret.use(raw => `Bearer ${raw}`);
   */
  use<T>(fn: (rawValue: string) => T): T {
    const raw = _secretStore.get(this);
    if (raw === undefined) throw new Error('[SecretValue] Internal error: secret not found in store');
    return fn(raw);
  }

  /** Never expose raw value in string conversions */
  toString(): string { return '[REDACTED]'; }
  toJSON(): string { return '[REDACTED]'; }
  [Symbol.toPrimitive](_hint: string): string { return '[REDACTED]'; }
}
