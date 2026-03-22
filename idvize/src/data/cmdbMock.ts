import type { CMDBApp } from '@/types/cmdb'
import { CMDB_FIELD_DEFINITIONS } from '@/types/cmdb'

// ── 100 fictitious enterprise apps with IAM control attributes ──────────────
// Columns: appId | appName | dept | appType | criticality | dataClass |
//          bizOwner | itOwner | sso | mfa | prov | deprov | reviewFreq |
//          pam | rbac | jit | sod | compliance |
//          total | active | orphan | lastReview | nextReview | status

type Row = [
  string, string, string,
  CMDBApp['appType'], CMDBApp['businessCriticality'], CMDBApp['dataClassification'],
  string, string,
  boolean, boolean,
  CMDBApp['provisioningType'], CMDBApp['provisioningType'], CMDBApp['accessReviewFrequency'],
  boolean, boolean, boolean, boolean, string,
  number, number, number, string, string,
  CMDBApp['onboardingStatus']
]

const RAW: Row[] = [
  // ── KNOWN ENTERPRISE APPS ────────────────────────────────────────────────
  ['APP-001','Salesforce CRM',        'Sales',       'SaaS',        'Critical','Confidential','Sarah Chen',       'Mike Patel',     true, true, 'Automated',     'Automated',     'Quarterly',   true, true, true, true,  'SOX,GDPR',                1240,1180,12,'2024-10-15','2025-01-15','Onboarded'],
  ['APP-002','Workday HCM',           'HR',          'SaaS',        'Critical','Confidential','David Kim',        'Raj Sharma',     true, true, 'Automated',     'Automated',     'Quarterly',   true, true, true, true,  'SOX,GDPR,HIPAA',          980, 940, 8, '2024-11-01','2025-02-01','Onboarded'],
  ['APP-003','ServiceNow ITSM',       'IT',          'SaaS',        'Critical','Internal',    'Tom Bradley',      'Ana Rivera',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, true, true,  'ISO27001,ITIL',           2100,2050,22,'2024-09-30','2024-12-30','Onboarded'],
  ['APP-004','SAP ERP',               'Finance',     'On-Premise',  'Critical','Confidential','Lisa Wong',        'Chris Yates',    true, true, 'Semi-Automated','Semi-Automated','Quarterly',   true, true, false,true,  'SOX,PCI-DSS',             3200,3050,45,'2024-08-15','2024-11-15','Onboarded'],
  ['APP-005','Oracle Financials',     'Finance',     'On-Premise',  'Critical','Confidential','Lisa Wong',        'Priya Nair',     true, true, 'Semi-Automated','Manual',        'Quarterly',   true, true, false,true,  'SOX,PCI-DSS',             1870,1790,31,'2024-09-01','2024-12-01','Onboarded'],
  ['APP-006','Microsoft 365',         'IT',          'SaaS',        'Critical','Internal',    'Tom Bradley',      'Sven Andersen',  true, true, 'Automated',     'Automated',     'Monthly',     false,true, false,false, 'GDPR,ISO27001',           8900,8700,67,'2024-10-01','2025-01-01','Onboarded'],
  ['APP-007','GitHub Enterprise',     'Engineering', 'SaaS',        'High',    'Internal',    'Alex Morgan',      'Sven Andersen',  true, true, 'Automated',     'Automated',     'Quarterly',   false,true, true, false, 'ISO27001',                1450,1420,18,'2024-10-20','2025-01-20','Onboarded'],
  ['APP-008','AWS Console',           'IT',          'SaaS',        'Critical','Confidential','Tom Bradley',      'Mike Patel',     true, true, 'Automated',     'Automated',     'Monthly',     true, true, true, true,  'SOC2,ISO27001,PCI-DSS',   320, 310, 4, '2024-11-15','2025-02-15','Onboarded'],
  ['APP-009','Azure Portal',          'IT',          'SaaS',        'Critical','Confidential','Tom Bradley',      'Ana Rivera',     true, true, 'Automated',     'Automated',     'Monthly',     true, true, true, true,  'SOC2,ISO27001',           280, 275, 3, '2024-11-15','2025-02-15','Onboarded'],
  ['APP-010','Google Workspace',      'IT',          'SaaS',        'High',    'Internal',    'Tom Bradley',      'Raj Sharma',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,false, 'GDPR,ISO27001',           5400,5300,44,'2024-10-01','2025-01-01','Onboarded'],
  ['APP-011','Jira',                  'Engineering', 'SaaS',        'High',    'Internal',    'Alex Morgan',      'Chris Yates',    true, false,'Semi-Automated','Manual',        'Quarterly',   false,true, false,false, 'ISO27001',                1200,1150,28,'2024-09-15','2024-12-15','Onboarded'],
  ['APP-012','Confluence',            'Engineering', 'SaaS',        'Medium',  'Internal',    'Alex Morgan',      'Priya Nair',     true, false,'Semi-Automated','Manual',        'Annual',      false,true, false,false, 'ISO27001',                1100,1040,35,'2024-07-01','2025-07-01','Onboarded'],
  ['APP-013','Slack',                 'IT',          'SaaS',        'High',    'Internal',    'Tom Bradley',      'Sven Andersen',  true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,false, 'GDPR,ISO27001',           6200,6050,55,'2024-10-15','2025-01-15','Onboarded'],
  ['APP-014','Zoom',                  'IT',          'SaaS',        'Medium',  'Internal',    'Tom Bradley',      'Mike Patel',     true, false,'Automated',     'Manual',        'Annual',      false,true, false,false, 'GDPR',                    4800,4700,62,'2024-06-01','2025-06-01','Onboarded'],
  ['APP-015','Tableau',               'Analytics',   'SaaS',        'High',    'Confidential','Nina Patel',       'Ana Rivera',     true, true, 'Semi-Automated','Semi-Automated','Quarterly',   false,true, false,true,  'SOX,GDPR',                340, 330, 7, '2024-10-01','2025-01-01','Onboarded'],
  ['APP-016','Splunk',                'IT',          'On-Premise',  'High',    'Internal',    'Tom Bradley',      'Raj Sharma',     true, true, 'Semi-Automated','Manual',        'Quarterly',   false,true, false,false, 'ISO27001,SOC2',           90,  88,  2, '2024-09-15','2024-12-15','Onboarded'],
  ['APP-017','Okta',                  'IT',          'SaaS',        'Critical','Confidential','Tom Bradley',      'Sven Andersen',  true, true, 'Automated',     'Automated',     'Monthly',     true, true, true, true,  'SOC2,ISO27001,GDPR',      45,  45,  0, '2024-11-01','2025-02-01','Onboarded'],
  ['APP-018','CrowdStrike Falcon',    'IT',          'SaaS',        'Critical','Internal',    'Tom Bradley',      'Chris Yates',    true, true, 'Automated',     'Automated',     'Monthly',     false,true, false,false, 'ISO27001,SOC2',           210, 208, 1, '2024-11-15','2025-02-15','Onboarded'],
  ['APP-019','DocuSign',              'Legal',       'SaaS',        'High',    'Confidential','Rachel Green',     'Mike Patel',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,false, 'SOX,GDPR',                680, 655, 11,'2024-10-01','2025-01-01','Onboarded'],
  ['APP-020','Zendesk',               'Customer Svc','SaaS',        'High',    'Internal',    'James Park',       'Ana Rivera',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,false, 'GDPR,ISO27001',           520, 505, 9, '2024-10-15','2025-01-15','Onboarded'],
  ['APP-021','HubSpot',               'Sales',       'SaaS',        'High',    'Confidential','Sarah Chen',       'Priya Nair',     true, false,'Automated',     'Semi-Automated','Quarterly',   false,true, false,false, 'GDPR',                    410, 395, 8, '2024-09-01','2024-12-01','Onboarded'],
  ['APP-022','Marketo',               'Marketing',   'SaaS',        'Medium',  'Internal',    'Olivia Brooks',    'Raj Sharma',     true, false,'Automated',     'Manual',        'Annual',      false,true, false,false, 'GDPR',                    180, 172, 14,'2024-05-15','2025-05-15','Onboarded'],
  ['APP-023','SAP Ariba',             'Finance',     'SaaS',        'High',    'Confidential','Lisa Wong',        'Sven Andersen',  true, true, 'Semi-Automated','Semi-Automated','Quarterly',   false,true, false,true,  'SOX,GDPR',                420, 405, 6, '2024-10-01','2025-01-01','Onboarded'],
  ['APP-024','SAP SuccessFactors',    'HR',          'SaaS',        'High',    'Confidential','David Kim',        'Chris Yates',    true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,true,  'GDPR,SOX',                760, 740, 10,'2024-11-01','2025-02-01','Onboarded'],
  ['APP-025','NetSuite ERP',          'Finance',     'SaaS',        'High',    'Confidential','Lisa Wong',        'Mike Patel',     true, true, 'Semi-Automated','Semi-Automated','Quarterly',   false,true, false,true,  'SOX,PCI-DSS',             560, 540, 8, '2024-10-15','2025-01-15','Onboarded'],
  ['APP-026','Veeva CRM',             'Sales',       'SaaS',        'High',    'Confidential','Sarah Chen',       'Ana Rivera',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,false, 'GDPR,HIPAA',              290, 278, 5, '2024-10-01','2025-01-01','Onboarded'],
  ['APP-027','Concur Travel',         'Finance',     'SaaS',        'Medium',  'Internal',    'Lisa Wong',        'Raj Sharma',     true, false,'Automated',     'Manual',        'Annual',      false,false,false,false, 'SOX',                     1800,1760,38,'2024-04-01','2025-04-01','Onboarded'],
  ['APP-028','Box',                   'IT',          'SaaS',        'Medium',  'Confidential','Tom Bradley',      'Priya Nair',     true, true, 'Automated',     'Automated',     'Semi-Annual', false,true, false,false, 'GDPR,ISO27001',           2300,2200,55,'2024-07-01','2025-01-01','Onboarded'],
  ['APP-029','Webex',                 'IT',          'SaaS',        'Medium',  'Internal',    'Tom Bradley',      'Sven Andersen',  true, false,'Automated',     'Manual',        'Annual',      false,true, false,false, 'GDPR',                    3100,3000,78,'2024-05-01','2025-05-01','Onboarded'],
  ['APP-030','GitLab',                'Engineering', 'SaaS',        'High',    'Internal',    'Alex Morgan',      'Chris Yates',    true, true, 'Automated',     'Automated',     'Quarterly',   false,true, true, false, 'ISO27001',                820, 800, 14,'2024-10-01','2025-01-01','Onboarded'],
  // ── FICTIONAL ENTERPRISE APPS ────────────────────────────────────────────
  ['APP-031','CoreVault DMS',         'Legal',       'On-Premise',  'High',    'Confidential','Rachel Green',     'Mike Patel',     true, true, 'Semi-Automated','Manual',        'Quarterly',   true, true, false,true,  'SOX,GDPR',                340, 325, 9, '2024-09-01','2024-12-01','Onboarded'],
  ['APP-032','DataSphere Analytics',  'Analytics',   'On-Premise',  'Medium',  'Confidential','Nina Patel',       'Ana Rivera',     false,false,'Manual',        'Manual',        'Annual',      false,true, false,false, 'GDPR',                    55,  50,  6, '2024-03-01','2025-03-01','Onboarded'],
  ['APP-033','NexusHR Portal',        'HR',          'Hybrid',      'Medium',  'Confidential','David Kim',        'Raj Sharma',     true, false,'Semi-Automated','Manual',        'Semi-Annual', false,true, false,false, 'GDPR,SOX',                620, 595, 18,'2024-07-15','2025-01-15','Onboarded'],
  ['APP-034','CloudBridge Connect',   'IT',          'SaaS',        'Medium',  'Internal',    'Tom Bradley',      'Priya Nair',     true, false,'Automated',     'Automated',     'Annual',      false,true, false,false, 'ISO27001',                120, 115, 8, '2024-06-01','2025-06-01','Onboarded'],
  ['APP-035','SecureGate PAM',        'IT',          'On-Premise',  'Critical','Confidential','Tom Bradley',      'Sven Andersen',  true, true, 'Automated',     'Automated',     'Monthly',     true, true, true, true,  'ISO27001,SOC2,PCI-DSS',   38,  38,  0, '2024-11-01','2025-02-01','Onboarded'],
  ['APP-036','FlowConnect iPaaS',     'IT',          'SaaS',        'High',    'Internal',    'Tom Bradley',      'Chris Yates',    true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,false, 'ISO27001',                65,  62,  1, '2024-10-15','2025-01-15','Onboarded'],
  ['APP-037','ProcureEdge',           'Finance',     'SaaS',        'Medium',  'Confidential','Lisa Wong',        'Mike Patel',     true, false,'Semi-Automated','Manual',        'Annual',      false,true, false,false, 'SOX',                     210, 198, 20,'2024-05-01','2025-05-01','Onboarded'],
  ['APP-038','TalentIQ Recruiting',   'HR',          'SaaS',        'Medium',  'Confidential','David Kim',        'Ana Rivera',     true, false,'Automated',     'Automated',     'Annual',      false,true, false,false, 'GDPR',                    180, 170, 14,'2024-06-15','2025-06-15','Onboarded'],
  ['APP-039','ComplianceSync GRC',    'GRC',         'SaaS',        'High',    'Confidential','Tom Bradley',      'Raj Sharma',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,true,  'SOX,ISO27001,GDPR',       95,  92,  2, '2024-10-01','2025-01-01','Onboarded'],
  ['APP-040','RiskRadar Platform',    'GRC',         'SaaS',        'High',    'Confidential','Tom Bradley',      'Priya Nair',     true, true, 'Semi-Automated','Semi-Automated','Quarterly',   false,true, false,true,  'SOX,ISO27001',            88,  85,  1, '2024-10-15','2025-01-15','Onboarded'],
  ['APP-041','AssetTracker ITAM',     'IT',          'SaaS',        'Medium',  'Internal',    'Tom Bradley',      'Sven Andersen',  true, false,'Semi-Automated','Manual',        'Annual',      false,true, false,false, 'ISO27001',                72,  68,  5, '2024-04-01','2025-04-01','Onboarded'],
  ['APP-042','VendorPortal B2B',      'Finance',     'SaaS',        'Medium',  'Confidential','Lisa Wong',        'Chris Yates',    false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, 'SOX',                     450, 420, 42,'2024-03-01','2025-03-01','In Progress'],
  ['APP-043','ContractHub CLM',       'Legal',       'SaaS',        'High',    'Confidential','Rachel Green',     'Mike Patel',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,true,  'SOX,GDPR',                140, 133, 4, '2024-10-01','2025-01-01','Onboarded'],
  ['APP-044','PolicyManager GRC',     'GRC',         'On-Premise',  'High',    'Confidential','Tom Bradley',      'Ana Rivera',     true, true, 'Semi-Automated','Manual',        'Quarterly',   false,true, false,true,  'ISO27001,SOX',            60,  58,  3, '2024-09-15','2024-12-15','Onboarded'],
  ['APP-045','BudgetFlow FP&A',       'Finance',     'SaaS',        'High',    'Confidential','Lisa Wong',        'Raj Sharma',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,true,  'SOX',                     120, 116, 4, '2024-10-01','2025-01-01','Onboarded'],
  ['APP-046','ProjectNexus PPM',      'IT',          'SaaS',        'Medium',  'Internal',    'Tom Bradley',      'Priya Nair',     true, false,'Automated',     'Manual',        'Annual',      false,true, false,false, 'ISO27001',                380, 362, 22,'2024-06-01','2025-06-01','Onboarded'],
  ['APP-047','AnalyticsCore BI',      'Analytics',   'On-Premise',  'Medium',  'Confidential','Nina Patel',       'Sven Andersen',  false,false,'Manual',        'Manual',        'Annual',      false,true, false,false, 'SOX',                     42,  38,  5, '2024-02-01','2025-02-01','Onboarded'],
  ['APP-048','ReportStream',          'Analytics',   'SaaS',        'Low',     'Internal',    'Nina Patel',       'Chris Yates',    false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, '',                        95,  85,  18,'2024-01-01','2025-01-01','Onboarded'],
  ['APP-049','IncidentIQ ITSM',       'IT',          'SaaS',        'Medium',  'Internal',    'Tom Bradley',      'Mike Patel',     true, false,'Semi-Automated','Manual',        'Semi-Annual', false,true, false,false, 'ISO27001',                280, 265, 16,'2024-07-15','2025-01-15','Onboarded'],
  ['APP-050','ChangeTracker ITSM',    'IT',          'SaaS',        'Medium',  'Internal',    'Tom Bradley',      'Ana Rivera',     true, false,'Semi-Automated','Manual',        'Annual',      false,true, false,false, 'ITIL',                    145, 138, 10,'2024-05-01','2025-05-01','Onboarded'],
  ['APP-051','ConfigHub SCM',         'Engineering', 'SaaS',        'High',    'Internal',    'Alex Morgan',      'Raj Sharma',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, true, false, 'ISO27001',                380, 370, 8, '2024-10-01','2025-01-01','Onboarded'],
  ['APP-052','DeployPilot CI/CD',     'Engineering', 'SaaS',        'High',    'Internal',    'Alex Morgan',      'Priya Nair',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, true, false, 'ISO27001',                290, 282, 5, '2024-10-15','2025-01-15','Onboarded'],
  ['APP-053','VaultKey Secrets',      'IT',          'On-Premise',  'Critical','Confidential','Tom Bradley',      'Sven Andersen',  true, true, 'Automated',     'Automated',     'Monthly',     true, true, true, true,  'ISO27001,SOC2,PCI-DSS',   22,  22,  0, '2024-11-01','2025-02-01','Onboarded'],
  ['APP-054','DataGuard DLP',         'IT',          'On-Premise',  'High',    'Confidential','Tom Bradley',      'Chris Yates',    true, true, 'Semi-Automated','Manual',        'Quarterly',   false,true, false,false, 'GDPR,ISO27001',           48,  46,  2, '2024-09-01','2024-12-01','Onboarded'],
  ['APP-055','NetMonitor NMS',        'IT',          'On-Premise',  'High',    'Internal',    'Tom Bradley',      'Mike Patel',     true, false,'Semi-Automated','Manual',        'Semi-Annual', false,true, false,false, 'ISO27001',                35,  33,  3, '2024-07-01','2025-01-01','Onboarded'],
  ['APP-056','LogStream SIEM',        'IT',          'On-Premise',  'Critical','Confidential','Tom Bradley',      'Ana Rivera',     true, true, 'Automated',     'Automated',     'Monthly',     true, true, false,true,  'ISO27001,SOC2,PCI-DSS',   55,  54,  0, '2024-11-15','2025-02-15','Onboarded'],
  ['APP-057','ThreatScan Vuln',       'IT',          'SaaS',        'High',    'Internal',    'Tom Bradley',      'Raj Sharma',     true, true, 'Automated',     'Automated',     'Monthly',     false,true, false,false, 'ISO27001,SOC2',           28,  27,  1, '2024-11-01','2025-02-01','Onboarded'],
  ['APP-058','PatchPilot',            'IT',          'SaaS',        'Medium',  'Internal',    'Tom Bradley',      'Priya Nair',     true, false,'Semi-Automated','Manual',        'Quarterly',   false,true, false,false, 'ISO27001',                32,  31,  2, '2024-09-15','2024-12-15','Onboarded'],
  ['APP-059','AssetScan Discovery',   'IT',          'SaaS',        'Medium',  'Internal',    'Tom Bradley',      'Sven Andersen',  false,false,'Manual',        'Manual',        'Annual',      false,true, false,false, '',                        18,  16,  2, '2024-04-01','2025-04-01','Onboarded'],
  ['APP-060','IdentityBridge IDM',    'IT',          'On-Premise',  'Critical','Confidential','Tom Bradley',      'Chris Yates',    true, true, 'Automated',     'Automated',     'Monthly',     true, true, true, true,  'ISO27001,SOC2,GDPR',      12,  12,  0, '2024-11-15','2025-02-15','Onboarded'],
  ['APP-061','RoleMatrix IAM',        'IT',          'SaaS',        'High',    'Confidential','Tom Bradley',      'Mike Patel',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, true, true,  'ISO27001,SOC2',           22,  22,  0, '2024-10-01','2025-01-01','Onboarded'],
  ['APP-062','CertifyNow',            'GRC',         'SaaS',        'High',    'Confidential','Tom Bradley',      'Ana Rivera',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,true,  'SOX,ISO27001',            48,  46,  1, '2024-10-15','2025-01-15','Onboarded'],
  ['APP-063','AccessGate SSO',        'IT',          'On-Premise',  'Critical','Confidential','Tom Bradley',      'Raj Sharma',     true, true, 'Automated',     'Automated',     'Monthly',     true, true, true, true,  'ISO27001,SOC2,GDPR',      10,  10,  0, '2024-11-01','2025-02-01','Onboarded'],
  ['APP-064','MobileDevice MDM',      'IT',          'SaaS',        'High',    'Internal',    'Tom Bradley',      'Priya Nair',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,false, 'ISO27001,GDPR',           1200,1185,8, '2024-10-01','2025-01-01','Onboarded'],
  ['APP-065','TrainingHub LMS',       'HR',          'SaaS',        'Low',     'Internal',    'David Kim',        'Sven Andersen',  false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, 'GDPR',                    2800,2650,180,'2024-01-15','2025-01-15','Onboarded'],
  ['APP-066','OnboardingFlow',        'HR',          'SaaS',        'Medium',  'Confidential','David Kim',        'Chris Yates',    true, false,'Automated',     'Automated',     'Semi-Annual', false,true, false,false, 'GDPR,SOX',                320, 305, 18,'2024-07-01','2025-01-01','Onboarded'],
  ['APP-067','OffboardingTracker',    'HR',          'SaaS',        'Medium',  'Confidential','David Kim',        'Mike Patel',     true, false,'Automated',     'Automated',     'Semi-Annual', false,true, false,false, 'GDPR,SOX',                310, 295, 22,'2024-07-01','2025-01-01','Onboarded'],
  ['APP-068','PayrollPro',            'Finance',     'On-Premise',  'Critical','Confidential','Lisa Wong',        'Ana Rivera',     true, true, 'Manual',        'Manual',        'Quarterly',   true, true, false,true,  'SOX,GDPR,PCI-DSS',        280, 270, 5, '2024-10-15','2025-01-15','Onboarded'],
  ['APP-069','ExpenseTracker',        'Finance',     'SaaS',        'Low',     'Internal',    'Lisa Wong',        'Raj Sharma',     false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, 'SOX',                     1900,1800,150,'2024-01-01','2025-01-01','Onboarded'],
  ['APP-070','InvoiceFlow AP/AR',     'Finance',     'SaaS',        'Medium',  'Confidential','Lisa Wong',        'Priya Nair',     true, false,'Semi-Automated','Manual',        'Semi-Annual', false,true, false,true,  'SOX,PCI-DSS',             380, 360, 25,'2024-07-15','2025-01-15','Onboarded'],
  ['APP-071','TaxCompliance',         'Finance',     'SaaS',        'High',    'Confidential','Lisa Wong',        'Sven Andersen',  true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,true,  'SOX,GDPR',                95,  92,  3, '2024-10-01','2025-01-01','Onboarded'],
  ['APP-072','AuditTrail GRC',        'GRC',         'On-Premise',  'High',    'Confidential','Tom Bradley',      'Chris Yates',    true, true, 'Semi-Automated','Manual',        'Quarterly',   false,true, false,true,  'SOX,ISO27001,GDPR',       65,  63,  2, '2024-09-15','2024-12-15','Onboarded'],
  ['APP-073','GovConnect Regulatory', 'GRC',         'SaaS',        'High',    'Confidential','Tom Bradley',      'Mike Patel',     true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,true,  'SOX,GDPR,ISO27001',       58,  56,  1, '2024-10-01','2025-01-01','Onboarded'],
  ['APP-074','LegalDesk',             'Legal',       'SaaS',        'Medium',  'Confidential','Rachel Green',     'Ana Rivera',     true, false,'Semi-Automated','Manual',        'Annual',      false,true, false,false, 'GDPR',                    145, 138, 10,'2024-05-01','2025-05-01','Onboarded'],
  ['APP-075','ContractReview AI',     'Legal',       'SaaS',        'Medium',  'Confidential','Rachel Green',     'Raj Sharma',     false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, 'GDPR',                    88,  80,  12,'2024-04-01','2025-04-01','In Progress'],
  ['APP-076','BoardPortal',           'Legal',       'SaaS',        'Critical','Confidential','Rachel Green',     'Priya Nair',     true, true, 'Automated',     'Automated',     'Quarterly',   true, true, false,true,  'SOX,GDPR',                45,  44,  0, '2024-10-15','2025-01-15','Onboarded'],
  ['APP-077','IRConnect',             'Finance',     'SaaS',        'High',    'Confidential','Lisa Wong',        'Sven Andersen',  true, true, 'Automated',     'Automated',     'Quarterly',   false,true, false,true,  'SOX,GDPR',                38,  37,  0, '2024-10-01','2025-01-01','Onboarded'],
  ['APP-078','BrandManager',          'Marketing',   'SaaS',        'Low',     'Internal',    'Olivia Brooks',    'Chris Yates',    false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, '',                        120, 110, 18,'2024-02-01','2025-02-01','Onboarded'],
  ['APP-079','ContentHub CMS',        'Marketing',   'SaaS',        'Low',     'Internal',    'Olivia Brooks',    'Mike Patel',     false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, 'GDPR',                    180, 162, 24,'2024-01-15','2025-01-15','Onboarded'],
  ['APP-080','EmailCampaign Suite',   'Marketing',   'SaaS',        'Low',     'Internal',    'Olivia Brooks',    'Ana Rivera',     false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, 'GDPR',                    95,  88,  12,'2024-03-01','2025-03-01','Onboarded'],
  ['APP-081','SocialMonitor',         'Marketing',   'SaaS',        'Low',     'Public',      'Olivia Brooks',    'Raj Sharma',     false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, 'GDPR',                    35,  32,  5, '2024-02-15','2025-02-15','Onboarded'],
  ['APP-082','SEOAnalyzer',           'Marketing',   'SaaS',        'Low',     'Public',      'Olivia Brooks',    'Priya Nair',     false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, '',                        28,  25,  4, '2024-01-01','2025-01-01','Onboarded'],
  ['APP-083','CustomerJourney CX',    'Sales',       'SaaS',        'Medium',  'Confidential','Sarah Chen',       'Sven Andersen',  true, false,'Automated',     'Manual',        'Annual',      false,true, false,false, 'GDPR',                    210, 198, 18,'2024-06-01','2025-06-01','Onboarded'],
  ['APP-084','SupportPortal',         'Customer Svc','On-Premise',  'Medium',  'Internal',    'James Park',       'Chris Yates',    false,false,'Manual',        'Manual',        'Annual',      false,true, false,false, 'GDPR',                    320, 295, 38,'2024-04-01','2025-04-01','In Progress'],
  ['APP-085','KnowledgeBase',         'Customer Svc','SaaS',        'Low',     'Public',      'James Park',       'Mike Patel',     false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, '',                        480, 440, 65,'2024-01-01','2025-01-01','Onboarded'],
  ['APP-086','FieldService Ops',      'Operations',  'SaaS',        'Medium',  'Internal',    'Marcus Ellis',     'Ana Rivera',     true, false,'Semi-Automated','Manual',        'Semi-Annual', false,true, false,false, 'ISO27001',                580, 550, 35,'2024-07-15','2025-01-15','Onboarded'],
  ['APP-087','InventorySync',         'Operations',  'Hybrid',      'Medium',  'Internal',    'Marcus Ellis',     'Raj Sharma',     true, false,'Manual',        'Manual',        'Annual',      false,true, false,false, 'ISO27001',                240, 225, 20,'2024-05-01','2025-05-01','Onboarded'],
  ['APP-088','ShipTracker Logistics', 'Operations',  'SaaS',        'Low',     'Internal',    'Marcus Ellis',     'Priya Nair',     false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, '',                        195, 178, 28,'2024-02-01','2025-02-01','Onboarded'],
  ['APP-089','QualityControl QMS',    'Operations',  'On-Premise',  'Medium',  'Internal',    'Marcus Ellis',     'Sven Andersen',  false,false,'Manual',        'Manual',        'Annual',      false,true, false,false, 'ISO9001',                 145, 132, 18,'2024-04-01','2025-04-01','Onboarded'],
  ['APP-090','SurveyPulse',           'HR',          'SaaS',        'Low',     'Internal',    'David Kim',        'Chris Yates',    false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, 'GDPR',                    3200,2980,280,'2024-01-01','2025-01-01','Onboarded'],
  ['APP-091','PrintManager',          'IT',          'Legacy',      'Low',     'Internal',    'Tom Bradley',      'Mike Patel',     false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, '',                        420, 380, 65,'2023-06-01','2024-06-01','Planned'],
  ['APP-092','VideoVault Media',      'Marketing',   'SaaS',        'Low',     'Internal',    'Olivia Brooks',    'Ana Rivera',     false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, 'GDPR',                    88,  78,  14,'2024-01-15','2025-01-15','Onboarded'],
  ['APP-093','PatentTracker',         'Legal',       'SaaS',        'Medium',  'Confidential','Rachel Green',     'Raj Sharma',     true, false,'Manual',        'Manual',        'Annual',      false,true, false,false, 'GDPR',                    42,  38,  5, '2024-04-01','2025-04-01','Onboarded'],
  ['APP-094','TrademarksDB',          'Legal',       'SaaS',        'Medium',  'Confidential','Rachel Green',     'Priya Nair',     false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, 'GDPR',                    38,  32,  8, '2024-03-01','2025-03-01','Onboarded'],
  ['APP-095','NDASigner',             'Legal',       'SaaS',        'Medium',  'Confidential','Rachel Green',     'Sven Andersen',  true, false,'Automated',     'Automated',     'Annual',      false,false,false,false, 'GDPR',                    210, 198, 18,'2024-05-15','2025-05-15','Onboarded'],
  ['APP-096','ChatBot AI',            'Customer Svc','SaaS',        'Low',     'Public',      'James Park',       'Chris Yates',    false,false,'Manual',        'Manual',        'Annual',      false,false,false,false, 'GDPR',                    12,  12,  0, '2024-06-01','2025-06-01','Onboarded'],
  ['APP-097','TalentPulse',           'HR',          'SaaS',        'Medium',  'Confidential','David Kim',        'Mike Patel',     true, false,'Automated',     'Manual',        'Semi-Annual', false,true, false,false, 'GDPR',                    410, 388, 30,'2024-07-01','2025-01-01','Onboarded'],
  ['APP-098','DataBridge ETL',        'IT',          'Hybrid',      'High',    'Confidential','Tom Bradley',      'Ana Rivera',     true, true, 'Semi-Automated','Manual',        'Quarterly',   false,true, false,false, 'ISO27001,SOX',            28,  27,  1, '2024-10-15','2025-01-15','In Progress'],
  ['APP-099','CloudStore Archive',    'IT',          'SaaS',        'Medium',  'Confidential','Tom Bradley',      'Raj Sharma',     true, false,'Automated',     'Automated',     'Annual',      false,true, false,false, 'GDPR,ISO27001',           180, 172, 10,'2024-06-15','2025-06-15','Onboarded'],
  ['APP-100','BackupVault DR',        'IT',          'On-Premise',  'High',    'Confidential','Tom Bradley',      'Priya Nair',     true, true, 'Semi-Automated','Manual',        'Quarterly',   true, true, false,false, 'ISO27001,SOC2',           22,  21,  1, '2024-09-01','2024-12-01','Onboarded'],
]

