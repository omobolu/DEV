/**
 * MFA Agent — Multi-Factor Authentication (AM-002)
 *
 * Provides discovery questions, implementation guidance, and recommended actions
 * for remediating MFA control gaps across applications.
 */

import type { AgentDefinition, AgentContext, AgentOutput } from './agent.types';

function generateGap(ctx: AgentContext): AgentOutput {
  return {
    questions: [
      {
        id: 'mfa-q1',
        question: `Is ${ctx.applicationName} integrated with your Identity Provider for conditional access enforcement?`,
        type: 'boolean',
        required: true,
        hint: 'MFA enforcement typically requires the app to be registered as an enterprise application in your IdP.',
      },
      {
        id: 'mfa-q2',
        question: 'Which MFA methods are currently available in your organisation?',
        type: 'multiselect',
        options: [
          'Microsoft Authenticator (Push)',
          'FIDO2 Security Key',
          'TOTP / Authenticator App',
          'SMS OTP',
          'Voice Call',
          'Hardware Token',
          'Passkeys',
          'None deployed yet',
        ],
        required: true,
      },
      {
        id: 'mfa-q3',
        question: 'What user population needs MFA for this application?',
        type: 'select',
        options: ['All users', 'Privileged/admin users only', 'External users only', 'Specific departments'],
        required: true,
      },
      {
        id: 'mfa-q4',
        question: 'Are there break-glass or emergency access accounts that must bypass MFA?',
        type: 'boolean',
        required: true,
        hint: 'Microsoft recommends at least 2 break-glass accounts excluded from all Conditional Access policies.',
      },
      {
        id: 'mfa-q5',
        question: 'What is the required re-authentication frequency?',
        type: 'select',
        options: ['Every sign-in', 'Every 24 hours', 'Every 7 days', 'Risk-based (adaptive)'],
        required: false,
        hint: 'More sensitive applications should require more frequent re-authentication.',
      },
    ],
    guidance: {
      title: `Implement MFA for ${ctx.applicationName}`,
      description:
        'Multi-Factor Authentication requires users to present two or more verification factors before gaining access. '
        + 'This dramatically reduces the risk of account compromise from phishing, credential stuffing, and password reuse. '
        + 'MFA should be enforced via Conditional Access policies in your Identity Provider.',
      steps: [
        `Verify ${ctx.applicationName} is registered as an enterprise application in ${ctx.platformName}.`,
        'Create a new Conditional Access policy targeting this application.',
        'Define the user/group scope — start with a pilot group before broad rollout.',
        'Set the Grant control to "Require multifactor authentication".',
        'Configure Authentication Strengths if you want to require specific MFA methods (e.g. phishing-resistant only).',
        'Exclude break-glass emergency access accounts from the policy.',
        'Deploy the policy in Report-only mode first to assess impact.',
        'Review the sign-in logs and Conditional Access insights dashboard.',
        'Switch the policy to Enabled after validating with the pilot group.',
        'Communicate the change to end users with enrollment instructions.',
      ],
      references: [
        'NIST SP 800-63B — Authenticator Assurance Levels (AAL)',
        'PCI-DSS Requirement 8.3 — Multi-Factor Authentication',
        'HIPAA § 164.312(d) — Person or Entity Authentication',
        'Zero Trust Architecture — Verify explicitly, always authenticate',
        'Microsoft Entra Conditional Access Documentation',
      ],
    },
    recommendedActions: [
      {
        id: 'mfa-a1',
        priority: 'critical',
        title: 'Create Conditional Access MFA Policy',
        description: `Create a Conditional Access policy in ${ctx.platformName} that requires MFA for all users accessing ${ctx.applicationName}.`,
        estimatedEffort: '1-2 hours',
        platform: ctx.platformName,
      },
      {
        id: 'mfa-a2',
        priority: 'critical',
        title: 'Define User Scope and Exclusions',
        description: 'Set the target users/groups and exclude break-glass emergency access accounts from the MFA policy.',
        estimatedEffort: '30 minutes',
        platform: ctx.platformName,
      },
      {
        id: 'mfa-a3',
        priority: 'high',
        title: 'Configure Authentication Strengths',
        description: 'Define which MFA methods are acceptable (phishing-resistant FIDO2, Authenticator push, TOTP). Block SMS if possible.',
        estimatedEffort: '1 hour',
        platform: ctx.platformName,
      },
      {
        id: 'mfa-a4',
        priority: 'high',
        title: 'Deploy in Report-Only Mode',
        description: 'Enable the policy in Report-only mode first to monitor impact without blocking users. Review sign-in logs for 7-14 days.',
        estimatedEffort: '30 minutes (+ 7-14 days monitoring)',
        platform: ctx.platformName,
      },
      {
        id: 'mfa-a5',
        priority: 'medium',
        title: 'User Communication and Enrollment',
        description: 'Send enrollment instructions to affected users and provide a self-service registration portal for MFA setup.',
        estimatedEffort: '2-4 hours',
      },
      {
        id: 'mfa-a6',
        priority: 'medium',
        title: 'Enable Policy Enforcement',
        description: 'After successful pilot, switch the Conditional Access policy from Report-only to Enabled for all target users.',
        estimatedEffort: '15 minutes',
        platform: ctx.platformName,
      },
    ],
  };
}

