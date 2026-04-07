import {
  SNOWTicket, CertificationCampaign,
  Investigation, Finding, AgentPlan, PlannedAction, AgentExecution, ActionResult,
} from './iga.types';
import { igaRepository } from './iga.repository';

// ── Investigation data per ticket ────────────────────────────────────────────

const INVESTIGATION_DATA: Record<string, { problem: string; rootCause: string; affectedSystems: string[]; findings: Finding[]; recommendedSolution: string; confidence: number }> = {
  'snow-001': {
    problem: 'Duplicate identity created in corporate directory',
    rootCause: 'HR system processed a department transfer as a new hire event, creating a second identity record. SailPoint joiner workflow provisioned a new AD account without correlating to the existing identity.',
    affectedSystems: ['Active Directory', 'SailPoint IdentityNow', 'Entra ID', 'HR System'],
    findings: [
      { source: 'Active Directory', type: 'Identity Correlation', detail: 'Two accounts found: john.smith (created 2023-01-15, last logon 2026-04-04) and jsmith2 (created 2026-04-03, last logon: never). Both in OU=Corporate Users.', severity: 'critical' },
      { source: 'SailPoint IdentityNow', type: 'Identity Correlation', detail: 'Two identity cubes correlated: ID-4521 (John Smith, john.smith@acme.com, source: HR Feed) and ID-8934 (John Smith, jsmith2@acme.com, source: HR Feed). Second identity created by automated joiner process from duplicate HR record.', severity: 'critical' },
      { source: 'Entra ID', type: 'Sign-In Activity', detail: 'john.smith@acme.com: 847 sign-ins last 30 days, 12 applications, MFA registered. jsmith2@acme.com: 0 sign-ins, 0 applications, no MFA registered.', severity: 'warning' },
      { source: 'HR System', type: 'Record Analysis', detail: 'Employee ID EMP-4521 has two active records: original hire date 2023-01-15 (dept: Engineering) and transfer record processed as new hire on 2026-04-03 (dept: Engineering - Platform Team).', severity: 'info' },
    ],
    recommendedSolution: '1. Disable the duplicate AD account (jsmith2). 2. Remove the duplicate SailPoint identity (ID-8934). 3. Update HR feed correlation rules to prevent recurrence. 4. Notify the user that jsmith2 is being removed and to continue using john.smith.',
    confidence: 95,
  },
  'snow-002': {
    problem: 'Salesforce provisioning stuck in pending fulfillment state',
    rootCause: 'SailPoint provisioning connector for Salesforce lost its OAuth token after a Salesforce API version upgrade. All provisioning tasks queued after March 29 are stuck.',
    affectedSystems: ['SailPoint IdentityNow', 'Salesforce CRM'],
    findings: [
      { source: 'SailPoint IdentityNow', type: 'Provisioning Queue', detail: 'Request REQ0045123 status: Pending Fulfillment since 2026-03-29. 14 other Salesforce provisioning requests also stuck in same state.', severity: 'critical' },
      { source: 'Salesforce CRM', type: 'API Status', detail: 'Salesforce API v62.0 endpoint returning 401 Unauthorized for SailPoint service account. Token last refreshed 2026-03-28.', severity: 'critical' },
      { source: 'SailPoint IdentityNow', type: 'Connector Health', detail: 'Salesforce connector last successful operation: 2026-03-28T23:45:00Z. Connection test failing with OAuth2 token refresh error.', severity: 'warning' },
    ],
    recommendedSolution: '1. Re-authenticate SailPoint Salesforce connector with new OAuth token. 2. Retry all 15 stuck provisioning requests. 3. Verify Maria Garcia receives Sales Professional license. 4. Set up connector health monitoring alerts.',
    confidence: 92,
  },
  'snow-003': {
    problem: 'Orphaned privileged admin account active in production after employee termination',
    rootCause: 'Termination workflow in SailPoint only targeted accounts correlated to the primary identity. The privileged admin account (r.thompson_admin) was manually provisioned outside SailPoint and was never correlated to the identity cube, so it was not disabled during offboarding.',
    affectedSystems: ['AWS IAM', 'Active Directory', 'SailPoint IdentityNow', 'CyberArk PAM'],
    findings: [
      { source: 'AWS IAM', type: 'Account Status', detail: 'Account r.thompson_admin: Status ACTIVE, AdministratorAccess policy attached, last activity 2025-12-17 (2 days post-termination). Access keys active but unused since.', severity: 'critical' },
      { source: 'Active Directory', type: 'Account Status', detail: 'AD account r.thompson disabled on 2025-12-15 (termination date). Privileged account r.thompson_admin not found in AD — exists only in AWS IAM.', severity: 'critical' },
      { source: 'SailPoint IdentityNow', type: 'Identity Status', detail: 'Identity ID-7722 (Robert Thompson) status: INACTIVE. No correlated AWS admin account found. Account r.thompson_admin is uncorrelated/orphaned.', severity: 'warning' },
      { source: 'CyberArk PAM', type: 'Vault Check', detail: 'No managed credential found for r.thompson_admin in any CyberArk safe. Account was never onboarded to PAM.', severity: 'warning' },
    ],
    recommendedSolution: '1. Immediately disable AWS IAM account r.thompson_admin and deactivate all access keys. 2. Review CloudTrail logs for any suspicious activity post-termination. 3. Add the account to SailPoint for correlation before deletion. 4. Audit all manually provisioned AWS accounts for similar gaps.',
    confidence: 98,
  },
  'snow-004': {
    problem: 'MFA registration and authentication broken for migrated users',
    rootCause: 'During ADFS to Entra ID migration, the MFA authentication methods were not migrated for users in the Finance department. The Conditional Access policy requires MFA but users cannot register new methods because the migration batch left them in a "migration pending" state in Entra ID.',
    affectedSystems: ['Entra ID', 'ADFS (legacy)', 'Conditional Access'],
    findings: [
      { source: 'Entra ID', type: 'Authentication Methods', detail: 'david.kim@acme.com: 0 authentication methods registered. Migration status: "PendingMigration". 23 other Finance users in same state.', severity: 'critical' },
      { source: 'Entra ID', type: 'Conditional Access', detail: 'Policy "Require MFA for All Cloud Apps" is blocking authentication. Users in PendingMigration state cannot access MFA registration portal.', severity: 'critical' },
      { source: 'ADFS (legacy)', type: 'Migration Log', detail: 'Migration batch "Finance-Dept-2026-03-28" completed with warnings: 24 users had custom MFA provider (PhoneFactor) that could not be auto-migrated to Entra ID.', severity: 'warning' },
    ],
    recommendedSolution: '1. Create a temporary Conditional Access exclusion group for affected Finance users. 2. Force-complete migration status for all 24 affected users via Graph API. 3. Trigger MFA registration campaign for affected users. 4. Remove temporary CA exclusion after registration is complete.',
    confidence: 90,
  },
  'snow-005': {
    problem: 'Contractor account has unauthorized DBA-level production database access',
    rootCause: 'Six months ago, a DBA manually granted the sa_reader SQL Server role to ext.chen@vendor.acme.com for an emergency production debugging session. The role was never revoked, and the account was subsequently added to the db_owner role on PaymentDB by a second DBA who confused it with an internal service account.',
    affectedSystems: ['SQL Server Production', 'Active Directory', 'SailPoint IdentityNow'],
    findings: [
      { source: 'SQL Server', type: 'Permission Audit', detail: 'ext.chen@vendor.acme.com has db_owner on PaymentDB, db_datareader on CustomerDB and OrderDB. 1,247 queries executed in last 30 days across all three databases. Last access: 2026-04-04T22:15:00Z.', severity: 'critical' },
      { source: 'SailPoint IdentityNow', type: 'Entitlement Review', detail: 'Identity ID-EXT-0892 (Wei Chen, Vendor Corp): Only authorized entitlement is "Dev-ReadOnly-Access" for DevDB. Production database access is not in any approved access request.', severity: 'critical' },
      { source: 'Active Directory', type: 'Group Membership', detail: 'ext.chen@vendor.acme.com is member of SQL-Prod-DBA-Group (added 2025-10-15 by admin.dba@acme.com). Contract end date: 2026-06-30.', severity: 'warning' },
      { source: 'SQL Server', type: 'Data Access Log', detail: 'PaymentDB access pattern: 89% SELECT on payment_transactions table, 11% SELECT on customer_billing. No INSERT/UPDATE/DELETE detected. Access pattern consistent with reporting, not malicious activity.', severity: 'info' },
    ],
    recommendedSolution: '1. Immediately revoke db_owner role on PaymentDB and db_datareader on CustomerDB and OrderDB. 2. Remove ext.chen from SQL-Prod-DBA-Group in AD. 3. Verify only Dev-ReadOnly-Access remains. 4. Generate data access audit report for compliance review. 5. Implement SQL Server access governance through SailPoint.',
    confidence: 97,
  },
};

