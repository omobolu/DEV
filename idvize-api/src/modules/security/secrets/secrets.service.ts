/**
 * Secrets Abstraction Layer
 *
 * Phase 1: reads from process.env.
 * Phase 2: swap provider to Azure Key Vault / AWS Secrets Manager / CyberArk
 * without changing the interface consumed by other services.
 */

import { SecretName } from './secrets.types';
import { getSeedMode } from '../../../config/seed-mode';

const DEV_DEFAULTS: Partial<Record<SecretName, string>> = {
  JWT_SIGNING_SECRET: 'idvize-jwt-dev-secret-change-in-production',
  SCIM_BEARER_TOKEN: 'idvize-scim-bearer-token-dev',
};

function isProduction(): boolean {
  return getSeedMode() === 'production' || process.env.NODE_ENV === 'production';
}

export class SecretsService {
  /**
   * Retrieve a named secret.
   * In production: ONLY reads from process.env — dev defaults are never used.
   * In demo/development: falls back to dev defaults when env var is missing.
   */
  async get(name: SecretName): Promise<string> {
    const envValue = process.env[name];
    if (envValue) return envValue;

    if (isProduction()) {
      throw new Error(
        `[SecretsService] FATAL: Secret "${name}" is not configured. ` +
        `In production, all secrets must be set via environment variables. ` +
        `Set ${name} in your environment.`
      );
    }

    const fallback = DEV_DEFAULTS[name];
    if (fallback) return fallback;
    throw new Error(`[SecretsService] Secret "${name}" not found — set process.env.${name}`);
  }

  /**
   * Synchronous get — same production/dev split as async get.
   */
  getSync(name: SecretName): string {
    const envValue = process.env[name];
    if (envValue) return envValue;

    if (isProduction()) {
      throw new Error(
        `[SecretsService] FATAL: Secret "${name}" is not configured in production. Set ${name} in your environment.`
      );
    }

    const fallback = DEV_DEFAULTS[name];
    if (fallback) return fallback;
    throw new Error(`[SecretsService] Secret "${name}" not found — set process.env.${name}`);
  }
}

export const secretsService = new SecretsService();
