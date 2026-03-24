/**
 * Demo seed — 50 enterprise applications with IAM posture data.
 * Saved directly to applicationRepository on startup.
 * Provides realistic coverage distribution across all 49 controls.
 */

import { Application, IamPosture, IamPlatformLink } from './application.types';
import { applicationRepository } from './application.repository';

const NOW = new Date().toISOString();

// ── Helper to build a posture object ─────────────────────────────────────
function posture(
  appId: string,
  opts: {
    sso: boolean; mfa: boolean; scim: boolean; jml: boolean;
    pam: boolean; certs: boolean;
    platforms: { am: boolean; iga: boolean; pam: boolean; ciam: boolean };
  }
): IamPosture {
  const platformLinks: IamPlatformLink[] = [
    { platform: 'AM',   tool: 'Entra',      onboarded: opts.platforms.am,   status: opts.platforms.am   ? 'active' : 'not_onboarded' },
    { platform: 'IGA',  tool: 'SailPoint',  onboarded: opts.platforms.iga,  status: opts.platforms.iga  ? 'active' : 'not_onboarded' },
    { platform: 'PAM',  tool: 'CyberArk',   onboarded: opts.platforms.pam,  status: opts.platforms.pam  ? 'active' : 'not_onboarded' },
    { platform: 'CIAM', tool: 'Okta',       onboarded: opts.platforms.ciam, status: opts.platforms.ciam ? 'active' : 'not_onboarded' },
  ];
  const missing: string[] = [];
  if (!opts.sso)   missing.push('SSO_ENABLED');
  if (!opts.mfa)   missing.push('MFA_ENFORCED');
  if (!opts.scim)  missing.push('SCIM_PROVISIONING');
  if (!opts.jml)   missing.push('JML_AUTOMATED');
  if (!opts.pam)   missing.push('PRIVILEGED_ACCOUNTS_VAULTED');
  if (!opts.certs) missing.push('CERTIFICATIONS_CONFIGURED');

  const riskScore = missing.length * 14 + (opts.platforms.am ? 0 : 10);

  return {
    appId,
    ssoEnabled:                  opts.sso,
    mfaEnforced:                 opts.mfa,
    scimEnabled:                 opts.scim,
    jmlAutomated:                opts.jml,
    privilegedAccountsVaulted:   opts.pam,
    certificationsConfigured:    opts.certs,
    platforms:                   platformLinks,
    riskScore:                   Math.min(riskScore, 100),
    missingControls:             missing,
    remediationPriority:         missing.length >= 4 ? 'immediate' : missing.length >= 2 ? 'high' : missing.length >= 1 ? 'medium' : 'low',
    evaluatedAt:                 NOW,
  };
}

// ── Helper to build an Application ───────────────────────────────────────
function app(
  appId: string, name: string, dept: string,
  riskTier: Application['riskTier'], vendor: string, users: number,
  appType: Application['appType'], tags: string[],
  p: ReturnType<typeof posture>
): Application {
  return {
    appId, name, rawName: name,
    owner: 'IAM Team', ownerEmail: 'iam@corp.com',
    vendor, department: dept, riskTier,
    dataClassification: riskTier === 'critical' ? 'restricted' : riskTier === 'high' ? 'confidential' : 'internal',
    userPopulation: users,
    appType, tags, source: 'cmdb', status: 'active',
    createdAt: NOW, updatedAt: NOW,
    iamPosture: p,
  };
}

