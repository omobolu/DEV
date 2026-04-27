/**
 * ServiceNow Tool Adapter — Executes allowlisted ServiceNow operations
 * via the Table API and Service Catalog API.
 *
 * Security:
 *   - Instance URL from trusted config only, not user input
 *   - No arbitrary table names, script fields, or encoded queries from user input
 *   - Catalog/workflow creation uses fixed templates + validated variables
 *   - No arbitrary JSON passthrough
 *   - Credentials from env vars only, never request input
 *   - Falls back to stub mode when credentials absent (dev/demo)
 */

import { BaseApiAdapter, validateString, validateBaseUrl, ApiError } from './base-api.adapter';
import { rollbackTracker } from '../rollback-tracker.service';
import type { ToolAdapter, ExecutionContext } from '../tool-broker.service';
import type { ToolAction, StepResult, SystemType } from '../agent-execution.types';

const MAX_NAME_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 2048;

// Allowlisted table names for ServiceNow operations
const ALLOWED_TABLES = new Set([
  'sc_cat_item',          // Service Catalog items
  'sc_category',          // Catalog categories
  'sys_flow',             // Flow Designer flows
  'sys_hub_flow',         // Hub flows
]);

class ServiceNowAdapter extends BaseApiAdapter implements ToolAdapter {
  systemType: SystemType = 'servicenow';
  systemName = 'ServiceNow';

  private instanceUrl: string | undefined;

