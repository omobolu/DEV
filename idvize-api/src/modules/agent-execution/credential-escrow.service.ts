/**
 * Ephemeral Credential Escrow — Secure, short-lived credential storage.
 *
 * Security model:
 *   - Credentials are encrypted at rest (AES-256-GCM)
 *   - Scoped to a single execution session and tenant
 *   - Short TTL (default 1 hour) — auto-destroyed after expiry
 *   - One-time retrieval — credential can only be read once by the execution worker
 *   - Never returned to frontend after submission
 *   - Never stored in audit logs, prompts, or agent messages
 *   - Handle ID is the ONLY reference passed around
 *
 * v1: In-process encrypted storage with AES-256-GCM
 * v2: External KMS/Vault integration (AWS KMS, HashiCorp Vault, Azure Key Vault)
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { auditService } from '../security/audit/audit.service';
import type { CredentialHandoff, SystemType } from './agent-execution.types';

const DEFAULT_TTL_MINUTES = 60;
const ALGORITHM = 'aes-256-gcm';

// Encryption key — in production, this MUST come from KMS/Vault or env var.
// Fail-closed: production hard-fails on missing/malformed key.
function getEncryptionKey(): Buffer {
  const envKey = process.env.CREDENTIAL_ESCROW_KEY;
  if (envKey) {
    if (Buffer.byteLength(envKey, 'hex') !== 32) {
      throw new Error(
        '[FATAL] CREDENTIAL_ESCROW_KEY is malformed — must be exactly 32 bytes (64 hex chars). ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    return Buffer.from(envKey, 'hex');
  }

  // Production must not use an ephemeral dev key
  const isProduction = process.env.NODE_ENV === 'production' || process.env.SEED_MODE === 'production';
  if (isProduction) {
    throw new Error(
      '[FATAL] CREDENTIAL_ESCROW_KEY is required in production. ' +
      'Credential escrow cannot operate without a persistent encryption key. ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  // Dev/test fallback — generate ephemeral key (lost on restart, which is fine for dev)
  if (!devKey) {
    console.warn('[WARN] CREDENTIAL_ESCROW_KEY not set — using ephemeral dev key (credentials lost on restart)');
    devKey = randomBytes(32);
  }
  return devKey;
}
let devKey: Buffer | undefined;

interface EncryptedValue {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

class CredentialEscrowService {
  // Handle metadata — no credential values here
  private handles = new Map<string, Map<string, CredentialHandoff>>(); // tenantId → handleId → metadata
  // Encrypted credential values — separate storage
  private encrypted = new Map<string, EncryptedValue>(); // handleId → encrypted value

  /**
   * Create a credential handoff request.
   * Returns a handle that the app team will use to submit the credential.
   */
  async createHandoff(
    tenantId: string,
    sessionId: string,
    targetSystem: SystemType,
    targetApplicationId: string | undefined,
    purpose: string,
    actorId: string,
    actorName: string,
    ttlMinutes = DEFAULT_TTL_MINUTES,
  ): Promise<CredentialHandoff> {
    const handleId = `credh-${uuidv4()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

    const handoff: CredentialHandoff = {
      handleId,
      tenantId,
      sessionId,
      targetSystem,
      targetApplicationId,
      purpose,
      status: 'pending',
      expiresAt,
      createdAt: now.toISOString(),
    };

    if (!this.handles.has(tenantId)) {
      this.handles.set(tenantId, new Map());
    }
    this.handles.get(tenantId)!.set(handleId, handoff);

    await auditService.log({
      tenantId,
      eventType: 'secret.accessed',
      actorId,
      actorName,
      targetType: 'credential_handoff',
      targetId: handleId,
      resource: 'credential_escrow',
      outcome: 'success',
      reason: 'Credential handoff request created',
      metadata: {
        handleId,
        sessionId,
        targetSystem,
        purpose,
        expiresAt,
        // NEVER log credential values
      },
    });

    return handoff;
  }

  /**
   * Submit a credential value for a handoff handle.
   * The value is immediately encrypted and the plaintext discarded.
   */
  async submitCredential(
    tenantId: string,
    handleId: string,
    credentialValue: string,
    submittedBy: string,
    submitterName: string,
  ): Promise<void> {
    const handoff = this.getHandoff(tenantId, handleId);
    if (!handoff) throw new Error('Credential handle not found');
    if (handoff.status !== 'pending') {
      throw new Error(`Handle ${handleId} is in status "${handoff.status}" — cannot submit`);
    }
    if (new Date() > new Date(handoff.expiresAt)) {
      handoff.status = 'expired';
      throw new Error(`Handle ${handleId} has expired`);
    }

    // Encrypt the credential value immediately
    const key = getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(credentialValue, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    this.encrypted.set(handleId, { ciphertext, iv, authTag });

    // Update handle metadata (no credential value stored here)
    handoff.status = 'submitted';
    handoff.submittedBy = submittedBy;
    handoff.submittedAt = new Date().toISOString();

    await auditService.log({
      tenantId,
      eventType: 'secret.accessed',
      actorId: submittedBy,
      actorName: submitterName,
      targetType: 'credential_handoff',
      targetId: handleId,
      resource: 'credential_escrow',
      outcome: 'success',
      reason: 'Credential submitted to escrow',
      metadata: {
        handleId,
        sessionId: handoff.sessionId,
        // NEVER log credential values
      },
    });
  }

  /**
   * Retrieve the credential value — ONE-TIME ONLY.
   * After retrieval, the encrypted value is destroyed.
   * Only the execution worker should call this.
   */
  async retrieveCredential(
    tenantId: string,
    handleId: string,
    workerId: string,
    workerName: string,
  ): Promise<string> {
    const handoff = this.getHandoff(tenantId, handleId);
    if (!handoff) throw new Error('Credential handle not found');
    if (handoff.status !== 'submitted') {
      throw new Error(`Handle ${handleId} is in status "${handoff.status}" — cannot retrieve`);
    }
    if (new Date() > new Date(handoff.expiresAt)) {
      this.destroyCredential(tenantId, handleId);
      throw new Error(`Handle ${handleId} has expired`);
    }

    const encryptedValue = this.encrypted.get(handleId);
    if (!encryptedValue) {
      throw new Error(`No encrypted value found for handle ${handleId}`);
    }

    // Decrypt
    const key = getEncryptionKey();
    const decipher = createDecipheriv(ALGORITHM, key, encryptedValue.iv);
    decipher.setAuthTag(encryptedValue.authTag);
    const plaintext = decipher.update(encryptedValue.ciphertext) + decipher.final('utf8');

    // Mark as retrieved and destroy encrypted value
    handoff.status = 'retrieved';
    handoff.retrievedAt = new Date().toISOString();
    this.encrypted.delete(handleId);

    await auditService.log({
      tenantId,
      eventType: 'secret.accessed',
      actorId: workerId,
      actorName: workerName,
      targetType: 'credential_handoff',
      targetId: handleId,
      resource: 'credential_escrow',
      outcome: 'success',
      reason: 'Credential retrieved by execution worker (one-time)',
      metadata: {
        handleId,
        sessionId: handoff.sessionId,
        // NEVER log credential values
      },
    });

    return plaintext;
  }

  /**
   * Destroy a credential — called after workflow completion or on expiry.
   */
  destroyCredential(tenantId: string, handleId: string): void {
    this.encrypted.delete(handleId);
    const handoff = this.getHandoff(tenantId, handleId);
    if (handoff) {
      handoff.status = 'destroyed';
      handoff.destroyedAt = new Date().toISOString();
    }
  }

  /**
   * Get handoff metadata (no credential value).
   */
  getHandoff(tenantId: string, handleId: string): CredentialHandoff | undefined {
    return this.handles.get(tenantId)?.get(handleId);
  }

  /**
   * List all handoffs for a session (metadata only).
   */
  getSessionHandoffs(tenantId: string, sessionId: string): CredentialHandoff[] {
    const tenantHandoffs = this.handles.get(tenantId);
    if (!tenantHandoffs) return [];
    return Array.from(tenantHandoffs.values()).filter(h => h.sessionId === sessionId);
  }

  /**
   * Cleanup: destroy all expired credentials across all tenants.
   * Call periodically (e.g. every 5 minutes).
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let destroyed = 0;

    for (const [tenantId, tenantHandoffs] of this.handles) {
      for (const handoff of tenantHandoffs.values()) {
        if (
          (handoff.status === 'pending' || handoff.status === 'submitted') &&
          new Date(handoff.expiresAt) < now
        ) {
          this.destroyCredential(tenantId, handoff.handleId);
          destroyed++;
        }
      }
    }

    return destroyed;
  }
}

export const credentialEscrowService = new CredentialEscrowService();
