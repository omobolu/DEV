import { SNOWTicket, CertificationCampaign } from './iga.types';
import { getSeedMode } from '../../config/seed-mode';

// ── Seed Data ────────────────────────────────────────────────────────────────

const SEED_TICKETS: SNOWTicket[] = [
  {
    ticketId: 'snow-001',
    number: 'INC0012847',
    shortDescription: 'New account created but I already have an existing one',
    description: 'I received an email today saying a new corporate account (jsmith2@acme.com) was created for me. However, I already have an existing account (john.smith@acme.com) that I have been using for 3 years. I am confused about which account to use and worried about losing access to my files, SharePoint sites, and applications. My manager did not request this. Please help resolve this duplicate account situation.',
    caller: 'John Smith',
    callerEmail: 'john.smith@acme.com',
    assignmentGroup: 'IAM Engineering',
    priority: 'high',
    state: 'new',
    category: 'Identity Management',
    subcategory: 'Duplicate Account',
    createdAt: '2026-04-04T09:15:00Z',
    updatedAt: '2026-04-04T09:15:00Z',
  },
  {
    ticketId: 'snow-002',
    number: 'INC0012903',
    shortDescription: 'Salesforce access not provisioned after 5 days',
    description: 'I submitted an access request for Salesforce CRM (Sales Professional license) through the portal 5 business days ago (REQ0045123). My manager approved it the same day but the access has still not been provisioned. I need this urgently for the Q2 pipeline review next week. The SailPoint request shows "Pending Fulfillment" status.',
    caller: 'Maria Garcia',
    callerEmail: 'maria.garcia@acme.com',
    assignmentGroup: 'IAM Engineering',
    priority: 'high',
    state: 'new',
    category: 'Access Management',
    subcategory: 'Provisioning Failure',
    createdAt: '2026-04-03T14:30:00Z',
    updatedAt: '2026-04-03T14:30:00Z',
  },
  {
    ticketId: 'snow-003',
    number: 'INC0012955',
    shortDescription: 'Former employee admin account still active in production',
    description: 'During our quarterly access review, we discovered that the admin account (r.thompson_admin) for Robert Thompson, who left the company 4 months ago, is still active in our production AWS environment and has full admin privileges. His regular AD account was disabled on his termination date but this privileged account was missed. Last logon was 2 days after his departure date.',
    caller: 'Security Operations Team',
    callerEmail: 'secops@acme.com',
    assignmentGroup: 'IAM Engineering',
    priority: 'critical',
    state: 'new',
    category: 'Privileged Access',
    subcategory: 'Orphan Admin Account',
    createdAt: '2026-04-04T11:00:00Z',
    updatedAt: '2026-04-04T11:00:00Z',
  },
  {
    ticketId: 'snow-004',
    number: 'INC0013001',
    shortDescription: 'MFA not working after Entra ID migration',
    description: 'Since the migration from on-prem ADFS to Entra ID last week, I cannot authenticate with MFA for any cloud applications (Office 365, ServiceNow, Workday). I keep getting "Authentication method not recognized" errors. I have tried re-registering my authenticator app but the enrollment page shows "Registration not available for your account". Other team members in Finance are also affected.',
    caller: 'David Kim',
    callerEmail: 'david.kim@acme.com',
    assignmentGroup: 'IAM Engineering',
    priority: 'high',
    state: 'new',
    category: 'Authentication',
    subcategory: 'MFA Failure',
    createdAt: '2026-04-04T08:45:00Z',
    updatedAt: '2026-04-04T08:45:00Z',
  },
  {
    ticketId: 'snow-005',
    number: 'INC0013042',
    shortDescription: 'Contractor has excessive production database access',
    description: 'Audit flagged that contractor account (ext.chen@vendor.acme.com) has DBA-level access to 3 production databases (CustomerDB, OrderDB, PaymentDB) through direct SQL Server role grants. Contractor was hired for a development project with read-only access to the dev environment only. This appears to be a provisioning error from 6 months ago.',
    caller: 'Compliance Team',
    callerEmail: 'compliance@acme.com',
    assignmentGroup: 'IAM Engineering',
    priority: 'critical',
    state: 'new',
    category: 'Access Management',
    subcategory: 'Excessive Permissions',
    createdAt: '2026-04-05T10:20:00Z',
    updatedAt: '2026-04-05T10:20:00Z',
  },
];

