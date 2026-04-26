/**
 * Email Repository — Tenant-scoped SMTP configuration storage
 *
 * Uses PostgreSQL for persistence. Configuration is stored per-tenant.
 * Passwords are encrypted with AES-256-GCM before storage.
 * Encryption key: SMTP_ENCRYPTION_KEY env var (hex-encoded 32 bytes).
 *
 * NEVER returns raw passwords to callers — use getConfigMasked().
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import pool from '../../db/pool';
import type { SmtpConfig, SmtpConfigResponse } from './email.types';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const envKey = process.env.SMTP_ENCRYPTION_KEY;
  if (envKey && Buffer.byteLength(envKey, 'hex') === 32) {
    return Buffer.from(envKey, 'hex');
  }
  // Dev fallback — deterministic key derived from JWT_SIGNING_SECRET or static dev key
  const fallback = process.env.JWT_SIGNING_SECRET ?? 'idvize-dev-smtp-key-do-not-use-in-production';
  const { createHash } = require('crypto') as typeof import('crypto');
  return createHash('sha256').update(fallback).digest();
}

function encryptPassword(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store as iv:authTag:ciphertext (all hex-encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

function decryptPassword(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    // Legacy plaintext — return as-is (migration path)
    return encrypted;
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

class EmailRepository {
  /**
   * Ensure the email_config table exists.
   * Called during seed/migration.
   */
  async ensureTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_config (
        tenant_id        TEXT PRIMARY KEY,
        host             TEXT NOT NULL,
        port             INTEGER NOT NULL DEFAULT 587,
        username         TEXT NOT NULL,
        password_enc     TEXT NOT NULL,
        from_email       TEXT NOT NULL,
        from_display     TEXT NOT NULL DEFAULT 'IDVIZE',
        use_tls          BOOLEAN NOT NULL DEFAULT true,
        allow_self_signed BOOLEAN NOT NULL DEFAULT false,
        provider         TEXT NOT NULL DEFAULT 'smtp',
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by       TEXT NOT NULL
      );
    `);
  }

  /**
   * Get full config (including password) for sending — internal use only.
   */
  async getConfig(tenantId: string): Promise<SmtpConfig | undefined> {
    const { rows } = await pool.query<{
      host: string;
      port: number;
      username: string;
      password_enc: string;
      from_email: string;
      from_display: string;
      use_tls: boolean;
      allow_self_signed: boolean;
      provider: string;
    }>(
      `SELECT host, port, username, password_enc, from_email, from_display, use_tls, allow_self_signed, provider
       FROM email_config WHERE tenant_id = $1`,
      [tenantId],
    );

    if (rows.length === 0) return undefined;

    const r = rows[0];
    return {
      host: r.host,
      port: r.port,
      username: r.username,
      password: decryptPassword(r.password_enc),
      fromEmail: r.from_email,
      fromDisplayName: r.from_display,
      useTls: r.use_tls,
      allowSelfSignedCerts: r.allow_self_signed,
      provider: r.provider as SmtpConfig['provider'],
    };
  }

  /**
   * Get masked config for UI display — password is NEVER returned.
   */
  async getConfigMasked(tenantId: string): Promise<SmtpConfigResponse | undefined> {
    const { rows } = await pool.query<{
      host: string;
      port: number;
      username: string;
      password_enc: string;
      from_email: string;
      from_display: string;
      use_tls: boolean;
      allow_self_signed: boolean;
      provider: string;
      updated_at: string;
      updated_by: string;
    }>(
      `SELECT host, port, username, password_enc, from_email, from_display, use_tls, allow_self_signed, provider, updated_at::text, updated_by
       FROM email_config WHERE tenant_id = $1`,
      [tenantId],
    );

    if (rows.length === 0) return undefined;

    const r = rows[0];
    return {
      host: r.host,
      port: r.port,
      username: r.username,
      passwordSet: r.password_enc.length > 0,
      fromEmail: r.from_email,
      fromDisplayName: r.from_display,
      useTls: r.use_tls,
      provider: r.provider as SmtpConfig['provider'],
      updatedAt: r.updated_at,
      updatedBy: r.updated_by,
    };
  }

  /**
   * Create or update SMTP config for a tenant (upsert).
   * Password is encrypted with AES-256-GCM before storage.
   */
  async saveConfig(tenantId: string, config: SmtpConfig, updatedBy: string): Promise<void> {
    const encryptedPassword = encryptPassword(config.password);
    await pool.query(
      `INSERT INTO email_config (tenant_id, host, port, username, password_enc, from_email, from_display, use_tls, allow_self_signed, provider, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
       ON CONFLICT (tenant_id) DO UPDATE SET
         host = EXCLUDED.host,
         port = EXCLUDED.port,
         username = EXCLUDED.username,
         password_enc = EXCLUDED.password_enc,
         from_email = EXCLUDED.from_email,
         from_display = EXCLUDED.from_display,
         use_tls = EXCLUDED.use_tls,
         allow_self_signed = EXCLUDED.allow_self_signed,
         provider = EXCLUDED.provider,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [
        tenantId,
        config.host,
        config.port,
        config.username,
        encryptedPassword,
        config.fromEmail,
        config.fromDisplayName,
        config.useTls,
        config.allowSelfSignedCerts ?? false,
        config.provider,
        updatedBy,
      ],
    );
  }

  /**
   * Update config without changing the password (keep existing).
   */
  async updateConfigKeepPassword(tenantId: string, config: Omit<SmtpConfig, 'password'>, updatedBy: string): Promise<void> {
    await pool.query(
      `UPDATE email_config SET
         host = $2,
         port = $3,
         username = $4,
         from_email = $5,
         from_display = $6,
         use_tls = $7,
         allow_self_signed = $8,
         provider = $9,
         updated_at = NOW(),
         updated_by = $10
       WHERE tenant_id = $1`,
      [
        tenantId,
        config.host,
        config.port,
        config.username,
        config.fromEmail,
        config.fromDisplayName,
        config.useTls,
        config.allowSelfSignedCerts ?? false,
        config.provider,
        updatedBy,
      ],
    );
  }

  /**
   * Delete email config for a tenant.
   */
  async deleteConfig(tenantId: string): Promise<void> {
    await pool.query(`DELETE FROM email_config WHERE tenant_id = $1`, [tenantId]);
  }
}

export const emailRepository = new EmailRepository();
