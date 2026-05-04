/**
 * Agent Execution Controller — API routes for the controlled execution framework.
 *
 * Routes:
 *   GET  /agent-execution/capabilities        — List available agent capabilities
 *   GET  /agent-execution/adapters             — List adapter configuration status
 *   POST /agent-execution/sessions             — Create execution session (plan)
 *   GET  /agent-execution/sessions             — List sessions for tenant (sanitized)
 *   GET  /agent-execution/sessions/:sessionId  — Get session detail
 *   POST /agent-execution/sessions/:sessionId/approve — Approve/reject a plan
 *   POST /agent-execution/sessions/:sessionId/execute — Execute an approved plan
 *   POST /agent-execution/sessions/:sessionId/cancel  — Cancel a session
 *   POST /agent-execution/sessions/:sessionId/credentials — Request credential handoff
 *   POST /agent-execution/credentials/:handleId/submit — Submit credential value
 *   GET  /agent-execution/sessions/:sessionId/evidence — Get session evidence
 *
 * All routes require authentication + tenant context.
 * Execution routes require elevated permissions (agents.execute.*).
 */

import express, { Router, Request, Response } from 'express';
import { executionOrchestratorService } from './execution-orchestrator.service';
import { toolBrokerService } from './tool-broker.service';
import { credentialEscrowService } from './credential-escrow.service';
import { evidenceStoreService } from './evidence-store.service';
import { emailActionTokenService } from '../email/email-action-token.service';
import { requireAuth } from '../../middleware/requireAuth';
import { tenantContext } from '../../middleware/tenantContext';
import { requirePermission } from '../../middleware/requirePermission';
import type { CreatePlanRequest, ExecutionSessionStatus, ExecutionSession, AgentType } from './agent-execution.types';
import type { TokenClaims } from '../security/security.types';

const router = Router();

// ── Email Action (public — no JWT, token-validated) ──────────────────────────

// GET shows a comment form; POST submits the decision.
router.get('/email-action', async (req: Request, res: Response) => {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(400).send(actionResultPage('Invalid Request', 'No action token provided.', false));
    return;
  }

  try {
    const payload = await emailActionTokenService.peekToken(token);
    const label = payload.decision === 'approved' ? 'Approve' : 'Reject';
    res.send(actionFormPage(label, payload.decision, token));
  } catch (err) {
    const message = (err as Error).message;
    res.status(400).send(actionResultPage('Action Failed', message, false));
  }
});

