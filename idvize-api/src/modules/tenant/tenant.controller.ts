/**
 * Tenant Controller
 *
 * Routes:
 *   GET /tenants       — list all tenants (Manager role required)
 *   GET /tenants/me    — current user's tenant info
 *   GET /tenants/:id   — get one tenant + stats
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { tenantService } from './tenant.service';

const router = Router();

// ── GET /tenants/me — current tenant (any authenticated user) ─────────────────
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const tenant = await tenantService.getTenant(req.tenantId!);
  if (!tenant) {
    res.status(404).json({ success: false, error: 'Tenant not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: tenant, timestamp: new Date().toISOString() });
});

// ── GET /tenants — list all tenants (Manager only) ────────────────────────────
router.get('/', requireAuth, requirePermission('security.manage.access'), async (_req: Request, res: Response) => {
  const tenants = await tenantService.listTenants();
  res.json({
    success: true,
    data: { total: tenants.length, tenants },
    timestamp: new Date().toISOString(),
  });
});

// ── GET /tenants/:tenantId — get one tenant ───────────────────────────────────
router.get('/:tenantId', requireAuth, requirePermission('security.manage.access'), async (req: Request, res: Response) => {
  const tenants = await tenantService.listTenants();
  const summary = tenants.find(t => t.tenantId === req.params.tenantId);
  if (!summary) {
    res.status(404).json({ success: false, error: 'Tenant not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: summary, timestamp: new Date().toISOString() });
});

export default router;
