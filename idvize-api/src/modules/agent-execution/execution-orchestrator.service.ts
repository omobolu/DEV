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
import { auditService } from '../security/audit/audit.service';
import * as repo from './agent-execution.repository';
import type {
  ExecutionSession,
  ExecutionSessionStatus,
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
  ): Promise<ExecutionSession> {
    const sessionId = `exs-${uuidv4()}`;

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
    }

    await repo.saveSession(session);
    return session;
  }

  /**
   * Phase 3: Execute an approved plan.
   * Steps are executed sequentially through the Tool Broker.
   * Enforces per-step system permissions.
   *
   * v1: Stub adapters produce simulation results (not real execution).
   */
  async executeSession(
    tenantId: string,
    sessionId: string,
    actorId: string,
    actorName: string,
    actorPermissions: PermissionId[],
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
    });

    let allSucceeded = true;
    let isSimulation = false;

    for (const step of session.plan.steps) {
      // Skip already-succeeded steps when resuming from paused
      if (step.status === 'succeeded') continue;

      step.status = 'in_progress';
      step.startedAt = new Date().toISOString();

      // Check if step requires credential
      let credentialHandle: string | undefined;
      if (step.requiresCredential && step.credentialHandle) {
        credentialHandle = step.credentialHandle;
      }

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

      // Execute step through Tool Broker
      const result = await toolBrokerService.execute(
        tenantId,
        step.toolAction,
        actorId,
        actorName,
        credentialHandle,
      );

      step.result = result;
      step.completedAt = new Date().toISOString();
      step.status = result.success ? 'succeeded' : 'failed';

      // Detect stub/simulation results
      if (result.output && (result.output as Record<string, unknown>)._stub === true) {
        isSimulation = true;
      }

      // Record evidence for this step
      const evidence = await evidenceStoreService.record(
        tenantId, sessionId,
        result.success ? 'api_response' : 'error_log',
        `Step ${step.order}: ${step.description}`,
        result.success ? 'Completed successfully' : `Failed: ${result.errorMessage}`,
        { stepId: step.stepId, actionType: step.actionType, output: result.output },
        step.stepId,
      );

      result.evidenceIds.push(evidence.evidenceId);

      if (!result.success) {
        allSucceeded = false;
        session.status = 'failed';
        session.errorMessage = `Step ${step.order} failed: ${result.errorMessage}`;
        break;
      }
    }

    if (allSucceeded) {
      // Stub adapters produce simulation status, not completed
      session.status = isSimulation ? 'completed_simulation' as ExecutionSessionStatus : 'completed';
      session.completedAt = new Date().toISOString();
    }

    session.updatedAt = new Date().toISOString();
    await repo.saveSession(session);

    // Cleanup: destroy any ephemeral credentials
    for (const handleId of session.credentialHandles) {
      credentialEscrowService.destroyCredential(tenantId, handleId);
    }

    await this.auditSessionEvent(tenantId, sessionId, actorId, actorName,
      allSucceeded ? 'agent.execution.completed' : 'agent.execution.failed', {
        completedSteps: session.plan.steps.filter(s => s.status === 'succeeded').length,
        totalSteps: session.plan.steps.length,
        isSimulation,
        errorMessage: session.errorMessage,
      },
    );

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

    await this.auditSessionEvent(tenantId, sessionId, actorId, actorName, 'agent.execution.cancelled', {
      reason,
    });

    return session;
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
      outcome: eventType.includes('failed') || eventType.includes('rejected') ? 'failure' : 'success',
      metadata,
    });
  }
}

export const executionOrchestratorService = new ExecutionOrchestratorService();
