/**
 * Execution Policy Engine — Validates and enforces execution policies.
 *
 * Responsibilities:
 *   - Validate execution plans against tenant policies
 *   - Estimate blast radius and enforce risk thresholds
 *   - Determine required approval levels based on plan scope
 *   - Block execution if policies are violated
 *   - Enforce action allowlists per agent type
 *
 * The policy engine is deterministic — no AI/LLM involvement.
 */

import type {
  ExecutionPlan,
  ExecutionStep,
  AgentType,
  ActionType,
  BlastRadiusLevel,
} from './agent-execution.types';

// ── Policy Violations ────────────────────────────────────────────────────────

export interface PolicyViolation {
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
  step?: string; // stepId if violation is step-specific
}

export interface PolicyEvaluation {
  allowed: boolean;
  violations: PolicyViolation[];
  requiredApprovalLevel: 'standard' | 'elevated' | 'platform_admin';
  maxBlastRadius: BlastRadiusLevel;
}

// ── Agent Action Allowlists ──────────────────────────────────────────────────

const AGENT_ALLOWED_ACTIONS: Record<AgentType, Set<ActionType>> = {
  sso: new Set([
    'entra.create_enterprise_app',
    'entra.configure_saml_sso',
    'entra.configure_oidc',
    'entra.create_group',
    'entra.assign_group_to_app',
    'sailpoint.create_access_profile',
    'sailpoint.create_role',
    'servicenow.create_catalog_item',
    'servicenow.create_request_mapping',
    'app_connector.configure_sso',
    'app_connector.verify_sso_login',
    'verification.test_sso_login',
  ]),
  mfa: new Set([
    'entra.configure_conditional_access',
    'entra.configure_mfa_policy',
    'verification.test_mfa_enforcement',
  ]),
  lifecycle: new Set([
    'sailpoint.create_source',
    'sailpoint.trigger_aggregation',
    'sailpoint.create_certification_campaign',
    'servicenow.create_workflow',
  ]),
  'access-review': new Set([
    'sailpoint.create_certification_campaign',
    'verification.validate_group_membership',
  ]),
  pam: new Set([
    // PAM agent actions to be defined in v2
  ]),
};

// ── Policy Rules ─────────────────────────────────────────────────────────────

const MAX_STEPS_PER_PLAN = 20;
const MAX_SYSTEMS_PER_PLAN = 6;

class ExecutionPolicyEngine {

  /**
   * Evaluate an execution plan against all policies.
   * Returns whether execution is allowed and any violations.
   */
  evaluate(plan: ExecutionPlan): PolicyEvaluation {
    const violations: PolicyViolation[] = [];

    // Rule 1: Validate all actions are in the agent's allowlist
    this.checkActionAllowlist(plan, violations);

    // Rule 2: Enforce step limits
    this.checkStepLimits(plan, violations);

    // Rule 3: Validate no credential-bearing steps without prerequisites
    this.checkCredentialPrerequisites(plan, violations);

    // Rule 4: Verify rollback steps exist for destructive actions
    this.checkRollbackCoverage(plan, violations);

    // Rule 5: Check blast radius is reasonable
    this.checkBlastRadius(plan, violations);

    // Rule 6: Ensure plan has required prerequisites
    this.checkPrerequisites(plan, violations);

    const hasErrors = violations.some(v => v.severity === 'error');
    const requiredApprovalLevel = this.determineApprovalLevel(plan);
    const maxBlastRadius = this.determineMaxBlastRadius(plan);

    return {
      allowed: !hasErrors,
      violations,
      requiredApprovalLevel,
      maxBlastRadius,
    };
  }

  // ── Rule Checks ────────────────────────────────────────────────────────

