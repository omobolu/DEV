/**
 * Tenant Controller
 *
 * Routes:
 *   GET  /tenants       — list all tenants (PlatformAdmin only)
 *   GET  /tenants/me    — current user's tenant info (any authenticated user)
 *   GET  /tenants/:id   — get one tenant + stats (PlatformAdmin only)
 *   POST /tenants       — create a new tenant + admin user (PlatformAdmin only)
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { tenantService, CreateTenantInput } from './tenant.service';

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

// ── GET /tenants — list all tenants (PlatformAdmin only) ──────────────────────
router.get('/', requireAuth, requirePermission('tenants.manage'), async (_req: Request, res: Response) => {
  const tenants = await tenantService.listTenants();
  res.json({
    success: true,
    data: { total: tenants.length, tenants },
    timestamp: new Date().toISOString(),
  });
});

// ── GET /tenants/:tenantId — get one tenant (PlatformAdmin only) ──────────────
router.get('/:tenantId', requireAuth, requirePermission('tenants.manage'), async (req: Request, res: Response) => {
  const tenants = await tenantService.listTenants();
  const summary = tenants.find(t => t.tenantId === req.params.tenantId);
  if (!summary) {
    res.status(404).json({ success: false, error: 'Tenant not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: summary, timestamp: new Date().toISOString() });
});

// ── POST /tenants — create a new tenant + admin user (PlatformAdmin only) ─────
router.post('/', requireAuth, requirePermission('tenants.manage'), async (req: Request, res: Response) => {
  const input: CreateTenantInput = req.body;

  const validationErrors = tenantService.validateCreateInput(input);
  if (validationErrors.length > 0) {
    res.status(400).json({
      success: false,
      errors: validationErrors,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const actorId = req.user?.sub ?? 'system';
    const actorName = req.user?.name ?? 'System';
    const result = await tenantService.createTenant(input, actorId, actorName);

    res.status(201).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: (err as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ── PATCH /tenants/me/settings — update tenant settings (Manager+) ────────────
router.patch('/me/settings', requireAuth, requirePermission('tenants.manage'), async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const tenant = await tenantService.getTenant(tenantId);
  if (!tenant) {
    res.status(404).json({ success: false, error: 'Tenant not found', timestamp: new Date().toISOString() });
    return;
  }

  const updates = req.body as Partial<typeof tenant.settings>;
  tenant.settings = { ...tenant.settings, ...updates };
  tenant.updatedAt = new Date().toISOString();

  await tenantService.updateTenant(tenant);
  res.json({ success: true, data: tenant.settings, timestamp: new Date().toISOString() });
});

// ── GET /tenants/me/settings — get tenant settings (Manager+) ─────────────────
router.get('/me/settings', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const tenant = await tenantService.getTenant(tenantId);
  if (!tenant) {
    res.status(404).json({ success: false, error: 'Tenant not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: tenant.settings, timestamp: new Date().toISOString() });
});

export default router;
