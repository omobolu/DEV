/**
 * Execution Orchestrator — Coordinates the full agent execution lifecycle.
 *
 * Lifecycle: Plan → Validate → Approve → Execute → Record Evidence → Cleanup
 *
 * This is the top-level service that ties together:
 *   - Planning Service (generates structured plans)
 *   - Policy Engine (validates plans against policies)
 *   - Execution Approval Service (manages human approval gates)
 *   - Tool Broker (executes allowlisted actions)
 *   - Evidence Store (records execution artifacts)
 *   - Credential Escrow (manages ephemeral credentials)
 *   - Audit Service (logs all events)
 *
 * The orchestrator enforces the invariant:
 *   EXECUTION MUST NOT BEGIN WITHOUT HUMAN APPROVAL.
 *
 * All session state is persisted to PostgreSQL.
 * Fails closed: PG unavailable → 503.
 */

import { v4 as uuidv4 } from 'uuid';
import { planningService } from './planning.service';
import { executionPolicyEngine } from './policy-engine.service';
import { executionApprovalService } from './approval.service';
import { toolBrokerService } from './tool-broker.service';
import { evidenceStoreService } from './evidence-store.service';
import { credentialEscrowService } from './credential-escrow.service';
import { rollbackTracker } from './rollback-tracker.service';
import { auditService } from '../security/audit/audit.service';
import { emailService } from '../email/email.service';
import { emailActionTokenService } from '../email/email-action-token.service';
import { applicationService } from '../application/application.service';
import { authRepository } from '../security/auth/auth.repository';
import { CONTROLS_CATALOG } from '../control/control.catalog';
import * as repo from './agent-execution.repository';
import type {
  ExecutionSession,
  ExecutionSessionStatus,
  ExecutionStep,
  StepStatus,
  AgentType,
  CreatePlanRequest,
  SessionListFilters,
  SystemType,
} from './agent-execution.types';
import type { PermissionId } from '../security/security.types';

/**
 * Maps system types to the permission required to execute actions against them.
 */
const SYSTEM_PERMISSION_MAP: Record<SystemType, PermissionId> = {
  entra: 'agents.execute.sso',
  sailpoint: 'agents.execute.iga',
  servicenow: 'agents.execute.servicenow',
  app_connector: 'agents.execute.sso',
  internal: 'agents.execute.request',
};

class ExecutionOrchestratorService {

  // ── Session Lifecycle ──────────────────────────────────────────────────

  /**
   * Phase 1: Create a new execution session and generate a plan.
   * Returns the session with plan, policy evaluation, and required approvals.
   */
  async createSession(
    tenantId: string,
    request: CreatePlanRequest,
    actorId: string,
    actorName: string,
    actorEmail?: string,
  ): Promise<ExecutionSession> {
    const sessionId = `exs-${uuidv4()}`;

    // 0. Validate initial context inputs if provided
    if (request.context) {
      const validationErrors = this.validateContextInputs(request.context);
      if (validationErrors.length > 0) {
        throw new Error(`Context validation failed: ${validationErrors.join('; ')}`);
      }
    }

    // 1. Generate plan
    const plan = await planningService.generatePlan(
      tenantId,
      request.agentType,
      request.applicationId,
      request.controlId,
      { ...request.context, sessionId },
    );
    plan.sessionId = sessionId;

    // 2. Validate plan against policies
    const policyResult = executionPolicyEngine.evaluate(plan);

    if (!policyResult.allowed) {
      const session = this.buildSession(sessionId, tenantId, request.agentType, 'failed', actorId);
      session.plan = plan;
      session.errorMessage = `Policy violations: ${policyResult.violations
        .filter(v => v.severity === 'error')
        .map(v => v.message)
        .join('; ')}`;
      await repo.saveSession(session);

      await this.auditSessionEvent(tenantId, sessionId, actorId, actorName, 'agent.plan.rejected', {
        violations: policyResult.violations,
      });

      return session;
    }

    // 3. Generate required approvals
    const approvals = executionApprovalService.generateRequiredApprovals(plan);
    await executionApprovalService.saveApprovals(tenantId, approvals);

    // 4. Build session
    const session = this.buildSession(sessionId, tenantId, request.agentType, 'pending_approval', actorId);
    session.plan = plan;
    session.approvals = approvals;
    await repo.saveSession(session);

    // 5. Record evidence: plan creation
    await evidenceStoreService.record(
      tenantId, sessionId, 'configuration_snapshot',
      'Execution Plan Generated',
      `Plan ${plan.planId} for ${request.agentType} agent on ${plan.applicationName}`,
      {
        planId: plan.planId,
        agentType: request.agentType,
        applicationId: request.applicationId,
        stepsCount: plan.steps.length,
        systemsTouched: plan.systemsTouched.map(s => s.systemName),
        blastRadius: plan.blastRadius,
        policyEvaluation: policyResult,
        requiredApprovals: approvals.map(a => ({ role: a.role, status: a.status })),
      },
    );

    await this.auditSessionEvent(tenantId, sessionId, actorId, actorName, 'agent.plan.created', {
      planId: plan.planId,
      agentType: request.agentType,
      applicationId: request.applicationId,
      stepsCount: plan.steps.length,
      blastRadius: plan.blastRadius.level,
      approvalsRequired: approvals.length,
    });

    // Fire email notification for plan created (best-effort — failure does not block session)
    this.notifyPlanCreated(tenantId, session, actorId, actorName, actorEmail ?? '').catch(err => {
      console.warn(`[ExecutionOrchestrator] notifyPlanCreated failed for session ${sessionId}:`, (err as Error).message);
    });

    return session;
  }