const SEED_CAMPAIGNS: CertificationCampaign[] = [
  {
    campaignId: 'cert-001',
    name: 'Manager Certification Q1 2026',
    type: 'manager',
    status: 'active',
    owner: 'sarah.chen@acme.com',
    startDate: '2026-01-15T00:00:00Z',
    endDate: '2026-04-15T00:00:00Z',
    totalItems: 250,
    certified: 180,
    revoked: 15,
    pending: 55,
    progress: 78,
    items: [
      { itemId: 'ci-001', identity: 'john.smith@acme.com', entitlement: 'SharePoint Site Collection Admin', application: 'SharePoint Online', decision: 'certified', reviewer: 'mgr.jones@acme.com', decidedAt: '2026-02-10T14:30:00Z' },
      { itemId: 'ci-002', identity: 'maria.garcia@acme.com', entitlement: 'Salesforce Sales Professional', application: 'Salesforce CRM', decision: 'certified', reviewer: 'mgr.jones@acme.com', decidedAt: '2026-02-10T14:35:00Z' },
      { itemId: 'ci-003', identity: 'robert.thompson@acme.com', entitlement: 'AWS Admin Role', application: 'AWS Production', decision: 'revoked', reviewer: 'mgr.williams@acme.com', decidedAt: '2026-02-12T09:00:00Z' },
      { itemId: 'ci-004', identity: 'david.kim@acme.com', entitlement: 'ServiceNow ITIL User', application: 'ServiceNow', decision: 'certified', reviewer: 'mgr.patel@acme.com', decidedAt: '2026-02-15T11:20:00Z' },
      { itemId: 'ci-005', identity: 'lisa.wang@acme.com', entitlement: 'Workday HR Partner', application: 'Workday', decision: 'pending', reviewer: 'mgr.jones@acme.com' },
      { itemId: 'ci-006', identity: 'mike.brown@acme.com', entitlement: 'Azure DevOps Contributor', application: 'Azure DevOps', decision: 'pending', reviewer: 'mgr.williams@acme.com' },
      { itemId: 'ci-007', identity: 'anna.taylor@acme.com', entitlement: 'Jira Project Admin', application: 'Jira', decision: 'certified', reviewer: 'mgr.patel@acme.com', decidedAt: '2026-03-01T16:45:00Z' },
    ],
  },
  {
    campaignId: 'cert-002',
    name: 'Salesforce Application Review',
    type: 'application',
    status: 'completed',
    owner: 'admin.ops@acme.com',
    startDate: '2026-02-01T00:00:00Z',
    endDate: '2026-03-01T00:00:00Z',
    totalItems: 120,
    certified: 108,
    revoked: 12,
    pending: 0,
    progress: 100,
    items: [
      { itemId: 'ci-010', identity: 'maria.garcia@acme.com', entitlement: 'Sales Professional License', application: 'Salesforce CRM', decision: 'certified', reviewer: 'sf.admin@acme.com', decidedAt: '2026-02-15T10:00:00Z' },
      { itemId: 'ci-011', identity: 'tom.jackson@acme.com', entitlement: 'Sales Manager License', application: 'Salesforce CRM', decision: 'certified', reviewer: 'sf.admin@acme.com', decidedAt: '2026-02-15T10:05:00Z' },
      { itemId: 'ci-012', identity: 'ext.vendor1@acme.com', entitlement: 'Sales Professional License', application: 'Salesforce CRM', decision: 'revoked', reviewer: 'sf.admin@acme.com', decidedAt: '2026-02-16T09:30:00Z' },
      { itemId: 'ci-013', identity: 'jane.doe@acme.com', entitlement: 'Service Cloud Agent', application: 'Salesforce CRM', decision: 'certified', reviewer: 'sf.admin@acme.com', decidedAt: '2026-02-17T14:00:00Z' },
      { itemId: 'ci-014', identity: 'old.employee@acme.com', entitlement: 'Sales Professional License', application: 'Salesforce CRM', decision: 'revoked', reviewer: 'sf.admin@acme.com', decidedAt: '2026-02-18T08:45:00Z' },
      { itemId: 'ci-015', identity: 'kevin.lee@acme.com', entitlement: 'Marketing Cloud User', application: 'Salesforce CRM', decision: 'certified', reviewer: 'sf.admin@acme.com', decidedAt: '2026-02-19T11:30:00Z' },
    ],
  },
  {
    campaignId: 'cert-003',
    name: 'PAM Admin Entitlement Review',
    type: 'entitlement',
    status: 'active',
    owner: 'security.lead@acme.com',
    startDate: '2026-03-01T00:00:00Z',
    endDate: '2026-04-30T00:00:00Z',
    totalItems: 45,
    certified: 20,
    revoked: 5,
    pending: 20,
    progress: 56,
    items: [
      { itemId: 'ci-020', identity: 'admin.user1@acme.com', entitlement: 'CyberArk Vault Admin', application: 'CyberArk PAM', decision: 'certified', reviewer: 'security.lead@acme.com', decidedAt: '2026-03-10T09:00:00Z' },
      { itemId: 'ci-021', identity: 'admin.user2@acme.com', entitlement: 'CyberArk Safe Owner', application: 'CyberArk PAM', decision: 'certified', reviewer: 'security.lead@acme.com', decidedAt: '2026-03-10T09:15:00Z' },
      { itemId: 'ci-022', identity: 'r.thompson@acme.com', entitlement: 'CyberArk Vault Admin', application: 'CyberArk PAM', decision: 'revoked', reviewer: 'security.lead@acme.com', decidedAt: '2026-03-11T10:00:00Z' },
      { itemId: 'ci-023', identity: 'ops.team1@acme.com', entitlement: 'AWS Root Account Access', application: 'AWS IAM', decision: 'pending', reviewer: 'security.lead@acme.com' },
      { itemId: 'ci-024', identity: 'dba.admin@acme.com', entitlement: 'SQL Server SA Role', application: 'SQL Server Production', decision: 'pending', reviewer: 'security.lead@acme.com' },
      { itemId: 'ci-025', identity: 'net.admin@acme.com', entitlement: 'Firewall Admin', application: 'Palo Alto Networks', decision: 'certified', reviewer: 'security.lead@acme.com', decidedAt: '2026-03-15T14:30:00Z' },
      { itemId: 'ci-026', identity: 'ext.chen@vendor.acme.com', entitlement: 'DBA Production Access', application: 'SQL Server Production', decision: 'revoked', reviewer: 'security.lead@acme.com', decidedAt: '2026-03-20T08:00:00Z' },
      { itemId: 'ci-027', identity: 'cloud.admin@acme.com', entitlement: 'Azure Global Admin', application: 'Microsoft Entra ID', decision: 'pending', reviewer: 'security.lead@acme.com' },
    ],
  },
  {
    campaignId: 'cert-004',
    name: 'SOX Compliance Role Review',
    type: 'role',
    status: 'scheduled',
    owner: 'compliance@acme.com',
    startDate: '2026-05-01T00:00:00Z',
    endDate: '2026-06-30T00:00:00Z',
    totalItems: 300,
    certified: 0,
    revoked: 0,
    pending: 300,
    progress: 0,
    items: [
      { itemId: 'ci-030', identity: 'finance.user1@acme.com', entitlement: 'AP Processor Role', application: 'SAP ERP', decision: 'pending', reviewer: 'sox.reviewer@acme.com' },
      { itemId: 'ci-031', identity: 'finance.user2@acme.com', entitlement: 'AR Manager Role', application: 'SAP ERP', decision: 'pending', reviewer: 'sox.reviewer@acme.com' },
      { itemId: 'ci-032', identity: 'finance.user3@acme.com', entitlement: 'GL Accountant Role', application: 'SAP ERP', decision: 'pending', reviewer: 'sox.reviewer@acme.com' },
      { itemId: 'ci-033', identity: 'treasury.user@acme.com', entitlement: 'Treasury Admin Role', application: 'SAP ERP', decision: 'pending', reviewer: 'sox.reviewer@acme.com' },
      { itemId: 'ci-034', identity: 'procurement.user@acme.com', entitlement: 'Purchasing Manager Role', application: 'SAP ERP', decision: 'pending', reviewer: 'sox.reviewer@acme.com' },
      { itemId: 'ci-035', identity: 'payroll.admin@acme.com', entitlement: 'Payroll Administrator Role', application: 'Workday', decision: 'pending', reviewer: 'sox.reviewer@acme.com' },
    ],
  },
];

