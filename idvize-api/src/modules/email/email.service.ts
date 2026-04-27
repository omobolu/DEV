/**
 * Email Service — Sends templated emails via SMTP (Nodemailer)
 *
 * Supports Mailtrap for dev/test, Microsoft 365 SMTP, and SendGrid for production.
 * All operations are tenant-scoped and audit-logged.
 *
 * Security:
 *   - SMTP passwords stored in PG (v1) — never returned to UI
 *   - tenantId always from JWT context
 *   - All sends are audit-logged with delivery status
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { emailRepository } from './email.repository';
import { getTemplate, renderTemplate } from './email.templates';
import { auditService } from '../security/audit/audit.service';
import { CONTROLS_CATALOG } from '../control/control.catalog';
import type {
  SmtpConfig,
  SmtpConfigResponse,
  EmailMessage,
  EmailDeliveryResult,
  AgentNotificationRequest,
  AgentNotificationResult,
  EmailTemplateId,
} from './email.types';

class EmailService {
  private transporterCache = new Map<string, { transporter: Transporter; configHash: string }>();

  private configHash(config: SmtpConfig): string {
    return `${config.host}:${config.port}:${config.username}:${config.password}:${config.useTls}:${config.allowSelfSignedCerts ?? false}`;
  }

  private createTransporter(config: SmtpConfig): Transporter {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.username, pass: config.password },
      tls: config.useTls ? { rejectUnauthorized: !config.allowSelfSignedCerts } : undefined,
    });
  }

  private async getTransporter(tenantId: string): Promise<{ transporter: Transporter; config: SmtpConfig } | undefined> {
    const config = await emailRepository.getConfig(tenantId);
    if (!config) return undefined;

    const hash = this.configHash(config);
    const cached = this.transporterCache.get(tenantId);
    if (cached && cached.configHash === hash) {
      return { transporter: cached.transporter, config };
    }

    const transporter = this.createTransporter(config);
    this.transporterCache.set(tenantId, { transporter, configHash: hash });
    return { transporter, config };
  }

  // ── Configuration Management ──────────────────────────────────────────────

  async getConfig(tenantId: string): Promise<SmtpConfigResponse | undefined> {
    return emailRepository.getConfigMasked(tenantId);
  }

  async saveConfig(
    tenantId: string,
    config: SmtpConfig,
    actorId: string,
    actorName: string,
  ): Promise<void> {
    await emailRepository.saveConfig(tenantId, config, actorId);
    this.transporterCache.delete(tenantId);

    await auditService.log({
      eventType: 'email.config.updated',
      actorId,
      actorName,
      resource: 'email_config',
      outcome: 'success',
      reason: `SMTP config updated: ${config.host}:${config.port} (${config.provider})`,
      metadata: {
        host: config.host,
        port: config.port,
        provider: config.provider,
        fromEmail: config.fromEmail,
      },
      tenantId,
    });
  }

  async updateConfigKeepPassword(
    tenantId: string,
    config: Omit<SmtpConfig, 'password'>,
    actorId: string,
    actorName: string,
  ): Promise<void> {
    await emailRepository.updateConfigKeepPassword(tenantId, config, actorId);
    this.transporterCache.delete(tenantId);

    await auditService.log({
      eventType: 'email.config.updated',
      actorId,
      actorName,
      resource: 'email_config',
      outcome: 'success',
      reason: `SMTP config updated (password unchanged): ${config.host}:${config.port}`,
      metadata: {
        host: config.host,
        port: config.port,
        provider: config.provider,
        fromEmail: config.fromEmail,
      },
      tenantId,
    });
  }

  // ── Email Sending ─────────────────────────────────────────────────────────

  async sendEmail(
    tenantId: string,
    message: EmailMessage,
    actorId: string,
    actorName: string,
  ): Promise<EmailDeliveryResult> {
    const transporterResult = await this.getTransporter(tenantId);
    if (!transporterResult) {
      return {
        messageId: '',
        accepted: [],
        rejected: message.to.map(r => r.email),
        success: false,
        error: 'Email not configured for this tenant',
        timestamp: new Date().toISOString(),
      };
    }

    const { transporter, config } = transporterResult;

    try {
      const info = await transporter.sendMail({
        from: `"${config.fromDisplayName}" <${config.fromEmail}>`,
        to: message.to.map(r => r.name ? `"${r.name}" <${r.email}>` : r.email).join(', '),
        cc: message.cc?.map(r => r.name ? `"${r.name}" <${r.email}>` : r.email).join(', '),
        subject: message.subject,
        html: message.htmlBody,
        text: message.textBody,
      });

      const result: EmailDeliveryResult = {
        messageId: info.messageId ?? '',
        accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : [],
        rejected: Array.isArray(info.rejected) ? info.rejected.map(String) : [],
        success: true,
        timestamp: new Date().toISOString(),
      };

      await auditService.log({
        eventType: 'email.sent',
        actorId,
        actorName,
        resource: 'email',
        outcome: 'success',
        reason: `Email sent: ${message.subject}`,
        metadata: {
          messageId: result.messageId,
          recipients: message.to.map(r => r.email),
          subject: message.subject,
          templateId: message.templateId,
        },
        tenantId,
      });

      return result;
    } catch (err) {
      const errorMessage = (err as Error).message;

      const result: EmailDeliveryResult = {
        messageId: '',
        accepted: [],
        rejected: message.to.map(r => r.email),
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };

      await auditService.log({
        eventType: 'email.delivery.failed',
        actorId,
        actorName,
        resource: 'email',
        outcome: 'failure',
        reason: `Email delivery failed: ${errorMessage}`,
        metadata: {
          recipients: message.to.map(r => r.email),
          subject: message.subject,
          error: errorMessage,
        },
        tenantId,
      });

      return result;
    }
  }

  // ── Test Email ────────────────────────────────────────────────────────────

  async sendTestEmail(
    tenantId: string,
    recipientEmail: string,
    actorId: string,
    actorName: string,
    tenantName: string,
  ): Promise<EmailDeliveryResult> {
    const config = await emailRepository.getConfigMasked(tenantId);
    const template = getTemplate('test-email');
    if (!template) {
      return {
        messageId: '',
        accepted: [],
        rejected: [recipientEmail],
        success: false,
        error: 'Test email template not found',
        timestamp: new Date().toISOString(),
      };
    }

    const data = {
      tenantName,
      smtpHost: config?.host ?? 'unknown',
      timestamp: new Date().toISOString(),
      senderName: actorName,
    };

    const htmlBody = renderTemplate(template.htmlTemplate, data);
    const textBody = renderTemplate(template.textTemplate, data, false);

    const result = await this.sendEmail(
      tenantId,
      {
        to: [{ email: recipientEmail, name: actorName }],
        subject: renderTemplate(template.subject, data, false),
        htmlBody,
        textBody,
        templateId: 'test-email',
      },
      actorId,
      actorName,
    );

    await auditService.log({
      eventType: 'email.test.sent',
      actorId,
      actorName,
      resource: 'email_config',
      outcome: result.success ? 'success' : 'failure',
      reason: result.success
        ? `Test email sent to ${recipientEmail}`
        : `Test email failed: ${result.error}`,
      metadata: { recipientEmail, messageId: result.messageId },
      tenantId,
    });

    return result;
  }

  // ── Agent Notifications ───────────────────────────────────────────────────

  async sendAgentNotification(
    tenantId: string,
    request: AgentNotificationRequest,
    actorId: string,
    actorName: string,
  ): Promise<AgentNotificationResult> {
    const template = getTemplate(request.notificationType);
    if (!template) {
      return {
        notificationId: `notif-${Date.now()}`,
        agentId: request.agentId,
        templateId: request.notificationType,
        delivery: {
          messageId: '',
          accepted: [],
          rejected: request.recipients.map(r => r.email),
          success: false,
          error: `Template not found: ${request.notificationType}`,
          timestamp: new Date().toISOString(),
        },
        auditEventId: '',
      };
    }

    const catalogEntry = CONTROLS_CATALOG.find(c => c.controlId === request.controlId);
    const templateData = {
      ...request.additionalData,
      applicationName: request.applicationName,
      controlName: catalogEntry?.name ?? request.controlId,
    };

    const htmlBody = renderTemplate(template.htmlTemplate, templateData);
    const textBody = renderTemplate(template.textTemplate, templateData, false);
    const subject = renderTemplate(template.subject, templateData, false);

    const delivery = await this.sendEmail(
      tenantId,
      {
        to: request.recipients,
        subject,
        htmlBody,
        textBody,
        templateId: request.notificationType,
        templateData,
      },
      actorId,
      actorName,
    );

    const notificationId = `notif-${Date.now()}`;

    await auditService.log({
      eventType: 'email.agent.notification',
      actorId,
      actorName,
      resource: 'agent_notification',
      outcome: delivery.success ? 'success' : 'failure',
      reason: `Agent notification (${request.notificationType}) for ${request.applicationName}`,
      metadata: {
        notificationId,
        agentId: request.agentId,
        templateId: request.notificationType,
        applicationId: request.applicationId,
        applicationName: request.applicationName,
        recipients: request.recipients.map(r => r.email),
        messageId: delivery.messageId,
      },
      tenantId,
    });

    return {
      notificationId,
      agentId: request.agentId,
      templateId: request.notificationType,
      delivery,
      auditEventId: notificationId,
    };
  }

  // ── Verify Connection ─────────────────────────────────────────────────────

  async verifyConnection(tenantId: string): Promise<{ success: boolean; error?: string }> {
    const transporterResult = await this.getTransporter(tenantId);
    if (!transporterResult) {
      return { success: false, error: 'Email not configured for this tenant' };
    }

    try {
      await transporterResult.transporter.verify();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

export const emailService = new EmailService();