function rowToApp(r: Row): CMDBApp {
  return {
    appId: r[0], appName: r[1], department: r[2], appType: r[3],
    businessCriticality: r[4], dataClassification: r[5],
    businessOwner: r[6], itOwner: r[7],
    ssoEnabled: r[8], mfaRequired: r[9],
    provisioningType: r[10], deprovisioningType: r[11],
    accessReviewFrequency: r[12],
    pamVaulted: r[13], rbacEnabled: r[14], jitAccess: r[15], sodPoliciesDefined: r[16],
    complianceFrameworks: r[17],
    totalAccounts: r[18], activeAccounts: r[19], orphanAccounts: r[20],
    lastAccessReviewDate: r[21], nextAccessReviewDate: r[22],
    onboardingStatus: r[23],
  }
}

export const CMDB_MOCK_APPS: CMDBApp[] = RAW.map(rowToApp)

// ── CSV export helpers ────────────────────────────────────────────────────────
export const CMDB_CSV_HEADERS: string[] = CMDB_FIELD_DEFINITIONS.map(f => f.label)

export function cmdbAppToCsvRow(app: CMDBApp): string[] {
  return CMDB_FIELD_DEFINITIONS.map(f => {
    const v = app[f.key]
    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    return String(v ?? '')
  })
}

export function generateSampleCsv(): string {
  const rows = [
    CMDB_CSV_HEADERS,
    ...CMDB_MOCK_APPS.map(cmdbAppToCsvRow),
  ]
  return rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
}