router.post('/email-action', express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
  const token = req.body.token as string | undefined;
  const comment = (req.body.comment as string | undefined)?.trim() || undefined;
  if (!token) {
    res.status(400).send(actionResultPage('Invalid Request', 'No action token provided.', false));
    return;
  }

  try {
    const payload = await emailActionTokenService.validateToken(token);
    const { tenantId, sessionId, approvalId, decision } = payload;

    await executionOrchestratorService.resolveApprovalViaEmail(
      tenantId, sessionId, approvalId, decision, comment,
    );

    const label = decision === 'approved' ? 'Approved' : 'Rejected';
    res.send(actionResultPage(
      `Plan ${label}`,
      `The remediation plan has been ${decision}.${comment ? ` Comment: "${comment}"` : ''} You can close this window.`,
      decision === 'approved',
    ));
  } catch (err) {
    const message = (err as Error).message;
    res.status(400).send(actionResultPage('Action Failed', message, false));
  }
});

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function actionFormPage(label: string, decision: string, token: string): string {
  const isApprove = decision === 'approved';
  const btnBg = isApprove ? '#16a34a' : '#dc2626';
  const alertBg = isApprove ? '#f0fdf4' : '#fef2f2';
  const alertBorder = isApprove ? '#16a34a' : '#dc2626';
  const alertColor = isApprove ? '#166534' : '#991b1b';
  const escapedToken = token.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>IDVIZE — ${label} Plan</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{margin:0;padding:0;background:#f4f6f9;font-family:Inter,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}
.card{background:#fff;border-radius:8px;border:1px solid #e2e8f0;max-width:480px;width:100%;overflow:hidden;}
.header{background:#1e293b;padding:20px 24px;color:#818cf8;font-weight:700;font-size:18px;}
.body{padding:24px;}
.alert{background:${alertBg};border-left:4px solid ${alertBorder};padding:12px 16px;border-radius:4px;margin:0 0 16px;}
.alert-title{color:${alertColor};font-size:14px;font-weight:600;}
.alert-msg{color:${alertColor};font-size:13px;margin:4px 0 0;}
label{display:block;color:#475569;font-size:13px;font-weight:500;margin:0 0 6px;}
textarea{width:100%;min-height:80px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;font-size:13px;resize:vertical;box-sizing:border-box;}
textarea:focus{outline:none;border-color:#818cf8;box-shadow:0 0 0 2px rgba(129,140,248,0.2);}
.btn{display:inline-block;padding:10px 28px;background:${btnBg};color:#fff;font-size:14px;font-weight:600;border:none;border-radius:6px;cursor:pointer;margin:16px 0 0;}
.btn:hover{opacity:0.9;}</style></head>
<body><div class="card"><div class="header">idvize <span style="color:#94a3b8;font-size:11px;margin-left:8px;">IAM Operating System</span></div>
<div class="body">
<div class="alert"><div class="alert-title">${label} Remediation Plan</div>
<p class="alert-msg">You are about to ${escapeHtml(decision === 'approved' ? 'approve' : 'reject')} this plan.</p></div>
<form method="POST" action="/agent-execution/email-action">
<input type="hidden" name="token" value="${escapedToken}">
<label for="comment">Comment (optional)</label>
<textarea id="comment" name="comment" placeholder="Enter any notes or justification..."></textarea>
<button type="submit" class="btn">${label} Plan</button>
</form></div></div></body></html>`;
}

function actionResultPage(title: string, message: string, success: boolean): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const bg = success ? '#f0fdf4' : '#fef2f2';
  const border = success ? '#16a34a' : '#dc2626';
  const color = success ? '#166534' : '#991b1b';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>IDVIZE — ${safeTitle}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{margin:0;padding:0;background:#f4f6f9;font-family:Inter,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}
.card{background:#fff;border-radius:8px;border:1px solid #e2e8f0;max-width:480px;width:100%;overflow:hidden;}
.header{background:#1e293b;padding:20px 24px;color:#818cf8;font-weight:700;font-size:18px;}
.body{padding:24px;}
.alert{background:${bg};border-left:4px solid ${border};padding:12px 16px;border-radius:4px;margin:0 0 16px;}
.alert-title{color:${color};font-size:14px;font-weight:600;}
.alert-msg{color:${color};font-size:13px;margin:4px 0 0;}</style></head>
<body><div class="card"><div class="header">idvize <span style="color:#94a3b8;font-size:11px;margin-left:8px;">IAM Operating System</span></div>
<div class="body"><div class="alert"><div class="alert-title">${safeTitle}</div><p class="alert-msg">${safeMessage}</p></div></div></div></body></html>`;
}

// All routes below require authentication and tenant context
router.use(requireAuth, tenantContext);

// ── Capabilities & Status ────────────────────────────────────────────────────

router.get('/capabilities', requirePermission('agents.use'), (_req: Request, res: Response) => {
  const capabilities = executionOrchestratorService.getAgentCapabilities();
  res.json({ success: true, data: capabilities });
});

router.get('/adapters', requirePermission('agents.use'), (_req: Request, res: Response) => {
  const adapters = toolBrokerService.getAdapterStatus();
  res.json({ success: true, data: adapters });
});

// ── Session Management ───────────────────────────────────────────────────────

router.post('/sessions', requirePermission('agents.plan'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    const user = (req as any).user as TokenClaims | undefined;
    if (!tenantId || !user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { agentType, applicationId, controlId, context } = req.body;

    if (!agentType || !applicationId || !controlId) {
      res.status(400).json({ error: 'agentType, applicationId, and controlId are required' });
      return;
    }

    const request: CreatePlanRequest = { agentType, applicationId, controlId, context };
    const session = await executionOrchestratorService.createSession(
      tenantId, request, user.sub, user.name, user.email,
    );

    const status = session.status === 'failed' ? 422 : 201;
    res.status(status).json({ success: session.status !== 'failed', data: session });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else if (message.includes('validation failed') || message.includes('Cannot overwrite')) {
      res.status(400).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to create session' });
    }
  }
});

/**
 * GET /sessions — List sessions (sanitized response).
 * Strips plan internals and credential handles for agents.use users.
 */
router.get('/sessions', requirePermission('agents.use'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const filters: { status?: ExecutionSessionStatus; agentType?: AgentType; limit?: number } = {};
    if (req.query.status) filters.status = req.query.status as ExecutionSessionStatus;
    if (req.query.agentType) filters.agentType = req.query.agentType as AgentType;
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string, 10);

    const sessions = await executionOrchestratorService.listSessions(tenantId, filters);

    // Sanitize: strip plan internals, credential handles, and full evidence data
    const sanitized = sessions.map(sanitizeSessionForList);
    res.json({ success: true, data: sanitized, total: sanitized.length });
  } catch (err) {
    res.status(503).json({ error: 'Session data temporarily unavailable' });
  }
});

router.get('/sessions/:sessionId', requirePermission('agents.use'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const sessionId = req.params.sessionId as string;
    const session = await executionOrchestratorService.getSession(tenantId, sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({ success: true, data: session });
  } catch (err) {
    res.status(503).json({ error: 'Session data temporarily unavailable' });
  }
});

// ── Approval ─────────────────────────────────────────────────────────────────

router.post('/sessions/:sessionId/approve', requirePermission('agents.execute.approve'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    const user = (req as any).user as TokenClaims | undefined;
    if (!tenantId || !user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { approvalId, decision, comment } = req.body;
    if (!approvalId || !decision) {
      res.status(400).json({ error: 'approvalId and decision are required' });
      return;
    }

    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ error: 'decision must be "approved" or "rejected"' });
      return;
    }

    const sessionId = req.params.sessionId as string;
    const session = await executionOrchestratorService.resolveApproval(
      tenantId, sessionId, approvalId, user.sub, user.name,
      user.roles as string[], decision, comment,
    );

    res.json({ success: true, data: session });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('eligible')) {
      res.status(403).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
});

// ── Execution ────────────────────────────────────────────────────────────────

router.post('/sessions/:sessionId/execute', requirePermission('agents.execute.request'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    const user = (req as any).user as TokenClaims | undefined;
    if (!tenantId || !user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const sessionId = req.params.sessionId as string;
    const session = await executionOrchestratorService.executeSession(
      tenantId, sessionId, user.sub, user.name, user.permissions, user.email,
    );

    res.json({ success: true, data: session });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('must be "approved"') || message.includes('Missing execution permissions')) {
      res.status(403).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
});

// ── Input Resolution (for paused sessions) ──────────────────────────────────

router.patch('/sessions/:sessionId/inputs', requirePermission('agents.execute.request'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    const user = (req as any).user as TokenClaims | undefined;
    if (!tenantId || !user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const sessionId = req.params.sessionId as string;
    const { inputs } = req.body;
    if (!inputs || typeof inputs !== 'object') {
      res.status(400).json({ error: 'inputs object is required' });
      return;
    }

    const session = await executionOrchestratorService.updateSessionInputs(
      tenantId, sessionId, inputs as Record<string, unknown>, user.sub, user.name,
    );

    res.json({ success: true, data: session });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
});

// ── Manual Step Confirmation ────────────────────────────────────────────────

router.post('/sessions/:sessionId/steps/:stepId/confirm', requirePermission('agents.execute.request'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    const user = (req as any).user as TokenClaims | undefined;
    if (!tenantId || !user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const sessionId = req.params.sessionId as string;
    const stepId = req.params.stepId as string;
    const { confirmed, evidence } = req.body;

    if (typeof confirmed !== 'boolean') {
      res.status(400).json({ error: 'confirmed (boolean) is required' });
      return;
    }

    const session = await executionOrchestratorService.confirmManualStep(
      tenantId, sessionId, stepId, confirmed, user.sub, user.name, evidence as string | undefined,
    );

    res.json({ success: true, data: session });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
});

// ── Cancellation ─────────────────────────────────────────────────────────────

router.post('/sessions/:sessionId/cancel', requirePermission('agents.plan'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    const user = (req as any).user as TokenClaims | undefined;
    if (!tenantId || !user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { reason } = req.body;
    const sessionId = req.params.sessionId as string;
    const session = await executionOrchestratorService.cancelSession(
      tenantId, sessionId, user.sub, user.name, reason,
    );

    res.json({ success: true, data: session });
  } catch (err) {
    const message = (err as Error).message;
    res.status(400).json({ error: message });
  }
});

// ── Credential Handoff ───────────────────────────────────────────────────────

router.post('/sessions/:sessionId/credentials', requirePermission('agents.execute.request'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    const user = (req as any).user as TokenClaims | undefined;
    if (!tenantId || !user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { stepId, purpose } = req.body;
    if (!stepId || !purpose) {
      res.status(400).json({ error: 'stepId and purpose are required' });
      return;
    }

    const sessionId = req.params.sessionId as string;
    const result = await executionOrchestratorService.requestCredential(
      tenantId, sessionId, stepId, purpose, user.sub, user.name,
    );

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    const message = (err as Error).message;
    res.status(400).json({ error: message });
  }
});

router.post('/credentials/:handleId/submit', requirePermission('agents.execute.request'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    const user = (req as any).user as TokenClaims | undefined;
    if (!tenantId || !user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { credential } = req.body;
    if (!credential) {
      res.status(400).json({ error: 'credential is required' });
      return;
    }

    const handleId = req.params.handleId as string;
    await credentialEscrowService.submitCredential(
      tenantId, handleId, credential, user.sub, user.name,
    );

    // Return only handle confirmation — NEVER return the credential value
    res.json({
      success: true,
      data: { handleId, status: 'submitted' },
    });
  } catch (err) {
    const message = (err as Error).message;
    res.status(400).json({ error: message });
  }
});

// ── Evidence ─────────────────────────────────────────────────────────────────

router.get('/sessions/:sessionId/evidence', requirePermission('agents.use'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const sessionId = req.params.sessionId as string;
    const evidence = await evidenceStoreService.getBySession(tenantId, sessionId);
    res.json({ success: true, data: evidence, total: evidence.length });
  } catch (err) {
    res.status(503).json({ error: 'Evidence data temporarily unavailable' });
  }
});

// ── Response Sanitization ────────────────────────────────────────────────────

/**
 * Sanitize session for list endpoint — strip plan internals, credential handles,
 * and full evidence data. Only expose safe summary fields.
 */
function sanitizeSessionForList(session: ExecutionSession) {
  return {
    sessionId: session.sessionId,
    tenantId: session.tenantId,
    agentType: session.agentType,
    status: session.status,
    planSummary: session.plan ? {
      planId: session.plan.planId,
      applicationId: session.plan.applicationId,
      applicationName: session.plan.applicationName,
      controlId: session.plan.controlId,
      controlName: session.plan.controlName,
      summary: session.plan.summary,
      stepsCount: session.plan.steps.length,
      blastRadius: session.plan.blastRadius,
    } : null,
    approvalsCount: session.approvals.length,
    approvalsPending: session.approvals.filter(a => a.status === 'pending').length,
    evidenceCount: session.evidence.length,
    createdBy: session.createdBy,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    errorMessage: session.errorMessage,
  };
}

export default router;
