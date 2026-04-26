/**
 * Email Repository — Tenant-scoped SMTP configuration storage
 *
 * Uses PostgreSQL for persistence. Configuration is stored per-tenant.
 * Passwords are stored encrypted in PG (for this v1, stored in column;
 * future: migrate to vault reference).
 *
 * NEVER returns raw passwords to callers — use getConfigMasked().
 */

import pool from '../../db/pool';
import type { SmtpConfig, SmtpConfigResponse } from './email.types';

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
      provider: string;
    }>(
      `SELECT host, port, username, password_enc, from_email, from_display, use_tls, provider
       FROM email_config WHERE tenant_id = $1`,
      [tenantId],
    );

    if (rows.length === 0) return undefined;

    const r = rows[0];
    return {
      host: r.host,
      port: r.port,
      username: r.username,
      password: r.password_enc,
      fromEmail: r.from_email,
      fromDisplayName: r.from_display,
      useTls: r.use_tls,
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
      provider: string;
      updated_at: string;
      updated_by: string;
    }>(
      `SELECT host, port, username, password_enc, from_email, from_display, use_tls, provider, updated_at::text, updated_by
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
   * Password is stored directly (v1). Future: vault reference.
   */
  async saveConfig(tenantId: string, config: SmtpConfig, updatedBy: string): Promise<void> {
    await pool.query(
      `INSERT INTO email_config (tenant_id, host, port, username, password_enc, from_email, from_display, use_tls, provider, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
       ON CONFLICT (tenant_id) DO UPDATE SET
         host = EXCLUDED.host,
         port = EXCLUDED.port,
         username = EXCLUDED.username,
         password_enc = EXCLUDED.password_enc,
         from_email = EXCLUDED.from_email,
         from_display = EXCLUDED.from_display,
         use_tls = EXCLUDED.use_tls,
         provider = EXCLUDED.provider,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [
        tenantId,
        config.host,
        config.port,
        config.username,
        config.password,
        config.fromEmail,
        config.fromDisplayName,
        config.useTls,
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
         provider = $8,
         updated_at = NOW(),
         updated_by = $9
       WHERE tenant_id = $1`,
      [
        tenantId,
        config.host,
        config.port,
        config.username,
        config.fromEmail,
        config.fromDisplayName,
        config.useTls,
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
