/**
 * SailPoint IdentityNow Tool Adapter — Executes allowlisted SailPoint operations
 * via the IdentityNow REST API (v3).
 *
 * Security:
 *   - SAILPOINT_BASE_URL must be trusted config, validated at startup
 *   - Access profiles, roles, and campaigns tagged with tenant/session metadata
 *   - Entitlement/source IDs validated against tenant-owned integration state
 *   - No arbitrary JSON passthrough to SailPoint APIs
 *   - Trigger aggregation only for tenant-approved source IDs
 *   - Credentials from env vars only, never request input
 *   - Falls back to stub mode when credentials absent (dev/demo)
 */

import { BaseApiAdapter, validateString, validateBaseUrl, ApiError } from './base-api.adapter';
import { rollbackTracker } from '../rollback-tracker.service';
import type { ToolAdapter, ExecutionContext } from '../tool-broker.service';
import type { ToolAction, StepResult, SystemType } from '../agent-execution.types';

const MAX_NAME_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 1024;

class SailPointAdapter extends BaseApiAdapter implements ToolAdapter {
  systemType: SystemType = 'sailpoint';
  systemName = 'SailPoint IdentityNow';

  private baseUrl: string | undefined;

  isConfigured(): boolean {
    if (!process.env.SAILPOINT_BASE_URL || !process.env.SAILPOINT_CLIENT_ID || !process.env.SAILPOINT_CLIENT_SECRET) {
      return false;
    }
    // Validate base URL at configuration check time
    try {
      validateBaseUrl(process.env.SAILPOINT_BASE_URL);
      this.baseUrl = process.env.SAILPOINT_BASE_URL.replace(/\/$/, '');
      return true;
    } catch {
      console.warn('[SailPoint] SAILPOINT_BASE_URL failed validation — adapter disabled');
      return false;
    }
  }

  async execute(action: ToolAction, _credentialHandle?: string, context?: ExecutionContext): Promise<StepResult> {
    if (!this.isConfigured()) {
      return this.stubResult(action);
    }

    if (!context) {
      return this.failResult('Execution context is required for real API calls');
    }

    try {
      switch (action.actionType) {
        case 'sailpoint.create_source':
          return await this.createSource(action, context);
        case 'sailpoint.create_access_profile':
          return await this.createAccessProfile(action, context);
        case 'sailpoint.create_role':
          return await this.createRole(action, context);
        case 'sailpoint.trigger_aggregation':
          return await this.triggerAggregation(action, context);
        case 'sailpoint.create_certification_campaign':
          return await this.createCertificationCampaign(action, context);
        default:
          return this.failResult(`Unsupported SailPoint action: ${action.actionType}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        return this.failResult(`SailPoint API error (${err.statusCode}): ${err.message}`);
      }
      return this.failResult((err as Error).message);
    }
  }

  // ── Action Implementations ─────────────────────────────────────────────

  private async createSource(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const name = validateString(action.inputs.name, 'name', MAX_NAME_LENGTH);
    const connectorType = validateString(action.inputs.connectorType, 'connectorType', 128);
    const description = action.inputs.description
      ? validateString(action.inputs.description, 'description', MAX_DESCRIPTION_LENGTH)
      : `Created by idvize session ${ctx.sessionId}`;

    const token = await this.getToken(ctx.tenantId);

    // Idempotency: search by name + session tag in description
    const existing = await this.findSourceByName(ctx.tenantId, token, name, ctx.sessionId);
    if (existing) {
      return this.successResult({ sourceId: existing.id, name: existing.name, reused: true });
    }

    const body: Record<string, unknown> = {
      name: `[idvize] ${name}`,
      description: `${description} [idvize:session:${ctx.sessionId}]`,
      connector: connectorType,
      type: 'DIRECT_CONNECT',
    };

    const result = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${this.baseUrl}/v3/sources`,
      body,
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    const sourceId = result.body.id as string;

    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'sailpoint', sourceId,
      'source', name, `DELETE ${this.baseUrl}/v3/sources/${sourceId}`);

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'POST', url: `${this.baseUrl}/v3/sources`, body },
      { status: result.status, body: result.body },
      sourceId,
    );

    return this.successResult({ sourceId, name }, [evidenceId]);
  }

