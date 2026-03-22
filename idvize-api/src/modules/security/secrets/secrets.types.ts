/**
 * Secrets Abstraction Layer — Type Definitions
 *
 * Known secret names as a string literal union to prevent typos.
 * Phase 2: back onto Azure Key Vault, AWS Secrets Manager, or CyberArk.
 */

export type SecretName =
  | 'JWT_SIGNING_SECRET'
  | 'SCIM_BEARER_TOKEN'
  | 'OKTA_CLIENT_SECRET'
  | 'ENTRA_CLIENT_SECRET'
  | 'CYBERARK_API_KEY'
  | 'OIDC_CLIENT_SECRET';

export type SecretsProvider = 'env' | 'vault' | 'keyvault' | 'cyberark';

export interface SecretsConfig {
  provider: SecretsProvider;
  vaultUrl?: string;
}
