/**
 * Entra ID Tool Adapter — Executes allowlisted Entra ID operations
 * via Microsoft Graph API.
 *
 * Security:
 *   - Uses least-privilege Graph application permissions
 *   - Conditional Access and MFA policy treated as high/critical blast radius
 *   - Redirect URIs / ACS URLs validated as HTTPS
 *   - Entity IDs validated for non-empty, sane length
 *   - Group display names / mail nicknames sanitized
 *   - Graph object IDs stored for rollback
 *   - Never accepts arbitrary Graph endpoint paths
 *   - Credentials come from env vars only, never request input
 *   - Falls back to stub mode when credentials absent (dev/demo)
 *
 * Required Graph Application Permissions (least-privilege):
 *   - Application.ReadWrite.All (create enterprise apps)
 *   - Group.ReadWrite.All (create security groups, assign to apps)
 *   - Policy.ReadWrite.ConditionalAccess (conditional access policies)
 *   - Policy.ReadWrite.AuthenticationMethod (MFA policy)
 *   - AppRoleAssignment.ReadWrite.All (assign groups to apps)
 */

import { BaseApiAdapter, validateString, validateUrl, validateEnum, ApiError } from './base-api.adapter';
import { rollbackTracker } from '../rollback-tracker.service';
import type { ToolAdapter, ExecutionContext } from '../tool-broker.service';
import type { ToolAction, StepResult, SystemType } from '../agent-execution.types';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_TOKEN_URL_TEMPLATE = 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token';
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';

// Safe characters for mail nickname (no special chars that could break AD)
const SAFE_MAIL_NICKNAME_RE = /^[a-zA-Z0-9._-]+$/;
const MAX_DISPLAY_NAME_LENGTH = 256;

class EntraAdapter extends BaseApiAdapter implements ToolAdapter {
  systemType: SystemType = 'entra';
  systemName = 'Microsoft Entra ID';

  isConfigured(): boolean {
    return !!(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET);
  }

