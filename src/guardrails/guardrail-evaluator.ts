/**
 * IDVIZE Platform Guardrail Evaluator
 * Classifies actions, enforces risk policies, requires approvals
 */

import type {
  GuardrailCheck,
  GuardrailPolicy,
  GuardrailEvaluator,
  ProposedAction,
  ActionClassification,
  GuardrailCondition,
} from '../types/guardrails'
import type { RiskLevel } from '../types/guardrails'
import { recordAudit } from '../types/audit'

export class DefaultGuardrailEvaluator implements GuardrailEvaluator {
  private policies: GuardrailPolicy[] = []

  constructor() {
    this.registerDefaultPolicies()
  }

  evaluate(action: ProposedAction): GuardrailCheck {
    const matchingPolicies = this.policies.filter(p =>
      (!p.agentDomain || p.agentDomain === action.agentDomain) &&
      (!p.eventType || p.eventType === action.actionType)
    )

    let maxRiskLevel: RiskLevel = action.riskLevel
    let approvalRequired = false
    const blockers: string[] = []
    const warnings: string[] = []

    for (const policy of matchingPolicies) {
      if (this.riskToNumber(action.riskLevel) > this.riskToNumber(policy.maxRiskLevel)) {
        if (policy.requiresApproval) {
          approvalRequired = true
          warnings.push(`Policy "${policy.name}" requires approval for risk level ${action.riskLevel}`)
        }
      }

      for (const condition of policy.conditions) {
        const result = this.evaluateCondition(condition, action)
        if (result === 'block') {
          blockers.push(`Blocked by policy "${policy.name}": condition on ${condition.field}`)
        } else if (result === 'warn') {
          warnings.push(`Warning from policy "${policy.name}": condition on ${condition.field}`)
        } else if (result === 'require_approval') {
          approvalRequired = true
        }
      }
    }

    const actionType: ActionClassification = blockers.length > 0
      ? 'approval_required'
      : approvalRequired
        ? 'approval_required'
        : action.riskLevel === 'low' && matchingPolicies.some(p => p.autoExecutable)
          ? 'auto_executable'
          : action.riskLevel === 'low'
            ? 'recommendation_only'
            : 'draft_only'

    const check: GuardrailCheck = {
      actionType,
      riskLevel: maxRiskLevel,
      approvalRequired,
      rationale: this.buildRationale(action, matchingPolicies, blockers, warnings),
      blockers,
      warnings,
    }

    recordAudit(
      'agent_decision',
      { type: 'agent', id: action.agentId, name: action.agentDomain },
      'guardrail_check',
      action.targetResource,
      blockers.length > 0 ? 'denied' : 'success',
      {
        actionType: check.actionType,
        riskLevel: check.riskLevel,
        approvalRequired: check.approvalRequired,
        blockerCount: blockers.length,
        warningCount: warnings.length,
      },
    )

    return check
  }

  registerPolicy(policy: GuardrailPolicy): void {
    const existing = this.policies.findIndex(p => p.id === policy.id)
    if (existing >= 0) {
      this.policies[existing] = policy
    } else {
      this.policies.push(policy)
    }
  }

  getPolicies(): GuardrailPolicy[] {
    return [...this.policies]
  }

  private evaluateCondition(condition: GuardrailCondition, action: ProposedAction): 'block' | 'warn' | 'require_approval' | 'pass' {
    const value = action.parameters[condition.field]
    if (value === undefined) return 'pass'

    let matches = false
    switch (condition.operator) {
      case 'equals':
        matches = String(value) === String(condition.value)
        break
      case 'not_equals':
        matches = String(value) !== String(condition.value)
        break
      case 'greater_than':
        matches = Number(value) > Number(condition.value)
        break
      case 'less_than':
        matches = Number(value) < Number(condition.value)
        break
      case 'contains':
        matches = String(value).includes(String(condition.value))
        break
    }

    return matches ? condition.action : 'pass'
  }

  private riskToNumber(risk: RiskLevel): number {
    const map: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 }
    return map[risk]
  }

  private buildRationale(
    action: ProposedAction,
    policies: GuardrailPolicy[],
    blockers: string[],
    warnings: string[],
  ): string {
    const parts: string[] = []
    parts.push(`Action "${action.description}" evaluated against ${policies.length} policies.`)
    if (blockers.length > 0) parts.push(`${blockers.length} blocker(s) found.`)
    if (warnings.length > 0) parts.push(`${warnings.length} warning(s) found.`)
    if (blockers.length === 0 && warnings.length === 0) parts.push('No issues found.')
    return parts.join(' ')
  }

  private registerDefaultPolicies(): void {
    this.registerPolicy({
      id: 'default-high-risk-approval',
      name: 'High Risk Actions Require Approval',
      description: 'Any action classified as high or critical risk requires human approval',
      maxRiskLevel: 'medium',
      requiresApproval: true,
      autoExecutable: false,
      conditions: [],
    })

    this.registerPolicy({
      id: 'default-secret-access',
      name: 'Secret Access Controls',
      description: 'Secret reveal and rotation actions always require approval',
      agentDomain: 'cost-intelligence',
      maxRiskLevel: 'low',
      requiresApproval: true,
      autoExecutable: false,
      conditions: [{
        field: 'involves_secrets',
        operator: 'equals',
        value: 'true',
        action: 'require_approval',
      }],
    })

    this.registerPolicy({
      id: 'default-read-only-auto',
      name: 'Read-Only Auto-Executable',
      description: 'Read-only operations at low risk can be auto-executed',
      maxRiskLevel: 'low',
      requiresApproval: false,
      autoExecutable: true,
      conditions: [],
    })
  }
}

/** Singleton guardrail evaluator */
export const guardrailEvaluator = new DefaultGuardrailEvaluator()