// ── Seed data — 50 apps ───────────────────────────────────────────────────
export const SEED_APPS: Application[] = [

  // ── CRITICAL tier (12 apps) ──────────────────────────────────────────────
  app('APP-001', 'SAP Finance',          'Finance',    'critical', 'SAP',        2800, 'on-premise', ['erp','finance','sap'],
    posture('APP-001',   { sso:true,  mfa:true,  scim:true,  jml:true,  pam:true,  certs:true,  platforms:{am:true, iga:true, pam:true, ciam:false} })),

  app('APP-002', 'Oracle EBS',           'Finance',    'critical', 'Oracle',     1900, 'on-premise', ['erp','finance'],
    posture('APP-002',   { sso:false, mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:false,iga:false,pam:false,ciam:false} })),

  app('APP-003', 'Workday HCM',          'HR',         'critical', 'Workday',    3200, 'saas',       ['hr','hcm','cloud'],
    posture('APP-003',   { sso:true,  mfa:true,  scim:true,  jml:true,  pam:false, certs:true,  platforms:{am:true, iga:true, pam:false,ciam:false} })),

  app('APP-004', 'Salesforce CRM',       'Sales',      'critical', 'Salesforce', 1400, 'saas',       ['crm','sales','cloud'],
    posture('APP-004',   { sso:true,  mfa:true,  scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-005', 'Active Directory',     'IT',         'critical', 'Microsoft',  5000, 'on-premise', ['directory','identity','microsoft'],
    posture('APP-005',   { sso:true,  mfa:true,  scim:true,  jml:true,  pam:true,  certs:true,  platforms:{am:true, iga:true, pam:true, ciam:false} })),

  app('APP-006', 'AWS Management',       'Cloud Ops',  'critical', 'Amazon',     320,  'cloud',      ['cloud','aws','infrastructure'],
    posture('APP-006',   { sso:true,  mfa:true,  scim:false, jml:false, pam:true,  certs:false, platforms:{am:true, iga:false,pam:true, ciam:false} })),

  app('APP-007', 'Azure DevOps',         'Engineering','critical', 'Microsoft',  680,  'cloud',      ['devops','engineering','azure'],
    posture('APP-007',   { sso:true,  mfa:true,  scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-008', 'Customer Portal',      'Digital',    'critical', 'Custom',     45000,'custom',     ['customer','portal','ciam'],
    posture('APP-008',   { sso:false, mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:false,iga:false,pam:false,ciam:true}  })),

  app('APP-009', 'Core Banking System',  'Finance',    'critical', 'Temenos',    1200, 'on-premise', ['banking','finance','core'],
    posture('APP-009',   { sso:false, mfa:false, scim:false, jml:false, pam:true,  certs:false, platforms:{am:false,iga:false,pam:true, ciam:false} })),

  app('APP-010', 'GRC Platform',         'Risk',       'critical', 'ServiceNow', 450,  'saas',       ['grc','risk','compliance'],
    posture('APP-010',   { sso:true,  mfa:true,  scim:false, jml:false, pam:false, certs:true,  platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-011', 'Data Warehouse',       'Analytics',  'critical', 'Snowflake',  280,  'cloud',      ['data','analytics','cloud'],
    posture('APP-011',   { sso:true,  mfa:true,  scim:false, jml:false, pam:true,  certs:false, platforms:{am:true, iga:false,pam:true, ciam:false} })),

  app('APP-012', 'Payment Processing',   'Finance',    'critical', 'Stripe',     150,  'saas',       ['payments','finance','pci'],
    posture('APP-012',   { sso:false, mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:false,iga:false,pam:false,ciam:false} })),

  // ── HIGH tier (14 apps) ──────────────────────────────────────────────────
  app('APP-013', 'GitHub Enterprise',    'Engineering','high',     'GitHub',     720,  'saas',       ['git','devops','engineering'],
    posture('APP-013',   { sso:true,  mfa:true,  scim:true,  jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-014', 'Jira Service Mgmt',    'IT',         'high',     'Atlassian',  890,  'saas',       ['itsm','ticketing','atlassian'],
    posture('APP-014',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-015', 'Confluence',           'IT',         'high',     'Atlassian',  1100, 'saas',       ['wiki','knowledge','atlassian'],
    posture('APP-015',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-016', 'ServiceNow ITSM',      'IT',         'high',     'ServiceNow', 560,  'saas',       ['itsm','servicedesk'],
    posture('APP-016',   { sso:true,  mfa:true,  scim:true,  jml:true,  pam:false, certs:true,  platforms:{am:true, iga:true, pam:false,ciam:false} })),

  app('APP-017', 'Slack',                'Comms',      'high',     'Slack',      2800, 'saas',       ['collaboration','messaging'],
    posture('APP-017',   { sso:true,  mfa:true,  scim:true,  jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-018', 'Zoom',                 'Comms',      'high',     'Zoom',       3100, 'saas',       ['collaboration','video'],
    posture('APP-018',   { sso:true,  mfa:true,  scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-019', 'SharePoint Online',    'IT',         'high',     'Microsoft',  2500, 'saas',       ['document','collaboration','microsoft'],
    posture('APP-019',   { sso:true,  mfa:true,  scim:true,  jml:true,  pam:false, certs:true,  platforms:{am:true, iga:true, pam:false,ciam:false} })),

  app('APP-020', 'Okta Admin Console',   'Security',   'high',     'Okta',       45,   'saas',       ['iam','identity','admin'],
    posture('APP-020',   { sso:true,  mfa:true,  scim:false, jml:false, pam:true,  certs:false, platforms:{am:true, iga:false,pam:true, ciam:false} })),

  app('APP-021', 'Datadog',              'Engineering','high',     'Datadog',    320,  'saas',       ['monitoring','observability'],
    posture('APP-021',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-022', 'Splunk SIEM',          'Security',   'high',     'Splunk',     85,   'on-premise', ['siem','security','logs'],
    posture('APP-022',   { sso:false, mfa:false, scim:false, jml:false, pam:true,  certs:false, platforms:{am:false,iga:false,pam:true, ciam:false} })),

  app('APP-023', 'Tableau',              'Analytics',  'high',     'Salesforce', 420,  'saas',       ['analytics','bi','dashboards'],
    posture('APP-023',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-024', 'Workiva',              'Finance',    'high',     'Workiva',    180,  'saas',       ['reporting','finance','sox'],
    posture('APP-024',   { sso:false, mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:false,iga:false,pam:false,ciam:false} })),

  app('APP-025', 'PeopleSoft HR',        'HR',         'high',     'Oracle',     1600, 'on-premise', ['hr','legacy','oracle'],
    posture('APP-025',   { sso:false, mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:false,iga:false,pam:false,ciam:false} })),

  app('APP-026', 'Veeva Vault',          'Legal',      'high',     'Veeva',      240,  'saas',       ['document','legal','pharma'],
    posture('APP-026',   { sso:true,  mfa:true,  scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  // ── MEDIUM tier (16 apps) ────────────────────────────────────────────────
  app('APP-027', 'Microsoft Teams',      'Comms',      'medium',   'Microsoft',  4200, 'saas',       ['collaboration','microsoft'],
    posture('APP-027',   { sso:true,  mfa:true,  scim:true,  jml:true,  pam:false, certs:false, platforms:{am:true, iga:true, pam:false,ciam:false} })),

  app('APP-028', 'Exchange Online',      'Comms',      'medium',   'Microsoft',  4200, 'saas',       ['email','microsoft','office365'],
    posture('APP-028',   { sso:true,  mfa:true,  scim:true,  jml:true,  pam:false, certs:true,  platforms:{am:true, iga:true, pam:false,ciam:false} })),

  app('APP-029', 'Box',                  'Operations', 'medium',   'Box',        680,  'saas',       ['storage','document','cloud'],
    posture('APP-029',   { sso:true,  mfa:false, scim:true,  jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-030', 'DocuSign',             'Legal',      'medium',   'DocuSign',   420,  'saas',       ['esignature','legal','contract'],
    posture('APP-030',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-031', 'Workday Expense',      'Finance',    'medium',   'Workday',    2800, 'saas',       ['expense','finance','hr'],
    posture('APP-031',   { sso:true,  mfa:true,  scim:true,  jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-032', 'Concur Travel',        'Finance',    'medium',   'SAP',        1900, 'saas',       ['travel','expense','finance'],
    posture('APP-032',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-033', 'Greenhouse ATS',       'HR',         'medium',   'Greenhouse', 140,  'saas',       ['recruiting','hr','ats'],
    posture('APP-033',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-034', 'BambooHR',             'HR',         'medium',   'BambooHR',   320,  'saas',       ['hr','employee','cloud'],
    posture('APP-034',   { sso:false, mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:false,iga:false,pam:false,ciam:false} })),

  app('APP-035', 'Zendesk',              'Support',    'medium',   'Zendesk',    95,   'saas',       ['support','ticketing','customer'],
    posture('APP-035',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-036', 'Figma',                'Design',     'medium',   'Figma',      180,  'saas',       ['design','product'],
    posture('APP-036',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-037', 'Notion',               'Operations', 'medium',   'Notion',     340,  'saas',       ['wiki','productivity'],
    posture('APP-037',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-038', 'Coupa Procurement',    'Finance',    'medium',   'Coupa',      210,  'saas',       ['procurement','finance','p2p'],
    posture('APP-038',   { sso:false, mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:false,iga:false,pam:false,ciam:false} })),

  app('APP-039', 'Netsuite ERP',         'Finance',    'medium',   'Oracle',     380,  'saas',       ['erp','finance','cloud'],
    posture('APP-039',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-040', 'Marketo',              'Marketing',  'medium',   'Adobe',      60,   'saas',       ['marketing','automation','crm'],
    posture('APP-040',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-041', 'HubSpot',              'Marketing',  'medium',   'HubSpot',    95,   'saas',       ['crm','marketing','cloud'],
    posture('APP-041',   { sso:false, mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:false,iga:false,pam:false,ciam:false} })),

  app('APP-042', 'Asana',                'Operations', 'medium',   'Asana',      420,  'saas',       ['project','productivity'],
    posture('APP-042',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  // ── LOW tier (8 apps) ────────────────────────────────────────────────────
  app('APP-043', 'Miro',                 'Design',     'low',      'Miro',       280,  'saas',       ['whiteboard','design','collaboration'],
    posture('APP-043',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-044', 'Loom',                 'Comms',      'low',      'Loom',       190,  'saas',       ['video','async','comms'],
    posture('APP-044',   { sso:false, mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:false,iga:false,pam:false,ciam:false} })),

  app('APP-045', 'Calendly',             'Operations', 'low',      'Calendly',   85,   'saas',       ['scheduling','productivity'],
    posture('APP-045',   { sso:false, mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:false,iga:false,pam:false,ciam:false} })),

  app('APP-046', 'SurveyMonkey',         'HR',         'low',      'SurveyMonkey',40,  'saas',       ['survey','hr','feedback'],
    posture('APP-046',   { sso:false, mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:false,iga:false,pam:false,ciam:false} })),

  app('APP-047', 'Grammarly Business',   'Comms',      'low',      'Grammarly',  220,  'saas',       ['productivity','writing'],
    posture('APP-047',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-048', 'Zoom Webinars',        'Marketing',  'low',      'Zoom',       35,   'saas',       ['webinar','marketing','video'],
    posture('APP-048',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),

  app('APP-049', 'Lucidchart',           'Design',     'low',      'Lucid',      130,  'saas',       ['diagram','design'],
    posture('APP-049',   { sso:false, mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:false,iga:false,pam:false,ciam:false} })),

  app('APP-050', 'Monday.com',           'Operations', 'low',      'Monday.com', 180,  'saas',       ['project','productivity'],
    posture('APP-050',   { sso:true,  mfa:false, scim:false, jml:false, pam:false, certs:false, platforms:{am:true, iga:false,pam:false,ciam:false} })),
];

// ── Seed function — idempotent ─────────────────────────────────────────────
export function seedApplications(): void {
  if (applicationRepository.count() > 0) return; // already seeded
  for (const a of SEED_APPS) applicationRepository.save(a);
  console.log(`  ✓ Application seed loaded — ${SEED_APPS.length} apps\n`);
}
