/**
 * HashiCorp Vault — Vault Adapter
 *
 * Phase 2 implementation stub.
 *
 * Phase 2 implementation guide:
 *   1. Install: npm install node-vault (or use the Vault HTTP API directly)
 *   2. Set env vars: VAULT_ADDR, VAULT_TOKEN (or VAULT_ROLE_ID + VAULT_SECRET_ID for AppRole)
 *   3. Auth: Token, AppRole, Kubernetes, or AWS IAM
 *   4. path: KV v2 path (e.g. "secret/data/iam/okta/prod")
 *   5. secretName: key within the secret data object
 *
 * Example Phase 2 retrieve (KV v2):
 *   GET {VAULT_ADDR}/v1/secret/data/{path}
 *   Headers: X-Vault-Token: {token}
 *   Response: { data: { data: { [secretName]: value } } }
 */

import {
  VaultAdapter, VaultProviderType, VaultRetrieveResult, VaultPushResult,
  VaultValidateResult, VaultStatusResult, SecretValue,
} from '../vault.types';

class HashiCorpVaultAdapter implements VaultAdapter {
  readonly providerType: VaultProviderType = 'hashicorp';

  isConfigured(): boolean {
    return !!(process.env.VAULT_ADDR && (process.env.VAULT_TOKEN || process.env.VAULT_ROLE_ID));
  }

  async getStatus(): Promise<VaultStatusResult> {
    if (!this.isConfigured()) {
      return { providerType: 'hashicorp', status: 'unconfigured', checkedAt: new Date().toISOString() };
    }
    // Phase 2: GET {VAULT_ADDR}/v1/sys/health
    return { providerType: 'hashicorp', status: 'unconfigured', checkedAt: new Date().toISOString(),
      error: 'HashiCorp Vault adapter not yet implemented — Phase 2' };
  }

  async retrieve(_path: string, _secretName: string): Promise<VaultRetrieveResult> {
    throw Object.assign(
      new Error('HashiCorp Vault adapter not yet implemented. Phase 2: implement KV v2 HTTP API.'),
      { statusCode: 501 },
    );
  }

  async push(_path: string, _secretName: string, _value: SecretValue): Promise<VaultPushResult> {
    throw Object.assign(
      new Error('HashiCorp Vault push not yet implemented. Phase 2: POST /v1/secret/data/{path}'),
      { statusCode: 501 },
    );
  }

  async validateReference(path: string, secretName: string): Promise<VaultValidateResult> {
    return { valid: false, vaultPath: path, secretName, checkedAt: new Date().toISOString(),
      error: 'HashiCorp Vault validation not yet implemented — Phase 2' };
  }
}

export const hashiCorpVaultAdapter = new HashiCorpVaultAdapter();
