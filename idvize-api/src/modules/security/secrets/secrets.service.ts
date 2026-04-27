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

const WEAK_SECRET_PATTERNS = [
  'change-me',
  'change_me',
  'changeme',
  'placeholder',
  'replace-me',
  'your-secret',
  'your_secret',
  'secret123',
  'password',
  'default',
  'example',
  'todo',
  'fixme',
  'idvize-jwt-dev',
  'idvize-dev-secret',
];

const MIN_SECRET_LENGTH = 32;

function isProduction(): boolean {
  return getSeedMode() === 'production' || process.env.NODE_ENV === 'production';
}

function isWeakSecret(value: string): string | null {
  if (value.length < MIN_SECRET_LENGTH) {
    return `Secret is too short (${value.length} chars). Production secrets must be at least ${MIN_SECRET_LENGTH} characters.`;
  }
  const lower = value.toLowerCase();
  for (const pattern of WEAK_SECRET_PATTERNS) {
    if (lower.includes(pattern)) {
      return `Secret contains known placeholder pattern "${pattern}". Use a cryptographically random value.`;
    }
  }
  return null;
}

export class SecretsService {
  /**
   * Retrieve a named secret.
   * In production: ONLY reads from process.env — dev defaults are never used.
   *   Additionally rejects known weak/placeholder values for signing secrets.
   * In demo/development: falls back to dev defaults when env var is missing.
   */
  async get(name: SecretName): Promise<string> {
    const envValue = process.env[name];

    if (isProduction()) {
      if (!envValue) {
        throw new Error(
          `[SecretsService] FATAL: Secret "${name}" is not configured. ` +
          `In production, all secrets must be set via environment variables. ` +
          `Set ${name} in your environment.`
        );
      }
      if (name === 'JWT_SIGNING_SECRET') {
        const weakness = isWeakSecret(envValue);
        if (weakness) {
          throw new Error(
            `[SecretsService] FATAL: ${name} is not safe for production. ${weakness}`
          );
        }
      }
      return envValue;
    }

    if (envValue) return envValue;
    const fallback = DEV_DEFAULTS[name];
    if (fallback) return fallback;
    throw new Error(`[SecretsService] Secret "${name}" not found — set process.env.${name}`);
  }

  /**
   * Synchronous get — same production/dev split as async get.
   */
  getSync(name: SecretName): string {
    const envValue = process.env[name];

    if (isProduction()) {
      if (!envValue) {
        throw new Error(
          `[SecretsService] FATAL: Secret "${name}" is not configured in production. Set ${name} in your environment.`
        );
      }
      if (name === 'JWT_SIGNING_SECRET') {
        const weakness = isWeakSecret(envValue);
        if (weakness) {
          throw new Error(
            `[SecretsService] FATAL: ${name} is not safe for production. ${weakness}`
          );
        }
      }
      return envValue;
    }

    if (envValue) return envValue;
    const fallback = DEV_DEFAULTS[name];
    if (fallback) return fallback;
    throw new Error(`[SecretsService] Secret "${name}" not found — set process.env.${name}`);
  }
}

export const secretsService = new SecretsService();
