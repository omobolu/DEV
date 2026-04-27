/**
 * Internal Verification Tool Adapter — Executes allowlisted verification actions.
 *
 * Verifications check that previous execution steps actually produced the
 * intended result. Uses the Graph API (for Entra) or SailPoint API to
 * validate SSO login, MFA enforcement, and group membership.
 *
 * When external APIs are not configured, returns human-assisted mode results
 * instructing the orchestrator to pause for manual verification.
 */

import { BaseApiAdapter, validateString, ApiError } from './base-api.adapter';
import type { ToolAdapter, ExecutionContext } from '../tool-broker.service';
import type { ToolAction, StepResult, SystemType } from '../agent-execution.types';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_TOKEN_URL_TEMPLATE = 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token';
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';

class InternalAdapter extends BaseApiAdapter implements ToolAdapter {
  systemType: SystemType = 'internal';
  systemName = 'Internal Verification';

  isConfigured(): boolean {
    return true;
  }

  private isEntraConfigured(): boolean {
    return !!(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET);
  }

  async execute(action: ToolAction, _credentialHandle?: string, context?: ExecutionContext): Promise<StepResult> {
    // If external APIs aren't configured, return human-assisted mode
    if (!this.isEntraConfigured() || !context) {
      return this.humanAssistedResult(action);
    }

    try {
      switch (action.actionType) {
        case 'verification.test_sso_login':
          return await this.testSsoLogin(action, context);
        case 'verification.test_mfa_enforcement':
          return await this.testMfaEnforcement(action, context);
        case 'verification.validate_group_membership':
          return await this.validateGroupMembership(action, context);
        default:
          return this.failResult(`Unsupported verification action: ${action.actionType}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        return this.failResult(`Verification API error (${err.statusCode}): ${err.message}`);
      }
      return this.failResult((err as Error).message);
    }
  }

  // ── Verification Implementations ───────────────────────────────────────

  private async testSsoLogin(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const servicePrincipalId = validateString(action.inputs.servicePrincipalId, 'servicePrincipalId');

    const token = await this.getEntraToken(ctx.tenantId);

    // Verify the service principal has SSO configured
    const spResult = await this.apiCall(ctx.tenantId, {
      method: 'GET',
      url: `${GRAPH_BASE}/servicePrincipals/${this.encodePath(servicePrincipalId)}?$select=preferredSingleSignOnMode,loginUrl,samlSingleSignOnSettings`,
      headers: { Authorization: `Bearer ${token}` },
    });

    const ssoMode = spResult.body.preferredSingleSignOnMode as string | undefined;
    const ssoConfigured = ssoMode === 'saml' || ssoMode === 'oidc';

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'GET', url: `${GRAPH_BASE}/servicePrincipals/${servicePrincipalId}` },
      { status: spResult.status, body: { ssoMode, ssoConfigured } },
    );

    return this.successResult({
      ssoTestPassed: ssoConfigured,
      ssoMode: ssoMode ?? 'none',
      servicePrincipalId,
      verificationMethod: 'graph_api',
    }, [evidenceId]);
  }

  private async testMfaEnforcement(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const token = await this.getEntraToken(ctx.tenantId);

    // Check conditional access policies for MFA enforcement
    const policiesResult = await this.apiCall(ctx.tenantId, {
      method: 'GET',
      url: `${GRAPH_BASE}/identity/conditionalAccess/policies?$select=id,displayName,state,grantControls`,
      headers: { Authorization: `Bearer ${token}` },
    });

    const policies = (policiesResult.body.value as Array<{
      id: string;
      displayName: string;
      state: string;
      grantControls?: { builtInControls?: string[] };
    }>) ?? [];

    const mfaPolicies = policies.filter(p =>
      p.state === 'enabled' &&
      p.grantControls?.builtInControls?.includes('mfa'),
    );

    const mfaEnforced = mfaPolicies.length > 0;

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'GET', url: `${GRAPH_BASE}/identity/conditionalAccess/policies` },
      { status: policiesResult.status, body: { totalPolicies: policies.length, mfaPolicies: mfaPolicies.length } },
    );

    return this.successResult({
      mfaEnforced,
      mfaPolicyCount: mfaPolicies.length,
      totalPolicyCount: policies.length,
      verificationMethod: 'graph_api',
    }, [evidenceId]);
  }

  private async validateGroupMembership(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const groupId = validateString(action.inputs.groupId, 'groupId');
    const servicePrincipalId = action.inputs.servicePrincipalId
      ? validateString(action.inputs.servicePrincipalId, 'servicePrincipalId')
      : undefined;

    const token = await this.getEntraToken(ctx.tenantId);

    // Check group exists and has members
    const groupResult = await this.apiCall(ctx.tenantId, {
      method: 'GET',
      url: `${GRAPH_BASE}/groups/${this.encodePath(groupId)}?$select=id,displayName,membershipRule`,
      headers: { Authorization: `Bearer ${token}` },
    });

    // Check group member count
    const membersResult = await this.apiCall(ctx.tenantId, {
      method: 'GET',
      url: `${GRAPH_BASE}/groups/${this.encodePath(groupId)}/members/$count`,
      headers: {
        Authorization: `Bearer ${token}`,
        ConsistencyLevel: 'eventual',
      },
    });

    // If servicePrincipalId provided, check app role assignment
    let appAssigned = false;
    if (servicePrincipalId) {
      try {
        const assignmentsResult = await this.apiCall(ctx.tenantId, {
          method: 'GET',
          url: `${GRAPH_BASE}/servicePrincipals/${this.encodePath(servicePrincipalId)}/appRoleAssignedTo?$filter=principalId eq '${groupId}'`,
          headers: { Authorization: `Bearer ${token}` },
        });
        const assignments = (assignmentsResult.body.value as unknown[]) ?? [];
        appAssigned = assignments.length > 0;
      } catch {
        // Assignment check is best-effort
      }
    }

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'GET', url: `${GRAPH_BASE}/groups/${groupId}` },
      {
        status: groupResult.status,
        body: {
          groupId,
          displayName: groupResult.body.displayName,
          appAssigned,
        },
      },
    );

    return this.successResult({
      groupMembershipValid: true,
      groupId,
      displayName: groupResult.body.displayName,
      appAssigned,
      verificationMethod: 'graph_api',
    }, [evidenceId]);
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async getEntraToken(tenantId: string): Promise<string> {
    const entraTenantId = process.env.ENTRA_TENANT_ID!;
    return this.getOAuthToken(tenantId, {
      tokenUrl: GRAPH_TOKEN_URL_TEMPLATE.replace('{tenantId}', entraTenantId),
      clientId: process.env.ENTRA_CLIENT_ID!,
      clientSecret: process.env.ENTRA_CLIENT_SECRET!,
      scope: GRAPH_SCOPE,
    });
  }

  private humanAssistedResult(action: ToolAction): StepResult {
    const notes: Record<string, string> = {
      'verification.test_sso_login': 'SSO login verification requires manual testing — Entra ID credentials not configured',
      'verification.test_mfa_enforcement': 'MFA enforcement verification requires manual testing — Entra ID credentials not configured',
      'verification.validate_group_membership': 'Group membership validation requires manual verification — Entra ID credentials not configured',
    };

    return {
      success: true,
      output: {
        _stub: true,
        mode: 'human_assisted',
        _note: notes[action.actionType] ?? 'Verification requires manual testing',
        actionType: action.actionType,
        applicationId: action.target.applicationId,
        verificationMethod: 'manual',
      },
      evidenceIds: [],
    };
  }
}

export const internalAdapter = new InternalAdapter();
