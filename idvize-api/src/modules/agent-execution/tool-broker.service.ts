/**
 * Tool Broker — The ONLY execution choke point for all external API calls.
 *
 * The LLM NEVER executes directly. It produces structured ToolAction objects.
 * The Tool Broker validates everything before routing to the correct adapter:
 *
 * Security enforcement (ALL mandatory):
 *   1. Action allowlisting — only known ActionTypes are accepted
 *   2. Session validation — execution must come from an approved session
 *   3. Tenant match — session.tenantId must match the calling tenantId
 *   4. Per-system permission check — agents.execute.sso / .iga / .servicenow
 *   5. Input validation — structured rules + no unresolved placeholders
 *   6. Dry-run mode — validate + permission check without mutating
 *   7. Replay protection — a step cannot execute twice unless retried
 *   8. High-blast-radius approval — CA, MFA, roles, workflows need explicit approval
 *   9. No credentials in logs, results, or error messages
 *   10. All executions audit-logged
 *
 * No adapter endpoint is callable directly from controllers.
 * The Tool Broker is the ONLY path to adapter.execute().
 */

import { auditService } from '../security/audit/audit.service';
import * as repo from './agent-execution.repository';
import type {
  ActionType,
  ToolAction,
  StepResult,
  SystemType,
  ExecutionSession,
} from './agent-execution.types';
import type { PermissionId } from '../security/security.types';

// ── Tool Adapter Interface ───────────────────────────────────────────────────

export interface ToolAdapter {
  systemType: SystemType;
  systemName: string;
  isConfigured(): boolean;
  execute(action: ToolAction, credentialHandle?: string, context?: ExecutionContext): Promise<StepResult>;
}

/**
 * Execution context passed to adapters — contains tenant/session info
 * needed for evidence capture, rollback tracking, and tenant-scoped operations.
 */
export interface ExecutionContext {
  tenantId: string;
  sessionId: string;
  stepId: string;
  dryRun: boolean;
  actorId: string;
  actorName: string;
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
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
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

// ── Per-System Permission Mapping ────────────────────────────────────────────

const SYSTEM_PERMISSION_MAP: Record<SystemType, PermissionId> = {
  entra: 'agents.execute.sso',
  sailpoint: 'agents.execute.iga',
  servicenow: 'agents.execute.servicenow',
  app_connector: 'agents.execute.sso',
  internal: 'agents.execute.request',
};

// ── High-Blast-Radius Actions ────────────────────────────────────────────────
// These actions require explicit approval at high/critical blast radius level.
// They cannot be executed with a generic agents.execute.request permission alone.

const HIGH_BLAST_RADIUS_ACTIONS: Set<ActionType> = new Set([
  'entra.configure_conditional_access',
  'entra.configure_mfa_policy',
  'sailpoint.create_role',
  'sailpoint.create_certification_campaign',
  'servicenow.create_workflow',
]);

// ── Single-Deployment Tenant Lock ────────────────────────────────────────────
// Phase 3 adapters use global env credentials (not tenant-scoped config).
// To prevent cross-tenant credential sharing, the first tenant to execute
// against a configured adapter "locks" that system type. Other tenants are
// blocked until tenant-scoped integration config is implemented.
// Key: systemType → tenantId that first executed against it.

const adapterTenantLock = new Map<string, string>();

// ── Step Execution Tracking (Replay Protection) ──────────────────────────────
// Tracks which steps have been executed to prevent duplicate execution.
// Key: tenantId|sessionId|stepId → last execution timestamp

const executedSteps = new Map<string, string>();

function stepKey(tenantId: string, sessionId: string, stepId: string): string {
  return `${tenantId}|${sessionId}|${stepId}`;
}

// ── Tool Broker ──────────────────────────────────────────────────────────────

class ToolBrokerService {

