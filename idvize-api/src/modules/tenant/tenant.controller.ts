/**
 * Tenant Controller
 *
 * Routes:
 *   GET  /tenants       — list all tenants (Manager role required)
 *   GET  /tenants/me    — current user's tenant info
 *   GET  /tenants/:id   — get one tenant + stats
 *   POST /tenants       — create a new tenant + admin user (no restart needed)
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { tenantService } from './tenant.service';
import { tenantRepository } from './tenant.repository';
import { authRepository } from '../security/auth/auth.repository';
import pool from '../../db/pool';
import { User } from '../security/security.types';

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

// ── POST /tenants — create a new tenant + admin user ──────────────────────────
router.post('/', requireAuth, requirePermission('security.manage.access'), async (req: Request, res: Response) => {
  const { name, slug, domain, plan, adminEmail, adminPassword, adminDisplayName } = req.body;

  if (!name || !slug || !domain || !adminEmail || !adminPassword) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: name, slug, domain, adminEmail, adminPassword',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const tenantId = `ten-${slug}`;
  const existing = await tenantRepository.findById(tenantId);
  if (existing) {
    res.status(409).json({
      success: false,
      error: `Tenant already exists: ${tenantId}`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const now = new Date().toISOString();
  const userId = `usr-${slug}-admin-001`;

  const tenant = {
    tenantId,
    name,
    slug,
    domain,
    status: 'active' as const,
    plan: (plan || 'professional') as 'enterprise' | 'professional' | 'trial',
    adminUserId: userId,
    settings: {
      mfaRequired: false,
      sessionTimeoutSeconds: 28800,
      allowedAuthProviders: ['oidc'],
      maxUsers: 100,
      maxApps: 50,
    },
    createdAt: now,
    updatedAt: now,
  };

  await tenantRepository.save(tenant);

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  try {
    await pool.query(
      `INSERT INTO users (user_id, tenant_id, username, display_name, first_name, last_name, email, department, title, roles, groups, status, auth_provider, mfa_enrolled, password_hash, attributes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, tenantId, adminEmail, adminDisplayName || 'Admin', 'Admin', 'User', adminEmail, 'IT', 'Administrator', JSON.stringify(['Manager']), JSON.stringify([]), 'active', 'local', false, passwordHash, JSON.stringify({}), now]
    );
  } catch (err) {
    console.warn(`[TenantController] PostgreSQL user insert failed, saving in-memory only:`, (err as Error).message);
  }

  const user: User = {
    userId,
    tenantId,
    username: adminEmail,
    displayName: adminDisplayName || 'Admin',
    firstName: 'Admin',
    lastName: 'User',
    email: adminEmail,
    department: 'IT',
    title: 'Administrator',
    roles: ['Manager'],
    groups: [],
    status: 'active',
    authProvider: 'local',
    mfaEnrolled: false,
    passwordHash,
    attributes: {},
    createdAt: now,
    updatedAt: now,
  };
  authRepository.save(tenantId, user);

  res.status(201).json({
    success: true,
    data: {
      tenant: { tenantId, name, slug, domain, status: 'active', plan: tenant.plan },
      adminUser: { userId, username: adminEmail, role: 'Manager' },
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
