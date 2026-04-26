/**
 * Audit Controller
 *
 * GET  /security/audit         — query audit events (requires security.view.audit)
 * GET  /security/audit/:id     — get a specific audit event
 * GET  /security/audit/summary — event counts by type
 */

import { Router, Request, Response } from 'express';
import { auditService } from './audit.service';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';
import { tenantContext } from '../../../middleware/tenantContext';
import { AuditEventType } from '../security.types';

const router = Router();

router.use(requireAuth, tenantContext);
router.use(requirePermission('security.view.audit'));

// GET /security/audit
router.get('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { eventType, actorId, targetId, outcome, dateFrom, dateTo, limit, offset } = req.query;
  const filter = {
    eventType: eventType as AuditEventType | undefined,
    actorId: actorId as string | undefined,
    targetId: targetId as string | undefined,
    outcome: outcome as any,
    dateFrom: dateFrom as string | undefined,
    dateTo: dateTo as string | undefined,
    limit: limit ? parseInt(limit as string) : 100,
    offset: offset ? parseInt(offset as string) : 0,
  };
  const [events, total] = await Promise.all([
    auditService.queryPg(tenantId, filter),
    auditService.countPg(tenantId),
  ]);
  res.json({ success: true, data: { total, returned: events.length, events }, timestamp: new Date().toISOString() });
});

// GET /security/audit/summary
router.get('/summary', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const [events, totalEvents] = await Promise.all([
    auditService.queryPg(tenantId, { limit: 10000 }),
    auditService.countPg(tenantId),
  ]);
  const byType = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] ?? 0) + 1;
    return acc;
  }, {});
  const byOutcome = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.outcome] = (acc[e.outcome] ?? 0) + 1;
    return acc;
  }, {});
  res.json({ success: true, data: { totalEvents, byType, byOutcome }, timestamp: new Date().toISOString() });
});

// GET /security/audit/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const event = await auditService.findByIdPg(id, req.tenantId!);
  if (!event) {
    res.status(404).json({ success: false, error: 'Audit event not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: event, timestamp: new Date().toISOString() });
});

export default router;