// ── Service ──────────────────────────────────────────────────────────────────

class IgaService {

  // ── Ticket Queries ─────────────────────────────────────────────────────

  listTickets(tenantId: string): SNOWTicket[] {
    return igaRepository.listTickets(tenantId);
  }

  getTicket(tenantId: string, ticketId: string): SNOWTicket | undefined {
    return igaRepository.getTicket(tenantId, ticketId);
  }

  // ── Ticket Actions ─────────────────────────────────────────────────────

  acceptTicket(tenantId: string, ticketId: string, acceptedBy: string): SNOWTicket | undefined {
    const ticket = igaRepository.getTicket(tenantId, ticketId);
    if (!ticket) return undefined;
    if (ticket.state !== 'new') throw new Error(`Ticket must be in 'new' state to accept (current: ${ticket.state})`);

    return igaRepository.updateTicket(tenantId, ticketId, {
      state: 'accepted',
      acceptedBy,
      acceptedAt: new Date().toISOString(),
    });
  }

  investigateTicket(tenantId: string, ticketId: string): SNOWTicket | undefined {
    const ticket = igaRepository.getTicket(tenantId, ticketId);
    if (!ticket) return undefined;
    if (ticket.state !== 'accepted') throw new Error(`Ticket must be in 'accepted' state to investigate (current: ${ticket.state})`);

    const data = INVESTIGATION_DATA[ticketId];

    const investigation: Investigation = data
      ? {
          problem: data.problem,
          rootCause: data.rootCause,
          affectedSystems: data.affectedSystems,
          findings: data.findings,
          recommendedSolution: data.recommendedSolution,
          confidence: data.confidence,
          investigatedAt: new Date().toISOString(),
        }
      : {
          problem: `Issue described in ticket ${ticket.number}`,
          rootCause: 'Automated investigation could not determine root cause. Manual review required.',
          affectedSystems: ['Unknown'],
          findings: [
            { source: 'System', type: 'General', detail: 'No specific findings available for this ticket type.', severity: 'info' as const },
          ],
          recommendedSolution: 'Manual investigation and resolution required.',
          confidence: 30,
          investigatedAt: new Date().toISOString(),
        };

    const solution = {
      summary: investigation.recommendedSolution,
      steps: investigation.recommendedSolution.split(/\d+\.\s+/).filter(Boolean).map(s => s.trim()),
      estimatedEffort: data ? '30 minutes' : '2 hours',
      risk: (data && data.confidence > 90 ? 'low' : 'medium') as 'low' | 'medium' | 'high',
    };

    return igaRepository.updateTicket(tenantId, ticketId, {
      state: 'solution_ready',
      investigation,
      solution,
    });
  }