function generateAttn(ctx: AgentContext): AgentOutput {
  return {
    questions: [
      {
        id: 'mfa-q1',
        question: `What MFA issues have been identified for ${ctx.applicationName}?`,
        type: 'select',
        options: [
          'Not all users are enrolled in MFA',
          'Weak MFA methods allowed (SMS only)',
          'No Conditional Access policy — MFA is per-user',
          'Break-glass accounts not properly excluded',
          'Re-authentication frequency too long',
          'Other',
        ],
        required: true,
      },
      {
        id: 'mfa-q2',
        question: 'What percentage of users have completed MFA registration?',
        type: 'select',
        options: ['0-25%', '25-50%', '50-75%', '75-90%', '90-100%'],
        required: true,
      },
      {
        id: 'mfa-q3',
        question: 'Is phishing-resistant MFA (FIDO2, Passkeys) available?',
        type: 'boolean',
        required: true,
        hint: 'Phishing-resistant methods are the gold standard — SMS and voice are weaker factors.',
      },
    ],
    guidance: {
      title: `Strengthen MFA for ${ctx.applicationName}`,
      description:
        'MFA is partially implemented but needs improvement. Common issues include incomplete user enrollment, '
        + 'reliance on weak MFA methods (SMS), or per-user MFA instead of Conditional Access policy enforcement.',
      steps: [
        'Review the MFA registration report to identify unenrolled users.',
        'Migrate from per-user MFA to Conditional Access-based enforcement.',
        'Restrict weak authentication methods (disable SMS/voice if possible).',
        'Enable a registration campaign to push unenrolled users to register.',
        'Review and update the re-authentication frequency for sensitive applications.',
        'Validate break-glass account exclusions are correctly configured.',
      ],
      references: [
        'NIST SP 800-63B — Authenticator Assurance Levels',
        'Microsoft Security Best Practices — MFA Deployment Guide',
      ],
    },
    recommendedActions: [
      {
        id: 'mfa-a1',
        priority: 'high',
        title: 'Migrate to Conditional Access MFA',
        description: 'If MFA is currently per-user, migrate to Conditional Access policy-based enforcement for centralised control.',
        estimatedEffort: '2-4 hours',
        platform: ctx.platformName,
      },
      {
        id: 'mfa-a2',
        priority: 'high',
        title: 'Complete User MFA Enrollment',
        description: 'Launch an MFA registration campaign targeting unenrolled users with a deadline for completion.',
        estimatedEffort: '1-2 hours (+ user enrollment time)',
        platform: ctx.platformName,
      },
      {
        id: 'mfa-a3',
        priority: 'medium',
        title: 'Restrict Weak MFA Methods',
        description: 'Disable SMS and voice call as MFA methods. Require Authenticator push, FIDO2, or TOTP as minimum.',
        estimatedEffort: '30 minutes',
        platform: ctx.platformName,
      },
    ],
  };
}

function generateOk(ctx: AgentContext): AgentOutput {
  return {
    questions: [],
    guidance: {
      title: `MFA is Passing for ${ctx.applicationName}`,
      description:
        'Multi-Factor Authentication is correctly implemented and enforced. Continue to monitor enrollment rates, '
        + 'review Conditional Access policy effectiveness, and plan migration to phishing-resistant methods.',
      steps: [
        'Monitor MFA registration rates monthly — target 100% enrollment.',
        'Review Conditional Access sign-in logs for MFA bypass attempts.',
        'Plan migration from TOTP/push to phishing-resistant methods (FIDO2, Passkeys).',
        'Validate break-glass account procedures quarterly.',
      ],
      references: [
        'NIST SP 800-63B — Authenticator Assurance Levels',
      ],
    },
    recommendedActions: [],
  };
}

export const mfaAgent: AgentDefinition = {
  agentId: 'agent-mfa',
  name: 'MFA Agent',
  controlId: 'AM-002',
  description: 'Guides implementation and remediation of Multi-Factor Authentication (MFA) for applications.',
  generate(ctx: AgentContext): AgentOutput {
    switch (ctx.outcome) {
      case 'GAP':  return generateGap(ctx);
      case 'ATTN': return generateAttn(ctx);
      case 'OK':   return generateOk(ctx);
    }
  },
};
