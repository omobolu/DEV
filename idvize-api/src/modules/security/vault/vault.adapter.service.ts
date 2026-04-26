/**
 * Vault Adapter Service
 *
 * Provider registry and request router for vault operations.
 * Selects the appropriate adapter based on the requested provider type,
 * with automatic fallback to the mock adapter in development.
 *
 * Logs every vault operation to the dedicated vault access event log.
 * Raw secret values are NEVER written to logs, events, or audit records.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  VaultAdapter, VaultProviderType, VaultProviderConfig, VaultProviderStatus,
  VaultRetrieveResult, VaultPushResult, VaultValidateResult, SecretValue,
} from './vault.types';
import { VaultAccessEvent, VaultAccessEventType } from './vault.types';
import { vaultAccessEventRepository } from './vault-access-event.repository';
import { mockVaultAdapter } from './adapters/mock.vault.adapter';
import { cyberArkVaultAdapter } from './adapters/cyberark.vault.adapter';
import { azureKeyVaultAdapter } from './adapters/azure-keyvault.adapter';
import { hashiCorpVaultAdapter } from './adapters/hashicorp.vault.adapter';
import { awsSecretsManagerAdapter } from './adapters/aws-secretsmanager.adapter';

const now = new Date().toISOString();

class VaultAdapterService {
  private adapters: Map<VaultProviderType, VaultAdapter> = new Map([
    ['mock',               mockVaultAdapter],
    ['cyberark',           cyberArkVaultAdapter],
    ['azure_keyvault',     azureKeyVaultAdapter],
    ['hashicorp',          hashiCorpVaultAdapter],
    ['aws_secretsmanager', awsSecretsManagerAdapter],
  ]);

  // ── Provider Registry ─────────────────────────────────────────────────────

  getAdapter(providerType: VaultProviderType): VaultAdapter {
    return this.adapters.get(providerType) ?? mockVaultAdapter;
  }

  getDefaultProvider(): VaultProviderType {
    // Use first configured real provider, fall back to mock
    const realProviders: VaultProviderType[] = ['cyberark', 'azure_keyvault', 'hashicorp', 'aws_secretsmanager'];
    for (const type of realProviders) {
      const adapter = this.adapters.get(type);
      if (adapter?.isConfigured()) return type;
    }
    return 'mock';
  }

  async getProviderConfigs(): Promise<VaultProviderConfig[]> {
    const configs: VaultProviderConfig[] = [];
    for (const [type, adapter] of this.adapters) {
      const status = await adapter.getStatus().catch(() => ({
        providerType: type, status: 'error' as VaultProviderStatus, checkedAt: new Date().toISOString(),
      }));
      configs.push({
        providerId: `provider-${type}`,
        providerType: type,
        displayName: this.getDisplayName(type),
        status: status.status,
        authMethod: this.getAuthMethod(type),
        capabilities: adapter.isConfigured()
          ? ['retrieve', 'push', 'rotate', 'validate']
          : ['validate'],
        isDefault: type === this.getDefaultProvider(),
        configuredVia: adapter.isConfigured() ? 'env' : 'auto',
        healthCheckedAt: status.checkedAt,
        createdAt: now,
        updatedAt: now,
      });
    }
    return configs;
  }

  // ── Vault Operations ──────────────────────────────────────────────────────

  /**
   * Retrieve a secret from the specified vault provider.
   * Logs the access attempt and outcome.
   * The returned SecretValue wrapper prevents raw values from leaking.
   */
  async retrieve(
    tenantId: string,
    providerType: VaultProviderType,
    path: string,
    secretName: string,
    actorId: string,
    actorName: string,
    credentialId: string,
    credentialName: string,
  ): Promise<VaultRetrieveResult> {
    const adapter = this.getAdapter(providerType);
    let result: VaultRetrieveResult;

    try {
      result = await adapter.retrieve(path, secretName);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown vault error';
      result = { success: false, vaultPath: path, secretName, accessedAt: new Date().toISOString(), error: message };
    }

    this.logEvent(tenantId, {
      credentialId,
      credentialName,
      eventType: 'retrieve',
      actorId,
      actorName,
      vaultProvider: providerType,
      vaultPath: path,   // path is safe to log — not a secret
      outcome: result.success ? 'success' : 'failure',
      reason: result.error,
      metadata: { secretName },
    });

    return result;
  }

  /**
   * Push a secret into the specified vault provider.
   * Requires secrets.reveal permission — enforced at controller level.
   */
  async push(
    tenantId: string,
    providerType: VaultProviderType,
    path: string,
    secretName: string,
    value: SecretValue,
    actorId: string,
    actorName: string,
    credentialId: string,
    credentialName: string,
    metadata?: Record<string, string>,
  ): Promise<VaultPushResult> {
    const adapter = this.getAdapter(providerType);
    let result: VaultPushResult;

    try {
      result = await adapter.push(path, secretName, value, metadata);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown vault error';
      result = { success: false, vaultPath: path, secretName, pushedAt: new Date().toISOString(), error: message };
    }

    this.logEvent(tenantId, {
      credentialId,
      credentialName,
      eventType: 'push',
      actorId,
      actorName,
      vaultProvider: providerType,
      vaultPath: path,
      outcome: result.success ? 'success' : 'failure',
      reason: result.error,
      metadata: { secretName },
      // NOTE: raw secret value is NEVER included in this log event
    });

    return result;
  }

  /**
   * Validate that a vault reference is accessible without reading the value.
   */
  async validateReference(
    tenantId: string,
    providerType: VaultProviderType,
    path: string,
    secretName: string,
    credentialId: string,
    credentialName: string,
  ): Promise<VaultValidateResult> {
    const adapter = this.getAdapter(providerType);
    const result = await adapter.validateReference(path, secretName).catch(err => ({
      valid: false, vaultPath: path, secretName,
      checkedAt: new Date().toISOString(), error: err.message,
    }));

    this.logEvent(tenantId, {
      credentialId,
      credentialName,
      eventType: 'validate_reference',
      actorId: 'system',
      actorName: 'System',
      vaultProvider: providerType,
      vaultPath: path,
      outcome: result.valid ? 'success' : 'failure',
      reason: result.error,
      metadata: { secretName },
    });

    return result;
  }

  // ── Vault Access Event Logging ────────────────────────────────────────────

  logEvent(tenantId: string, input: Omit<VaultAccessEvent, 'eventId' | 'timestamp'>): VaultAccessEvent {
    const event: VaultAccessEvent = {
      eventId: uuidv4(),
      ...input,
      timestamp: new Date().toISOString(),
    };
    vaultAccessEventRepository.append(tenantId, event);

    const icon = input.outcome === 'success' ? '✓' : input.outcome === 'denied' ? '⊘' : '✗';
    // CRITICAL: log only metadata — never the secret value
    console.log(`[VaultAudit] ${icon} ${event.eventType} | actor=${event.actorId} | cred=${event.credentialName} | path=${event.vaultPath ?? 'N/A'} | ${event.outcome}`);
    return event;
  }

  queryEvents(tenantId: string, filter: Parameters<typeof vaultAccessEventRepository.query>[1] = {}) {
    return vaultAccessEventRepository.query(tenantId, filter);
  }

  eventCount(tenantId: string): number {
    return vaultAccessEventRepository.count(tenantId);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getDisplayName(type: VaultProviderType): string {
    const names: Record<VaultProviderType, string> = {
      cyberark: 'CyberArk Privileged Access Manager',
      azure_keyvault: 'Azure Key Vault',
      hashicorp: 'HashiCorp Vault',
      aws_secretsmanager: 'AWS Secrets Manager',
      mock: 'Mock Vault (Development)',
    };
    return names[type];
  }

  private getAuthMethod(type: VaultProviderType): string {
    const methods: Record<VaultProviderType, string> = {
      cyberark: 'CyberArk Application Identity (App-ID / CCP)',
      azure_keyvault: 'Azure Managed Identity / Client Credentials',
      hashicorp: 'AppRole / Kubernetes / Token',
      aws_secretsmanager: 'IAM Role / Access Keys',
      mock: 'None (in-memory)',
    };
    return methods[type];
  }
}

export const vaultAdapterService = new VaultAdapterService();
