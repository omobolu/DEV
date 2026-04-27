/**
 * Auth Controller
 *
 * POST /security/auth/token          — login (password grant, mock OIDC)
 * POST /security/auth/refresh        — token refresh (stub — Phase 2)
 * POST /security/auth/logout         — logout
 * GET  /security/auth/me             — current user + effective permissions
 * GET  /security/auth/oidc/config    — OIDC discovery document
 * GET  /security/auth/users          — list platform users (Manager only)
 * GET  /security/auth/users/:userId  — get user profile
 * GET  /security/auth/matrix         — full permission matrix (Manager only)
 */

import { Router, Request, Response } from 'express';
import { authService } from './auth.service';
import { authzService } from '../authz/authz.service';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';

const router = Router();

// POST /security/auth/token
router.post('/token', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ success: false, error: '"username" and "password" are required', timestamp: new Date().toISOString() });
    return;
  }
  const actorIp = req.ip;
  try {
    const result = await authService.login(username, password, actorIp);
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    const message = (err as Error).message ?? 'Authentication failed';
    res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
  }
});

// POST /security/auth/logout
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  await authService.recordLogout(req.user!.sub, req.user!.tenantId, req.user!.sessionId, req.ip);
  res.json({ success: true, data: { message: 'Logged out successfully' }, timestamp: new Date().toISOString() });
});

// GET /security/auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const claims = req.user!;
  const user = authService.getUser(claims.tenantId, claims.sub);
  const permissions = authzService.getUserPermissions(claims.sub, claims.tenantId);
  res.json({ success: true, data: { user, permissions, roles: claims.roles }, timestamp: new Date().toISOString() });
});

// GET /security/auth/oidc/config
router.get('/oidc/config', (_req: Request, res: Response) => {
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
  const { oidcAdapter } = require('./adapters/oidc.adapter');
  res.json(oidcAdapter.getDiscoveryDocument(baseUrl));
});

// POST /security/auth/refresh — Phase 2 stub
router.post('/refresh', (_req: Request, res: Response) => {
  res.status(501).json({ success: false, error: 'Token refresh not yet implemented — Phase 2', timestamp: new Date().toISOString() });
});

// GET /security/auth/users — list all users (requires security.manage.access)
router.get('/users', requireAuth, requirePermission('security.manage.access'), (req: Request, res: Response) => {
  const users = authService.listUsers(req.user!.tenantId);
  res.json({ success: true, data: { total: users.length, users }, timestamp: new Date().toISOString() });
});

// GET /security/auth/users/:userId
router.get('/users/:userId', requireAuth, requirePermission('security.manage.access'), (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const user = authService.getUser(req.user!.tenantId, userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: user, timestamp: new Date().toISOString() });
});

// GET /security/auth/matrix — full RBAC permission matrix
router.get('/matrix', requireAuth, requirePermission('security.view.audit'), (_req: Request, res: Response) => {
  const matrix = authzService.getPermissionMatrix();
  const roles = authzService.listRoles();
  const permissions = authzService.listPermissions();
  res.json({ success: true, data: { matrix, roles, permissions }, timestamp: new Date().toISOString() });
});

// GET /security/auth/roles — list roles
router.get('/roles', requireAuth, (req: Request, res: Response) => {
  res.json({ success: true, data: { roles: authzService.listRoles() }, timestamp: new Date().toISOString() });
});

export default router;
