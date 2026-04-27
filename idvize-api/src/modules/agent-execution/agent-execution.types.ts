/**
 * Agent Execution Framework — Type Definitions
 *
 * Defines the controlled execution model where:
 *   - Agents produce structured intent (plans), NOT direct execution
 *   - Humans approve plans before execution begins
 *   - A Tool Broker executes allowlisted actions through deterministic adapters
 *   - Credentials are never exposed to the model or stored in prompts/logs
 *   - All actions are tenant-scoped, permission-checked, and audit-logged
 *
 * Architecture:
 *   Agent Controller → Agent Service → Planning Service → Approval Service
 *     → Execution Orchestrator → Policy Engine → Tool Broker
 *       → [Entra | SailPoint | ServiceNow | AppConnector] Adapters
 *     → Audit Service → Evidence Store
 */

// ── Execution Session ────────────────────────────────────────────────────────

export type ExecutionSessionStatus =
  | 'planning'              // Agent is generating the plan
  | 'pending_approval'      // Plan complete, awaiting human approval
  | 'approved'              // Plan approved, ready for execution
  | 'executing'             // Tool broker is running actions
  | 'paused'                // Execution paused (manual intervention needed)
  | 'completed'             // All actions succeeded (live execution)
  | 'completed_simulation'  // All actions succeeded (stub adapters — no real changes made)
  | 'failed'                // One or more actions failed
  | 'cancelled'             // User cancelled the session
  | 'expired';              // Approval window expired