  /**
   * Phase 2: Approve or reject an execution plan.
   */
  async resolveApproval(
    tenantId: string,
    sessionId: string,
    approvalId: string,
    approverId: string,
    approverName: string,
    approverRoles: string[],
    decision: 'approved' | 'rejected',
    comment?: string,
  ): Promise<ExecutionSession> {
    const session = await repo.getSession(tenantId, sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'pending_approval') {
      throw new Error(`Session ${sessionId} is in status "${session.status}" — cannot resolve approvals`);
    }

    await executionApprovalService.resolve(
      tenantId, approvalId, sessionId, approverId, approverName, approverRoles, decision, comment,
    );

    // Update session approvals
    session.approvals = await executionApprovalService.getSessionApprovals(tenantId, sessionId);

    // Expired approvals checked FIRST — if any required approval has expired,
    // execution must not proceed regardless of other approvals' status.
    // This prevents bypass where: approval A expires, approval B approved →
    // isFullyApproved would return true (1/1) if expired was excluded from denominator.
    if (await executionApprovalService.hasExpiredApprovals(tenantId, sessionId)) {
      session.status = 'expired';
      session.updatedAt = new Date().toISOString();
      session.errorMessage = 'One or more required approvals expired before resolution';

      for (const handleId of session.credentialHandles) {
        credentialEscrowService.destroyCredential(tenantId, handleId);
      }

      await this.auditSessionEvent(tenantId, sessionId, approverId, approverName, 'agent.approval.expired', {
        approvalId,
      });
    } else if (await executionApprovalService.hasRejection(tenantId, sessionId)) {
      session.status = 'cancelled';
      session.updatedAt = new Date().toISOString();
      session.errorMessage = `Approval rejected by ${approverName}: ${comment ?? 'no reason given'}`;

      // Cleanup credentials on rejection
      for (const handleId of session.credentialHandles) {
        credentialEscrowService.destroyCredential(tenantId, handleId);
      }

      await this.auditSessionEvent(tenantId, sessionId, approverId, approverName, 'agent.plan.rejected', {
        approvalId,
        comment,
      });
    } else if (await executionApprovalService.isFullyApproved(tenantId, sessionId)) {
      session.status = 'approved';
      session.updatedAt = new Date().toISOString();

      await this.auditSessionEvent(tenantId, sessionId, approverId, approverName, 'agent.plan.approved', {
        approvalId,
      });

      this.notifyStakeholders(tenantId, session, approverName).catch(err =>
        console.error('[Orchestrator] Stakeholder notification failed:', (err as Error).message),
      );
    }

    await repo.saveSession(session);
    return session;
  }

  /**
   * Resolve an approval via a one-time email action token.
   * No JWT user context — uses a predefined system identity for audit logging.
   */
  async resolveApprovalViaEmail(
    tenantId: string,
    sessionId: string,
    approvalId: string,
    decision: 'approved' | 'rejected',
  ): Promise<void> {
    const session = await repo.getSession(tenantId, sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'pending_approval') {
      throw new Error(`Session is no longer pending approval (current status: ${session.status})`);
    }

    const approval = (await executionApprovalService.getSessionApprovals(tenantId, sessionId))
      .find(a => a.approvalId === approvalId);
    if (!approval) throw new Error(`Approval ${approvalId} not found`);
    if (approval.status !== 'pending') throw new Error(`This approval has already been ${approval.status}`);

    const roleMap: Record<string, string[]> = {
      app_owner: ['Manager', 'PlatformAdmin'],
      iam_admin: ['Manager', 'PlatformAdmin'],
      platform_admin: ['PlatformAdmin'],
      security_admin: ['Manager', 'PlatformAdmin'],
    };
    const eligible = roleMap[approval.role] ?? ['PlatformAdmin'];

    await executionApprovalService.resolve(
      tenantId, approvalId, sessionId,
      'email-action', 'Email Approver',
      eligible, decision,
    );

    session.approvals = await executionApprovalService.getSessionApprovals(tenantId, sessionId);

    if (await executionApprovalService.hasExpiredApprovals(tenantId, sessionId)) {
      session.status = 'expired';
      session.updatedAt = new Date().toISOString();
      session.errorMessage = 'One or more required approvals expired before resolution';
      for (const handleId of session.credentialHandles) {
        credentialEscrowService.destroyCredential(tenantId, handleId);
      }
    } else if (await executionApprovalService.hasRejection(tenantId, sessionId)) {
      session.status = 'cancelled';
      session.updatedAt = new Date().toISOString();
      session.errorMessage = `Approval rejected via email`;
      for (const handleId of session.credentialHandles) {
        credentialEscrowService.destroyCredential(tenantId, handleId);
      }
    } else if (await executionApprovalService.isFullyApproved(tenantId, sessionId)) {
      session.status = 'approved';
      session.updatedAt = new Date().toISOString();

      this.notifyStakeholders(tenantId, session, 'Email Approver').catch(err =>
        console.error('[Orchestrator] Stakeholder notification failed:', (err as Error).message),
      );
    }

    await repo.saveSession(session);

    await auditService.log({
      tenantId,
      eventType: decision === 'approved' ? 'approval.granted' : 'approval.rejected',
      actorId: 'email-action',
      actorName: 'Email Approver',
      targetType: 'execution_plan',
      targetId: sessionId,
      resource: 'agent_execution',
      outcome: 'success',
      metadata: { approvalId, sessionId, decision, channel: 'email' },
    });
  }

