/**
 * SSO Agent — Single Sign-On (AM-001)
 *
 * Provides discovery questions, implementation guidance, and recommended actions
 * for remediating SSO control gaps across applications.
 */

import type { AgentDefinition, AgentContext, AgentOutput, AgentNotificationOption } from './agent.types';

function generateGap(ctx: AgentContext): AgentOutput {
  return {
    questions: [
      {
        id: 'sso-q1',
        question: `Does ${ctx.applicationName} support SAML 2.0 or OpenID Connect for federated sign-on?`,
        type: 'select',
        options: ['SAML 2.0', 'OpenID Connect / OAuth 2.0', 'Both', 'Neither / Unknown'],
        required: true,
        hint: 'Check the vendor documentation or admin console for supported protocols.',
      },
      {
        id: 'sso-q2',
        question: 'Is there an existing enterprise application registration in your Identity Provider?',
        type: 'boolean',
        required: true,
        hint: 'Check Entra ID > Enterprise Applications or your IdP admin console.',
      },
      {
        id: 'sso-q3',
        question: 'Which user groups need access to this application?',
        type: 'text',
        required: true,
        hint: 'List Entra/AD group names (e.g. GRP-App-Users, GRP-Finance-Team).',
      },
      {
        id: 'sso-q4',
        question: 'Does the application require specific attribute claims (e.g. department, employee ID)?',
        type: 'text',
        required: false,
        hint: 'List any custom SAML attributes or OIDC claims the app needs.',
      },
      {
        id: 'sso-q5',
        question: 'Is there a break-glass or service account that should bypass SSO?',
        type: 'boolean',
        required: false,
        hint: 'Emergency access accounts should be documented and excluded from SSO enforcement.',
      },
    ],
    guidance: {
      title: `Implement SSO for ${ctx.applicationName}`,
      description:
        'Single Sign-On centralises authentication so users log in once via your Identity Provider and gain access to all authorised applications. '
        + 'This eliminates application-specific passwords, reduces credential sprawl, and enables centralised session management and revocation.',
      steps: [
        'Verify the application supports SAML 2.0 or OIDC by reviewing vendor documentation.',
        `Create an Enterprise Application registration in ${ctx.platformName} for ${ctx.applicationName}.`,
        'Configure the sign-on method (SAML or OIDC) with the correct Reply URL / Redirect URI.',
        'Set the Entity ID / Client ID and upload or exchange IdP metadata.',
        'Map required user attributes (UPN, email, display name) to the application claims.',
        'Assign the appropriate user groups to the enterprise application.',
        'Test SSO with a pilot group before enabling for all users.',
        'Disable or restrict local/password-based login in the application admin console.',
        'Document the configuration and add to the IAM runbook.',
      ],
      references: [
        'NIST SP 800-63B — Digital Identity Guidelines',
        'ISO 27001 — A.9.4 System and Application Access Control',
        'SOX Section 404 — Access Controls',
        'PCI-DSS Requirement 8 — Identify Users and Authenticate Access',
      ],
    },
    recommendedActions: [
      {
        id: 'sso-a1',
        priority: 'critical',
        title: 'Register Enterprise Application',
        description: `Create an enterprise application registration in ${ctx.platformName} for ${ctx.applicationName} and configure the SSO protocol.`,
        estimatedEffort: '2-4 hours',
        platform: ctx.platformName,
      },
      {
        id: 'sso-a2',
        priority: 'critical',
        title: 'Configure Federation Protocol',
        description: 'Set up SAML 2.0 or OIDC with proper Reply URL, Entity ID, and metadata exchange between the IdP and application.',
        estimatedEffort: '1-2 hours',
        platform: ctx.platformName,
      },
      {
        id: 'sso-a3',
        priority: 'high',
        title: 'Map User Attributes and Claims',
        description: 'Configure attribute mappings so the application receives the correct user identity claims (UPN, email, groups, department).',
        estimatedEffort: '1 hour',
        platform: ctx.platformName,
      },
      {
        id: 'sso-a4',
        priority: 'high',
        title: 'Assign User Groups',
        description: 'Assign the appropriate Entra/AD security groups to the enterprise application to control who can authenticate.',
        estimatedEffort: '30 minutes',
        platform: ctx.platformName,
      },
      {
        id: 'sso-a5',
        priority: 'medium',
        title: 'Disable Local Authentication',
        description: `After SSO is verified, disable or restrict password-based login in the ${ctx.applicationName} admin console to enforce federated authentication.`,
        estimatedEffort: '30 minutes',
      },
      {
        id: 'sso-a6',
        priority: 'medium',
        title: 'Document and Add to IAM Runbook',
        description: 'Record the SSO configuration, break-glass procedures, and certificate renewal schedule in the IAM operations runbook.',
        estimatedEffort: '1 hour',
      },
    ],
    notificationOptions: getSsoNotificationOptions(ctx),
  };
}