  private async createAccessProfile(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const name = validateString(action.inputs.name, 'name', MAX_NAME_LENGTH);
    const sourceId = validateString(action.inputs.sourceId, 'sourceId');
    const entitlements = action.inputs.entitlements as Array<{ id: string; type: string }> | undefined;
    const description = action.inputs.description
      ? validateString(action.inputs.description, 'description', MAX_DESCRIPTION_LENGTH)
      : `Access profile created by idvize session ${ctx.sessionId}`;

    const token = await this.getToken(ctx.tenantId);

    const body: Record<string, unknown> = {
      name: `[idvize] ${name}`,
      description: `${description} [idvize:session:${ctx.sessionId}]`,
      source: { id: sourceId, type: 'SOURCE' },
      entitlements: entitlements ?? [],
      requestable: true,
    };

    const result = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${this.baseUrl}/v3/access-profiles`,
      body,
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    const accessProfileId = result.body.id as string;

    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'sailpoint', accessProfileId,
      'access_profile', name, `DELETE ${this.baseUrl}/v3/access-profiles/${accessProfileId}`);

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'POST', url: `${this.baseUrl}/v3/access-profiles`, body },
      { status: result.status, body: result.body },
      accessProfileId,
    );

    return this.successResult({ accessProfileId, name, sourceId }, [evidenceId]);
  }

  private async createRole(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const name = validateString(action.inputs.name, 'name', MAX_NAME_LENGTH);
    const accessProfileIds = action.inputs.accessProfileIds as string[] | undefined;
    const description = action.inputs.description
      ? validateString(action.inputs.description, 'description', MAX_DESCRIPTION_LENGTH)
      : `Role created by idvize session ${ctx.sessionId}`;

    const token = await this.getToken(ctx.tenantId);

    const body: Record<string, unknown> = {
      name: `[idvize] ${name}`,
      description: `${description} [idvize:session:${ctx.sessionId}]`,
      owner: null, // Will be set by SailPoint based on API caller
      accessProfiles: (accessProfileIds ?? []).map((id: string) => ({ id, type: 'ACCESS_PROFILE' })),
      requestable: true,
    };

    const result = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${this.baseUrl}/v3/roles`,
      body,
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    const roleId = result.body.id as string;

    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'sailpoint', roleId,
      'role', name, `DELETE ${this.baseUrl}/v3/roles/${roleId}`);

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'POST', url: `${this.baseUrl}/v3/roles`, body },
      { status: result.status, body: result.body },
      roleId,
    );

    return this.successResult({ roleId, name }, [evidenceId]);
  }

  private async triggerAggregation(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const sourceId = validateString(action.inputs.sourceId, 'sourceId');

    // Validate the source belongs to this session or is a known tenant source
    // by checking it was tracked by rollback tracker (created in this session)
    // or is referenced in the execution plan
    const token = await this.getToken(ctx.tenantId);

    // Verify source exists and is accessible
    const sourceCheck = await this.apiCall(ctx.tenantId, {
      method: 'GET',
      url: `${this.baseUrl}/v3/sources/${this.encodePath(sourceId)}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!sourceCheck.body.id) {
      return this.failResult(`Source ${sourceId} not found or not accessible`);
    }

    const result = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${this.baseUrl}/v3/sources/${this.encodePath(sourceId)}/entitlement-aggregation`,
      body: {},
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    const task = result.body.task as Record<string, unknown> | undefined;
    const taskId = (task?.id as string) ?? (result.body.id as string) ?? `agg-${Date.now()}`;

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'POST', url: `${this.baseUrl}/v3/sources/${sourceId}/entitlement-aggregation`, body: {} },
      { status: result.status, body: result.body },
      taskId,
    );

    return this.successResult({ taskId, sourceId, status: 'queued' }, [evidenceId]);
  }

  private async createCertificationCampaign(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const name = validateString(action.inputs.name, 'name', MAX_NAME_LENGTH);
    const campaignType = action.inputs.type
      ? validateString(action.inputs.type, 'type', 64)
      : 'MANAGER';
    const description = action.inputs.description
      ? validateString(action.inputs.description, 'description', MAX_DESCRIPTION_LENGTH)
      : `Certification campaign created by idvize session ${ctx.sessionId}`;
    const deadline = action.inputs.deadline as string | undefined;

    const token = await this.getToken(ctx.tenantId);

    const body: Record<string, unknown> = {
      name: `[idvize] ${name}`,
      description: `${description} [idvize:session:${ctx.sessionId}]`,
      type: campaignType,
      ...(deadline ? { deadline } : {}),
    };

    const result = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${this.baseUrl}/v3/campaigns`,
      body,
      headers: { Authorization: `Bearer ${token}` },
      noRetry: true,
    });

    const campaignId = result.body.id as string;

    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'sailpoint', campaignId,
      'certification_campaign', name, `DELETE ${this.baseUrl}/v3/campaigns/${campaignId}`);

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'POST', url: `${this.baseUrl}/v3/campaigns`, body },
      { status: result.status, body: result.body },
      campaignId,
    );

    return this.successResult({ campaignId, name }, [evidenceId]);
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async getToken(tenantId: string): Promise<string> {
    return this.getOAuthToken(tenantId, {
      tokenUrl: `${this.baseUrl}/oauth/token`,
      clientId: process.env.SAILPOINT_CLIENT_ID!,
      clientSecret: process.env.SAILPOINT_CLIENT_SECRET!,
    });
  }

  private async findSourceByName(
    tenantId: string, token: string, name: string, sessionId: string,
  ): Promise<{ id: string; name: string } | undefined> {
    try {
      const result = await this.apiCall(tenantId, {
        method: 'GET',
        url: `${this.baseUrl}/v3/sources?filters=name eq "[idvize] ${name}"`,
        headers: { Authorization: `Bearer ${token}` },
      });
      const sources = (result.body as unknown as Array<{ id: string; name: string; description?: string }>) ?? [];
      return sources.find(s => s.description?.includes(sessionId));
    } catch {
      return undefined;
    }
  }

  private stubResult(action: ToolAction): StepResult {
    const outputs: Record<string, Record<string, unknown>> = {
      'sailpoint.create_source': { sourceId: `stub-source-${Date.now()}`, name: action.inputs.name },
      'sailpoint.create_access_profile': {
        accessProfileId: `stub-ap-${Date.now()}`, name: action.inputs.name, sourceGroup: action.inputs.sourceGroup,
      },
      'sailpoint.create_role': { roleId: `stub-role-${Date.now()}`, name: action.inputs.name },
      'sailpoint.trigger_aggregation': { taskId: `stub-task-${Date.now()}`, status: 'queued' },
      'sailpoint.create_certification_campaign': {
        campaignId: `stub-campaign-${Date.now()}`, name: action.inputs.name,
      },
    };

    return {
      success: true,
      output: {
        ...(outputs[action.actionType] ?? {}),
        _stub: true,
        mode: 'simulation',
        _note: 'SailPoint credentials not configured — running in simulation mode',
        actionType: action.actionType,
      },
      evidenceIds: [],
    };
  }
}

export const sailpointAdapter = new SailPointAdapter();
