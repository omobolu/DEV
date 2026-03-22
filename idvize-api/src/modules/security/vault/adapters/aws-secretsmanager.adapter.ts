/**
 * AWS Secrets Manager — Vault Adapter
 *
 * Phase 2 implementation stub.
 *
 * Phase 2 implementation guide:
 *   1. Install: npm install @aws-sdk/client-secrets-manager
 *   2. Set env vars: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *      (or use IAM role/ECS task role — no explicit keys needed)
 *   3. path: AWS Secret ARN or secret name (e.g. "iam/okta/prod/api-key")
 *   4. secretName: key within the JSON secret string (if structured secret)
 *
 * Example Phase 2 retrieve:
 *   const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
 *   const cmd = new GetSecretValueCommand({ SecretId: path });
 *   const resp = await client.send(cmd);
 *   const secretObj = JSON.parse(resp.SecretString!);
 *   return new SecretValue(secretObj[secretName]);
 */

import {
  VaultAdapter, VaultProviderType, VaultRetrieveResult, VaultPushResult,
  VaultValidateResult, VaultStatusResult, SecretValue,
} from '../vault.types';

class AwsSecretsManagerAdapter implements VaultAdapter {
  readonly providerType: VaultProviderType = 'aws_secretsmanager';

  isConfigured(): boolean {
    return !!(process.env.AWS_REGION && (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ROLE_ARN));
  }

  async getStatus(): Promise<VaultStatusResult> {
    if (!this.isConfigured()) {
      return { providerType: 'aws_secretsmanager', status: 'unconfigured', checkedAt: new Date().toISOString() };
    }
    return { providerType: 'aws_secretsmanager', status: 'unconfigured', checkedAt: new Date().toISOString(),
      error: 'AWS Secrets Manager adapter not yet implemented — Phase 2' };
  }

  async retrieve(_path: string, _secretName: string): Promise<VaultRetrieveResult> {
    throw Object.assign(
      new Error('AWS Secrets Manager adapter not yet implemented. Phase 2: install @aws-sdk/client-secrets-manager.'),
      { statusCode: 501 },
    );
  }

  async push(_path: string, _secretName: string, _value: SecretValue): Promise<VaultPushResult> {
    throw Object.assign(
      new Error('AWS Secrets Manager push not yet implemented. Phase 2: CreateSecretCommand or PutSecretValueCommand.'),
      { statusCode: 501 },
    );
  }

  async validateReference(path: string, secretName: string): Promise<VaultValidateResult> {
    return { valid: false, vaultPath: path, secretName, checkedAt: new Date().toISOString(),
      error: 'AWS Secrets Manager validation not yet implemented — Phase 2' };
  }
}

export const awsSecretsManagerAdapter = new AwsSecretsManagerAdapter();
