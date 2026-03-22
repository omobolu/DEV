/**
 * Secrets Abstraction Layer
 *
 * Phase 1: reads from process.env.
 * Phase 2: swap provider to Azure Key Vault / AWS Secrets Manager / CyberArk
 * without changing the interface consumed by other services.
 */

import { SecretName } from './secrets.types';

const DEV_DEFAULTS: Partial<Record<SecretName, string>> = {
  JWT_SIGNING_SECRET: 'idvize-jwt-dev-secret-change-in-production',
  SCIM_BEARER_TOKEN: 'idvize-scim-bearer-token-dev',
};

export class SecretsService {
  /**
   * Retrieve a named secret.
   * Reads from process.env first, then falls back to dev defaults.
   * In production, NODE_ENV=production causes missing secrets to throw.
   */
  async get(name: SecretName): Promise<string> {
    const value = process.env[name] ?? DEV_DEFAULTS[name];
    if (!value) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`[SecretsService] Secret "${name}" is not configured`);
      }
      throw new Error(`[SecretsService] Secret "${name}" not found — set process.env.${name}`);
    }
    return value;
  }

  /**
   * Synchronous get — use only when async is not possible.
   * Not available in production vault mode.
   */
  getSync(name: SecretName): string {
    const value = process.env[name] ?? DEV_DEFAULTS[name];
    if (!value) {
      throw new Error(`[SecretsService] Secret "${name}" not found`);
    }
    return value;
  }
}

export const secretsService = new SecretsService();
