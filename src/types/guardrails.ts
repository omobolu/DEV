/**
 * IDVIZE Platform Guardrails Types
 * Part 9: Guardrails / Approval Layer
 */

export type ActionClassification =
  | 'read_only'
  | 'recommendation_only'
  | 'draft_only'
  | 'approval_required'
  | 'auto_executable'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface GuardrailCheck {
  actionType: ActionClassification
  riskLevel: RiskLevel
  approvalRequired: boolean
  rationale: string
  blockers: string[]
  warnings: string[]
}

export interface GuardrailPolicy {
  id: string
  name: string
  description: string
  agentDomain?: string
  eventType?: string
  maxRiskLevel: RiskLevel
  requiresApproval: boolean
  autoExecutable: boolean
  conditions: GuardrailCondition[]
}

export interface GuardrailCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'
  value: string | number
  action: 'block' | 'warn' | 'require_approval'
}

/**
 * Guardrail evaluator contract
 */
export interface GuardrailEvaluator {
  /** Evaluate an action against guardrail policies */
  evaluate(action: ProposedAction): GuardrailCheck

  /** Register a new guardrail policy */
  registerPolicy(policy: GuardrailPolicy): void

  /** Get all registered policies */
  getPolicies(): GuardrailPolicy[]
}

export interface ProposedAction {
  agentId: string
  agentDomain: string
  actionType: string
  description: string
  targetResource: string
  targetResourceId?: string
  riskLevel: RiskLevel
  parameters: Record<string, unknown>
}
