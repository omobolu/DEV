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
 */

import { v4 as uuidv4 } from 'uuid';
import { planningService } from './planning.service';
import { executionPolicyEngine } from './policy-engine.service';
import { executionApprovalService } from './approval.service';
import { toolBrokerService } from './tool-broker.service';
import { evidenceStoreService } from './evidence-store.service';
import { credentialEscrowService } from './credential-escrow.service';
import { auditService } from '../security/audit/audit.service';
import type {
  ExecutionSession,
  ExecutionSessionStatus,
  AgentType,
  CreatePlanRequest,
  SessionListFilters,
} from './agent-execution.types';

class ExecutionOrchestratorService {
  private sessions = new Map<string, Map<string, ExecutionSession>>(); // tenantId → sessionId → session

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
    const sessionId = `exs-${uuidv4().split('-')[0]}`;

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
      this.saveSession(tenantId, session);

      await this.auditSessionEvent(tenantId, sessionId, actorId, actorName, 'agent.plan.rejected', {
        violations: policyResult.violations,
      });

      return session;
    }

    // 3. Generate required approvals
    const approvals = executionApprovalService.generateRequiredApprovals(plan);
    executionApprovalService.saveApprovals(tenantId, approvals);

    // 4. Build session
    const session = this.buildSession(sessionId, tenantId, request.agentType, 'pending_approval', actorId);
    session.plan = plan;
    session.approvals = approvals;
    this.saveSession(tenantId, session);

    // 5. Record evidence: plan creation
    evidenceStoreService.record(
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
    decision: 'approved' | 'rejected',
    comment?: string,
  ): Promise<ExecutionSession> {
    const session = this.getSession(tenantId, sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'pending_approval') {
      throw new Error(`Session ${sessionId} is in status "${session.status}" — cannot resolve approvals`);
    }

    await executionApprovalService.resolve(tenantId, approvalId, sessionId, approverId, approverName, decision, comment);

    // Update session approvals
    session.approvals = executionApprovalService.getSessionApprovals(tenantId, sessionId);

    // Check if fully approved
    if (executionApprovalService.isFullyApproved(tenantId, sessionId)) {
      session.status = 'approved';
      session.updatedAt = new Date().toISOString();

      await this.auditSessionEvent(tenantId, sessionId, approverId, approverName, 'agent.plan.approved', {
        approvalId,
      });
    } else if (executionApprovalService.isRejected(tenantId, sessionId)) {
      session.status = 'cancelled';
      session.updatedAt = new Date().toISOString();
      session.errorMessage = `Approval rejected by ${approverName}: ${comment ?? 'no reason given'}`;

      await this.auditSessionEvent(tenantId, sessionId, approverId, approverName, 'agent.plan.rejected', {
        approvalId,
        comment,
      });
    }

    this.saveSession(tenantId, session);
    return session;
  }

  /**
   * Phase 3: Execute an approved plan.
   * Steps are executed sequentially through the Tool Broker.
   */
  async executeSession(
    tenantId: string,
    sessionId: string,
    actorId: string,
    actorName: string,
  ): Promise<ExecutionSession> {
    const session = this.getSession(tenantId, sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'approved') {
      throw new Error(`Session ${sessionId} is in status "${session.status}" — must be "approved" to execute`);
    }
    if (!session.plan) throw new Error(`Session ${sessionId} has no plan`);

    session.status = 'executing';
    session.updatedAt = new Date().toISOString();
    this.saveSession(tenantId, session);

    await this.auditSessionEvent(tenantId, sessionId, actorId, actorName, 'agent.execution.started', {
      stepsCount: session.plan.steps.length,
    });

    let allSucceeded = true;

    for (const step of session.plan.steps) {
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
        this.saveSession(tenantId, session);

        evidenceStoreService.record(
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

      // Record evidence for this step
      const evidence = evidenceStoreService.record(
        tenantId, sessionId,
        result.success ? 'api_response' : 'error_log',
        `Step ${step.order}: ${step.description}`,
        result.success ? 'Completed successfully' : `Failed: ${result.errorMessage}`,
        { stepId: step.stepId, actionType: step.actionType, output: result.output },
        step.stepId,
      );

      result.evidenceIds.push(evidence.evidenceId);
      session.evidence.push(evidence);

      if (!result.success) {
        allSucceeded = false;
        session.status = 'failed';
        session.errorMessage = `Step ${step.order} failed: ${result.errorMessage}`;
        break;
      }
    }

    if (allSucceeded) {
      session.status = 'completed';
      session.completedAt = new Date().toISOString();
    }

    session.updatedAt = new Date().toISOString();
    this.saveSession(tenantId, session);

    // Cleanup: destroy any ephemeral credentials
    for (const handleId of session.credentialHandles) {
      credentialEscrowService.destroyCredential(tenantId, handleId);
    }

    await this.auditSessionEvent(tenantId, sessionId, actorId, actorName,
      allSucceeded ? 'agent.execution.completed' : 'agent.execution.failed', {
        completedSteps: session.plan.steps.filter(s => s.status === 'succeeded').length,
        totalSteps: session.plan.steps.length,
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
    const session = this.getSession(tenantId, sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const cancelableStatuses: ExecutionSessionStatus[] = ['planning', 'pending_approval', 'approved', 'paused'];
    if (!cancelableStatuses.includes(session.status)) {
      throw new Error(`Session ${sessionId} is in status "${session.status}" — cannot cancel`);
    }

    session.status = 'cancelled';
    session.updatedAt = new Date().toISOString();
    session.errorMessage = reason ?? 'Cancelled by user';
    this.saveSession(tenantId, session);

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
    const session = this.getSession(tenantId, sessionId);
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
    this.saveSession(tenantId, session);

    return { handleId: handoff.handleId };
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getSession(tenantId: string, sessionId: string): ExecutionSession | undefined {
    return this.sessions.get(tenantId)?.get(sessionId);
  }

  listSessions(tenantId: string, filters?: SessionListFilters): ExecutionSession[] {
    const tenantSessions = this.sessions.get(tenantId);
    if (!tenantSessions) return [];

    let results = Array.from(tenantSessions.values());

    if (filters?.status) {
      results = results.filter(s => s.status === filters.status);
    }
    if (filters?.agentType) {
      results = results.filter(s => s.agentType === filters.agentType);
    }
    if (filters?.applicationId && results.length > 0) {
      results = results.filter(s => s.plan?.applicationId === filters.applicationId);
    }

    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  private saveSession(tenantId: string, session: ExecutionSession): void {
    if (!this.sessions.has(tenantId)) {
      this.sessions.set(tenantId, new Map());
    }
    this.sessions.get(tenantId)!.set(session.sessionId, session);
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
