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
import { AuditEventType } from '../security.types';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('security.view.audit'));

// GET /security/audit
router.get('/', (req: Request, res: Response) => {
  const { eventType, actorId, targetId, outcome, dateFrom, dateTo, limit, offset } = req.query;
  const events = auditService.query({
    eventType: eventType as AuditEventType | undefined,
    actorId: actorId as string | undefined,
    targetId: targetId as string | undefined,
    outcome: outcome as any,
    dateFrom: dateFrom as string | undefined,
    dateTo: dateTo as string | undefined,
    limit: limit ? parseInt(limit as string) : 100,
    offset: offset ? parseInt(offset as string) : 0,
  });
  res.json({ success: true, data: { total: auditService.count(), returned: events.length, events }, timestamp: new Date().toISOString() });
});

// GET /security/audit/summary
router.get('/summary', (_req: Request, res: Response) => {
  const events = auditService.query({ limit: 10000 });
  const byType = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] ?? 0) + 1;
    return acc;
  }, {});
  const byOutcome = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.outcome] = (acc[e.outcome] ?? 0) + 1;
    return acc;
  }, {});
  res.json({ success: true, data: { totalEvents: auditService.count(), byType, byOutcome }, timestamp: new Date().toISOString() });
});

// GET /security/audit/:id
router.get('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const event = auditService.findById(id);
  if (!event) {
    res.status(404).json({ success: false, error: 'Audit event not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: event, timestamp: new Date().toISOString() });
});

export default router;
