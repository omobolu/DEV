/**
 * IDVIZE Service Layer Exports
 */

// Platform initialization
export { initializePlatform, getPlatformStatus } from './platform-init'

// Orchestration
export { agentOrchestrator } from '../orchestration/agent-orchestrator'
export { eventBus } from '../orchestration/event-bus'

// Memory
export { workingMemory, operationalMemory, knowledgeMemory } from '../memory/memory-store'

// Guardrails
export { guardrailEvaluator } from '../guardrails/guardrail-evaluator'

// Security
export { authService } from '../modules/security/auth/auth-service'
export { authorizationService } from '../modules/security/authorization/authorization-service'
export { auditService } from '../modules/security/audit/audit-service'
export { scimService } from '../modules/security/scim/scim-service'
export { approvalService } from '../modules/security/approvals/approval-service'
export { vaultService } from '../modules/security/vault/vault-service'
export { policyService } from '../modules/security/policies/policy-service'

// Domain Modules
export { applicationGovernanceService } from '../modules/application-governance/application-service'
export { buildExecutionService } from '../modules/build-execution/build-service'
export { costIntelligenceService } from '../modules/cost-intelligence/cost-service'
export { documentationService } from '../modules/documentation/documentation-service'

// Tools
export { adapterRegistry, PREDEFINED_ADAPTERS } from '../tools/adapters'

// Prompts
export { PROMPT_TEMPLATES, fillTemplate, getTemplatesForAgent } from '../prompts/prompt-templates'