  async execute(action: ToolAction, _credentialHandle?: string, context?: ExecutionContext): Promise<StepResult> {
    // If not configured, return stub results (dev/demo mode)
    if (!this.isConfigured()) {
      return this.stubResult(action);
    }

    if (!context) {
      return this.failResult('Execution context is required for real API calls');
    }

    try {
      switch (action.actionType) {
        case 'entra.create_enterprise_app':
          return await this.createEnterpriseApp(action, context);
        case 'entra.configure_saml_sso':
          return await this.configureSamlSso(action, context);
        case 'entra.configure_oidc':
          return await this.configureOidc(action, context);
        case 'entra.create_group':
          return await this.createGroup(action, context);
        case 'entra.assign_group_to_app':
          return await this.assignGroupToApp(action, context);
        case 'entra.configure_conditional_access':
          return await this.configureConditionalAccess(action, context);
        case 'entra.configure_mfa_policy':
          return await this.configureMfaPolicy(action, context);
        default:
          return this.failResult(`Unsupported Entra action: ${action.actionType}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        return this.failResult(`Entra API error (${err.statusCode}): ${err.message}`);
      }
      return this.failResult((err as Error).message);
    }
  }

  // ── Action Implementations ─────────────────────────────────────────────

  private async createEnterpriseApp(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const displayName = validateString(action.inputs.displayName, 'displayName', MAX_DISPLAY_NAME_LENGTH);

    const token = await this.getToken(ctx.tenantId);

    // Idempotency: search for existing app by display name tag
    const existing = await this.findAppByTag(ctx.tenantId, token, ctx.sessionId, displayName);
    if (existing) {
      return this.successResult({
        objectId: existing.id,
        appId: existing.appId,
        displayName: existing.displayName,
        reused: true,
      });
    }

    const body: Record<string, unknown> = {
      displayName,
      signInAudience: 'AzureADMyOrg',
      tags: [`idvize:session:${ctx.sessionId}`, `idvize:tenant:${ctx.tenantId}`],
    };

    const result = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${GRAPH_BASE}/applications`,
      body,
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    const objectId = result.body.id as string;
    const appId = result.body.appId as string;

    // Create service principal for the app
    const spResult = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${GRAPH_BASE}/servicePrincipals`,
      body: { appId, tags: [`idvize:session:${ctx.sessionId}`] },
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    const servicePrincipalId = spResult.body.id as string;

    // Track for rollback
    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'entra', objectId,
      'application', displayName, `DELETE ${GRAPH_BASE}/applications/${objectId}`);
    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'entra', servicePrincipalId,
      'service_principal', displayName, `DELETE ${GRAPH_BASE}/servicePrincipals/${servicePrincipalId}`);

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'POST', url: `${GRAPH_BASE}/applications`, body },
      { status: result.status, body: result.body },
      objectId,
    );

    return this.successResult({
      objectId,
      appId,
      servicePrincipalId,
      displayName,
    }, [evidenceId]);
  }

  private async configureSamlSso(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const servicePrincipalId = validateString(action.inputs.servicePrincipalId, 'servicePrincipalId');
    const entityId = validateString(action.inputs.entityId, 'entityId', 1024);
    const acsUrl = validateUrl(action.inputs.acsUrl, 'acsUrl', true);

    const token = await this.getToken(ctx.tenantId);

    // Configure SAML SSO on the service principal
    const body: Record<string, unknown> = {
      preferredSingleSignOnMode: 'saml',
      samlSingleSignOnSettings: {
        relayState: null,
      },
    };

    await this.apiCall(ctx.tenantId, {
      method: 'PATCH',
      url: `${GRAPH_BASE}/servicePrincipals/${this.encodePath(servicePrincipalId)}`,
      body,
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    // Set identifier URI and reply URL on the application
    // First, get the application ID from the service principal
    const spInfo = await this.apiCall(ctx.tenantId, {
      method: 'GET',
      url: `${GRAPH_BASE}/servicePrincipals/${this.encodePath(servicePrincipalId)}?$select=appId`,
      headers: { Authorization: `Bearer ${token}` },
    });

    const appId = spInfo.body.appId as string;

    // Find the application object
    const appSearch = await this.apiCall(ctx.tenantId, {
      method: 'GET',
      url: this.buildODataUrl(`${GRAPH_BASE}/applications`, `appId eq '${appId}'`, 'id'),
      headers: { Authorization: `Bearer ${token}` },
    });

    const apps = appSearch.body.value as Array<{ id: string }>;
    if (apps.length > 0) {
      await this.apiCall(ctx.tenantId, {
        method: 'PATCH',
        url: `${GRAPH_BASE}/applications/${this.encodePath(apps[0].id)}`,
        body: {
          identifierUris: [entityId],
          web: { redirectUris: [acsUrl] },
        },
        headers: { Authorization: `Bearer ${token}` },
        noRetry: true,
      });
    }

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'PATCH', url: `${GRAPH_BASE}/servicePrincipals/${servicePrincipalId}`, body },
      { status: 204, body: { configured: true } },
    );

    return this.successResult({
      servicePrincipalId,
      entityId,
      acsUrl,
      ssoConfigured: true,
    }, [evidenceId]);
  }

  private async configureOidc(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const applicationObjectId = validateString(action.inputs.applicationObjectId, 'applicationObjectId');
    const redirectUri = validateUrl(action.inputs.redirectUri, 'redirectUri', true);

    const token = await this.getToken(ctx.tenantId);

    const body: Record<string, unknown> = {
      web: {
        redirectUris: [redirectUri],
        implicitGrantSettings: { enableIdTokenIssuance: true },
      },
    };

    await this.apiCall(ctx.tenantId, {
      method: 'PATCH',
      url: `${GRAPH_BASE}/applications/${this.encodePath(applicationObjectId)}`,
      body,
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'PATCH', url: `${GRAPH_BASE}/applications/${applicationObjectId}`, body },
      { status: 204, body: { configured: true } },
    );

    return this.successResult({ applicationObjectId, redirectUri, oidcConfigured: true }, [evidenceId]);
  }

  private async createGroup(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const displayName = validateString(action.inputs.displayName, 'displayName', MAX_DISPLAY_NAME_LENGTH);
    const mailNickname = this.sanitizeMailNickname(displayName);

    const token = await this.getToken(ctx.tenantId);

    // Idempotency: search for existing group by tag
    const existing = await this.findGroupByTag(ctx.tenantId, token, ctx.sessionId, displayName);
    if (existing) {
      return this.successResult({
        groupId: existing.id,
        displayName: existing.displayName,
        reused: true,
      });
    }

    const body: Record<string, unknown> = {
      displayName,
      mailEnabled: false,
      mailNickname,
      securityEnabled: true,
      description: `Created by idvize execution session ${ctx.sessionId}`,
    };

    const result = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${GRAPH_BASE}/groups`,
      body,
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    const groupId = result.body.id as string;

    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'entra', groupId,
      'group', displayName, `DELETE ${GRAPH_BASE}/groups/${groupId}`);

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'POST', url: `${GRAPH_BASE}/groups`, body },
      { status: result.status, body: result.body },
      groupId,
    );

    return this.successResult({ groupId, displayName }, [evidenceId]);
  }

