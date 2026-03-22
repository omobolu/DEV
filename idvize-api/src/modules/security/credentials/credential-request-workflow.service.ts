/**
 * Credential Request Workflow Service
 *
 * Manages the end-to-end lifecycle for credential vaulting requests.
 *
 * Three operating modes:
 *
 *  HANDOFF — Most common. IDVIZE generates structured work instructions
 *    for the assigned engineer. The engineer vaults the credential in the
 *    enterprise vault and calls POST /credentials/{id}/register-reference.
 *
 *  RETRIEVAL — IDVIZE retrieves at runtime from a configured vault.
 *    Credential record stores the vault path; no human vaulting step needed
 *    if the credential already exists in the vault.
 *
 *  PUSH — IDVIZE stores the credential in the vault directly after approval.
 *    Requires secrets.approve. Future Phase 2 capability for vault push mode.
 *
 * The handoff work instruction generator produces step-by-step Markdown
 * instructions tailored to the target vault provider, so the engineer knows
 * exactly what path format, authentication method, and confirmation step is expected.
 */

import { v4 as uuidv4 } from 'uuid';
import { CredentialRequest, CredentialRequestType, CredentialRequestStatus } from './credential.types';
import { VaultOperatingMode, VaultProviderType } from '../vault/vault.types';
import { credentialRequestRepository } from './credential-request.repository';
import { credentialRegistryService } from './credential-registry.service';
import { vaultAdapterService } from '../vault/vault.adapter.service';
import { auditService } from '../audit/audit.service';
import { authRepository } from '../auth/auth.repository';

const REQUEST_EXPIRY_HOURS = 72;

class CredentialRequestWorkflowService {

  // ── Submit Request ────────────────────────────────────────────────────────

  submitRequest(input: {
    requestedBy: string;
    credentialId?: string;
    requestType: CredentialRequestType;
    targetSystem: string;
    credentialType: CredentialRequest['credentialType'];
    targetEnvironment: string;
    operatingMode: VaultOperatingMode;
    vaultProvider?: VaultProviderType;
    justification: string;
    assignedTo?: string;
  }): CredentialRequest {
    const requester = authRepository.findById(input.requestedBy);
    const assignee = input.assignedTo ? authRepository.findById(input.assignedTo) : undefined;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REQUEST_EXPIRY_HOURS * 3600 * 1000).toISOString();

    const request: CredentialRequest = {
      requestId: `creq-${uuidv4().split('-')[0]}`,
      credentialId: input.credentialId,
      requestType: input.requestType,
      requestedBy: input.requestedBy,
      requestedByName: requester?.displayName ?? input.requestedBy,
      targetSystem: input.targetSystem,
      credentialType: input.credentialType,
      targetEnvironment: input.targetEnvironment,
      operatingMode: input.operatingMode,
      vaultProvider: input.vaultProvider ?? vaultAdapterService.getDefaultProvider(),
      justification: input.justification,
      status: 'pending',
      assignedTo: input.assignedTo,
      assignedToName: assignee?.displayName,
      expiresAt,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Auto-generate handoff work instructions
    if (input.operatingMode === 'handoff') {
      request.workInstructions = this.generateHandoffInstructions(request);
    }

    credentialRequestRepository.save(request);

    auditService.log({
      eventType: 'approval.requested',
      actorId: input.requestedBy,
      actorName: requester?.displayName ?? input.requestedBy,
      targetType: 'credential_request',
      outcome: 'success',
      metadata: {
        requestId: request.requestId,
        requestType: input.requestType,
        targetSystem: input.targetSystem,
        operatingMode: input.operatingMode,
      },
    });

    console.log(`[CredentialWorkflow] Request submitted: ${request.requestId} | ${input.requestType} | ${input.targetSystem} | mode=${input.operatingMode}`);
    return request;
  }

  // ── Approve / Reject ──────────────────────────────────────────────────────

  resolve(
    requestId: string,
    approverId: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ): CredentialRequest {
    const request = credentialRequestRepository.findById(requestId);
    if (!request) throw Object.assign(new Error(`Request "${requestId}" not found`), { statusCode: 404 });
    if (request.status !== 'pending') throw Object.assign(new Error(`Request is already ${request.status}`), { statusCode: 409 });

    const approver = authRepository.findById(approverId);
    const now = new Date().toISOString();

    request.status = decision;
    request.approvedBy = approverId;
    request.approvedByName = approver?.displayName ?? approverId;
    request.approverComment = comment;
    request.updatedAt = now;

    // If approved + handoff mode: auto-register the credential record
    if (decision === 'approved' && request.operatingMode === 'handoff' && !request.credentialId) {
      const record = credentialRegistryService.register({
        name: `${request.targetSystem} ${request.credentialType} — ${request.targetEnvironment}`,
        description: request.justification,
        credentialType: request.credentialType,
        targetSystem: request.targetSystem,
        targetEnvironment: request.targetEnvironment,
        operatingMode: request.operatingMode,
        vaultProvider: request.vaultProvider,
        ownerId: request.requestedBy,
      }, approverId);
      request.credentialId = record.credentialId;
      request.status = 'in_progress';
    }

    credentialRequestRepository.save(request);

    auditService.log({
      eventType: decision === 'approved' ? 'approval.granted' : 'approval.rejected',
      actorId: approverId,
      actorName: approver?.displayName ?? approverId,
      targetType: 'credential_request',
      outcome: 'success',
      metadata: { requestId, decision, comment: comment ?? '' },
    });

    return request;
  }