  generateAgentPlan(tenantId: string, ticketId: string, instructions: string): SNOWTicket | undefined {
    const ticket = igaRepository.getTicket(tenantId, ticketId);
    if (!ticket) return undefined;
    if (ticket.state !== 'solution_ready') throw new Error(`Ticket must be in 'solution_ready' state to generate plan (current: ${ticket.state})`);

    // Parse instructions into planned actions
    const plannedActions = this.parseInstructions(ticketId, instructions);

    const agentPlan: AgentPlan = {
      instructions,
      plannedActions,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    return igaRepository.updateTicket(tenantId, ticketId, {
      state: 'agent_planning',
      agentPlan,
    });
  }

  approveAgentPlan(tenantId: string, ticketId: string): SNOWTicket | undefined {
    const ticket = igaRepository.getTicket(tenantId, ticketId);
    if (!ticket) return undefined;
    if (ticket.state !== 'agent_planning') throw new Error(`Ticket must be in 'agent_planning' state to approve plan (current: ${ticket.state})`);
    if (!ticket.agentPlan) throw new Error('No agent plan exists for this ticket');

    const updatedPlan: AgentPlan = { ...ticket.agentPlan, status: 'approved' };

    return igaRepository.updateTicket(tenantId, ticketId, {
      state: 'agent_approved',
      agentPlan: updatedPlan,
    });
  }

  async executeAgentPlan(tenantId: string, ticketId: string): Promise<SNOWTicket | undefined> {
    const ticket = igaRepository.getTicket(tenantId, ticketId);
    if (!ticket) return undefined;
    if (ticket.state !== 'agent_approved') throw new Error(`Ticket must be in 'agent_approved' state to execute (current: ${ticket.state})`);
    if (!ticket.agentPlan) throw new Error('No agent plan exists for this ticket');

    // Mark as executing
    const executingPlan: AgentPlan = { ...ticket.agentPlan, status: 'executing' };
    const execution: AgentExecution = {
      startedAt: new Date().toISOString(),
      results: [],
      status: 'running',
    };

    igaRepository.updateTicket(tenantId, ticketId, {
      state: 'executing',
      agentPlan: executingPlan,
      agentExecution: execution,
    });

    // Simulate executing each step
    const results: ActionResult[] = [];
    for (const action of ticket.agentPlan.plannedActions) {
      // Simulate 1-2 second delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

      const result: ActionResult = {
        step: action.step,
        status: 'success',
        output: this.getExecutionOutput(action),
        timestamp: new Date().toISOString(),
      };
      results.push(result);

      // Update the action status
      action.status = 'completed';
    }

    // Mark as completed
    const completedPlan: AgentPlan = { ...ticket.agentPlan, status: 'completed', plannedActions: ticket.agentPlan.plannedActions.map(a => ({ ...a, status: 'completed' as const })) };
    const completedExecution: AgentExecution = {
      startedAt: execution.startedAt,
      completedAt: new Date().toISOString(),
      results,
      status: 'completed',
    };

    return igaRepository.updateTicket(tenantId, ticketId, {
      state: 'resolved',
      agentPlan: completedPlan,
      agentExecution: completedExecution,
    });
  }

  submitFeedback(tenantId: string, ticketId: string, feedback: string): SNOWTicket | undefined {
    const ticket = igaRepository.getTicket(tenantId, ticketId);
    if (!ticket) return undefined;
    if (ticket.state !== 'resolved') throw new Error(`Ticket must be in 'resolved' state to submit feedback (current: ${ticket.state})`);

    return igaRepository.updateTicket(tenantId, ticketId, {
      state: 'closed',
      feedback,
    });
  }

  // ── Certification Queries ──────────────────────────────────────────────

  listCampaigns(tenantId: string): CertificationCampaign[] {
    return igaRepository.listCampaigns(tenantId);
  }

  getCampaign(tenantId: string, campaignId: string): CertificationCampaign | undefined {
    return igaRepository.getCampaign(tenantId, campaignId);
  }

  // ── Private Helpers ────────────────────────────────────────────────────

  private parseInstructions(ticketId: string, instructions: string): PlannedAction[] {
    // For known tickets, return contextual actions based on the instructions
    const lowerInstructions = instructions.toLowerCase();

    if (ticketId === 'snow-001' || lowerInstructions.includes('disable') || lowerInstructions.includes('duplicate')) {
      return [
        { step: 1, system: 'Active Directory', action: 'Disable Account', detail: 'Disable AD account jsmith2 and move to Disabled Users OU', risk: 'low', status: 'pending' },
        { step: 2, system: 'SailPoint IdentityNow', action: 'Delete Identity', detail: 'Remove identity cube ID-8934 and all correlated accounts', risk: 'medium', status: 'pending' },
        { step: 3, system: 'HR System', action: 'Flag Record', detail: 'Flag duplicate HR record for review by HR team', risk: 'low', status: 'pending' },
        { step: 4, system: 'Email', action: 'Notify User', detail: 'Send confirmation email to john.smith@acme.com that duplicate account has been resolved', risk: 'low', status: 'pending' },
      ];
    }

    if (ticketId === 'snow-002' || lowerInstructions.includes('salesforce') || lowerInstructions.includes('provision')) {
      return [
        { step: 1, system: 'SailPoint IdentityNow', action: 'Refresh Connector', detail: 'Re-authenticate Salesforce connector with new OAuth2 token', risk: 'low', status: 'pending' },
        { step: 2, system: 'SailPoint IdentityNow', action: 'Retry Provisioning', detail: 'Retry all 15 stuck provisioning requests including REQ0045123', risk: 'medium', status: 'pending' },
        { step: 3, system: 'Salesforce CRM', action: 'Verify Access', detail: 'Confirm maria.garcia@acme.com has Sales Professional license', risk: 'low', status: 'pending' },
        { step: 4, system: 'Monitoring', action: 'Create Alert', detail: 'Set up connector health monitoring alert for Salesforce provisioning', risk: 'low', status: 'pending' },
        { step: 5, system: 'Email', action: 'Notify User', detail: 'Send confirmation to maria.garcia@acme.com that access has been provisioned', risk: 'low', status: 'pending' },
      ];
    }

    if (ticketId === 'snow-003' || lowerInstructions.includes('orphan') || lowerInstructions.includes('admin account')) {
      return [
        { step: 1, system: 'AWS IAM', action: 'Disable Account', detail: 'Disable IAM account r.thompson_admin and deactivate all access keys immediately', risk: 'low', status: 'pending' },
        { step: 2, system: 'AWS CloudTrail', action: 'Audit Review', detail: 'Review CloudTrail logs for r.thompson_admin activity from 2025-12-15 to present', risk: 'low', status: 'pending' },
        { step: 3, system: 'SailPoint IdentityNow', action: 'Correlate Account', detail: 'Correlate r.thompson_admin to inactive identity ID-7722 for tracking', risk: 'low', status: 'pending' },
        { step: 4, system: 'AWS IAM', action: 'Delete Account', detail: 'Delete IAM account r.thompson_admin after audit review confirmation', risk: 'high', status: 'pending' },
        { step: 5, system: 'Email', action: 'Notify SecOps', detail: 'Send audit summary to secops@acme.com with findings', risk: 'low', status: 'pending' },
      ];
    }

    if (ticketId === 'snow-004' || lowerInstructions.includes('mfa') || lowerInstructions.includes('entra')) {
      return [
        { step: 1, system: 'Entra ID', action: 'Create Exclusion Group', detail: 'Create temporary CA exclusion group and add 24 affected Finance users', risk: 'medium', status: 'pending' },
        { step: 2, system: 'Entra ID', action: 'Complete Migration', detail: 'Force-complete migration status for all 24 PendingMigration users via Graph API', risk: 'medium', status: 'pending' },
        { step: 3, system: 'Entra ID', action: 'MFA Registration', detail: 'Trigger MFA registration campaign for affected users', risk: 'low', status: 'pending' },
        { step: 4, system: 'Entra ID', action: 'Remove Exclusion', detail: 'Remove temporary CA exclusion group after users complete MFA registration', risk: 'low', status: 'pending' },
        { step: 5, system: 'Email', action: 'Notify Users', detail: 'Send MFA re-enrollment instructions to all 24 affected Finance users', risk: 'low', status: 'pending' },
      ];
    }

    if (ticketId === 'snow-005' || lowerInstructions.includes('contractor') || lowerInstructions.includes('excessive')) {
      return [
        { step: 1, system: 'SQL Server', action: 'Revoke Roles', detail: 'Revoke db_owner on PaymentDB and db_datareader on CustomerDB and OrderDB for ext.chen@vendor.acme.com', risk: 'medium', status: 'pending' },
        { step: 2, system: 'Active Directory', action: 'Remove Group', detail: 'Remove ext.chen@vendor.acme.com from SQL-Prod-DBA-Group', risk: 'low', status: 'pending' },
        { step: 3, system: 'SailPoint IdentityNow', action: 'Verify Entitlements', detail: 'Verify only Dev-ReadOnly-Access entitlement remains for identity ID-EXT-0892', risk: 'low', status: 'pending' },
        { step: 4, system: 'SQL Server', action: 'Generate Report', detail: 'Generate full data access audit report for compliance review', risk: 'low', status: 'pending' },
        { step: 5, system: 'Email', action: 'Notify Compliance', detail: 'Send remediation summary and audit report to compliance@acme.com', risk: 'low', status: 'pending' },
      ];
    }

    // Generic fallback: parse numbered steps from instructions
    const steps = instructions.split(/\d+\.\s+/).filter(Boolean);
    return steps.map((step, i) => ({
      step: i + 1,
      system: 'General',
      action: 'Execute Step',
      detail: step.trim(),
      risk: 'medium' as const,
      status: 'pending' as const,
    }));
  }

  private getExecutionOutput(action: PlannedAction): string {
    const outputs: Record<string, Record<string, string>> = {
      'Active Directory': {
        'Disable Account': `Successfully disabled account in Active Directory. Account moved to OU=Disabled Users,DC=acme,DC=com. Last logon timestamp preserved for audit.`,
        'Remove Group': `Successfully removed account from specified AD group. Group membership change replicated to all domain controllers.`,
      },
      'SailPoint IdentityNow': {
        'Delete Identity': `Identity cube removed successfully. All correlated accounts de-provisioned. Audit event logged: IDN-EVENT-${Date.now()}.`,
        'Refresh Connector': `Salesforce connector re-authenticated successfully. OAuth2 token refreshed. Connection test: PASSED.`,
        'Retry Provisioning': `15 provisioning requests retried. 15/15 completed successfully. REQ0045123 fulfilled.`,
        'Correlate Account': `Account correlated to inactive identity. Governance tracking enabled.`,
        'Verify Entitlements': `Entitlement verification complete. Only authorized entitlements remain.`,
      },
      'HR System': {
        'Flag Record': `Duplicate HR record flagged for review. Ticket HR-REV-${Date.now()} created for HR team. Correlation rule update recommended.`,
      },
      'Email': {
        'Notify User': `Confirmation email sent successfully. Message ID: MSG-${Date.now()}. Delivery confirmed.`,
        'Notify SecOps': `Security summary email sent to secops@acme.com. Audit report attached.`,
        'Notify Users': `Bulk notification sent to 24 affected users with MFA re-enrollment instructions.`,
        'Notify Compliance': `Remediation summary and audit report sent to compliance@acme.com.`,
      },
      'AWS IAM': {
        'Disable Account': `IAM account disabled. All access keys deactivated. Console access revoked. CloudTrail logging confirmed active.`,
        'Delete Account': `IAM account deleted. All associated policies detached. Deletion logged in CloudTrail.`,
      },
      'AWS CloudTrail': {
        'Audit Review': `CloudTrail audit complete. 3 API calls found post-termination (all ListBuckets on 2025-12-17). No data exfiltration detected. Full report generated.`,
      },
      'Salesforce CRM': {
        'Verify Access': `User maria.garcia@acme.com confirmed with Sales Professional license. Profile: Sales User. Last login: verification pending first access.`,
      },
      'Monitoring': {
        'Create Alert': `Connector health monitoring alert created. Alert ID: MON-${Date.now()}. Threshold: 1 hour without successful operation.`,
      },
      'Entra ID': {
        'Create Exclusion Group': `Temporary CA exclusion group "MFA-Migration-Temp" created. 24 Finance users added. Group ID: grp-${Date.now()}.`,
        'Complete Migration': `Migration status force-completed for 24 users via Graph API batch request. All users now in "Migrated" state.`,
        'MFA Registration': `MFA registration campaign triggered for 24 users. Registration portal now accessible. Campaign ID: MFA-REG-${Date.now()}.`,
        'Remove Exclusion': `Temporary CA exclusion group "MFA-Migration-Temp" deleted. Normal Conditional Access enforcement resumed.`,
      },
      'SQL Server': {
        'Revoke Roles': `Roles revoked: db_owner on PaymentDB, db_datareader on CustomerDB and OrderDB. Permissions effective immediately.`,
        'Generate Report': `Data access audit report generated. 1,247 queries analyzed. Report ID: RPT-${Date.now()}. No unauthorized data modifications found.`,
      },
    };

    return outputs[action.system]?.[action.action]
      ?? `${action.action} completed successfully on ${action.system}. Operation logged for audit trail.`;
  }
}

export const igaService = new IgaService();