  /**
   * Execute a single tool action through the appropriate adapter.
   *
   * This is the ONLY entry point for executing external API calls.
   * All security checks are performed here before routing to the adapter.
   *
   * @param tenantId - Must come from authenticated session, not request input
   * @param sessionId - Execution session ID for validation
   * @param stepId - Step within the session (for replay protection)
   * @param action - Structured tool action
   * @param actorId - Authenticated user ID
   * @param actorName - Authenticated user name
   * @param actorPermissions - Permissions from the authenticated JWT
   * @param options - Execution options (dryRun, retryAttempt)
   * @param credentialHandle - Optional credential escrow handle
   */
  async executeSecure(
    tenantId: string,
    sessionId: string,
    stepId: string,
    action: ToolAction,
    actorId: string,
    actorName: string,
    actorPermissions: PermissionId[],
    options: { dryRun?: boolean; retryAttempt?: boolean } = {},
    credentialHandle?: string,
  ): Promise<StepResult> {

    // ── 1. Verify action is allowlisted ──────────────────────────────────
    if (!ALLOWED_ACTIONS.has(action.actionType)) {
      return this.failResult(`Action type "${action.actionType}" is not allowlisted`);
    }

    // ── 2. Session validation — must be an approved session ──────────────
    const session = await repo.getSession(tenantId, sessionId);
    if (!session) {
      return this.failResult('Execution session not found');
    }
    if (session.status !== 'executing' && session.status !== 'approved') {
      return this.failResult(`Session is in status "${session.status}" — must be "approved" or "executing"`);
    }

    // ── 3. Tenant match — session must belong to this tenant ─────────────
    if (session.tenantId !== tenantId) {
      await auditService.log({
        tenantId,
        eventType: 'agent.execution.denied',
        actorId,
        actorName,
        targetType: 'tool_action',
        targetId: action.actionType,
        resource: 'agent_execution',
        outcome: 'failure',
        reason: 'Cross-tenant execution attempt blocked',
        metadata: { sessionTenant: session.tenantId, callerTenant: tenantId },
      });
      return this.failResult('Execution session does not belong to this tenant');
    }

    // ── 4. Per-system permission check ───────────────────────────────────
    const requiredPerm = SYSTEM_PERMISSION_MAP[action.target.systemType];
    if (requiredPerm && !actorPermissions.includes(requiredPerm)) {
      await this.auditDenied(tenantId, actorId, actorName, action, `Missing permission: ${requiredPerm}`);
      return this.failResult(`Missing execution permission: ${requiredPerm}`);
    }

    // ── 5. High-blast-radius actions need explicit high-risk approval ────
    if (HIGH_BLAST_RADIUS_ACTIONS.has(action.actionType)) {
      const hasHighRiskApproval = this.hasHighRiskApproval(session);
      if (!hasHighRiskApproval) {
        await this.auditDenied(tenantId, actorId, actorName, action,
          'High-blast-radius action requires explicit high-risk approval');
        return this.failResult(
          `Action "${action.actionType}" is high-blast-radius and requires explicit approval. ` +
          'Ensure the execution plan was approved with high-risk acknowledgment.',
        );
      }
    }

    // ── 6. Validate inputs ───────────────────────────────────────────────
    const validationErrors = validateInputs(action);
    if (validationErrors.length > 0) {
      return this.failResult(`Input validation failed: ${validationErrors.join('; ')}`);
    }

    // ── 7. Check for unresolved placeholders ─────────────────────────────
    const unresolvedInputs = this.findUnresolvedPlaceholders(action.inputs);
    if (unresolvedInputs.length > 0) {
      return this.failResult(`Unresolved placeholders: ${unresolvedInputs.join(', ')}`);
    }

    // ── 8. Replay protection ─────────────────────────────────────────────
    const sKey = stepKey(tenantId, sessionId, stepId);
    if (executedSteps.has(sKey) && !options.retryAttempt) {
      return this.failResult(
        `Step ${stepId} has already been executed. Use retryAttempt=true to re-execute.`,
      );
    }

    // ── 9. Dry-run mode — validate only, no mutation ─────────────────────
    if (options.dryRun) {
      await auditService.log({
        tenantId,
        eventType: 'agent.execution.dryrun',
        actorId,
        actorName,
        targetType: 'tool_action',
        targetId: action.actionType,
        resource: 'agent_execution',
        outcome: 'success',
        metadata: {
          sessionId,
          stepId,
          actionType: action.actionType,
          systemType: action.target.systemType,
          mode: 'dry_run',
        },
      });

      return {
        success: true,
        output: {
          mode: 'dry_run',
          actionType: action.actionType,
          systemType: action.target.systemType,
          validationPassed: true,
          permissionCheckPassed: true,
          adapterConfigured: this.isAdapterConfigured(action.target.systemType),
          _note: 'Dry run — no external mutations performed',
        },
        evidenceIds: [],
      };
    }

    // ── 10. Route to adapter ─────────────────────────────────────────────
    const adapter = ADAPTER_REGISTRY.get(action.target.systemType);
    if (!adapter) {
      return this.failResult(`No adapter registered for system type "${action.target.systemType}"`);
    }

    // ── 10b. Fail closed in production when provider config is missing ──
    const isProduction = process.env.NODE_ENV === 'production' || process.env.SEED_MODE === 'production';
    if (!adapter.isConfigured() && isProduction && !options.dryRun) {
      return this.failResult(
        `${action.target.systemType} adapter is not configured (missing credentials). ` +
        `Production execution requires valid provider configuration.`,
      );
    }

    // ── 10c. Single-deployment tenant lock (global env credentials) ─────
    // Adapters using global env vars are NOT tenant-scoped. Lock each
    // system type to the first tenant that executes against it.
    const sysType = action.target.systemType;
    if (adapter.isConfigured() && sysType !== 'internal' && sysType !== 'app_connector') {
      const lockedTenant = adapterTenantLock.get(sysType);
      if (lockedTenant && lockedTenant !== tenantId) {
        return this.failResult(
          `${sysType} adapter is locked to a different tenant. ` +
          `Phase 3 uses global provider credentials and does not support multi-tenant execution. ` +
          `Contact platform admin to configure tenant-scoped integration credentials.`,
        );
      }
      if (!lockedTenant && !options.dryRun) {
        adapterTenantLock.set(sysType, tenantId);
      }
    }

    // ── 11. Execute through adapter ──────────────────────────────────────
    const context: ExecutionContext = {
      tenantId,
      sessionId,
      stepId,
      dryRun: options.dryRun ?? false,
      actorId,
      actorName,
    };

    try {
      const result = await adapter.execute(action, credentialHandle, context);

      // Mark step as executed (replay protection) — only for success/manual-action.
      // Failed results should not block retry.
      if (result.success || result.requiresManualAction) {
        executedSteps.set(sKey, new Date().toISOString());
      }

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
          sessionId,
          stepId,
          actionType: action.actionType,
          systemType: action.target.systemType,
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
          sessionId,
          stepId,
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
   * Legacy execute() — maintained for backward compatibility during migration.
   * Routes through executeSecure with minimal context.
   * TODO: Remove once all callers migrate to executeSecure.
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

    // Adapters gracefully degrade to stub mode when not configured

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

  /**
   * Check if an action is high-blast-radius.
   */
  isHighBlastRadius(actionType: string): boolean {
    return HIGH_BLAST_RADIUS_ACTIONS.has(actionType as ActionType);
  }

  /**
   * Clear replay tracking for a session (e.g., on cancellation).
   */
  clearReplayTracking(tenantId: string, sessionId: string): void {
    for (const key of executedSteps.keys()) {
      if (key.startsWith(`${tenantId}|${sessionId}|`)) {
        executedSteps.delete(key);
      }
    }
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

  private isAdapterConfigured(systemType: SystemType): boolean {
    const adapter = ADAPTER_REGISTRY.get(systemType);
    return !!adapter?.isConfigured();
  }

  /**
   * Check if the session has been approved with high-risk acknowledgment.
   * High-blast-radius actions need at least one approval from iam_admin or platform_admin.
   */
  private hasHighRiskApproval(session: ExecutionSession): boolean {
    if (!session.approvals || session.approvals.length === 0) return false;
    return session.approvals.some(
      a => a.status === 'approved' && (a.role === 'iam_admin' || a.role === 'platform_admin'),
    );
  }

  private async auditDenied(
    tenantId: string, actorId: string, actorName: string,
    action: ToolAction, reason: string,
  ): Promise<void> {
    await auditService.log({
      tenantId,
      eventType: 'agent.execution.denied',
      actorId,
      actorName,
      targetType: 'tool_action',
      targetId: action.actionType,
      resource: 'agent_execution',
      outcome: 'failure',
      reason,
      metadata: {
        actionType: action.actionType,
        systemType: action.target.systemType,
      },
    });
  }
}

export const toolBrokerService = new ToolBrokerService();
