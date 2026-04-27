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

  // Whitelist only allowed setting keys and validate shape
  const body = req.body;
  if (body == null || typeof body !== 'object') {
    res.status(400).json({ success: false, error: 'Request body must be a JSON object', timestamp: new Date().toISOString() });
    return;
  }

  const allowedKeys = ['remediation'];
  const extraKeys = Object.keys(body).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    res.status(400).json({
      success: false,
      error: `Unrecognized settings keys: ${extraKeys.join(', ')}. Allowed: ${allowedKeys.join(', ')}`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Validate remediation shape if provided
  if (body.remediation !== undefined) {
    const rem = body.remediation;
    if (typeof rem !== 'object' || rem === null) {
      res.status(400).json({ success: false, error: 'remediation must be an object', timestamp: new Date().toISOString() });
      return;
    }
    const remAllowed = ['requireIamManagerApproval', 'requireAppOwnerApproval'];
    const remExtra = Object.keys(rem).filter(k => !remAllowed.includes(k));
    if (remExtra.length > 0) {
      res.status(400).json({
        success: false,
        error: `Unrecognized remediation keys: ${remExtra.join(', ')}. Allowed: ${remAllowed.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (rem.requireIamManagerApproval !== undefined && typeof rem.requireIamManagerApproval !== 'boolean') {
      res.status(400).json({ success: false, error: 'requireIamManagerApproval must be a boolean', timestamp: new Date().toISOString() });
      return;
    }
    if (rem.requireAppOwnerApproval !== undefined && typeof rem.requireAppOwnerApproval !== 'boolean') {
      res.status(400).json({ success: false, error: 'requireAppOwnerApproval must be a boolean', timestamp: new Date().toISOString() });
      return;
    }
  }

  // Clone tenant before mutation to avoid cache corruption on DB failure
  const updatedTenant = {
    ...tenant,
    settings: { ...tenant.settings, ...(body.remediation ? { remediation: { ...tenant.settings?.remediation, ...body.remediation } } : {}) },
    updatedAt: new Date().toISOString(),
  };

  await tenantService.updateTenant(updatedTenant);
  res.json({ success: true, data: updatedTenant.settings, timestamp: new Date().toISOString() });
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
