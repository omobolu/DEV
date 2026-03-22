// ─── Control Module Types ─────────────────────────────────────────────────────

export type ControlName =
  | 'SSO_ENABLED'
  | 'MFA_ENFORCED'
  | 'SCIM_PROVISIONING'
  | 'JML_AUTOMATED'
  | 'PRIVILEGED_ACCOUNTS_VAULTED'
  | 'CERTIFICATIONS_CONFIGURED'
  | 'RBAC_IMPLEMENTED'
  | 'CIAM_INTEGRATED'
  | 'SESSION_MANAGEMENT'
  | 'AUDIT_LOGGING';

export type ControlStatus = 'implemented' | 'partial' | 'not_implemented' | 'not_applicable' | 'unknown';
export type ControlRisk = 'critical' | 'high' | 'medium' | 'low';

export interface Control {
  controlId: string;
  appId: string;
  controlName: ControlName;
  description: string;
  expected: boolean;          // Should this control be applied?
  implemented: boolean;       // Is it actually in place?
  status: ControlStatus;
  risk: ControlRisk;
  policyDrivers: PolicyDriver[];
  remediationAction: string;
  evaluatedAt: string;
}

export interface PolicyDriver {
  policy: string;             // e.g., 'SOX', 'PCI-DSS', 'HIPAA', 'NIST'
  requirement: string;        // Human-readable requirement
  mandatory: boolean;
}

export interface ControlEvaluationRequest {
  appId: string;
  forceRefresh?: boolean;
}

export interface ControlEvaluationResult {
  appId: string;
  appName: string;
  totalControls: number;
  implemented: number;
  missing: number;
  partial: number;
  riskScore: number;
  controls: Control[];
  evaluatedAt: string;
}

// Policy rules — define which controls are required for which app profiles
export interface PolicyRule {
  ruleId: string;
  name: string;
  condition: (app: { riskTier: string; dataClassification: string; userPopulation: number; appType: string; tags: string[] }) => boolean;
  requiredControls: ControlName[];
  policyDrivers: PolicyDriver[];
}