  // ── Mark Complete ─────────────────────────────────────────────────────────

  markComplete(requestId: string, actorId: string): CredentialRequest {
    const request = credentialRequestRepository.findById(requestId);
    if (!request) throw Object.assign(new Error(`Request "${requestId}" not found`), { statusCode: 404 });

    request.status = 'completed';
    request.completedAt = new Date().toISOString();
    request.updatedAt = new Date().toISOString();
    credentialRequestRepository.save(request);
    return request;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  listAll(filters: { status?: CredentialRequestStatus; requestedBy?: string; assignedTo?: string } = {}): CredentialRequest[] {
    let results = credentialRequestRepository.findAll();
    if (filters.status) results = results.filter(r => r.status === filters.status);
    if (filters.requestedBy) results = results.filter(r => r.requestedBy === filters.requestedBy);
    if (filters.assignedTo) results = results.filter(r => r.assignedTo === filters.assignedTo);
    return results;
  }

  getRequest(requestId: string): CredentialRequest | undefined {
    return credentialRequestRepository.findById(requestId);
  }

  // ── Handoff Work Instruction Generator ───────────────────────────────────
  //
  // Produces provider-specific Markdown instructions for the engineer
  // who will physically vault the credential in the enterprise vault.
  //
  // The instructions tell the engineer:
  //   1. What credential to vault (without revealing any existing value)
  //   2. Which vault to use and the exact path format
  //   3. How to authenticate to the vault
  //   4. What confirmation step to perform in IDVIZE once done

  generateHandoffInstructions(request: CredentialRequest): string {
    const provider = request.vaultProvider ?? 'mock';
    const providerInstructions = this.getProviderInstructions(provider, request);
    const pathSuggestion = this.suggestVaultPath(provider, request);

    return `# Vault Credential — Work Instructions

**Request ID:** \`${request.requestId}\`
**Assigned To:** ${request.assignedToName ?? 'Unassigned'}
**Requested By:** ${request.requestedByName}
**Target System:** ${request.targetSystem}
**Credential Type:** ${request.credentialType}
**Environment:** ${request.targetEnvironment}
**Vault Provider:** ${this.providerDisplayName(provider)}

---

## What You Need to Do

You have been assigned a credential vaulting task. The credential must be stored in the enterprise vault and the vault reference registered back in IDVIZE. **Do not share or log the raw credential value.**

### Step 1 — Obtain the Credential

Work with the system owner or administrator to obtain the credential for:
- **System:** ${request.targetSystem}
- **Type:** ${request.credentialType}
- **Environment:** ${request.targetEnvironment}
- **Justification:** ${request.justification}

> ⚠️ Do not enter the credential into IDVIZE or send it via email or chat. Vault it directly.

---

### Step 2 — Store in ${this.providerDisplayName(provider)}

${providerInstructions}

**Suggested vault path:** \`${pathSuggestion}\`

---

### Step 3 — Register the Vault Reference in IDVIZE

Once the credential is in the vault, call:

\`\`\`bash
POST /credentials/${request.credentialId ?? '<credential-id>'}/register-reference
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "vaultPath": "${pathSuggestion}",
  "vaultSecretName": "${this.suggestSecretName(request)}",
  "vaultProvider": "${provider}",
  "vaultReferenceId": "<vault-reference-id-from-step-2>"
}
\`\`\`

This call validates the reference is reachable and marks the credential as **vaulted**.

---

### Step 4 — Confirm

After calling register-reference:
- Confirm the credential status is \`vaulted\` in IDVIZE
- Notify the requester (${request.requestedByName}) that the credential is ready
- Do not retain a local copy of the credential

**Request expires:** ${request.expiresAt}
`;
  }

  // ── Provider-Specific Vault Instructions ──────────────────────────────────

  private getProviderInstructions(provider: VaultProviderType, request: CredentialRequest): string {
    const system = request.targetSystem.replace(/\s/g, '-').toLowerCase();
    const env = request.targetEnvironment;

    switch (provider) {
      case 'cyberark':
        return `**CyberArk Privileged Access Manager (PVWA)**

1. Log in to the CyberArk PVWA web console
2. Navigate to **Accounts** → **Add Account**
3. Select Safe: \`IAM-${env.toUpperCase()}\` (or create if it does not exist)
4. Set Platform to: \`WinServerLocal\` or \`Oracle\` depending on credential type
5. Set Account Name: \`${system}-${request.credentialType}-${env}\`
6. Enter the credential value in the **Password** field
7. Save and note the **Account ID** (vault reference ID)

Authentication: Use your CyberArk user account or the IAM service account.
Safe permissions: Confirm you have \`Add Accounts\` permission on the target Safe.`;

      case 'azure_keyvault':
        return `**Azure Key Vault**

1. Navigate to the Azure Portal → Key Vaults → \`kv-iam-${env}\`
2. Go to **Secrets** → **+ Generate/Import**
3. Upload method: **Manual**
4. Name: \`${system}-${request.credentialType}-${env}\`
5. Value: (enter the credential)
6. Set expiration date if applicable
7. Click **Create** and copy the **Secret Identifier URI** (vault reference ID)

Authentication: Use your Azure AD account with \`Key Vault Secrets Officer\` role on the vault.`;

      case 'hashicorp':
        return `**HashiCorp Vault (KV v2)**

1. Authenticate to Vault:
   \`\`\`bash
   vault login -method=ldap username=<your-username>
   # or: vault login <token>
   \`\`\`
2. Write the secret:
   \`\`\`bash
   vault kv put secret/iam/${env}/${system} ${this.suggestSecretName(request)}=<value>
   \`\`\`
3. Confirm it was written:
   \`\`\`bash
   vault kv metadata get secret/iam/${env}/${system}
   \`\`\`
4. Note the **version** number as your vault reference ID

Authentication: Requires \`write\` capability on \`secret/iam/${env}/*\`.`;

      case 'aws_secretsmanager':
        return `**AWS Secrets Manager**

1. Use the AWS CLI (or Console → Secrets Manager):
   \`\`\`bash
   aws secretsmanager create-secret \\
     --name "iam/${env}/${system}/${request.credentialType}" \\
     --secret-string '{"${this.suggestSecretName(request)}": "<value>"}' \\
     --region <aws-region>
   \`\`\`
2. Note the **ARN** returned — this is your vault reference ID
3. Confirm:
   \`\`\`bash
   aws secretsmanager describe-secret --secret-id iam/${env}/${system}/${request.credentialType}
   \`\`\`

Authentication: Requires \`secretsmanager:CreateSecret\` and \`secretsmanager:PutSecretValue\` IAM permissions.`;

      case 'mock':
      default:
        return `**IDVIZE Mock Vault (Development Only)**

1. No real vaulting needed — the mock vault is in-memory
2. The system will auto-validate the reference
3. Proceed directly to Step 3 — register the reference
4. Use path: \`${this.suggestVaultPath(provider, request)}\`

> This is a development mock. In production, use a real vault provider.`;
    }
  }

  private suggestVaultPath(provider: VaultProviderType, request: CredentialRequest): string {
    const system = request.targetSystem.replace(/\s/g, '-').toLowerCase();
    const env = request.targetEnvironment;
    switch (provider) {
      case 'cyberark': return `IAM-${env.toUpperCase()}/${system}-${request.credentialType}-${env}`;
      case 'azure_keyvault': return `kv-iam-${env}`;
      case 'hashicorp': return `secret/iam/${env}/${system}`;
      case 'aws_secretsmanager': return `iam/${env}/${system}/${request.credentialType}`;
      default: return `secret/iam/${system}/${env}`;
    }
  }

  private suggestSecretName(request: CredentialRequest): string {
    const map: Record<string, string> = {
      api_key: 'api-key',
      bearer_token: 'token',
      password: 'password',
      client_secret: 'client-secret',
      certificate: 'certificate',
      service_account: 'service-account-key',
      ssh_key: 'ssh-private-key',
      connection_string: 'connection-string',
      oauth_token: 'oauth-token',
    };
    return map[request.credentialType] ?? 'secret';
  }

  private providerDisplayName(provider: VaultProviderType): string {
    const names: Record<VaultProviderType, string> = {
      cyberark: 'CyberArk PAM',
      azure_keyvault: 'Azure Key Vault',
      hashicorp: 'HashiCorp Vault',
      aws_secretsmanager: 'AWS Secrets Manager',
      mock: 'Mock Vault (Dev)',
    };
    return names[provider];
  }
}

export const credentialRequestWorkflowService = new CredentialRequestWorkflowService();