  private checkActionAllowlist(plan: ExecutionPlan, violations: PolicyViolation[]): void {
    const allowedActions = AGENT_ALLOWED_ACTIONS[plan.agentType];
    if (!allowedActions) {
      violations.push({
        ruleId: 'POLICY-001',
        severity: 'error',
        message: `Unknown agent type: ${plan.agentType}`,
      });
      return;
    }

    for (const step of plan.steps) {
      if (!allowedActions.has(step.actionType)) {
        violations.push({
          ruleId: 'POLICY-002',
          severity: 'error',
          message: `Action "${step.actionType}" is not allowed for agent type "${plan.agentType}"`,
          step: step.stepId,
        });
      }
    }
  }

  private checkStepLimits(plan: ExecutionPlan, violations: PolicyViolation[]): void {
    if (plan.steps.length > MAX_STEPS_PER_PLAN) {
      violations.push({
        ruleId: 'POLICY-003',
        severity: 'error',
        message: `Plan has ${plan.steps.length} steps (max ${MAX_STEPS_PER_PLAN})`,
      });
    }

    if (plan.systemsTouched.length > MAX_SYSTEMS_PER_PLAN) {
      violations.push({
        ruleId: 'POLICY-004',
        severity: 'warning',
        message: `Plan touches ${plan.systemsTouched.length} systems (recommended max ${MAX_SYSTEMS_PER_PLAN})`,
      });
    }
  }

  private checkCredentialPrerequisites(plan: ExecutionPlan, violations: PolicyViolation[]): void {
    const credentialSteps = plan.steps.filter(s => s.requiresCredential);
    const hasCredentialPrereq = plan.prerequisites.some(p => p.type === 'credential_handoff');

    if (credentialSteps.length > 0 && !hasCredentialPrereq) {
      violations.push({
        ruleId: 'POLICY-005',
        severity: 'error',
        message: `Plan has ${credentialSteps.length} steps requiring credentials but no credential_handoff prerequisite`,
      });
    }
  }

  private checkRollbackCoverage(plan: ExecutionPlan, violations: PolicyViolation[]): void {
    const destructiveSteps = plan.steps.filter(s =>
      s.actionType.includes('create_') || s.actionType.includes('configure_'),
    );

    if (destructiveSteps.length > 0 && plan.rollbackSteps.length === 0) {
      violations.push({
        ruleId: 'POLICY-006',
        severity: 'warning',
        message: `Plan has ${destructiveSteps.length} destructive steps but no rollback steps defined`,
      });
    }
  }

  private checkBlastRadius(plan: ExecutionPlan, violations: PolicyViolation[]): void {
    if (plan.blastRadius.level === 'critical' && !plan.blastRadius.reversible) {
      violations.push({
        ruleId: 'POLICY-007',
        severity: 'warning',
        message: 'Plan has CRITICAL blast radius and is not fully reversible — requires platform_admin approval',
      });
    }
  }

  private checkPrerequisites(plan: ExecutionPlan, violations: PolicyViolation[]): void {
    const hasAppSideChanges = plan.steps.some(s =>
      s.targetSystem.systemType === 'app_connector',
    );

    if (hasAppSideChanges) {
      const hasOwnerConfirmation = plan.prerequisites.some(p => p.type === 'owner_confirmation');
      if (!hasOwnerConfirmation) {
        violations.push({
          ruleId: 'POLICY-008',
          severity: 'warning',
          message: 'Plan modifies app-side configuration but has no owner_confirmation prerequisite',
        });
      }
    }
  }

  // ── Approval Level Determination ───────────────────────────────────────

  private determineApprovalLevel(plan: ExecutionPlan): 'standard' | 'elevated' | 'platform_admin' {
    if (plan.blastRadius.level === 'critical') return 'platform_admin';
    if (plan.blastRadius.level === 'high') return 'elevated';
    if (plan.steps.some(s => s.requiresCredential)) return 'elevated';
    if (plan.systemsTouched.length >= 3) return 'elevated';
    return 'standard';
  }

  private determineMaxBlastRadius(plan: ExecutionPlan): BlastRadiusLevel {
    return plan.blastRadius.level;
  }
}

export const executionPolicyEngine = new ExecutionPolicyEngine();
