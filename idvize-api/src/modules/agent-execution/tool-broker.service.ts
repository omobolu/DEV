/**
 * Tool Broker — Executes allowlisted tool actions through deterministic adapters.
 *
 * The LLM NEVER executes directly. It produces structured ToolAction objects.
 * The Tool Broker validates inputs, routes to the correct adapter, and returns
 * sanitized results. Credentials are retrieved from the Ephemeral Credential
 * Escrow by handle — never passed through the broker interface.
 *
 * Security:
 *   - Only allowlisted ActionTypes are accepted
 *   - All inputs are validated before execution
 *   - No shell, PowerShell, SSH, or generic browser automation
 *   - Credentials never appear in logs, results, or error messages
 *   - All executions are audit-logged
 */

import { auditService } from '../security/audit/audit.service';
import type {
  ActionType,
  ToolAction,
  StepResult,
  SystemType,
} from './agent-execution.types';

// ── Tool Adapter Interface ───────────────────────────────────────────────────

export interface ToolAdapter {
  systemType: SystemType;
  systemName: string;
  isConfigured(): boolean;
  execute(action: ToolAction, credentialHandle?: string): Promise<StepResult>;
}

// ── Adapter Registry ─────────────────────────────────────────────────────────

const ADAPTER_REGISTRY = new Map<SystemType, ToolAdapter>();

export function registerAdapter(adapter: ToolAdapter): void {
  ADAPTER_REGISTRY.set(adapter.systemType, adapter);
}

// ── Input Validation ─────────────────────────────────────────────────────────

function validateInputs(action: ToolAction): string[] {
  const errors: string[] = [];

  for (const rule of action.validationRules) {
    const value = action.inputs[rule.field];

    switch (rule.rule) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          errors.push(rule.message);
        }
        break;
      case 'format':
        if (typeof value === 'string' && rule.value && !new RegExp(rule.value as string).test(value)) {
          errors.push(rule.message);
        }
        break;
      case 'enum':
        if (Array.isArray(rule.value) && !rule.value.includes(value)) {
          errors.push(rule.message);
        }
        break;
      case 'maxLength':
        if (typeof value === 'string' && typeof rule.value === 'number' && value.length > rule.value) {
          errors.push(rule.message);
        }
        break;
      case 'minLength':
        if (typeof value === 'string' && typeof rule.value === 'number' && value.length < rule.value) {
          errors.push(rule.message);
        }
        break;
    }
  }

  return errors;
}

// ── Allowlisted Action Types ─────────────────────────────────────────────────

const ALLOWED_ACTIONS: Set<ActionType> = new Set([
  'entra.create_enterprise_app',
  'entra.configure_saml_sso',
  'entra.configure_oidc',
  'entra.create_group',
  'entra.assign_group_to_app',
  'entra.configure_conditional_access',
  'entra.configure_mfa_policy',
  'sailpoint.create_source',
  'sailpoint.create_access_profile',
  'sailpoint.create_role',
  'sailpoint.trigger_aggregation',
  'sailpoint.create_certification_campaign',
  'servicenow.create_catalog_item',
  'servicenow.create_request_mapping',
  'servicenow.create_workflow',
  'app_connector.configure_sso',
  'app_connector.verify_sso_login',
  'app_connector.configure_scim',
  'verification.test_sso_login',
  'verification.test_mfa_enforcement',
  'verification.validate_group_membership',
]);

// ── Tool Broker ──────────────────────────────────────────────────────────────

class ToolBrokerService {

  /**
   * Execute a single tool action through the appropriate adapter.
   * Returns a sanitized result — no credentials in output.
   */
  async execute(
    tenantId: string,
    action: ToolAction,
    actorId: string,
    actorName: string,
    credentialHandle?: string,
  ): Promise<StepResult> {
    // 1. Verify action is allowlisted
    if (!ALLOWED_ACTIONS.has(action.actionType)) {
      return this.failResult(`Action type "${action.actionType}" is not allowlisted`);
    }

    // 2. Validate inputs
    const validationErrors = validateInputs(action);
    if (validationErrors.length > 0) {
      return this.failResult(`Input validation failed: ${validationErrors.join('; ')}`);
    }

    // 3. Check for placeholder inputs ({{...}}) that weren't resolved
    const unresolvedInputs = this.findUnresolvedPlaceholders(action.inputs);
    if (unresolvedInputs.length > 0) {
      return this.failResult(`Unresolved placeholders: ${unresolvedInputs.join(', ')}`);
    }

    // 4. Route to the correct adapter
    const adapter = ADAPTER_REGISTRY.get(action.target.systemType);
    if (!adapter) {
      return this.failResult(`No adapter registered for system type "${action.target.systemType}"`);
    }

    if (!adapter.isConfigured()) {
      return this.failResult(`Adapter "${adapter.systemName}" is not configured for this tenant`);
    }

    // 5. Execute through adapter
    try {
      const result = await adapter.execute(action, credentialHandle);

      await auditService.log({
        tenantId,
        eventType: result.success ? 'agent.execution.completed' : 'agent.execution.failed',
        actorId,
        actorName,
        targetType: 'tool_action',
        targetId: action.actionType,
        resource: 'agent_execution',
        outcome: result.success ? 'success' : 'failure',
        metadata: {
          actionType: action.actionType,
          systemType: action.target.systemType,
          applicationId: action.target.applicationId,
          hasCredential: !!credentialHandle,
          // NEVER log credential values
        },
      });

      return result;
    } catch (err) {
      const errorMessage = (err as Error).message;

      await auditService.log({
        tenantId,
        eventType: 'agent.execution.failed',
        actorId,
        actorName,
        targetType: 'tool_action',
        targetId: action.actionType,
        resource: 'agent_execution',
        outcome: 'failure',
        metadata: {
          actionType: action.actionType,
          systemType: action.target.systemType,
          error: errorMessage,
          // NEVER log credential values
        },
      });

      return this.failResult(errorMessage);
    }
  }

  /**
   * Check which adapters are configured and available.
   */
  getAdapterStatus(): Array<{ systemType: SystemType; systemName: string; configured: boolean }> {
    return Array.from(ADAPTER_REGISTRY.values()).map(adapter => ({
      systemType: adapter.systemType,
      systemName: adapter.systemName,
      configured: adapter.isConfigured(),
    }));
  }

  /**
   * Check if a specific action type is allowed.
   */
  isActionAllowed(actionType: string): boolean {
    return ALLOWED_ACTIONS.has(actionType as ActionType);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private failResult(errorMessage: string): StepResult {
    return {
      success: false,
      output: {},
      errorMessage,
      evidenceIds: [],
    };
  }

  private findUnresolvedPlaceholders(inputs: Record<string, unknown>): string[] {
    const unresolved: string[] = [];
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'string' && /^\{\{.+\}\}$/.test(value)) {
        unresolved.push(key);
      }
    }
    return unresolved;
  }
}

export const toolBrokerService = new ToolBrokerService();
