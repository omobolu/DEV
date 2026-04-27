/**
 * Email Controller — API endpoints for email configuration and sending.
 *
 * Routes:
 *   GET    /email/config          — Get SMTP config (masked password)
 *   PUT    /email/config          — Save/update SMTP config
 *   POST   /email/test            — Send test email
 *   POST   /email/verify          — Verify SMTP connection
 *   GET    /email/templates       — List available email templates
 *   POST   /email/agent-notify    — Send agent notification email
 *
 * Security:
 *   - requireAuth + tenantContext on all routes
 *   - email.configure for config management
 *   - email.send for test/notification sending
 *   - Passwords NEVER returned in responses
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { tenantContext } from '../../middleware/tenantContext';
import { requirePermission } from '../../middleware/requirePermission';
import { emailService } from './email.service';
import { getAllTemplates } from './email.templates';
import type { SmtpConfig, AgentNotificationRequest, EmailTemplateId } from './email.types';

const router = Router();

router.use(requireAuth, tenantContext);

// ── GET /email/config — Retrieve SMTP config (password masked) ──────────────

router.get('/config', requirePermission('email.configure'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const config = await emailService.getConfig(tenantId);

    res.json({
      success: true,
      data: config ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Email] GET /config failed:', (err as Error).message);
    res.status(503).json({ success: false, error: 'Email configuration temporarily unavailable' });
  }
});

// ── PUT /email/config — Save/update SMTP config ─────────────────────────────

router.put('/config', requirePermission('email.configure'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const actorId = req.user!.sub;
    const actorName = req.user!.name;

    const body = req.body as Partial<SmtpConfig>;

    if (!body.host || !body.port || !body.username || !body.fromEmail || !body.fromDisplayName) {
      res.status(400).json({
        success: false,
        error: 'host, port, username, fromEmail, and fromDisplayName are required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (body.password) {
      const config: SmtpConfig = {
        host: body.host,
        port: body.port,
        username: body.username,
        password: body.password,
        fromEmail: body.fromEmail,
        fromDisplayName: body.fromDisplayName,
        useTls: body.useTls ?? true,
        provider: body.provider ?? 'smtp',
      };
      await emailService.saveConfig(tenantId, config, actorId, actorName);
    } else {
      const existing = await emailService.getConfig(tenantId);
      if (!existing) {
        res.status(400).json({
          success: false,
          error: 'Password is required for initial configuration',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      await emailService.updateConfigKeepPassword(
        tenantId,
        {
          host: body.host,
          port: body.port,
          username: body.username,
          fromEmail: body.fromEmail,
          fromDisplayName: body.fromDisplayName,
          useTls: body.useTls ?? true,
          provider: body.provider ?? 'smtp',
        },
        actorId,
        actorName,
      );
    }

    const updated = await emailService.getConfig(tenantId);
    res.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Email] PUT /config failed:', (err as Error).message);
    res.status(503).json({ success: false, error: 'Email configuration update failed' });
  }
});

// ── POST /email/test — Send test email ───────────────────────────────────────

router.post('/test', requirePermission('email.send'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const actorId = req.user!.sub;
    const actorName = req.user!.name;
    const tenantName = req.body.tenantName ?? req.user!.tenantId;

    const { recipientEmail } = req.body as { recipientEmail?: string };
    if (!recipientEmail) {
      res.status(400).json({
        success: false,
        error: 'recipientEmail is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await emailService.sendTestEmail(tenantId, recipientEmail, actorId, actorName, tenantName);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Email] POST /test failed:', (err as Error).message);
    res.status(503).json({ success: false, error: 'Test email failed' });
  }
});

// ── POST /email/verify — Verify SMTP connection ─────────────────────────────

router.post('/verify', requirePermission('email.configure'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const result = await emailService.verifyConnection(tenantId);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Email] POST /verify failed:', (err as Error).message);
    res.status(503).json({ success: false, error: 'SMTP verification failed' });
  }
});

// ── GET /email/templates — List available email templates ────────────────────

router.get('/templates', requirePermission('email.send'), (_req: Request, res: Response) => {
  const templates = getAllTemplates().map(t => ({
    templateId: t.templateId,
    name: t.name,
    subject: t.subject,
    description: t.description,
  }));

  res.json({
    success: true,
    data: templates,
    timestamp: new Date().toISOString(),
  });
});

// ── POST /email/agent-notify — Send agent notification email ────────────────

router.post('/agent-notify', requirePermission('email.send'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const actorId = req.user!.sub;
    const actorName = req.user!.name;

    const body = req.body as Partial<AgentNotificationRequest>;

    if (!body.agentId || !body.controlId || !body.applicationId || !body.applicationName || !body.notificationType || !body.recipients?.length) {
      res.status(400).json({
        success: false,
        error: 'agentId, controlId, applicationId, applicationName, notificationType, and recipients are required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const validTemplates: EmailTemplateId[] = [
      'sso-onboarding-request',
      'sso-mfa-conditional-access',
      'sso-group-targeting',
      'sso-group-creation',
      'sso-remediation-plan',
    ];

    if (!validTemplates.includes(body.notificationType)) {
      res.status(400).json({
        success: false,
        error: `Invalid notificationType. Must be one of: ${validTemplates.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await emailService.sendAgentNotification(
      tenantId,
      body as AgentNotificationRequest,
      actorId,
      actorName,
    );

    res.json({
      success: result.delivery.success,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Email] POST /agent-notify failed:', (err as Error).message);
    res.status(503).json({ success: false, error: 'Agent notification failed' });
  }
});

export const emailController = router;
