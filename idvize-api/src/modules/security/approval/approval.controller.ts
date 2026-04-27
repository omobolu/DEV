/**
 * Approval Controller
 *
 * POST /security/approvals             — request an approval (generic only)
 * GET  /security/approvals             — list approvals (?status= &requesterId=)
 * GET  /security/approvals/:id         — get a specific request
 * POST /security/approvals/:id/resolve — approve or reject (generic only)
 *
 * Remediation-domain approvals are created/resolved exclusively through
 * the remediation-specific endpoint (/controls/.../remediate/approve).
 */

import { Router, Request, Response } from 'express';
import { approvalService } from './approval.service';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';
import { tenantContext } from '../../../middleware/tenantContext';

const router = Router();

router.use(requireAuth, tenantContext);

// Reserved resource key pattern: appId::controlId::buildId (remediation-scoped)
const REMEDIATION_RESOURCE_RE = /^[^:]+::[^:]+::[^:]+$/;

// POST /security/approvals — create a generic approval (remediation domain blocked)
router.post('/', requirePermission('approval.request'), async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { targetUserId, permissionId, action, resource, riskLevel, justification } = req.body;
  if (!action || !riskLevel || !justification) {
    res.status(400).json({ success: false, error: '"action", "riskLevel", and "justification" are required', timestamp: new Date().toISOString() });
    return;
  }
  if (!['standard', 'high_risk'].includes(riskLevel)) {
    res.status(400).json({ success: false, error: '"riskLevel" must be "standard" or "high_risk"', timestamp: new Date().toISOString() });
    return;
  }

  // Block creation of remediation-like approvals through generic endpoint
  if (resource && REMEDIATION_RESOURCE_RE.test(resource)) {
    res.status(403).json({
      success: false,
      error: 'Cannot create approvals with remediation-scoped resource keys through the generic endpoint. Use the remediation-specific endpoint.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const request = await approvalService.requestApproval(tenantId, {
    requesterId: req.user!.sub,
    targetUserId,
    permissionId,
    action,
    resource,
    riskLevel,
    justification,
    approvalDomain: 'generic',
  });
  res.status(201).json({ success: true, data: request, timestamp: new Date().toISOString() });
});

// GET /security/approvals — list approvals (remediation approvals filtered unless caller has build.view)
router.get('/', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const status = req.query.status as string | undefined;
  const requesterId = req.query.requesterId as string | undefined;
  let results = approvalService.listAll(tenantId, { status: status as any, requesterId });

  // Filter out remediation-domain approvals — they should only be viewed through the remediation status endpoint
  results = results.filter(r => r.approvalDomain !== 'remediation');

  res.json({ success: true, data: { total: results.length, requests: results }, timestamp: new Date().toISOString() });
});

// GET /security/approvals/:id — get a specific request (block remediation metadata for non-remediation callers)
router.get('/:id', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const request = approvalService.getRequest(tenantId, id);
  if (!request) {
    res.status(404).json({ success: false, error: 'Approval request not found', timestamp: new Date().toISOString() });
    return;
  }

  // Block access to remediation approvals through generic endpoint
  if (request.approvalDomain === 'remediation') {
    res.status(403).json({
      success: false,
      error: 'Remediation approvals must be viewed through the remediation status endpoint',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.json({ success: true, data: request, timestamp: new Date().toISOString() });
});

// POST /security/approvals/:id/resolve — resolve a generic approval (remediation domain blocked)
router.post('/:id/resolve', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { decision, comment } = req.body;
  if (!['approved', 'rejected'].includes(decision)) {
    res.status(400).json({ success: false, error: '"decision" must be "approved" or "rejected"', timestamp: new Date().toISOString() });
    return;
  }

  // Block resolution of remediation approvals through generic endpoint
  const existing = approvalService.getRequest(tenantId, id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Approval request not found', timestamp: new Date().toISOString() });
    return;
  }
  if (existing.approvalDomain === 'remediation') {
    res.status(403).json({
      success: false,
      error: 'Remediation approvals must be resolved through the remediation-specific approve endpoint (/controls/app/:appId/:controlId/remediate/approve)',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const request = await approvalService.resolve(tenantId, id, req.user!.sub, decision, comment);
  res.json({ success: true, data: request, timestamp: new Date().toISOString() });
});

export default router;
