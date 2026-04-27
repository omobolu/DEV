/**
 * Email Templates — HTML templates for agent notifications and system emails.
 *
 * Templates use {{variable}} placeholders for simple interpolation.
 * No external template engine — keeps it lightweight for v1.
 */

import type { EmailTemplate, EmailTemplateId } from './email.types';

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
<tr><td style="background:#1e293b;padding:20px 24px;">
  <span style="color:#818cf8;font-weight:700;font-size:18px;">id<span style="color:#818cf8;">vize</span></span>
  <span style="color:#94a3b8;font-size:11px;margin-left:8px;">IAM Operating System</span>
</td></tr>
<tr><td style="padding:24px;">${content}</td></tr>
<tr><td style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;">
  <span style="color:#94a3b8;font-size:11px;">This email was sent by IDVIZE IAM OS. Do not reply directly.</span>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

const TEMPLATES: EmailTemplate[] = [
  {
    templateId: 'test-email',
    name: 'Test Email',
    subject: 'IDVIZE — Test Email Configuration',
    description: 'Sent when an admin tests the email configuration.',
    htmlTemplate: baseLayout(`
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 12px;">Email Configuration Test</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;">
        This test email confirms that your SMTP configuration is working correctly.
      </p>
      <table style="margin:16px 0;border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Tenant</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;font-weight:500;">{{tenantName}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">SMTP Host</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;">{{smtpHost}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Sent At</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;">{{timestamp}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Sent By</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;">{{senderName}}</td></tr>
      </table>
      <p style="color:#16a34a;font-size:14px;font-weight:600;">Configuration is working.</p>
    `),
    textTemplate: 'IDVIZE Email Test\n\nThis confirms your SMTP configuration is working.\nTenant: {{tenantName}}\nHost: {{smtpHost}}\nSent at: {{timestamp}}\nSent by: {{senderName}}',
  },
  {
    templateId: 'sso-onboarding-request',
    name: 'SSO App Onboarding Request',
    subject: 'IDVIZE — SSO Onboarding: {{applicationName}} Information Required',
    description: 'Sent by SSO Agent to collect application onboarding information.',
    htmlTemplate: baseLayout(`
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">SSO Onboarding — Information Required</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 16px;">Agent: SSO Agent &middot; Control: {{controlName}}</p>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;margin:0 0 16px;">
        <span style="color:#92400e;font-size:13px;font-weight:600;">Action Required</span>
        <p style="color:#92400e;font-size:13px;margin:4px 0 0;">Please provide the following details for <strong>{{applicationName}}</strong> to proceed with SSO configuration.</p>
      </div>
      <h3 style="color:#1e293b;font-size:15px;margin:16px 0 8px;">Information Needed</h3>
      <ol style="color:#475569;font-size:13px;line-height:1.8;padding-left:20px;">
        <li>Does {{applicationName}} support SAML 2.0 or OpenID Connect?</li>
        <li>Application admin console URL</li>
        <li>Application Reply URL / ACS endpoint</li>
        <li>Entity ID / Client ID</li>
        <li>Required attribute mappings (e.g. email, department, groups)</li>
        <li>User groups that need access</li>
      </ol>
      <p style="color:#475569;font-size:13px;margin:16px 0;">
        <strong>Application:</strong> {{applicationName}}<br>
        <strong>Risk Level:</strong> {{riskLevel}}<br>
        <strong>Current Status:</strong> <span style="color:#dc2626;font-weight:600;">{{outcome}}</span>
      </p>
    `),
    textTemplate: 'SSO Onboarding — Information Required\n\nApplication: {{applicationName}}\nControl: {{controlName}}\nStatus: {{outcome}}\n\nPlease provide SSO configuration details for {{applicationName}}.',
  },
  {
    templateId: 'sso-mfa-conditional-access',
    name: 'MFA Conditional Access Configuration',
    subject: 'IDVIZE — MFA Configuration Required: {{applicationName}}',
    description: 'Sent by SSO Agent for MFA Conditional Access policy configuration.',
    htmlTemplate: baseLayout(`
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">MFA Conditional Access Configuration</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 16px;">Agent: SSO Agent &middot; Control: {{controlName}}</p>
      <div style="background:#fee2e2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;margin:0 0 16px;">
        <span style="color:#991b1b;font-size:13px;font-weight:600;">MFA Gap Detected</span>
        <p style="color:#991b1b;font-size:13px;margin:4px 0 0;"><strong>{{applicationName}}</strong> does not have MFA enforcement via Conditional Access.</p>
      </div>
      <h3 style="color:#1e293b;font-size:15px;margin:16px 0 8px;">Required Steps</h3>
      <ol style="color:#475569;font-size:13px;line-height:1.8;padding-left:20px;">
        <li>Create Conditional Access policy targeting {{applicationName}}</li>
        <li>Set users/groups in scope: {{targetGroups}}</li>
        <li>Configure grant control: Require multifactor authentication</li>
        <li>Set session controls and sign-in frequency</li>
        <li>Enable policy in Report-only mode first</li>
        <li>Review sign-in logs for 7-14 days</li>
        <li>Switch to Enforce mode after validation</li>
      </ol>
      <h3 style="color:#1e293b;font-size:15px;margin:16px 0 8px;">Recommended MFA Methods</h3>
      <ul style="color:#475569;font-size:13px;line-height:1.8;padding-left:20px;">
        <li>Microsoft Authenticator (Push) — recommended</li>
        <li>FIDO2 Security Key — phishing resistant</li>
        <li>TOTP / Authenticator App</li>
      </ul>
      <p style="color:#dc2626;font-size:13px;font-weight:500;margin:16px 0;">SMS and Voice Call are not recommended for new deployments.</p>
    `),
    textTemplate: 'MFA Conditional Access Configuration\n\nApplication: {{applicationName}}\nControl: {{controlName}}\n\nMFA enforcement via Conditional Access is required for {{applicationName}}.',
  },
  {
    templateId: 'sso-group-targeting',
    name: 'SSO Group Targeting',
    subject: 'IDVIZE — SSO Group Assignment: {{applicationName}}',
    description: 'Sent by SSO Agent when targeting an existing app group for SSO.',
    htmlTemplate: baseLayout(`
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">SSO Group Targeting</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 16px;">Agent: SSO Agent &middot; Application: {{applicationName}}</p>
      <div style="background:#dbeafe;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:4px;margin:0 0 16px;">
        <span style="color:#1e40af;font-size:13px;font-weight:600;">Existing Group Identified</span>
        <p style="color:#1e40af;font-size:13px;margin:4px 0 0;">An existing security group can be used for SSO access assignment.</p>
      </div>
      <table style="margin:16px 0;border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Group Name</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;font-weight:500;">{{groupName}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Members</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;">{{memberCount}} users</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Application</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;">{{applicationName}}</td></tr>
      </table>
      <h3 style="color:#1e293b;font-size:15px;margin:16px 0 8px;">Next Steps</h3>
      <ol style="color:#475569;font-size:13px;line-height:1.8;padding-left:20px;">
        <li>Review group membership for accuracy</li>
        <li>Assign group to the enterprise application in your IdP</li>
        <li>Verify SSO access for a sample of group members</li>
      </ol>
    `),
    textTemplate: 'SSO Group Targeting\n\nApplication: {{applicationName}}\nGroup: {{groupName}}\nMembers: {{memberCount}}\n\nAssign this existing group to the SSO enterprise application.',
  },
  {
    templateId: 'sso-group-creation',
    name: 'SSO Group Creation Request',
    subject: 'IDVIZE — New Group Required for SSO: {{applicationName}}',
    description: 'Sent by SSO Agent when no existing group is available.',
    htmlTemplate: baseLayout(`
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">New Security Group Required</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 16px;">Agent: SSO Agent &middot; Application: {{applicationName}}</p>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;margin:0 0 16px;">
        <span style="color:#92400e;font-size:13px;font-weight:600;">Group Creation Required</span>
        <p style="color:#92400e;font-size:13px;margin:4px 0 0;">No existing security group is suitable for SSO access to <strong>{{applicationName}}</strong>.</p>
      </div>
      <h3 style="color:#1e293b;font-size:15px;margin:16px 0 8px;">Proposed Group</h3>
      <table style="margin:0 0 16px;border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Group Name</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;font-weight:500;">{{proposedGroupName}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Description</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;">SSO access group for {{applicationName}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Type</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;">Security Group (Assigned Membership)</td></tr>
      </table>
      <h3 style="color:#1e293b;font-size:15px;margin:16px 0 8px;">Required Actions</h3>
      <ol style="color:#475569;font-size:13px;line-height:1.8;padding-left:20px;">
        <li>Create security group <code>{{proposedGroupName}}</code> in your IdP</li>
        <li>Add initial members (application owners + pilot users)</li>
        <li>Assign the group to the SSO enterprise application</li>
        <li>Document group ownership and membership policy</li>
      </ol>
    `),
    textTemplate: 'New Security Group Required\n\nApplication: {{applicationName}}\nProposed Group: {{proposedGroupName}}\n\nCreate this group in your IdP and assign to the SSO application.',
  },
  {
    templateId: 'sso-remediation-plan',
    name: 'SSO Remediation Plan',
    subject: 'IDVIZE — SSO Remediation Plan: {{applicationName}}',
    description: 'Human-reviewable remediation plan generated by the SSO Agent.',
    htmlTemplate: baseLayout(`
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">SSO Remediation Plan</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 16px;">Generated by SSO Agent for human review</p>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px;margin:0 0 16px;">
        <span style="color:#166534;font-size:13px;font-weight:600;">Plan Ready for Review</span>
        <p style="color:#166534;font-size:13px;margin:4px 0 0;">Review and approve this remediation plan before execution.</p>
      </div>
      <table style="margin:16px 0;border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Application</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;font-weight:500;">{{applicationName}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Control</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;">{{controlName}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Current Status</td>
            <td style="padding:8px 12px;color:#dc2626;font-size:13px;border-bottom:1px solid #e2e8f0;font-weight:600;">{{outcome}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Risk Level</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;font-weight:600;">{{riskLevel}}</td></tr>
      </table>
      <h3 style="color:#1e293b;font-size:15px;margin:16px 0 8px;">Remediation Steps</h3>
      <pre style="color:#475569;font-size:13px;line-height:1.8;white-space:pre-wrap;font-family:inherit;margin:0;padding:0 0 0 8px;">{{remediationSteps}}</pre>
      <h3 style="color:#1e293b;font-size:15px;margin:16px 0 8px;">Estimated Timeline</h3>
      <p style="color:#475569;font-size:13px;">{{estimatedTimeline}}</p>
      <div style="margin:24px 0 0;padding:16px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;">
        <p style="color:#475569;font-size:13px;margin:0;"><strong>Next Step:</strong> Reply to this email or update the IDVIZE platform to approve or request changes to this plan.</p>
      </div>
    `),
    textTemplate: 'SSO Remediation Plan\n\nApplication: {{applicationName}}\nControl: {{controlName}}\nStatus: {{outcome}}\nRisk: {{riskLevel}}\n\nRemediation Steps:\n{{remediationSteps}}\n\nEstimated Timeline: {{estimatedTimeline}}',
  },
  {
    templateId: 'agent-execution-result',
    name: 'Agent Execution Result',
    subject: 'IDVIZE — Execution {{outcome}}: {{applicationName}}',
    description: 'Notification sent when an agent execution session completes or fails.',
    htmlTemplate: baseLayout(`
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Agent Execution {{outcome}}</h2>
      <p style="color:#64748b;font-size:13px;margin:0 0 16px;">{{agentName}} has finished processing</p>
      <div style="background:{{statusBg}};border-left:4px solid {{statusBorder}};padding:12px 16px;border-radius:4px;margin:0 0 16px;">
        <span style="color:{{statusColor}};font-size:13px;font-weight:600;">{{statusLabel}}</span>
        <p style="color:{{statusColor}};font-size:13px;margin:4px 0 0;">{{statusMessage}}</p>
      </div>
      <table style="margin:16px 0;border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Application</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;font-weight:500;">{{applicationName}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Control</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;">{{controlName}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Session</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;">{{sessionId}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Steps Completed</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;">{{completedSteps}} / {{totalSteps}}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Outcome</td>
            <td style="padding:8px 12px;color:#1e293b;font-size:13px;font-weight:600;">{{outcome}}</td></tr>
      </table>
      <div style="margin:24px 0 0;padding:16px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;">
        <p style="color:#475569;font-size:13px;margin:0;"><strong>Next Step:</strong> Review the execution results in the IDVIZE platform for full details and evidence.</p>
      </div>
    `),
    textTemplate: 'Agent Execution {{outcome}}\n\nApplication: {{applicationName}}\nControl: {{controlName}}\nSession: {{sessionId}}\nSteps: {{completedSteps}}/{{totalSteps}}\nOutcome: {{outcome}}\n\nReview results in the IDVIZE platform.',
  },
];

const TEMPLATE_MAP = new Map<EmailTemplateId, EmailTemplate>(
  TEMPLATES.map(t => [t.templateId, t]),
);

export function getTemplate(templateId: EmailTemplateId): EmailTemplate | undefined {
  return TEMPLATE_MAP.get(templateId);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTemplate(template: string, data: Record<string, unknown>, htmlEscape = true): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const raw = String(value ?? '');
    const safeValue = htmlEscape ? escapeHtml(raw) : raw;
    result = result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), safeValue);
  }
  return result;
}

export function getAllTemplates(): EmailTemplate[] {
  return TEMPLATES;
}
