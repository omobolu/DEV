/**
 * Azure Key Vault — Vault Adapter
 *
 * Phase 2 implementation stub.
 *
 * Phase 2 implementation guide:
 *   1. Install: npm install @azure/keyvault-secrets @azure/identity
 *   2. Set env vars: AZURE_KEYVAULT_URL, AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 *      (or use managed identity in Azure — no client secret needed)
 *   3. Auth: DefaultAzureCredential or ClientSecretCredential
 *   4. path: Azure Key Vault URL (from env — AZURE_KEYVAULT_URL)
 *   5. secretName: Azure Key Vault secret name
 *
 * Example Phase 2 retrieve:
 *   const client = new SecretClient(vaultUrl, new DefaultAzureCredential());
 *   const secret = await client.getSecret(secretName);
 *   return new SecretValue(secret.value!);
 */

import {
  VaultAdapter, VaultProviderType, VaultRetrieveResult, VaultPushResult,
  VaultValidateResult, VaultStatusResult, SecretValue,
} from '../vault.types';

class AzureKeyVaultAdapter implements VaultAdapter {
  readonly providerType: VaultProviderType = 'azure_keyvault';

  isConfigured(): boolean {
    return !!(process.env.AZURE_KEYVAULT_URL && process.env.AZURE_TENANT_ID);
  }

  async getStatus(): Promise<VaultStatusResult> {
    if (!this.isConfigured()) {
      return { providerType: 'azure_keyvault', status: 'unconfigured', checkedAt: new Date().toISOString() };
    }
    return { providerType: 'azure_keyvault', status: 'unconfigured', checkedAt: new Date().toISOString(),
      error: 'Azure Key Vault adapter not yet implemented — Phase 2' };
  }

  async retrieve(_path: string, _secretName: string): Promise<VaultRetrieveResult> {
    throw Object.assign(
      new Error('Azure Key Vault adapter not yet implemented. Phase 2: install @azure/keyvault-secrets.'),
      { statusCode: 501 },
    );
  }

  async push(_path: string, _secretName: string, _value: SecretValue): Promise<VaultPushResult> {
    throw Object.assign(
      new Error('Azure Key Vault push not yet implemented. Phase 2: client.setSecret(name, value).'),
      { statusCode: 501 },
    );
  }

  async validateReference(path: string, secretName: string): Promise<VaultValidateResult> {
    return { valid: false, vaultPath: path, secretName, checkedAt: new Date().toISOString(),
      error: 'Azure Key Vault validation not yet implemented — Phase 2' };
  }
}

export const azureKeyVaultAdapter = new AzureKeyVaultAdapter();
