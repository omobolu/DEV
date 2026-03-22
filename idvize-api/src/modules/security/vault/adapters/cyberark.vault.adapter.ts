/**
 * CyberArk Privileged Access Manager — Vault Adapter
 *
 * Phase 2 implementation stub.
 * Connects to CyberArk PVWA REST API (v2) or Central Credential Provider (CCP).
 *
 * Phase 2 implementation guide:
 *   1. Set env vars: CYBERARK_BASE_URL, CYBERARK_APP_ID, CYBERARK_SAFE, CYBERARK_CLIENT_CERT_PATH
 *   2. Auth method: Certificate + CyberArk Application Identity (app-id)
 *   3. CCP endpoint: GET /AIMWebService/api/Accounts?AppID=&Safe=&Object=
 *   4. PVWA endpoint: GET /PasswordVault/API/Accounts/{accountId}/Password/Retrieve
 *
 * path format: <SafeName>/<ObjectName>
 * secretName: not used for CyberArk (object contains the single credential)
 *
 * Package to install for Phase 2: axios (already common) or node-fetch
 */

import {
  VaultAdapter, VaultProviderType, VaultRetrieveResult, VaultPushResult,
  VaultValidateResult, VaultStatusResult, SecretValue,
} from '../vault.types';

class CyberArkVaultAdapter implements VaultAdapter {
  readonly providerType: VaultProviderType = 'cyberark';

  isConfigured(): boolean {
    return !!(process.env.CYBERARK_BASE_URL && process.env.CYBERARK_APP_ID);
  }

  async getStatus(): Promise<VaultStatusResult> {
    if (!this.isConfigured()) {
      return { providerType: 'cyberark', status: 'unconfigured', checkedAt: new Date().toISOString() };
    }
    // Phase 2: call GET /PasswordVault/API/ServerHeartbeat
    return { providerType: 'cyberark', status: 'unconfigured', checkedAt: new Date().toISOString(),
      error: 'CyberArk adapter not yet implemented — Phase 2' };
  }

  async retrieve(_path: string, _secretName: string): Promise<VaultRetrieveResult> {
    throw Object.assign(
      new Error('CyberArk adapter not yet implemented. Phase 2: implement PVWA REST API or CCP integration.'),
      { statusCode: 501 },
    );
  }

  async push(_path: string, _secretName: string, _value: SecretValue): Promise<VaultPushResult> {
    throw Object.assign(
      new Error('CyberArk push not yet implemented. Phase 2: POST /PasswordVault/API/Accounts'),
      { statusCode: 501 },
    );
  }

  async validateReference(path: string, secretName: string): Promise<VaultValidateResult> {
    return { valid: false, vaultPath: path, secretName, checkedAt: new Date().toISOString(),
      error: 'CyberArk validation not yet implemented — Phase 2' };
  }
}

export const cyberArkVaultAdapter = new CyberArkVaultAdapter();