  /**
   * Supply missing context data for a paused session.
   * Merges provided inputs into the plan's contextData so placeholder resolution
   * can resolve them on the next execution attempt.
   */
  async updateSessionInputs(
    tenantId: string,
    sessionId: string,
    inputs: Record<string, unknown>,
    actorId: string,
    actorName: string,
  ): Promise<ExecutionSession> {
    const session = await repo.getSession(tenantId, sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'paused') {
      throw new Error(`Session ${sessionId} is in status "${session.status}" — can only update inputs on paused sessions`);
    }
    if (!session.plan) throw new Error(`Session ${sessionId} has no plan`);

    // Validate inputs against known schema constraints
    const validationErrors = this.validateContextInputs(inputs);
    if (validationErrors.length > 0) {
      throw new Error(`Input validation failed: ${validationErrors.join('; ')}`);
    }

    // Scope-sensitive keys that affect what the approved plan actually touches.
    // These can only be FILLED IN (from undefined/placeholder) — not overwritten
    // after they already have a resolved value. Changing them post-approval would
    // make the approval record no longer match what runs in real systems.
    const SCOPE_SENSITIVE_KEYS = ['includeGroups', 'sourceId', 'entityId', 'acsUrl', 'testUserEmail'];
    const existing = session.plan.contextData ?? {};
    const overwritten: string[] = [];
    for (const key of SCOPE_SENSITIVE_KEYS) {
      if (!(key in inputs)) continue;
      const prev = existing[key];
      // Allow filling in a missing/placeholder value
      if (prev === undefined || prev === null) continue;
      if (typeof prev === 'string' && /^\{\{.+\}\}$/.test(prev)) continue;
      // Reject overwriting an already-resolved value
      if (JSON.stringify(prev) !== JSON.stringify(inputs[key])) {
        overwritten.push(key);
      }
    }
    if (overwritten.length > 0) {
      throw new Error(
        `Cannot overwrite scope-sensitive inputs after approval: ${overwritten.join(', ')}. ` +
        'These values were already set when the plan was approved. Cancel and create a new session to change them.',
      );
    }

    session.plan.contextData = { ...existing, ...inputs };
    session.updatedAt = new Date().toISOString();
    await repo.saveSession(session);

    await this.auditSessionEvent(tenantId, sessionId, actorId, actorName, 'agent.execution.inputs_updated', {
      inputKeys: Object.keys(inputs),
      scopeSensitiveKeys: Object.keys(inputs).filter(k => SCOPE_SENSITIVE_KEYS.includes(k)),
    });

    return session;
  }

  /**
   * Confirm (or reject) a manual-action step that paused the session.
   * On confirmation, marks the step as succeeded with operator evidence.
   * On rejection, marks the step as failed.
   * Either way, does NOT re-execute the step's adapter.
   */
  async confirmManualStep(
    tenantId: string,
    sessionId: string,
    stepId: string,
    confirmed: boolean,
    actorId: string,
    actorName: string,
    evidence?: string,
  ): Promise<ExecutionSession> {
    const session = await repo.getSession(tenantId, sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'paused') {
      throw new Error(`Session ${sessionId} is in status "${session.status}" — manual confirmation only applies to paused sessions`);
    }
    if (!session.plan) throw new Error(`Session ${sessionId} has no plan`);

    const step = session.plan.steps.find(s => s.stepId === stepId);
    if (!step) throw new Error(`Step ${stepId} not found in session ${sessionId}`);
    if (!step.result?.requiresManualAction) {
      throw new Error(`Step ${stepId} is not awaiting manual confirmation`);
    }

    if (confirmed) {
      step.status = 'succeeded';
      step.completedAt = new Date().toISOString();
      step.result = {
        success: true,
        output: { ...step.result.output, manuallyConfirmed: true, confirmedBy: actorName, evidence: evidence ?? '' },
        evidenceIds: step.result.evidenceIds,
      };
    } else {
      step.status = 'failed';
      step.completedAt = new Date().toISOString();
      step.result = {
        success: false,
        output: { ...step.result.output, manuallyRejected: true, rejectedBy: actorName },
        errorMessage: evidence ?? 'Manual step rejected by operator',
        evidenceIds: step.result.evidenceIds,
      };

      // Rejection means the session cannot proceed — fail and rollback immediately
      session.status = 'failed';
      session.errorMessage = `Step ${step.order} rejected by ${actorName}: ${evidence ?? 'no reason given'}`;
    }

    session.updatedAt = new Date().toISOString();
    if (confirmed) session.errorMessage = undefined;
    await repo.saveSession(session);

    await evidenceStoreService.record(
      tenantId, sessionId, 'api_response',
      `Step ${step.order}: Manual Confirmation`,
      confirmed ? `Confirmed by ${actorName}` : `Rejected by ${actorName}`,
      { stepId, confirmed, confirmedBy: actorName, evidence },
      stepId,
    );

    await this.auditSessionEvent(tenantId, sessionId, actorId, actorName,
      confirmed ? 'agent.execution.step_confirmed' : 'agent.execution.step_rejected',
      { stepId, confirmed, evidence },
    );

    // Trigger rollback and cleanup for rejected steps
    if (!confirmed) {
      await this.rollbackSession(tenantId, sessionId, actorId, actorName);
      for (const handleId of session.credentialHandles) {
        credentialEscrowService.destroyCredential(tenantId, handleId);
      }
      toolBrokerService.clearReplayTracking(tenantId, sessionId);
      rollbackTracker.cleanupSession(tenantId, sessionId);
    }

    return session;
  }