// ── Repository ───────────────────────────────────────────────────────────────

class IgaRepository {
  private ticketStore = new Map<string, SNOWTicket[]>();
  private campaignStore = new Map<string, CertificationCampaign[]>();

  // ── Lazy seed helpers ────────────────────────────────────────────────────

  private ensureTickets(tenantId: string): SNOWTicket[] {
    if (!this.ticketStore.has(tenantId)) {
      if (getSeedMode() === 'production') {
        this.ticketStore.set(tenantId, []);
        return this.ticketStore.get(tenantId)!;
      }
      const cloned = JSON.parse(JSON.stringify(SEED_TICKETS)) as SNOWTicket[];
      this.ticketStore.set(tenantId, cloned);
      console.log(`[IgaRepository] Seeded ${cloned.length} SNOW tickets for tenant ${tenantId}`);
    }
    return this.ticketStore.get(tenantId)!;
  }

  private ensureCampaigns(tenantId: string): CertificationCampaign[] {
    if (!this.campaignStore.has(tenantId)) {
      if (getSeedMode() === 'production') {
        this.campaignStore.set(tenantId, []);
        return this.campaignStore.get(tenantId)!;
      }
      const cloned = JSON.parse(JSON.stringify(SEED_CAMPAIGNS)) as CertificationCampaign[];
      this.campaignStore.set(tenantId, cloned);
      console.log(`[IgaRepository] Seeded ${cloned.length} certification campaigns for tenant ${tenantId}`);
    }
    return this.campaignStore.get(tenantId)!;
  }

  // ── Ticket Methods ───────────────────────────────────────────────────────

  listTickets(tenantId: string): SNOWTicket[] {
    return this.ensureTickets(tenantId);
  }

  getTicket(tenantId: string, ticketId: string): SNOWTicket | undefined {
    return this.ensureTickets(tenantId).find(t => t.ticketId === ticketId);
  }

  updateTicket(tenantId: string, ticketId: string, updates: Partial<SNOWTicket>): SNOWTicket | undefined {
    const tickets = this.ensureTickets(tenantId);
    const idx = tickets.findIndex(t => t.ticketId === ticketId);
    if (idx === -1) return undefined;

    tickets[idx] = { ...tickets[idx], ...updates, updatedAt: new Date().toISOString() };
    return tickets[idx];
  }

  // ── Campaign Methods ─────────────────────────────────────────────────────

  listCampaigns(tenantId: string): CertificationCampaign[] {
    return this.ensureCampaigns(tenantId);
  }

  getCampaign(tenantId: string, campaignId: string): CertificationCampaign | undefined {
    return this.ensureCampaigns(tenantId).find(c => c.campaignId === campaignId);
  }
}

export const igaRepository = new IgaRepository();
