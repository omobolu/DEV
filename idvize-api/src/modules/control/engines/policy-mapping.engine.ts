import { PolicyRule, ControlName, PolicyDriver } from '../control.types';

/**
 * Policy Mapping Engine
 *
 * Defines which IAM controls are REQUIRED for each application profile.
 * Rules are evaluated in order; all matching rules are applied.
 *
 * Based on:
 *   SOX apps → MFA required
 *   High-risk apps → PAM required
 *   External/customer-facing → CIAM required
 *   All apps with users → SSO + IGA
 */
export const POLICY_RULES: PolicyRule[] = [
  // ── Baseline: All active apps ──────────────────────────────────────────────
  {
    ruleId: 'BASELINE_SSO',
    name: 'Baseline SSO Requirement',
    condition: (app) => app.userPopulation > 10,
    requiredControls: ['SSO_ENABLED', 'AUDIT_LOGGING'],
    policyDrivers: [
      { policy: 'NIST SP 800-63', requirement: 'All enterprise applications should use federated identity', mandatory: false },
      { policy: 'Zero Trust', requirement: 'No application should use local credentials', mandatory: false },
    ],
  },

  // ── High criticality: MFA required ────────────────────────────────────────
  {
    ruleId: 'HIGH_CRIT_MFA',
    name: 'MFA for Critical/High Applications',
    condition: (app) => app.riskTier === 'critical' || app.riskTier === 'high',
    requiredControls: ['MFA_ENFORCED', 'SSO_ENABLED', 'AUDIT_LOGGING'],
    policyDrivers: [
      { policy: 'SOX', requirement: 'Multi-factor authentication required for financially significant systems', mandatory: true },
      { policy: 'ISO 27001 A.9', requirement: 'Strong authentication for critical systems', mandatory: true },
      { policy: 'NIST CSF', requirement: 'PR.AC-7: Users, devices, and other assets are authenticated', mandatory: true },
    ],
  },

  // ── IGA: User lifecycle management ───────────────────────────────────────
  {
    ruleId: 'IGA_JML',
    name: 'IGA / JML for Apps with 50+ Users',
    condition: (app) => app.userPopulation >= 50,
    requiredControls: ['JML_AUTOMATED', 'CERTIFICATIONS_CONFIGURED', 'RBAC_IMPLEMENTED'],
    policyDrivers: [
      { policy: 'SOX IT General Controls', requirement: 'User access reviews required quarterly', mandatory: true },
      { policy: 'ISO 27001 A.9.2', requirement: 'User access provisioning and deprovisioning must be controlled', mandatory: true },
      { policy: 'GDPR Art. 25', requirement: 'Data minimization — access granted only as needed', mandatory: true },
    ],
  },

  // ── SCIM: For IGA-covered apps ────────────────────────────────────────────
  {
    ruleId: 'SCIM_PROVISIONING',
    name: 'SCIM for Apps Supporting Automated Provisioning',
    condition: (app) => app.userPopulation >= 50 && (app.appType === 'saas' || app.appType === 'cloud'),
    requiredControls: ['SCIM_PROVISIONING', 'JML_AUTOMATED'],
    policyDrivers: [
      { policy: 'Operational Excellence', requirement: 'Automated provisioning reduces human error and leaver risk', mandatory: false },
      { policy: 'ISO 27001 A.9.2.6', requirement: 'Access rights must be removed on termination', mandatory: true },
    ],
  },

  // ── PAM: Critical infrastructure apps ────────────────────────────────────
  {
    ruleId: 'PAM_CRITICAL',
    name: 'PAM for Critical Infrastructure Applications',
    condition: (app) =>
      app.riskTier === 'critical' &&
      (app.appType === 'on-premise' || app.appType === 'legacy' || app.appType === 'cloud' ||
       app.tags.some(t => ['erp', 'finance', 'hr-system', 'infrastructure', 'cloud-provider'].includes(t))),
    requiredControls: ['PRIVILEGED_ACCOUNTS_VAULTED', 'SESSION_MANAGEMENT'],
    policyDrivers: [
      { policy: 'SOX', requirement: 'Privileged access to financially significant systems must be controlled and audited', mandatory: true },
      { policy: 'PCI-DSS Req 8', requirement: 'Shared/generic accounts prohibited; privileged access must be individually tracked', mandatory: true },
      { policy: 'NIST SP 800-53 AC-6', requirement: 'Least privilege — privileged accounts require additional controls', mandatory: true },
    ],
  },

  // ── CIAM: Customer-facing applications ───────────────────────────────────
  {
    ruleId: 'CIAM_EXTERNAL',
    name: 'CIAM for Customer-Facing Applications',
    condition: (app) =>
      app.tags.includes('customer-facing') || app.userPopulation > 10000,
    requiredControls: ['CIAM_INTEGRATED', 'MFA_ENFORCED', 'SESSION_MANAGEMENT', 'AUDIT_LOGGING'],
    policyDrivers: [
      { policy: 'GDPR Art. 32', requirement: 'Appropriate security measures for processing personal data', mandatory: true },
      { policy: 'CCPA', requirement: 'Consumer identity and access controls required', mandatory: true },
      { policy: 'NIST SP 800-63B', requirement: 'Identity assurance levels for digital identity services', mandatory: false },
    ],
  },

  // ── Legacy apps: Elevated requirements ───────────────────────────────────
  {
    ruleId: 'LEGACY_ELEVATED',
    name: 'Elevated Controls for Legacy Applications',
    condition: (app) => app.appType === 'legacy' || app.tags.includes('legacy'),
    requiredControls: ['AUDIT_LOGGING', 'PRIVILEGED_ACCOUNTS_VAULTED', 'CERTIFICATIONS_CONFIGURED'],
    policyDrivers: [
      { policy: 'Risk Management', requirement: 'Legacy systems pose elevated risk due to limited integration capabilities', mandatory: true },
    ],
  },

  // ── Data Classification: Restricted ──────────────────────────────────────
  {
    ruleId: 'RESTRICTED_DATA',
    name: 'Full Control Suite for Restricted Data Systems',
    condition: (app) => app.dataClassification === 'restricted',
    requiredControls: ['SSO_ENABLED', 'MFA_ENFORCED', 'JML_AUTOMATED', 'CERTIFICATIONS_CONFIGURED', 'PRIVILEGED_ACCOUNTS_VAULTED', 'RBAC_IMPLEMENTED', 'AUDIT_LOGGING'],
    policyDrivers: [
      { policy: 'Data Protection Policy', requirement: 'Systems containing restricted data require full IAM control suite', mandatory: true },
      { policy: 'SOX/HIPAA/PCI-DSS', requirement: 'Regulated data requires comprehensive access controls', mandatory: true },
    ],
  },
];

export function getRequiredControls(app: {
  riskTier: string;
  dataClassification: string;
  userPopulation: number;
  appType: string;
  tags: string[];
}): { controls: ControlName[]; drivers: PolicyDriver[]; matchedRules: string[] } {
  const controlSet = new Set<ControlName>();
  const driverSet = new Map<string, PolicyDriver>();
  const matchedRules: string[] = [];

  for (const rule of POLICY_RULES) {
    if (rule.condition(app)) {
      matchedRules.push(rule.name);
      rule.requiredControls.forEach(c => controlSet.add(c));
      rule.policyDrivers.forEach(d => driverSet.set(d.policy, d));
    }
  }

  return {
    controls: Array.from(controlSet),
    drivers: Array.from(driverSet.values()),
    matchedRules,
  };
}