  /**
   * Phase 3: Execute an approved plan.
   * Steps are executed sequentially through the Tool Broker (executeSecure).
   * Enforces per-step system permissions, replay protection, and rollback on failure.
   */
  async executeSession(
    tenantId: string,
    sessionId: string,
    actorId: string,
    actorName: string,
    actorPermissions: PermissionId[],
    actorEmail?: string,
    options?: { dryRun?: boolean },
  ): Promise<ExecutionSession> {
    const session = await repo.getSession(tenantId, sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'approved' && session.status !== 'paused') {
      throw new Error(`Session ${sessionId} is in status "${session.status}" — must be "approved" or "paused" to execute`);
    }
    if (!session.plan) throw new Error(`Session ${sessionId} has no plan`);

    // Verify actor has per-system execution permissions for all steps
    const missingPerms = this.checkStepPermissions(session.plan.steps, actorPermissions);
    if (missingPerms.length > 0) {
      throw new Error(`Missing execution permissions: ${missingPerms.join(', ')}`);
    }

    session.status = 'executing';
    session.updatedAt = new Date().toISOString();
    await repo.saveSession(session);

    await this.auditSessionEvent(tenantId, sessionId, actorId, actorName, 'agent.execution.started', {
      stepsCount: session.plan.steps.length,
      dryRun: options?.dryRun ?? false,
    });

    let allSucceeded = true;
    let isSimulation = false;

    for (const step of session.plan.steps) {
      // Skip already-succeeded steps when resuming from paused,
      // but preserve simulation flag from prior stub results
      if (step.status === 'succeeded') {
        if (step.result?.output && (step.result.output as Record<string, unknown>)._stub === true) {
          isSimulation = true;
        }
        continue;
      }

      // A manually-rejected step means the session cannot proceed — fail immediately
      if (step.status === 'failed' && (step.result?.output as Record<string, unknown>)?.manuallyRejected) {
        allSucceeded = false;
        session.status = 'failed';
        session.errorMessage = `Step ${step.order} was rejected by operator: ${step.result?.errorMessage ?? 'no reason given'}`;
        await this.rollbackSession(tenantId, sessionId, actorId, actorName);
        break;
      }

      step.status = 'in_progress';
      step.startedAt = new Date().toISOString();

      // Check if step requires credential
      let credentialHandle: string | undefined;
      if (step.requiresCredential && step.credentialHandle) {
        credentialHandle = step.credentialHandle;
      }

      // Resolve step-output references: {{step:N:fieldName}} → value from step N's result
      this.resolveStepOutputReferences(step, session.plan.steps);

      // Resolve context placeholders: {{key}} → value from plan.contextData
      this.resolveContextPlaceholders(step, session.plan.contextData ?? {});

      // Check for unresolved placeholders in inputs — pause if found
      const hasPlaceholders = Object.values(step.toolAction.inputs).some(
        v => typeof v === 'string' && /^\{\{.+\}\}$/.test(v),
      );

      if (hasPlaceholders) {
        step.status = 'pending';
        session.status = 'paused';
        session.updatedAt = new Date().toISOString();
        session.errorMessage = `Step ${step.order} requires input resolution before execution`;
        await repo.saveSession(session);

        await evidenceStoreService.record(
          tenantId, sessionId, 'error_log',
          `Step ${step.order} Paused — Input Required`,
          step.description,
          { stepId: step.stepId, unresolvedInputs: step.toolAction.inputs },
          step.stepId,
        );

        return session;
      }

      // Execute step through Tool Broker (secure path with full enforcement)
      const result = await toolBrokerService.executeSecure(
        tenantId,
        sessionId,
        step.stepId,
        step.toolAction,
        actorId,
        actorName,
        actorPermissions,
        { dryRun: options?.dryRun, retryAttempt: step.result?.requiresManualAction === true },
        credentialHandle,
      );

      step.result = result;
      step.status = result.success ? 'succeeded' : (result.requiresManualAction ? 'pending' as StepStatus : 'failed');
      step.completedAt = step.status === 'pending' ? undefined : new Date().toISOString();

      // Detect stub/simulation results
      if (result.output && (result.output as Record<string, unknown>)._stub === true) {
        isSimulation = true;
      }

      // Record evidence for this step
      const evidence = await evidenceStoreService.record(
        tenantId, sessionId,
        result.success ? 'api_response' : (result.requiresManualAction ? 'api_response' : 'error_log'),
        `Step ${step.order}: ${step.description}`,
        result.success ? 'Completed successfully'
          : result.requiresManualAction ? 'Paused — requires manual intervention'
          : `Failed: ${result.errorMessage}`,
        { stepId: step.stepId, actionType: step.actionType, output: result.output },
        step.stepId,
      );

      result.evidenceIds.push(evidence.evidenceId);

      // Manual-action steps pause the session — do NOT rollback or mark as failed
      if (result.requiresManualAction) {
        allSucceeded = false;
        session.status = 'paused';
        session.errorMessage = `Step ${step.order} requires manual intervention: ${
          (result.output as Record<string, unknown>).note ?? 'Human action needed'
        }`;
        break;
      }

      if (!result.success) {
        allSucceeded = false;
        session.status = 'failed';
        session.errorMessage = `Step ${step.order} failed: ${result.errorMessage}`;

        // Attempt rollback of objects created by this session
        await this.rollbackSession(tenantId, sessionId, actorId, actorName);
        break;
      }
    }

    if (allSucceeded) {
      session.status = isSimulation ? 'completed_simulation' as ExecutionSessionStatus : 'completed';
      session.completedAt = new Date().toISOString();
    }

    session.updatedAt = new Date().toISOString();
    await repo.saveSession(session);

    // Cleanup: only destroy credentials and replay tracking on terminal states.
    // Paused sessions may resume and still need credentials + replay protection.
    if (session.status !== 'paused') {
      for (const handleId of session.credentialHandles) {
        credentialEscrowService.destroyCredential(tenantId, handleId);
      }
      toolBrokerService.clearReplayTracking(tenantId, sessionId);
      rollbackTracker.cleanupSession(tenantId, sessionId);
    }

    const auditEventType = allSucceeded ? 'agent.execution.completed'
      : session.status === 'paused' ? 'agent.execution.paused'
      : 'agent.execution.failed';
    await this.auditSessionEvent(tenantId, sessionId, actorId, actorName,
      auditEventType, {
        completedSteps: session.plan.steps.filter(s => s.status === 'succeeded').length,
        totalSteps: session.plan.steps.length,
        isSimulation,
        dryRun: options?.dryRun ?? false,
        sessionStatus: session.status,
        errorMessage: session.errorMessage,
      },
    );

    // Fire email notification for execution completed/failed (best-effort)
    this.notifyExecutionCompleted(tenantId, session, actorId, actorName, actorEmail ?? '').catch(err => {
      console.warn(`[ExecutionOrchestrator] notifyExecutionCompleted failed for session ${session.sessionId}:`, (err as Error).message);
    });

    return session;
  }

