/**
 * Security Module — Top-Level Controller (Module 7)
 *
 * Mounts all sub-module controllers and exposes:
 *   /security/auth/...     — Authentication (OIDC + mock login)
 *   /security/scim/v2/...  — SCIM 2.0 inbound provisioning
 *   /security/approvals/...- Approval workflow
 *   /security/audit/...    — Audit event log
 *
 * Direct routes on /security/:
 *   GET  /security/status               — module status
 *   GET  /security/authz/check          — ad-hoc permission check
 *   GET  /security/authz/policies       — list all policies (Manager/Architect)
 *   GET  /security/masking/demo         — field masking demonstration
 *   POST /security/masking/demo         — field masking with custom data
 */

import { Router, Request, Response } from 'express';
import authController from './auth/auth.controller';
import scimController from './scim/scim.controller';
import approvalController from './approval/approval.controller';
import auditController from './audit/audit.controller';
import credentialsController from './credentials/credentials.controller';
import vaultController from './vault/vault.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { authzService } from './authz/authz.service';
import { authRepository } from './auth/auth.repository';
import { maskingService } from './masking/masking.service';
import { auditService } from './audit/audit.service';
import { PermissionId } from './security.types';
import { securityGovernanceAgent } from '../../agents/security-governance.agent';

const router = Router();

// ── Sub-module Routers ────────────────────────────────────────────────────────
router.use('/auth', authController);
router.use('/scim/v2', scimController);
router.use('/approvals', approvalController);
router.use('/audit', auditController);
router.use('/credentials', credentialsController);
router.use('/vault', vaultController);

// ── Security Governance Agent ─────────────────────────────────────────────────

// GET /security/posture — deterministic security posture report
router.get('/posture', requireAuth, requirePermission('security.view.audit'), async (req: Request, res: Response) => {
  const report = await securityGovernanceAgent.run(req.tenantId!);
  res.json({ success: true, data: report, timestamp: new Date().toISOString() });
});

// POST /security/posture/ai — Claude-powered deep security analysis
router.post('/posture/ai', requireAuth, requirePermission('security.view.audit'), async (req: Request, res: Response) => {
  console.log('[POST /security/posture/ai] Starting AI analysis...');
  const result = await securityGovernanceAgent.runWithAI(req.tenantId!);
  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
});

// ── Status ────────────────────────────────────────────────────────────────────

router.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      module: 'Security & Identity Governance',
      version: '1.0.0',
      status: 'active',
      capabilities: {
        authentication: { oidc: 'active', saml: 'stub-phase2' },
        provisioning: { scim2: 'active', manualUser: 'active' },
        authorization: { rbac: 'active', abac: 'active', denyByDefault: true },
        fieldMasking: 'active',
        approvalWorkflow: 'active',
        auditLog: 'active',
        secretsAbstraction: 'active',
        credentialRegistry: 'active',
        vaultIntegration: 'active',
        rotationMonitor: 'active',
      },
      dataSnapshot: {
        users: authRepository.count(req.tenantId!),
        auditEvents: auditService.countAll(),
        policies: authzService.listPolicies().length,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// ── Authorization Check ───────────────────────────────────────────────────────

// GET /security/authz/check?permission=cost.view.salary_detail
router.get('/authz/check', requireAuth, (req: Request, res: Response) => {
  const permission = req.query.permission as PermissionId | undefined;
  if (!permission) {
    res.status(400).json({ success: false, error: '"permission" query param required', timestamp: new Date().toISOString() });
    return;
  }
  const decision = authzService.check(req.user!.sub, permission);
  res.json({ success: true, data: decision, timestamp: new Date().toISOString() });
});

// GET /security/authz/my-permissions — effective permissions for current user
router.get('/authz/my-permissions', requireAuth, (req: Request, res: Response) => {
  const permissions = authzService.getUserPermissions(req.user!.sub);
  res.json({ success: true, data: { userId: req.user!.sub, roles: req.user!.roles, permissions }, timestamp: new Date().toISOString() });
});

// GET /security/authz/policies
router.get('/authz/policies', requireAuth, requirePermission('security.view.audit'), (_req: Request, res: Response) => {
  res.json({ success: true, data: { total: authzService.listPolicies().length, policies: authzService.listPolicies() }, timestamp: new Date().toISOString() });
});

// GET /security/authz/matrix — full permission matrix
router.get('/authz/matrix', requireAuth, requirePermission('security.view.audit'), (_req: Request, res: Response) => {
  res.json({ success: true, data: authzService.getPermissionMatrix(), timestamp: new Date().toISOString() });
});

// ── Field Masking Demo ────────────────────────────────────────────────────────

/**
 * GET /security/masking/demo
 *
 * Demonstrates field-level masking for PersonCost (salary detail).
 * If the caller has `cost.view.salary_detail` → full data.
 * If not (Architect, Engineer, etc.) → annualCost is [RESTRICTED].
 */
router.get('/masking/demo', requireAuth, requirePermission('cost.view.summary'), (req: Request, res: Response) => {
  const samplePeople = [
    { personId: 'p-demo-1', name: 'Demo FTE 1', role: 'iam_architect',  employmentType: 'fte',        annualCost: 145000, fteEquivalent: 1.0 },
    { personId: 'p-demo-2', name: 'Demo FTE 2', role: 'iam_engineer',   employmentType: 'fte',        annualCost: 118000, fteEquivalent: 1.0 },
    { personId: 'p-demo-3', name: 'Demo Contractor', role: 'iam_dev',   employmentType: 'contractor', annualCost: 165000, fteEquivalent: 1.0 },
  ];

  const userId = req.user!.sub;
  const masked = maskingService.maskArray(
    samplePeople as unknown as Record<string, unknown>[],
    userId,
    'PersonCost',
    req.requestId,
  );

  const hasSalaryAccess = authzService.check(userId, 'cost.view.salary_detail').allowed;

  res.json({
    success: true,
    data: {
      description: 'Field masking demo — annualCost is [RESTRICTED] if caller lacks cost.view.salary_detail',
      callerRoles: req.user!.roles,
      hasSalaryDetail: hasSalaryAccess,
      people: masked,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
