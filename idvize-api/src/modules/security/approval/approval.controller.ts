/**
 * Approval Controller
 *
 * POST /security/approvals             — request an approval
 * GET  /security/approvals             — list approvals (?status= &requesterId=)
 * GET  /security/approvals/:id         — get a specific request
 * POST /security/approvals/:id/resolve — approve or reject
 */

import { Router, Request, Response } from 'express';
import { approvalService } from './approval.service';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';
import { tenantContext } from '../../../middleware/tenantContext';

const router = Router();

router.use(requireAuth, tenantContext);

// POST /security/approvals
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
  const request = approvalService.requestApproval(tenantId, {
    requesterId: req.user!.sub,
    targetUserId,
    permissionId,
    action,
    resource,
    riskLevel,
    justification,
  });
  res.status(201).json({ success: true, data: request, timestamp: new Date().toISOString() });
});

// GET /security/approvals
router.get('/', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const status = req.query.status as string | undefined;
  const requesterId = req.query.requesterId as string | undefined;
  const results = approvalService.listAll(tenantId, { status: status as any, requesterId });
  res.json({ success: true, data: { total: results.length, requests: results }, timestamp: new Date().toISOString() });
});

// GET /security/approvals/:id
router.get('/:id', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const request = approvalService.getRequest(tenantId, id);
  if (!request) {
    res.status(404).json({ success: false, error: 'Approval request not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: request, timestamp: new Date().toISOString() });
});

// POST /security/approvals/:id/resolve
router.post('/:id/resolve', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { decision, comment } = req.body;
  if (!['approved', 'rejected'].includes(decision)) {
    res.status(400).json({ success: false, error: '"decision" must be "approved" or "rejected"', timestamp: new Date().toISOString() });
    return;
  }
  const request = approvalService.resolve(tenantId, id, req.user!.sub, decision, comment);
  res.json({ success: true, data: request, timestamp: new Date().toISOString() });
});

export default router;