  /**
   * Cancel an in-progress or pending session.
   */
  async cancelSession(
    tenantId: string,
    sessionId: string,
    actorId: string,
    actorName: string,
    reason?: string,
  ): Promise<ExecutionSession> {
    const session = await repo.getSession(tenantId, sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const cancelableStatuses: ExecutionSessionStatus[] = ['planning', 'pending_approval', 'approved', 'paused'];
    if (!cancelableStatuses.includes(session.status)) {
      throw new Error(`Session ${sessionId} is in status "${session.status}" — cannot cancel`);
    }

    session.status = 'cancelled';
    session.updatedAt = new Date().toISOString();
    session.errorMessage = reason ?? 'Cancelled by user';
    await repo.saveSession(session);

    // Cleanup credentials
    for (const handleId of session.credentialHandles) {
      credentialEscrowService.destroyCredential(tenantId, handleId);
    }

    // Cleanup replay tracking
    toolBrokerService.clearReplayTracking(tenantId, sessionId);

    // Mark any externally-created objects as rollback_required, then free memory
    await this.rollbackSession(tenantId, sessionId, actorId, actorName);
    rollbackTracker.cleanupSession(tenantId, sessionId);

    await this.auditSessionEvent(tenantId, sessionId, actorId, actorName, 'agent.execution.cancelled', {
      reason,
    });

    return session;
  }

  // ── Rollback ───────────────────────────────────────────────────────────

  /**
   * Rollback all objects created by a failed session.
   * Only touches objects tracked by the rollback tracker for this session.
   * Each rollback action is audit-logged.
   */
  private async rollbackSession(
    tenantId: string,
    sessionId: string,
    actorId: string,
    actorName: string,
  ): Promise<void> {
    const pendingRollbacks = rollbackTracker.getPendingRollbacks(tenantId, sessionId);
    if (pendingRollbacks.length === 0) return;

    await this.auditSessionEvent(tenantId, sessionId, actorId, actorName, 'agent.rollback.started', {
      objectCount: pendingRollbacks.length,
      objects: pendingRollbacks.map(o => ({
        externalObjectId: o.externalObjectId,
        objectType: o.objectType,
        systemType: o.systemType,
      })),
    });

    // Mark objects as requiring manual rollback (in reverse creation order).
    // Actual provider DELETE calls are NOT executed automatically —
    // an operator must perform the rollback actions listed in evidence.
    for (const obj of [...pendingRollbacks].reverse()) {
      try {
        await rollbackTracker.markRollbackRequired(tenantId, sessionId, obj.externalObjectId, actorId, actorName);

        await evidenceStoreService.record(
          tenantId, sessionId, 'api_response',
          `Rollback required: ${obj.objectType} (${obj.externalObjectId})`,
          `Manual rollback required — ${obj.rollbackAction ?? 'contact platform admin for cleanup'}`,
          {
            provider: obj.systemType,
            externalObjectId: obj.externalObjectId,
            objectType: obj.objectType,
            rollbackAction: obj.rollbackAction,
            rollbackStatus: 'rollback_required',
            timestamp: new Date().toISOString(),
          },
        );
      } catch (err) {
        console.warn(
          `[ExecutionOrchestrator] Rollback marking failed for ${obj.objectType} (${obj.externalObjectId}):`,
          (err as Error).message,
        );
      }
    }

    await this.auditSessionEvent(tenantId, sessionId, actorId, actorName, 'agent.rollback.required', {
      objectCount: pendingRollbacks.length,
      note: 'Objects require manual rollback — provider DELETE calls not executed automatically',
    });
  }

  // ── Credential Handoff ─────────────────────────────────────────────────

  /**
   * Create a credential handoff request for a session step.
   */
  async requestCredential(
    tenantId: string,
    sessionId: string,
    stepId: string,
    purpose: string,
    actorId: string,
    actorName: string,
  ): Promise<{ handleId: string }> {
    const session = await repo.getSession(tenantId, sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (!session.plan) throw new Error(`Session ${sessionId} has no plan`);

    const step = session.plan.steps.find(s => s.stepId === stepId);
    if (!step) throw new Error(`Step ${stepId} not found in session ${sessionId}`);

    const handoff = await credentialEscrowService.createHandoff(
      tenantId,
      sessionId,
      step.targetSystem.systemType,
      session.plan.applicationId,
      purpose,
      actorId,
      actorName,
    );

    step.credentialHandle = handoff.handleId;
    session.credentialHandles.push(handoff.handleId);
    await repo.saveSession(session);

    return { handleId: handoff.handleId };
  }

  // ── Queries ────────────────────────────────────────────────────────────

  async getSession(tenantId: string, sessionId: string): Promise<ExecutionSession | undefined> {
    return repo.getSession(tenantId, sessionId);
  }

  async listSessions(tenantId: string, filters?: SessionListFilters): Promise<ExecutionSession[]> {
    return repo.listSessions(tenantId, filters);
  }

  /**
   * Get available agent capabilities.
   */
  getAgentCapabilities() {
    return [
      {
        agentType: 'sso' as const,
        name: 'SSO Configuration Agent',
        description: 'End-to-end SSO setup: Entra enterprise app + SAML/OIDC → security group → SailPoint access profile → ServiceNow catalog item → app-side SSO → verification',
        supportedActionTypes: [
          'entra.create_enterprise_app', 'entra.configure_saml_sso', 'entra.configure_oidc',
          'entra.create_group', 'entra.assign_group_to_app',
          'sailpoint.create_access_profile', 'sailpoint.create_role',
          'servicenow.create_catalog_item', 'servicenow.create_request_mapping',
          'app_connector.configure_sso', 'app_connector.verify_sso_login',
          'verification.test_sso_login',
        ],
        requiredPermissions: ['agents.plan' as const, 'agents.execute.sso' as const],
      },
      {
        agentType: 'mfa' as const,
        name: 'MFA Enforcement Agent',
        description: 'Configure MFA enforcement: Conditional Access policy → MFA method configuration → verification',
        supportedActionTypes: [
          'entra.configure_conditional_access', 'entra.configure_mfa_policy',
          'verification.test_mfa_enforcement',
        ],
        requiredPermissions: ['agents.plan' as const, 'agents.execute.sso' as const],
      },
    ];
  }

  // ── Email Notifications ─────────────────────────────────────────────────

  private async notifyPlanCreated(
    tenantId: string,
    session: ExecutionSession,
    actorId: string,
    actorName: string,
    actorEmail: string,
  ): Promise<void> {
    if (!session.plan) return;
    if (!actorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actorEmail)) return;
    const recipientEmail = actorEmail;
    const appName = session.plan.applicationName;
    const controlId = session.plan.controlId;
    const agentLabel = session.agentType === 'sso' ? 'SSO Configuration' : session.agentType === 'mfa' ? 'MFA Enforcement' : session.agentType;

    const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const firstApproval = session.approvals[0];
    let approveUrl = `${baseUrl}/agent-execution/email-action?token=unavailable`;
    let rejectUrl = approveUrl;

    if (firstApproval) {
      const [approveToken, rejectToken] = await Promise.all([
        emailActionTokenService.generateToken(tenantId, session.sessionId, firstApproval.approvalId, 'approved'),
        emailActionTokenService.generateToken(tenantId, session.sessionId, firstApproval.approvalId, 'rejected'),
      ]);
      approveUrl = `${baseUrl}/agent-execution/email-action?token=${encodeURIComponent(approveToken)}`;
      rejectUrl = `${baseUrl}/agent-execution/email-action?token=${encodeURIComponent(rejectToken)}`;
    }

    await emailService.sendAgentNotification(tenantId, {
      agentId: `agent-${session.agentType}`,
      controlId,
      applicationId: session.plan.applicationId,
      applicationName: appName,
      notificationType: 'sso-remediation-plan',
      recipients: [{ email: recipientEmail, name: actorName }],
      additionalData: {
        sessionId: session.sessionId,
        agentName: `${agentLabel} Agent`,
        blastRadius: session.plan.blastRadius.level,
        stepsCount: session.plan.steps.length,
        systemsTouched: session.plan.systemsTouched.map(s => s.systemName).join(', '),
        approvalsRequired: session.approvals.length,
        status: session.status,
        outcome: 'PENDING_APPROVAL',
        riskLevel: session.plan.blastRadius.level,
        remediationSteps: session.plan.steps.map((s, i) => `${i + 1}. ${s.description}`).join('\n'),
        estimatedTimeline: session.plan.estimatedDuration ?? 'To be determined',
        approveUrl,
        rejectUrl,
      },
    }, actorId, actorName);
  }

  /**
   * Notify stakeholders when a plan is fully approved.
   * Stakeholders: app business owner, app engineer/admin (technicalSme),
   * IAM engineers (Engineer role), IAM managers (Manager role).
   */
  private async notifyStakeholders(
    tenantId: string,
    session: ExecutionSession,
    approverName: string,
  ): Promise<void> {
    if (!session.plan) return;
    const appName = session.plan.applicationName;
    const controlId = session.plan.controlId;
    const catalogEntry = CONTROLS_CATALOG.find(c => c.controlId === controlId);
    const agentLabel = session.agentType === 'sso' ? 'SSO Configuration' : session.agentType === 'mfa' ? 'MFA Enforcement' : session.agentType;

    const recipients: { email: string; name?: string; role: string }[] = [];
    const seen = new Set<string>();

    const app = applicationService.getApplication(tenantId, session.plan.applicationId);
    if (app?.ownerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(app.ownerEmail)) {
      const key = app.ownerEmail.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        recipients.push({ email: app.ownerEmail, name: app.owner, role: 'Business Owner' });
      }
    }
    if (app?.technicalSmeEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(app.technicalSmeEmail)) {
      const key = app.technicalSmeEmail.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        recipients.push({ email: app.technicalSmeEmail, name: app.technicalSme, role: 'App Engineer/Admin' });
      }
    }

