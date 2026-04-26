/**
 * Email Service — Types
 *
 * Defines SMTP configuration, email templates, and delivery tracking types.
 */

// ── SMTP Configuration ──────────────────────────────────────────────────────

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromDisplayName: string;
  useTls: boolean;
  provider: 'smtp' | 'mailtrap' | 'sendgrid' | 'microsoft365';
}

/** Returned to UI — password is masked */
export interface SmtpConfigResponse {
  host: string;
  port: number;
  username: string;
  passwordSet: boolean;
  fromEmail: string;
  fromDisplayName: string;
  useTls: boolean;
  provider: 'smtp' | 'mailtrap' | 'sendgrid' | 'microsoft365';
  updatedAt: string;
  updatedBy: string;
}

// ── Email Send ───────────────────────────────────────────────────────────────

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailMessage {
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
}

export interface EmailDeliveryResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  success: boolean;
  error?: string;
  timestamp: string;
}

// ── Email Templates ──────────────────────────────────────────────────────────

export type EmailTemplateId =
  | 'test-email'
  | 'sso-onboarding-request'
  | 'sso-mfa-conditional-access'
  | 'sso-group-targeting'
  | 'sso-group-creation'
  | 'sso-remediation-plan';

export interface EmailTemplate {
  templateId: EmailTemplateId;
  name: string;
  subject: string;
  description: string;
  htmlTemplate: string;
  textTemplate: string;
}

// ── Agent Notification ───────────────────────────────────────────────────────

export interface AgentNotificationRequest {
  agentId: string;
  controlId: string;
  applicationId: string;
  applicationName: string;
  notificationType: EmailTemplateId;
  recipients: EmailRecipient[];
  additionalData?: Record<string, unknown>;
}

export interface AgentNotificationResult {
  notificationId: string;
  agentId: string;
  templateId: EmailTemplateId;
  delivery: EmailDeliveryResult;
  auditEventId: string;
}
