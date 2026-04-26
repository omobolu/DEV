// ─── Build Execution Module Types ────────────────────────────────────────────

export type BuildState =
  | 'DETECTED'
  | 'CLASSIFIED'
  | 'ASSIGNED'
  | 'READY_TO_BUILD'
  | 'OUTREACH_SENT'
  | 'MEETING_SCHEDULED'
  | 'DATA_COLLECTED'
  | 'BUILD_IN_PROGRESS'
  | 'TESTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type BuildMode = 'advisory' | 'guided' | 'automated';
export type BuildType =
  | 'ENTRA_SSO_SAML'
  | 'ENTRA_SSO_OIDC'
  | 'ENTRA_SCIM'
  | 'ENTRA_CONDITIONAL_ACCESS'
  | 'SAILPOINT_SOURCE_ONBOARDING'
  | 'SAILPOINT_JML_WORKFLOW'
  | 'SAILPOINT_CERTIFICATION'
  | 'SAILPOINT_RULE_GENERATION'
  | 'CYBERARK_SAFE_CREATION'
  | 'CYBERARK_ACCOUNT_ONBOARDING'
  | 'CYBERARK_CPM_ROTATION'
  | 'OKTA_CIAM_FLOW'
  | 'OKTA_MFA_POLICY'
  | 'MANUAL_GUIDED';

export type IAMPlatform = 'Entra' | 'SailPoint' | 'CyberArk' | 'Okta';

export interface BuildJob {
  buildId: string;
  appId: string;
  appName: string;
  buildType: BuildType;
  platform: IAMPlatform;
  mode: BuildMode;
  state: BuildState;
  controlGap: string;           // The gap being remediated
  priority: 'immediate' | 'high' | 'medium' | 'low';
  assignedTo?: string;
  requiredInputs: RequiredInput[];
  collectedData: Record<string, string | number | boolean>;
  artifacts: BuildArtifact[];
  stateHistory: StateTransition[];
  stakeholders: Stakeholder[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  estimatedHours?: number;
}

export interface RequiredInput {
  key: string;
  label: string;
  description: string;
  type: 'string' | 'url' | 'email' | 'boolean' | 'select';
  options?: string[];           // For select type
  required: boolean;
  collected: boolean;
  value?: string | boolean;
}

export interface BuildArtifact {
  artifactId: string;
  type: 'entra_saml_config' | 'entra_oidc_config' | 'entra_ca_policy' | 'sailpoint_source' | 'sailpoint_rule' | 'sailpoint_workflow' | 'cyberark_safe' | 'cyberark_account' | 'okta_app_config' | 'documentation';
  name: string;
  content: Record<string, unknown>;
  format: 'json' | 'xml' | 'beanshell' | 'yaml' | 'markdown';
  generatedAt: string;
  appliedAt?: string;
  status: 'draft' | 'ready' | 'applied' | 'failed';
}

export interface StateTransition {
  from: BuildState;
  to: BuildState;
  timestamp: string;
  actor: string;              // 'system' | 'user:id' | 'ai-agent'
  reason?: string;
}

export interface Stakeholder {
  name: string;
  email: string;
  role: 'app_owner' | 'technical_lead' | 'iam_engineer' | 'approver';
  notified: boolean;
  notifiedAt?: string;
}

export interface StartBuildRequest {
  appId: string;
  controlGap: string;
  buildType: BuildType;
  platform: IAMPlatform;
  mode?: BuildMode;
  assignedTo?: string;
}

export interface BuildSummary {
  buildId: string;
  appId: string;
  appName: string;
  buildType: BuildType;
  platform: IAMPlatform;
  state: BuildState;
  priority: string;
  createdAt: string;
  updatedAt: string;
}