export interface ExecutionSession {
  sessionId: string;
  tenantId: string;
  agentType: AgentType;
  status: ExecutionSessionStatus;
  plan?: ExecutionPlan;
  approvals: ExecutionApproval[];
  evidence: EvidenceRecord[];
  credentialHandles: string[];     // References only — never the actual secrets
  createdBy: string;               // userId who initiated
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

// ── Agent Types ──────────────────────────────────────────────────────────────

export type AgentType = 'sso' | 'mfa' | 'lifecycle' | 'access-review' | 'pam';

export interface AgentCapability {
  agentType: AgentType;
  name: string;
  description: string;
  supportedActionTypes: ActionType[];
  requiredPermissions: AgentPermissionId[];
}

// ── Execution Plan ───────────────────────────────────────────────────────────

export interface ExecutionPlan {
  planId: string;
  sessionId: string;
  tenantId: string;
  agentType: AgentType;
  applicationId: string;
  applicationName: string;
  controlId: string;
  controlName: string;
  summary: string;                // Human-readable plan description
  systemsTouched: SystemTarget[]; // Which external systems will be modified
  blastRadius: BlastRadius;       // Risk assessment of the plan
  steps: ExecutionStep[];
  prerequisites: PlanPrerequisite[];
  estimatedDuration: string;      // ISO 8601 duration (e.g. "PT30M")
  rollbackSteps: ExecutionStep[]; // Steps to undo if execution fails
  createdAt: string;
}

export interface ExecutionStep {
  stepId: string;
  order: number;
  actionType: ActionType;
  targetSystem: SystemTarget;
  description: string;            // Human-readable description
  toolAction: ToolAction;         // Structured intent for the Tool Broker
  status: StepStatus;
  requiresCredential: boolean;
  credentialHandle?: string;      // Reference to ephemeral credential
  result?: StepResult;
  startedAt?: string;
  completedAt?: string;
}

export type StepStatus =
  | 'pending'
  | 'in_progress'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'rolled_back';

export interface StepResult {
  success: boolean;
  output: Record<string, unknown>; // Sanitized — no credentials
  errorMessage?: string;
  evidenceIds: string[];           // References to Evidence Store
}

// ── Tool Actions (Structured Intent) ─────────────────────────────────────────

export type ActionType =
  // Entra ID
  | 'entra.create_enterprise_app'
  | 'entra.configure_saml_sso'
  | 'entra.configure_oidc'
  | 'entra.create_group'
  | 'entra.assign_group_to_app'
  | 'entra.configure_conditional_access'
  | 'entra.configure_mfa_policy'
  // SailPoint
  | 'sailpoint.create_source'
  | 'sailpoint.create_access_profile'
  | 'sailpoint.create_role'
  | 'sailpoint.trigger_aggregation'
  | 'sailpoint.create_certification_campaign'
  // ServiceNow
  | 'servicenow.create_catalog_item'
  | 'servicenow.create_request_mapping'
  | 'servicenow.create_workflow'
  // App-side (through allowlisted connectors)
  | 'app_connector.configure_sso'
  | 'app_connector.verify_sso_login'
  | 'app_connector.configure_scim'
  // Verification
  | 'verification.test_sso_login'
  | 'verification.test_mfa_enforcement'
  | 'verification.validate_group_membership';

export interface ToolAction {
  actionType: ActionType;
  target: {
    systemType: SystemType;
    applicationId?: string;
    resourceId?: string;
  };
  inputs: Record<string, unknown>; // Validated, structured inputs — no credentials
  validationRules: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  rule: 'required' | 'format' | 'enum' | 'maxLength' | 'minLength';
  value?: unknown;
  message: string;
}

// ── Systems & Blast Radius ───────────────────────────────────────────────────

export type SystemType = 'entra' | 'sailpoint' | 'servicenow' | 'app_connector' | 'internal';

export interface SystemTarget {
  systemType: SystemType;
  systemName: string;             // Human-readable (e.g. "Microsoft Entra ID")
  operations: string[];           // What will be done (e.g. ["create_enterprise_app", "configure_saml"])
}

export type BlastRadiusLevel = 'low' | 'medium' | 'high' | 'critical';

export interface BlastRadius {
  level: BlastRadiusLevel;
  affectedUsers: number;          // Estimated number of users impacted
  affectedSystems: number;
  reversible: boolean;            // Can changes be fully rolled back?
  justification: string;          // Why this risk level was assigned
}

// ── Approvals ────────────────────────────────────────────────────────────────

export type ApprovalRole = 'app_owner' | 'iam_admin' | 'platform_admin' | 'security_admin';

export interface ExecutionApproval {
  approvalId: string;
  sessionId: string;
  role: ApprovalRole;             // Which role must approve
  approverId?: string;
  approverName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requiredBy: string;             // ISO 8601 — approval must come before this
  comment?: string;
  createdAt: string;
  resolvedAt?: string;
}

// ── Plan Prerequisites ───────────────────────────────────────────────────────

export type PrerequisiteType =
  | 'credential_handoff'           // App team must provide temporary credentials
  | 'owner_confirmation'           // App owner must confirm scope
  | 'system_access_verification'   // Verify the adapter can reach the target system
  | 'data_collection';             // Additional information needed from the user

export interface PlanPrerequisite {
  prerequisiteId: string;
  type: PrerequisiteType;
  description: string;
  status: 'pending' | 'fulfilled' | 'waived';
  fulfilledAt?: string;
  fulfilledBy?: string;
}

// ── Ephemeral Credential Escrow ──────────────────────────────────────────────

export interface CredentialHandoff {
  handleId: string;               // The ONLY reference passed around
  tenantId: string;
  sessionId: string;              // Scoped to this execution session
  targetSystem: SystemType;
  targetApplicationId?: string;
  purpose: string;                // "Temporary admin access for SSO configuration"
  status: 'pending' | 'submitted' | 'retrieved' | 'expired' | 'destroyed';
  submittedBy?: string;           // userId of the person who provided the credential
  submittedAt?: string;
  retrievedAt?: string;           // One-time retrieval timestamp
  destroyedAt?: string;
  expiresAt: string;              // Short TTL — auto-destroy after this
  createdAt: string;
}

// NOTE: The actual credential value is NEVER part of this interface.
// It is stored separately in encrypted ephemeral storage and accessed
// only by the execution worker through the handleId.

// ── Evidence Store ───────────────────────────────────────────────────────────

export type EvidenceType =
  | 'screenshot'
  | 'api_response'
  | 'configuration_snapshot'
  | 'test_result'
  | 'approval_record'
  | 'error_log';

export interface EvidenceRecord {
  evidenceId: string;
  sessionId: string;
  stepId?: string;
  type: EvidenceType;
  title: string;
  description: string;
  data: Record<string, unknown>;  // Sanitized — no credentials
  createdAt: string;
}

// ── Permissions ──────────────────────────────────────────────────────────────

export type AgentPermissionId =
  | 'agents.use'                   // View agents and their capabilities
  | 'agents.plan'                  // Request agent to generate a plan
  | 'agents.execute.request'       // Request execution of an approved plan
  | 'agents.execute.approve'       // Approve execution plans
  | 'agents.execute.sso'           // Execute SSO-related tool actions
  | 'agents.execute.iga'           // Execute IGA-related tool actions
  | 'agents.execute.servicenow'    // Execute ServiceNow-related tool actions
  | 'agents.admin';               // Full agent administration

// ── Agent Controller Request/Response ────────────────────────────────────────

export interface CreatePlanRequest {
  agentType: AgentType;
  applicationId: string;
  controlId: string;
  context?: Record<string, unknown>; // Additional context for plan generation
}

export interface ApprovePlanRequest {
  sessionId: string;
  decision: 'approved' | 'rejected';
  comment?: string;
}

export interface ExecutePlanRequest {
  sessionId: string;
}

export interface SubmitCredentialRequest {
  handleId: string;
  // credential value is extracted from request body separately
  // and NEVER stored in this interface or logged
}

export interface SessionListFilters {
  status?: ExecutionSessionStatus;
  agentType?: AgentType;
  applicationId?: string;
  limit?: number;
}
