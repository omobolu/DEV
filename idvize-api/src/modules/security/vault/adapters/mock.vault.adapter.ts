/**
 * Mock Vault Adapter
 *
 * In-memory vault for development and testing.
 * Simulates vault operations without any external dependencies.
 * Active when no real vault provider is configured.
 */

import {
  VaultAdapter, VaultProviderType, VaultRetrieveResult, VaultPushResult,
  VaultValidateResult, VaultStatusResult, SecretValue,
} from '../vault.types';

class MockVaultAdapter implements VaultAdapter {
  readonly providerType: VaultProviderType = 'mock';

  // In-memory vault store: path:secretName → value
  private store = new Map<string, string>();

  // Pre-seeded mock secrets for demo/testing
  constructor() {
    this.seed('secret/iam/okta/prod', 'api-key', 'OKTA_SSWS_0000MockTokenForTesting');
    this.seed('secret/iam/sailpoint/prod', 'client-secret', 'SP_CLIENT_SECRET_MockValue');
    this.seed('secret/iam/entra/prod', 'client-secret', 'ENTRA_CS_MockValue12345');
    this.seed('secret/iam/cyberark/prod', 'api-key', 'CYBERARK_API_MockKey');
  }

  private key(path: string, secretName: string): string {
    return `${path.replace(/\/$/, '')}:${secretName}`;
  }

  private seed(path: string, secretName: string, value: string): void {
    this.store.set(this.key(path, secretName), value);
  }

  isConfigured(): boolean {
    return true; // always available as fallback
  }

  async getStatus(): Promise<VaultStatusResult> {
    return { providerType: 'mock', status: 'mock', latencyMs: 0, checkedAt: new Date().toISOString() };
  }

  async retrieve(path: string, secretName: string): Promise<VaultRetrieveResult> {
    const raw = this.store.get(this.key(path, secretName));
    if (!raw) {
      return { success: false, vaultPath: path, secretName, accessedAt: new Date().toISOString(), error: `Secret not found: ${path}/${secretName}` };
    }
    return {
      success: true,
      value: new SecretValue(raw),    // wrapped — never exposed in logs
      vaultPath: path,
      secretName,
      accessedAt: new Date().toISOString(),
      metadata: { provider: 'mock', path },
    };
  }

  async push(path: string, secretName: string, value: SecretValue, metadata?: Record<string, string>): Promise<VaultPushResult> {
    value.use(raw => this.store.set(this.key(path, secretName), raw));
    return {
      success: true,
      vaultPath: path,
      secretName,
      vaultReferenceId: `mock-ref-${Date.now()}`,
      pushedAt: new Date().toISOString(),
    };
  }

  async validateReference(path: string, secretName: string): Promise<VaultValidateResult> {
    const exists = this.store.has(this.key(path, secretName));
    return { valid: exists, vaultPath: path, secretName, checkedAt: new Date().toISOString() };
  }

  /** Seed a secret directly (test/demo use only) */
  seedSecret(path: string, secretName: string, value: string): void {
    this.store.set(this.key(path, secretName), value);
  }
}

export const mockVaultAdapter = new MockVaultAdapter();