  private async assignGroupToApp(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const servicePrincipalId = validateString(action.inputs.servicePrincipalId, 'servicePrincipalId');
    const groupId = validateString(action.inputs.groupId, 'groupId');
    const appRoleId = (action.inputs.appRoleId as string) ?? '00000000-0000-0000-0000-000000000000';

    const token = await this.getToken(ctx.tenantId);

    const body: Record<string, unknown> = {
      principalId: groupId,
      resourceId: servicePrincipalId,
      appRoleId,
    };

    const result = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${GRAPH_BASE}/servicePrincipals/${this.encodePath(servicePrincipalId)}/appRoleAssignments`,
      body,
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    const assignmentId = result.body.id as string;

    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'entra', assignmentId,
      'app_role_assignment', `Group ${groupId} → SP ${servicePrincipalId}`,
      `DELETE ${GRAPH_BASE}/servicePrincipals/${servicePrincipalId}/appRoleAssignments/${assignmentId}`);

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'POST', url: `${GRAPH_BASE}/servicePrincipals/${servicePrincipalId}/appRoleAssignments`, body },
      { status: result.status, body: result.body },
      assignmentId,
    );

    return this.successResult({ assignmentId, assigned: true, groupId, servicePrincipalId }, [evidenceId]);
  }

  private async configureConditionalAccess(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const policyName = validateString(action.inputs.policyName, 'policyName', MAX_DISPLAY_NAME_LENGTH);
    const state = validateEnum(action.inputs.state, 'state',
      ['enabled', 'disabled', 'enabledForReportingButNotEnforced'] as const);
    const includeApplications = action.inputs.includeApplications as string[] | undefined;
    const includeGroups = action.inputs.includeGroups as string[] | undefined;
    const grantControls = action.inputs.grantControls as Record<string, unknown> | undefined;

    const token = await this.getToken(ctx.tenantId);

    const body: Record<string, unknown> = {
      displayName: `[idvize] ${policyName}`,
      state,
      conditions: {
        applications: {
          includeApplications: includeApplications ?? ['All'],
        },
        users: {
          includeGroups: includeGroups ?? [],
          includeUsers: ['All'],
        },
      },
      grantControls: grantControls ?? {
        operator: 'OR',
        builtInControls: ['mfa'],
      },
    };

    const result = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${GRAPH_BASE}/identity/conditionalAccess/policies`,
      body,
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    const policyId = result.body.id as string;

    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'entra', policyId,
      'conditional_access_policy', policyName,
      `DELETE ${GRAPH_BASE}/identity/conditionalAccess/policies/${policyId}`);

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'POST', url: `${GRAPH_BASE}/identity/conditionalAccess/policies`, body },
      { status: result.status, body: result.body },
      policyId,
    );

    return this.successResult({ policyId, policyName, state }, [evidenceId]);
  }

  private async configureMfaPolicy(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const allowedMethods = action.inputs.allowedMethods as string[] | undefined;

    const token = await this.getToken(ctx.tenantId);

    // Get current authentication methods policy for rollback reference
    const currentPolicy = await this.apiCall(ctx.tenantId, {
      method: 'GET',
      url: `${GRAPH_BASE}/policies/authenticationMethodsPolicy`,
      headers: { Authorization: `Bearer ${token}` },
    });

    // Record current state for rollback evidence
    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'entra', 'authenticationMethodsPolicy',
      'mfa_policy', 'Authentication Methods Policy',
      `PATCH ${GRAPH_BASE}/policies/authenticationMethodsPolicy (restore previous state)`);

    // Update MFA registration enforcement
    const body: Record<string, unknown> = {
      registrationEnforcement: {
        authenticationMethodsRegistrationCampaign: {
          state: 'enabled',
          snoozeDurationInDays: 0,
        },
      },
    };

    await this.apiCall(ctx.tenantId, {
      method: 'PATCH',
      url: `${GRAPH_BASE}/policies/authenticationMethodsPolicy`,
      body,
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'PATCH', url: `${GRAPH_BASE}/policies/authenticationMethodsPolicy`, body },
      { status: 204, body: { configured: true, previousState: currentPolicy.body } },
    );

    return this.successResult({
      registrationCampaignEnabled: true,
      requestedMethods: allowedMethods ?? [],
      note: 'Registration enforcement campaign enabled. Individual method configuration requires per-method PATCH to /authenticationMethodConfigurations/{methodId} — not yet implemented in v1.',
    }, [evidenceId]);
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async getToken(tenantId: string): Promise<string> {
    const entraTenantId = process.env.ENTRA_TENANT_ID!;
    return this.getOAuthToken(tenantId, {
      tokenUrl: GRAPH_TOKEN_URL_TEMPLATE.replace('{tenantId}', entraTenantId),
      clientId: process.env.ENTRA_CLIENT_ID!,
      clientSecret: process.env.ENTRA_CLIENT_SECRET!,
      scope: GRAPH_SCOPE,
    });
  }

  private async findAppByTag(
    tenantId: string, token: string, sessionId: string, displayName: string,
  ): Promise<{ id: string; appId: string; displayName: string } | undefined> {
    try {
      const result = await this.apiCall(tenantId, {
        method: 'GET',
        url: this.buildODataUrl(`${GRAPH_BASE}/applications`, `displayName eq '${displayName.replace(/'/g, "''")}'`, 'id,appId,displayName,tags'),
        headers: { Authorization: `Bearer ${token}` },
      });
      const apps = (result.body.value as Array<{ id: string; appId: string; displayName: string; tags?: string[] }>) ?? [];
      return apps.find(a => a.tags?.includes(`idvize:session:${sessionId}`));
    } catch {
      return undefined;
    }
  }

  private async findGroupByTag(
    tenantId: string, token: string, sessionId: string, displayName: string,
  ): Promise<{ id: string; displayName: string } | undefined> {
    try {
      const result = await this.apiCall(tenantId, {
        method: 'GET',
        url: this.buildODataUrl(`${GRAPH_BASE}/groups`, `displayName eq '${displayName.replace(/'/g, "''")}'`, 'id,displayName,description'),
        headers: { Authorization: `Bearer ${token}` },
      });
      const groups = (result.body.value as Array<{ id: string; displayName: string; description?: string }>) ?? [];
      return groups.find(g => g.description?.includes(sessionId));
    } catch {
      return undefined;
    }
  }

  private sanitizeMailNickname(displayName: string): string {
    const sanitized = displayName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 64);
    if (SAFE_MAIL_NICKNAME_RE.test(sanitized) && sanitized.length > 0) {
      return sanitized;
    }
    return `idvize-group-${Date.now()}`;
  }

  private stubResult(action: ToolAction): StepResult {
    const outputs: Record<string, Record<string, unknown>> = {
      'entra.create_enterprise_app': {
        objectId: `stub-app-${Date.now()}`, appId: `stub-appid-${Date.now()}`,
        servicePrincipalId: `stub-sp-${Date.now()}`, displayName: action.inputs.displayName as string,
      },
      'entra.configure_saml_sso': {
        entityId: action.inputs.entityId, acsUrl: action.inputs.acsUrl, ssoConfigured: true,
      },
      'entra.configure_oidc': {
        applicationObjectId: action.inputs.applicationObjectId, redirectUri: action.inputs.redirectUri,
        oidcConfigured: true,
      },
      'entra.create_group': {
        groupId: `stub-group-${Date.now()}`, displayName: action.inputs.displayName as string,
      },
      'entra.assign_group_to_app': {
        assignmentId: `stub-assignment-${Date.now()}`, assigned: true,
      },
      'entra.configure_conditional_access': {
        policyId: `stub-ca-${Date.now()}`, policyName: action.inputs.policyName,
        state: action.inputs.state,
      },
      'entra.configure_mfa_policy': {
        allowedMethods: action.inputs.allowedMethods, configured: true,
      },
    };

    return {
      success: true,
      output: {
        ...(outputs[action.actionType] ?? {}),
        _stub: true,
        mode: 'simulation',
        _note: 'Entra ID credentials not configured — running in simulation mode',
        actionType: action.actionType,
      },
      evidenceIds: [],
    };
  }
}

export const entraAdapter = new EntraAdapter();