  isConfigured(): boolean {
    if (!process.env.SERVICENOW_INSTANCE_URL || !process.env.SERVICENOW_CLIENT_ID || !process.env.SERVICENOW_CLIENT_SECRET) {
      return false;
    }
    try {
      validateBaseUrl(process.env.SERVICENOW_INSTANCE_URL);
      this.instanceUrl = process.env.SERVICENOW_INSTANCE_URL.replace(/\/$/, '');
      return true;
    } catch {
      console.warn('[ServiceNow] SERVICENOW_INSTANCE_URL failed validation — adapter disabled');
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
        case 'servicenow.create_catalog_item':
          return await this.createCatalogItem(action, context);
        case 'servicenow.create_request_mapping':
          return await this.createRequestMapping(action, context);
        case 'servicenow.create_workflow':
          return await this.createWorkflow(action, context);
        default:
          return this.failResult(`Unsupported ServiceNow action: ${action.actionType}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        return this.failResult(`ServiceNow API error (${err.statusCode}): ${err.message}`);
      }
      return this.failResult((err as Error).message);
    }
  }

  // ── Action Implementations ─────────────────────────────────────────────

  private async createCatalogItem(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const name = validateString(action.inputs.name, 'name', MAX_NAME_LENGTH);
    const category = action.inputs.category
      ? validateString(action.inputs.category, 'category', MAX_NAME_LENGTH)
      : 'IAM Access Requests';
    const description = action.inputs.description
      ? validateString(action.inputs.description, 'description', MAX_DESCRIPTION_LENGTH)
      : `Service catalog item for IAM access request, created by idvize session ${ctx.sessionId}`;

    const token = await this.getToken(ctx.tenantId);

    // Fixed template: create a catalog item with validated variables only
    const body: Record<string, unknown> = {
      name: `[idvize] ${name}`,
      short_description: description,
      category,
      active: true,
      type: 'item',
      // Tag for idempotency and session tracking
      comments: `idvize:session:${ctx.sessionId} idvize:tenant:${ctx.tenantId}`,
    };

    const result = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${this.instanceUrl}/api/now/table/sc_cat_item`,
      body,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      noRetry: true,
    });

    const responseResult = result.body.result as Record<string, unknown> | undefined;
    const catalogItemId = (responseResult?.sys_id ?? result.body.sys_id) as string;

    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'servicenow', catalogItemId,
      'catalog_item', name,
      `PATCH ${this.instanceUrl}/api/now/table/sc_cat_item/${catalogItemId} (set active=false)`);

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'POST', url: `${this.instanceUrl}/api/now/table/sc_cat_item`, body },
      { status: result.status, body: result.body },
      catalogItemId,
    );

    return this.successResult({ catalogItemId, name, category }, [evidenceId]);
  }

  private async createRequestMapping(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const sourceSystem = validateString(action.inputs.sourceSystem, 'sourceSystem', MAX_NAME_LENGTH);
    const catalogItemId = validateString(action.inputs.catalogItemId, 'catalogItemId');
    const targetAccessProfileId = action.inputs.targetAccessProfileId
      ? validateString(action.inputs.targetAccessProfileId, 'targetAccessProfileId')
      : undefined;

    const token = await this.getToken(ctx.tenantId);

    // Request mapping: stored as a custom record that links a catalog item
    // to a provisioning action in the source system (SailPoint, Entra, etc.)
    const body: Record<string, unknown> = {
      name: `[idvize] Mapping: ${sourceSystem} → ${catalogItemId}`,
      short_description: `Request mapping for ${sourceSystem} provisioning`,
      u_source_system: sourceSystem,
      u_catalog_item: catalogItemId,
      u_target_access_profile: targetAccessProfileId ?? '',
      active: true,
      comments: `idvize:session:${ctx.sessionId} idvize:tenant:${ctx.tenantId}`,
    };

    // Use a generic configuration item table for the mapping
    const result = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${this.instanceUrl}/api/now/table/sc_cat_item`,
      body,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      noRetry: true,
    });

    const responseResult = result.body.result as Record<string, unknown> | undefined;
    const mappingId = (responseResult?.sys_id ?? result.body.sys_id) as string;

    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'servicenow', mappingId,
      'request_mapping', `${sourceSystem} → ${catalogItemId}`,
      `PATCH ${this.instanceUrl}/api/now/table/sc_cat_item/${mappingId} (set active=false)`);

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'POST', url: `${this.instanceUrl}/api/now/table/sc_cat_item`, body },
      { status: result.status, body: result.body },
      mappingId,
    );

    return this.successResult({ mappingId, sourceSystem, catalogItemId }, [evidenceId]);
  }

  private async createWorkflow(action: ToolAction, ctx: ExecutionContext): Promise<StepResult> {
    const name = validateString(action.inputs.name, 'name', MAX_NAME_LENGTH);
    const description = action.inputs.description
      ? validateString(action.inputs.description, 'description', MAX_DESCRIPTION_LENGTH)
      : `IAM workflow created by idvize session ${ctx.sessionId}`;
    const triggerType = action.inputs.triggerType
      ? validateString(action.inputs.triggerType, 'triggerType', 64)
      : 'record';

    const token = await this.getToken(ctx.tenantId);

    // Fixed workflow template — no arbitrary scripts from user input
    const body: Record<string, unknown> = {
      name: `[idvize] ${name}`,
      description: `${description} [idvize:session:${ctx.sessionId}]`,
      trigger_type: triggerType,
      active: false, // Created inactive — must be explicitly activated
      // No script fields, encoded queries, or arbitrary code from user input
    };

    const result = await this.apiCall(ctx.tenantId, {
      method: 'POST',
      url: `${this.instanceUrl}/api/now/table/sys_hub_flow`,
      body,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      noRetry: true,
    });

    const responseResult = result.body.result as Record<string, unknown> | undefined;
    const workflowId = (responseResult?.sys_id ?? result.body.sys_id) as string;

    rollbackTracker.track(ctx.tenantId, ctx.sessionId, ctx.stepId, 'servicenow', workflowId,
      'workflow', name,
      `DELETE ${this.instanceUrl}/api/now/table/sys_hub_flow/${workflowId}`);

    const evidenceId = await this.recordApiEvidence(
      ctx.tenantId, ctx.sessionId, ctx.stepId, action.actionType,
      { method: 'POST', url: `${this.instanceUrl}/api/now/table/sys_hub_flow`, body },
      { status: result.status, body: result.body },
      workflowId,
    );

    return this.successResult({ workflowId, name, active: false }, [evidenceId]);
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async getToken(tenantId: string): Promise<string> {
    return this.getOAuthToken(tenantId, {
      tokenUrl: `${this.instanceUrl}/oauth_token.do`,
      clientId: process.env.SERVICENOW_CLIENT_ID!,
      clientSecret: process.env.SERVICENOW_CLIENT_SECRET!,
    });
  }

  private stubResult(action: ToolAction): StepResult {
    const outputs: Record<string, Record<string, unknown>> = {
      'servicenow.create_catalog_item': {
        catalogItemId: `stub-ci-${Date.now()}`, name: action.inputs.name, category: action.inputs.category,
      },
      'servicenow.create_request_mapping': {
        mappingId: `stub-rm-${Date.now()}`, sourceSystem: action.inputs.sourceSystem,
      },
      'servicenow.create_workflow': {
        workflowId: `stub-wf-${Date.now()}`, name: action.inputs.name, active: false,
      },
    };

    return {
      success: true,
      output: {
        ...(outputs[action.actionType] ?? {}),
        _stub: true,
        mode: 'simulation',
        _note: 'ServiceNow credentials not configured — running in simulation mode',
        actionType: action.actionType,
      },
      evidenceIds: [],
    };
  }
}

export const servicenowAdapter = new ServiceNowAdapter();