function generateAttn(ctx: AgentContext): AgentOutput {
  return {
    questions: [
      {
        id: 'sso-q1',
        question: `What SSO issues have been identified for ${ctx.applicationName}?`,
        type: 'select',
        options: [
          'Certificate expiring soon',
          'Partial user coverage — some groups not assigned',
          'Local login still enabled alongside SSO',
          'Attribute mapping issues',
          'Other',
        ],
        required: true,
      },
      {
        id: 'sso-q2',
        question: 'What percentage of users are currently authenticating via SSO?',
        type: 'select',
        options: ['0-25%', '25-50%', '50-75%', '75-90%', '90-100%'],
        required: true,
      },
      {
        id: 'sso-q3',
        question: 'Is the SSO certificate set to auto-renew?',
        type: 'boolean',
        required: true,
        hint: 'SAML certificates typically expire after 1-3 years and must be rotated.',
      },
    ],
    guidance: {
      title: `Improve SSO Coverage for ${ctx.applicationName}`,
      description:
        'SSO is partially implemented but requires attention. Common issues include incomplete user group assignments, '
        + 'expiring certificates, local login still enabled, or attribute mapping gaps that cause authentication failures.',
      steps: [
        'Review the current SSO configuration in your IdP for any warnings or errors.',
        'Check certificate expiration dates and enable auto-renewal if available.',
        'Audit user group assignments to ensure all required groups have access.',
        'Review sign-in logs for users still authenticating via local password.',
        'Disable local authentication for users who should be using SSO.',
        'Test attribute claims to ensure the application receives correct user data.',
      ],
      references: [
        'NIST SP 800-63B — Digital Identity Guidelines',
        'CIS Controls v8 — Control 6: Access Control Management',
      ],
    },
    recommendedActions: [
      {
        id: 'sso-a1',
        priority: 'high',
        title: 'Audit SSO Certificate Expiration',
        description: 'Check the SAML/OIDC certificate expiration date and configure auto-renewal or set a calendar reminder for manual rotation.',
        estimatedEffort: '30 minutes',
        platform: ctx.platformName,
      },
      {
        id: 'sso-a2',
        priority: 'high',
        title: 'Expand User Group Coverage',
        description: 'Review and assign all required security groups to the enterprise application to ensure complete SSO coverage.',
        estimatedEffort: '1 hour',
        platform: ctx.platformName,
      },
      {
        id: 'sso-a3',
        priority: 'medium',
        title: 'Disable Local Authentication',
        description: 'Restrict or disable password-based login for users who should exclusively authenticate via SSO.',
        estimatedEffort: '30 minutes',
      },
    ],
    notificationOptions: getSsoNotificationOptions(ctx),
  };
}

function generateOk(ctx: AgentContext): AgentOutput {
  return {
    questions: [],
    guidance: {
      title: `SSO is Passing for ${ctx.applicationName}`,
      description:
        'Single Sign-On is correctly implemented and operational. Users are authenticating via your Identity Provider. '
        + 'Continue to monitor certificate expiration, user group changes, and sign-in anomalies.',
      steps: [
        'Schedule quarterly SSO configuration reviews.',
        'Monitor certificate expiration dates (set alerts 60 days before).',
        'Review sign-in logs for any local authentication bypass attempts.',
        'Validate attribute mappings after any IdP or application upgrades.',
      ],
      references: [
        'NIST SP 800-63B — Digital Identity Guidelines',
      ],
    },
    recommendedActions: [],
  };
}

function getSsoNotificationOptions(ctx: AgentContext): AgentNotificationOption[] {
  const options: AgentNotificationOption[] = [];

  if (ctx.outcome === 'GAP') {
    options.push(
      {
        notificationType: 'sso-onboarding-request',
        label: 'Request Onboarding Information',
        description: `Send an email to collect SSO onboarding information for ${ctx.applicationName}.`,
      },
      {
        notificationType: 'sso-mfa-conditional-access',
        label: 'Request MFA / Conditional Access Setup',
        description: `Notify the team to configure MFA via Conditional Access for ${ctx.applicationName}.`,
      },
      {
        notificationType: 'sso-group-targeting',
        label: 'Request Group Assignment',
        description: `Notify admins to target an existing app group for ${ctx.applicationName} SSO.`,
      },
      {
        notificationType: 'sso-group-creation',
        label: 'Request New App Group Creation',
        description: `Request creation of a new security group for ${ctx.applicationName} SSO assignment.`,
      },
      {
        notificationType: 'sso-remediation-plan',
        label: 'Send Remediation Plan for Review',
        description: `Send the full SSO remediation plan for ${ctx.applicationName} for human review before execution.`,
      },
    );
  } else if (ctx.outcome === 'ATTN') {
    options.push(
      {
        notificationType: 'sso-group-targeting',
        label: 'Request Group Assignment Review',
        description: `Notify admins to review group assignments for ${ctx.applicationName}.`,
      },
      {
        notificationType: 'sso-remediation-plan',
        label: 'Send Improvement Plan for Review',
        description: `Send the SSO improvement plan for ${ctx.applicationName} for review.`,
      },
    );
  }

  return options;
}

export const ssoAgent: AgentDefinition = {
  agentId: 'agent-sso',
  name: 'SSO Agent',
  controlId: 'AM-001',
  description: 'Guides implementation and remediation of Single Sign-On (SSO) for applications.',
  generate(ctx: AgentContext): AgentOutput {
    switch (ctx.outcome) {
      case 'GAP':  return generateGap(ctx);
      case 'ATTN': return generateAttn(ctx);
      case 'OK':   return generateOk(ctx);
    }
  },
};