    const engineers = authRepository.findByRole(tenantId, 'Engineer');
    for (const eng of engineers) {
      const key = eng.email.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        recipients.push({ email: eng.email, name: eng.displayName, role: 'IAM Engineer' });
      }
    }

    const managers = authRepository.findByRole(tenantId, 'Manager');
    for (const mgr of managers) {
      const key = mgr.email.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        recipients.push({ email: mgr.email, name: mgr.displayName, role: 'IAM Manager' });
      }
    }

    if (recipients.length === 0) return;

    const approvalSummary = session.approvals.map(a =>
      `${a.role}: ${a.status}${a.approverName ? ` by ${a.approverName}` : ''}${a.resolvedAt ? ` at ${a.resolvedAt}` : ''}`,
    ).join('\n');

    await emailService.sendAgentNotification(tenantId, {
      agentId: `agent-${session.agentType}`,
      controlId,
      applicationId: session.plan.applicationId,
      applicationName: appName,
      notificationType: 'approval-granted-notification',
      recipients: recipients.map(r => ({ email: r.email, name: r.name })),
      additionalData: {
        sessionId: session.sessionId,
        agentName: `${agentLabel} Agent`,
        approverName,
        riskLevel: session.plan.blastRadius.level,
        stepsCount: session.plan.steps.length,
        systemsTouched: session.plan.systemsTouched.map(s => s.systemName).join(', '),
        controlName: catalogEntry?.name ?? controlId,
        approvalSummary,
      },
    }, 'system', 'IDVIZE System');

    await auditService.log({
      tenantId,
      eventType: 'email.stakeholder.notification',
      actorId: 'system',
      actorName: 'IDVIZE System',
      resource: 'agent_execution',
      outcome: 'success',
      metadata: {
        sessionId: session.sessionId,
        applicationName: appName,
        recipientCount: recipients.length,
        recipientRoles: recipients.map(r => r.role),
      },
    });
  }

  private async notifyExecutionCompleted(
    tenantId: string,
    session: ExecutionSession,
    actorId: string,
    actorName: string,
    actorEmail: string,
  ): Promise<void> {
    if (!session.plan) return;
    if (!actorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actorEmail)) return;
    const recipientEmail = actorEmail;
    const appName = session.plan.applicationName;
    const controlId = session.plan.controlId;

    const succeeded = session.status === 'completed' || session.status === 'completed_simulation';
    const completedSteps = session.plan.steps.filter(s => s.status === 'succeeded').length;
    const totalSteps = session.plan.steps.length;

    await emailService.sendAgentNotification(tenantId, {
      agentId: `agent-${session.agentType}`,
      controlId,
      applicationId: session.plan.applicationId,
      applicationName: appName,
      notificationType: 'agent-execution-result',
      recipients: [{ email: recipientEmail, name: actorName }],
      additionalData: {
        sessionId: session.sessionId,
        agentName: `${session.agentType.toUpperCase()} Agent`,
        status: session.status,
        completedSteps,
        totalSteps,
        outcome: succeeded ? 'COMPLETED' : 'FAILED',
        riskLevel: session.plan.blastRadius.level,
        statusBg: succeeded ? '#f0fdf4' : '#fef2f2',
        statusBorder: succeeded ? '#16a34a' : '#dc2626',
        statusColor: succeeded ? '#166534' : '#991b1b',
        statusLabel: succeeded ? 'Execution Completed' : 'Execution Failed',
        statusMessage: succeeded
          ? `All ${completedSteps} steps completed successfully.`
          : `${completedSteps} of ${totalSteps} steps completed. Review session for details.`,
      },
    }, actorId, actorName);
  }

  // ── Permission Checking ────────────────────────────────────────────────

  private checkStepPermissions(
    steps: { targetSystem: { systemType: SystemType } }[],
    actorPermissions: PermissionId[],
  ): string[] {
    const required = new Set<PermissionId>();
    for (const step of steps) {
      const perm = SYSTEM_PERMISSION_MAP[step.targetSystem.systemType];
      if (perm) required.add(perm);
    }

    const missing: string[] = [];
    for (const perm of required) {
      if (!actorPermissions.includes(perm)) {
        missing.push(perm);
      }
    }
    return missing;
  }

  /**
   * Validate context inputs against known schema constraints.
   * Prevents empty arrays from passing generic 'required' checks and
   * causing unintended scope expansion (e.g. empty includeGroups → all users).
   */
  private validateContextInputs(inputs: Record<string, unknown>): string[] {
    const errors: string[] = [];

    if ('includeGroups' in inputs) {
      const val = inputs.includeGroups;
      if (!Array.isArray(val) || val.length === 0) {
        errors.push('includeGroups must be a non-empty array of group IDs');
      } else if (val.some((g: unknown) => typeof g !== 'string' || (g as string).trim() === '')) {
        errors.push('includeGroups must contain only non-empty string group IDs');
      }
    }

    if ('entityId' in inputs) {
      if (typeof inputs.entityId !== 'string' || inputs.entityId.trim() === '') {
        errors.push('entityId must be a non-empty string');
      }
    }

    if ('acsUrl' in inputs) {
      const val = inputs.acsUrl;
      if (typeof val !== 'string' || !val.startsWith('https://')) {
        errors.push('acsUrl must be a valid HTTPS URL');
      }
    }

    if ('sourceId' in inputs) {
      if (typeof inputs.sourceId !== 'string' || inputs.sourceId.trim() === '') {
        errors.push('sourceId must be a non-empty string');
      }
    }

    if ('testUserEmail' in inputs) {
      const val = inputs.testUserEmail;
      if (typeof val !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        errors.push('testUserEmail must be a valid email address');
      }
    }

    return errors;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private buildSession(
    sessionId: string,
    tenantId: string,
    agentType: AgentType,
    status: ExecutionSessionStatus,
    createdBy: string,
  ): ExecutionSession {
    const now = new Date().toISOString();
    return {
      sessionId,
      tenantId,
      agentType,
      status,
      approvals: [],
      evidence: [],
      credentialHandles: [],
      createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Resolve {{step:N:fieldName}} placeholders in step inputs from
   * previous steps' result outputs. Unresolvable references are left
   * as-is (the unresolved-placeholder check will catch them).
   */
  private resolveStepOutputReferences(step: ExecutionStep, allSteps: ExecutionStep[]): void {
    const STEP_REF_RE = /^\{\{step:(\d+):(\w+)\}\}$/;
    for (const [key, value] of Object.entries(step.toolAction.inputs)) {
      if (typeof value !== 'string') continue;
      const match = STEP_REF_RE.exec(value);
      if (!match) continue;
      const refOrder = parseInt(match[1], 10);
      const refField = match[2];
      const refStep = allSteps.find(s => s.order === refOrder);
      if (refStep?.result?.output && refField in (refStep.result.output as Record<string, unknown>)) {
        (step.toolAction.inputs as Record<string, unknown>)[key] =
          (refStep.result.output as Record<string, unknown>)[refField];
      }
    }
  }

  /**
   * Resolve {{key}} placeholders in step inputs from plan contextData.
   * Only resolves simple {{key}} patterns (not {{step:N:field}}).
   */
  private resolveContextPlaceholders(step: ExecutionStep, contextData: Record<string, unknown>): void {
    const CONTEXT_REF_RE = /^\{\{(\w+)\}\}$/;
    for (const [key, value] of Object.entries(step.toolAction.inputs)) {
      if (typeof value !== 'string') continue;
      const match = CONTEXT_REF_RE.exec(value);
      if (!match) continue;
      const ctxKey = match[1];
      if (ctxKey in contextData && contextData[ctxKey] !== undefined) {
        (step.toolAction.inputs as Record<string, unknown>)[key] = contextData[ctxKey];
      }
    }
  }

  private async auditSessionEvent(
    tenantId: string,
    sessionId: string,
    actorId: string,
    actorName: string,
    eventType: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await auditService.log({
      tenantId,
      eventType: eventType as any,
      actorId,
      actorName,
      targetType: 'execution_session',
      targetId: sessionId,
      resource: 'agent_execution',
      outcome: eventType.includes('failed') || eventType.includes('rejected') || eventType.includes('rollback') ? 'failure' : 'success',
      metadata,
    });
  }
}

export const executionOrchestratorService = new ExecutionOrchestratorService();
