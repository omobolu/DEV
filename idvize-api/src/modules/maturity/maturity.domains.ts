/**
 * IAM Program Maturity — Domain & Indicator Definitions
 *
 * 13 domains. Each indicator has a weight that sums to 1.0 per domain.
 * Weights reflect strategic importance to overall IAM program health.
 */

import { MaturityDomainDefinition } from './maturity.types';

export const MATURITY_DOMAINS: MaturityDomainDefinition[] = [
  {
    domainId:    'governance',
    name:        'Governance & Operating Model',
    description: 'IAM program charter, operating model, roles, accountability structures, and budget ownership.',
    weight:      1.2,
    indicatorDefs: [
      { indicatorId: 'gov-charter',    name: 'IAM Charter & Strategy',       description: 'Formal IAM strategy document exists and is current',        weight: 0.20, sources: ['document_module'] },
      { indicatorId: 'gov-roles',      name: 'Roles & Responsibilities',      description: 'RACI/RASCI for IAM roles documented and communicated',       weight: 0.20, sources: ['document_module'] },
      { indicatorId: 'gov-budget',     name: 'Budget & Investment Tracking',  description: 'IAM budget is tracked with cost visibility',                  weight: 0.20, sources: ['cost_module'] },
      { indicatorId: 'gov-policies',   name: 'Policy Framework Coverage',     description: 'Core IAM policies published and under review cycle',          weight: 0.25, sources: ['document_module'] },
      { indicatorId: 'gov-metrics',    name: 'Metrics & KPI Reporting',       description: 'IAM KPIs defined and reported to stakeholders',               weight: 0.15, sources: ['audit_logs', 'cost_module'] },
    ],
  },
  {
    domainId:    'iga',
    name:        'Identity Governance & Administration (IGA)',
    description: 'Joiner/mover/leaver automation, role management, access certifications, and orphan account remediation.',
    weight:      1.2,
    indicatorDefs: [
      { indicatorId: 'iga-jml',        name: 'Joiner/Mover/Leaver Coverage', description: 'JML processes are automated end-to-end',                      weight: 0.25, sources: ['sailpoint_adapter', 'scim_provisioning'] },
      { indicatorId: 'iga-cert',       name: 'Access Certification Rate',    description: 'Access reviews completed on schedule',                        weight: 0.25, sources: ['approval_workflows', 'audit_logs'] },
      { indicatorId: 'iga-orphan',     name: 'Orphan Account Remediation',   description: 'Orphan and dormant accounts identified and actioned',          weight: 0.20, sources: ['application_cmdb', 'audit_logs'] },
      { indicatorId: 'iga-roles',      name: 'Role Engineering Maturity',    description: 'RBAC roles defined and maintained with minimal role explosion', weight: 0.15, sources: ['sailpoint_adapter', 'security_policies'] },
      { indicatorId: 'iga-scim',       name: 'SCIM Provisioning Coverage',   description: 'Apps provisioned via SCIM vs manual',                         weight: 0.15, sources: ['scim_provisioning', 'application_cmdb'] },
    ],
  },
  {
    domainId:    'am',
    name:        'Access Management (AM)',
    description: 'SSO coverage, MFA enforcement, conditional access policies, and federated identity.',
    weight:      1.2,
    indicatorDefs: [
      { indicatorId: 'am-sso',         name: 'SSO Coverage Rate',            description: 'Percentage of apps onboarded to SSO',                        weight: 0.30, sources: ['entra_adapter', 'application_cmdb'] },
      { indicatorId: 'am-mfa',         name: 'MFA Enforcement Rate',         description: 'MFA enforced for all users and privileged accounts',          weight: 0.30, sources: ['entra_adapter', 'application_cmdb'] },
      { indicatorId: 'am-ca',          name: 'Conditional Access Coverage',  description: 'Risk-based conditional access policies deployed',             weight: 0.20, sources: ['entra_adapter'] },
      { indicatorId: 'am-fed',         name: 'Federated Identity',           description: 'Identity federation with enterprise IdP for key apps',        weight: 0.20, sources: ['application_cmdb', 'entra_adapter'] },
    ],
  },
  {
    domainId:    'pam',
    name:        'Privileged Access Management (PAM)',
    description: 'Privileged account vaulting, session recording, credential rotation, and least privilege enforcement.',
    weight:      1.1,
    indicatorDefs: [
      { indicatorId: 'pam-vault',      name: 'Privileged Account Vaulting',  description: 'Privileged accounts stored in PAM vault',                    weight: 0.30, sources: ['cyberark_adapter', 'application_cmdb'] },
      { indicatorId: 'pam-rotation',   name: 'Credential Rotation Coverage', description: 'Automated credential rotation enabled',                      weight: 0.25, sources: ['cyberark_adapter'] },
      { indicatorId: 'pam-session',    name: 'Session Recording Rate',       description: 'Privileged sessions recorded and auditable',                  weight: 0.25, sources: ['cyberark_adapter', 'audit_logs'] },
      { indicatorId: 'pam-discovery',  name: 'Account Discovery Coverage',   description: 'Privileged accounts discovered vs known universe',            weight: 0.20, sources: ['cyberark_adapter', 'application_cmdb'] },
    ],
  },
  {
    domainId:    'ciam',
    name:        'Customer Identity & Access Management (CIAM)',
    description: 'Customer-facing identity, passwordless authentication, consent management, and external SSO.',
    weight:      0.8,
    indicatorDefs: [
      { indicatorId: 'ciam-platform',  name: 'CIAM Platform Coverage',       description: 'Customer identity managed through dedicated CIAM platform',   weight: 0.30, sources: ['okta_adapter', 'integration_status'] },
      { indicatorId: 'ciam-mfa',       name: 'Customer MFA Adoption',        description: 'MFA offered and adopted for customer accounts',               weight: 0.25, sources: ['okta_adapter'] },
      { indicatorId: 'ciam-pwdless',   name: 'Passwordless Capabilities',    description: 'Passwordless options available to customers',                 weight: 0.25, sources: ['okta_adapter', 'mock_placeholder'] },
      { indicatorId: 'ciam-consent',   name: 'Consent Management',           description: 'Privacy consent and data subject rights implemented',         weight: 0.20, sources: ['mock_placeholder'] },
    ],
  },
  {
    domainId:    'lifecycle',
    name:        'Lifecycle Automation',
    description: 'Automated provisioning and deprovisioning SLAs, workflow coverage, and event-driven lifecycle events.',
    weight:      1.0,
    indicatorDefs: [
      { indicatorId: 'lc-provision',   name: 'Provisioning Automation Rate', description: 'New access requests fulfilled via automated workflow',        weight: 0.30, sources: ['sailpoint_adapter', 'scim_provisioning'] },
      { indicatorId: 'lc-deprovision', name: 'Deprovisioning SLA',           description: 'Access revoked within SLA on offboarding',                   weight: 0.30, sources: ['audit_logs', 'approval_workflows'] },
      { indicatorId: 'lc-workflow',    name: 'Workflow Coverage',            description: 'Core lifecycle events covered by automated workflows',        weight: 0.20, sources: ['sailpoint_adapter', 'audit_logs'] },
      { indicatorId: 'lc-events',      name: 'Event-Driven Integration',     description: 'HRMS/AD change events trigger automated actions',            weight: 0.20, sources: ['scim_provisioning', 'mock_placeholder'] },
    ],
  },
  {
    domainId:    'compliance',
    name:        'Compliance & Access Reviews',
    description: 'Regulatory compliance posture, access certification completion, SOX/ISO control coverage, and audit readiness.',
    weight:      1.1,
    indicatorDefs: [
      { indicatorId: 'cmp-reviews',    name: 'Access Review Completion',     description: 'Access certifications completed within scheduled periods',    weight: 0.30, sources: ['approval_workflows', 'audit_logs'] },
      { indicatorId: 'cmp-remediation','name': 'Remediation Timeliness',     description: 'Access removed within SLA after review finding',             weight: 0.25, sources: ['audit_logs', 'approval_workflows'] },
      { indicatorId: 'cmp-controls',   name: 'Control Framework Coverage',   description: 'IAM controls mapped to compliance frameworks (SOX, ISO)',     weight: 0.25, sources: ['document_module', 'security_policies'] },
      { indicatorId: 'cmp-audit',      name: 'Audit Log Completeness',       description: 'All access events captured and retained per policy',          weight: 0.20, sources: ['audit_logs'] },
    ],
  },
  {
    domainId:    'documentation',
    name:        'Documentation & Knowledge Management',
    description: 'Policy currency, runbook completeness, architecture documentation, and knowledge base quality.',
    weight:      0.7,
    indicatorDefs: [
      { indicatorId: 'doc-policies',   name: 'Policy Currency',              description: 'IAM policies reviewed within the last 12 months',            weight: 0.30, sources: ['document_module'] },
      { indicatorId: 'doc-runbooks',   name: 'Runbook Completeness',         description: 'Operational runbooks exist for key IAM processes',           weight: 0.25, sources: ['document_module'] },
      { indicatorId: 'doc-arch',       name: 'Architecture Documentation',   description: 'Architecture diagrams and standards documented',              weight: 0.25, sources: ['document_module'] },
      { indicatorId: 'doc-review',     name: 'Document Review Cadence',      description: 'Documents under active review cycle',                        weight: 0.20, sources: ['document_module'] },
    ],
  },
  {
    domainId:    'service_ops',
    name:        'Ticketing & Service Operations',
    description: 'IAM service desk SLA performance, ticket volumes, self-service adoption, and automation rate.',
    weight:      0.8,
    indicatorDefs: [
      { indicatorId: 'svc-sla',        name: 'Service Desk SLA Adherence',   description: 'IAM tickets resolved within SLA targets',                    weight: 0.30, sources: ['mock_placeholder'] },
      { indicatorId: 'svc-selfservice','name': 'Self-Service Adoption Rate', description: 'Access requests handled via self-service portal',            weight: 0.30, sources: ['approval_workflows', 'mock_placeholder'] },
      { indicatorId: 'svc-automation', name: 'Ticket Automation Rate',       description: 'Tickets resolved through automated fulfilment',              weight: 0.25, sources: ['audit_logs', 'mock_placeholder'] },
      { indicatorId: 'svc-escalation', name: 'Escalation Rate',              description: 'Low rate of escalations and repeat incidents',               weight: 0.15, sources: ['mock_placeholder'] },
    ],
  },
  {
    domainId:    'build',
    name:        'Build Execution & Delivery',
    description: 'IAM project delivery velocity, quality metrics, deployment frequency, and delivery pipeline maturity.',
    weight:      0.8,
    indicatorDefs: [
      { indicatorId: 'bld-velocity',   name: 'Delivery Velocity',            description: 'IAM capabilities delivered on schedule',                     weight: 0.25, sources: ['build_module', 'mock_placeholder'] },
      { indicatorId: 'bld-quality',    name: 'Delivery Quality',             description: 'Low defect rate and rework in IAM deployments',              weight: 0.25, sources: ['build_module', 'mock_placeholder'] },
      { indicatorId: 'bld-pipeline',   name: 'CI/CD Pipeline Maturity',      description: 'Automated testing and deployment pipelines in use',           weight: 0.25, sources: ['build_module', 'mock_placeholder'] },
      { indicatorId: 'bld-coverage',   name: 'Delivery Coverage',            description: 'IAM build backlog coverage vs program goals',                weight: 0.25, sources: ['build_module'] },
    ],
  },
  {
    domainId:    'cost',
    name:        'Cost, Capacity & Vendor Management',
    description: 'IAM cost visibility, vendor consolidation, contract management, and ROI measurement.',
    weight:      0.8,
    indicatorDefs: [
      { indicatorId: 'cst-visibility', name: 'Cost Visibility',              description: 'IAM total cost broken down by vendor, people, and platform',  weight: 0.25, sources: ['cost_module'] },
      { indicatorId: 'cst-vendors',    name: 'Vendor Consolidation',         description: 'Vendor landscape rationalized and non-strategic tools exited', weight: 0.25, sources: ['cost_module'] },
      { indicatorId: 'cst-contracts',  name: 'Contract Coverage & Renewal',  description: 'Contracts tracked with renewal alerts and active management',  weight: 0.25, sources: ['cost_module'] },
      { indicatorId: 'cst-roi',        name: 'ROI & Value Tracking',         description: 'IAM investment return measured and reported',                 weight: 0.25, sources: ['cost_module', 'mock_placeholder'] },
    ],
  },
  {
    domainId:    'ai_automation',
    name:        'AI & Automation Maturity',
    description: 'AI-assisted operations, intelligent automation coverage, anomaly detection, and predictive analytics.',
    weight:      0.7,
    indicatorDefs: [
      { indicatorId: 'ai-tools',       name: 'AI Tool Adoption',             description: 'AI/ML tools actively used in IAM operations',                weight: 0.25, sources: ['integration_status', 'mock_placeholder'] },
      { indicatorId: 'ai-automation',  name: 'Intelligent Automation Coverage','description': 'Manual processes replaced by rule-based or AI automation', weight: 0.30, sources: ['audit_logs', 'scim_provisioning'] },
      { indicatorId: 'ai-anomaly',     name: 'Anomaly Detection',            description: 'Behavioural analytics and access anomaly detection in use',   weight: 0.25, sources: ['security_policies', 'audit_logs'] },
      { indicatorId: 'ai-predict',     name: 'Predictive Analytics',         description: 'Predictive analytics for access risk and churn',             weight: 0.20, sources: ['mock_placeholder'] },
    ],
  },
  {
    domainId:    'security_gov',
    name:        'Security & Access Governance',
    description: 'Security policy enforcement, access anomaly response, audit completeness, and SoD controls.',
    weight:      1.1,
    indicatorDefs: [
      { indicatorId: 'sec-policies',   name: 'Security Policy Enforcement',  description: 'Access policies enforced consistently and audited',           weight: 0.25, sources: ['security_policies', 'audit_logs'] },
      { indicatorId: 'sec-sod',        name: 'Segregation of Duties (SoD)',  description: 'SoD rules defined and violations tracked',                   weight: 0.25, sources: ['security_policies', 'approval_workflows'] },
      { indicatorId: 'sec-anomaly',    name: 'Access Anomaly Response',      description: 'Anomalous access events detected and responded to',          weight: 0.25, sources: ['audit_logs', 'security_policies'] },
      { indicatorId: 'sec-authz',      name: 'Authz Denial Rate',            description: 'Proportion of authz denials investigated and resolved',       weight: 0.25, sources: ['audit_logs'] },
    ],
  },
];

export const DOMAIN_MAP: Record<string, MaturityDomainDefinition> = Object.fromEntries(
  MATURITY_DOMAINS.map(d => [d.domainId, d])
);

/** Score band → MaturityLevel */
export function scoreToLevel(score: number): import('./maturity.types').MaturityLevel {
  if (score >= 81) return 'Optimized';
  if (score >= 61) return 'Managed';
  if (score >= 41) return 'Defined';
  if (score >= 21) return 'Developing';
  return 'Initial';
}
