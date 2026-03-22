/**
 * SCIM 2.0 Controller
 *
 * Base path: /security/scim/v2/
 * Auth: Bearer token (not API key — SCIM callers use IdP-issued tokens)
 *
 * Users:
 *   GET    /security/scim/v2/Users
 *   POST   /security/scim/v2/Users
 *   GET    /security/scim/v2/Users/:id
 *   PUT    /security/scim/v2/Users/:id
 *   PATCH  /security/scim/v2/Users/:id
 *   DELETE /security/scim/v2/Users/:id
 *
 * Groups:
 *   GET    /security/scim/v2/Groups
 *   POST   /security/scim/v2/Groups
 *   GET    /security/scim/v2/Groups/:id
 *   PUT    /security/scim/v2/Groups/:id
 *   PATCH  /security/scim/v2/Groups/:id
 *   DELETE /security/scim/v2/Groups/:id
 *
 * Meta:
 *   GET    /security/scim/v2/ServiceProviderConfig
 *   GET    /security/scim/v2/ResourceTypes
 *   GET    /security/scim/v2/Schemas
 */

import { Router, Request, Response } from 'express';
import { scimService, SCIM_ERROR_SCHEMA, SCIM_PATCH_SCHEMA } from './scim.service';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';

const router = Router();

// SCIM requires Bearer auth — apply requireAuth to all SCIM routes
router.use(requireAuth);
// All SCIM write operations require security.manage.scim
// Read operations require security.manage.access or security.manage.scim (Manager)

function scimError(res: Response, status: number, detail: string): void {
  res.status(status).json({ schemas: [SCIM_ERROR_SCHEMA], status, detail });
}

// ── Service Provider Config ─────────────────────────────────────────────────

router.get('/ServiceProviderConfig', (_req: Request, res: Response) => {
  res.json(scimService.getServiceProviderConfig());
});

router.get('/ResourceTypes', (_req: Request, res: Response) => {
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 2,
    Resources: [
      { schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'], id: 'User', name: 'User', endpoint: '/Users', schema: 'urn:ietf:params:scim:schemas:core:2.0:User' },
      { schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'], id: 'Group', name: 'Group', endpoint: '/Groups', schema: 'urn:ietf:params:scim:schemas:core:2.0:Group' },
    ],
  });
});

router.get('/Schemas', (_req: Request, res: Response) => {
  res.json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'], totalResults: 2, Resources: [] });
});

// ── Users ───────────────────────────────────────────────────────────────────

router.get('/Users', requirePermission('security.manage.scim'), (req: Request, res: Response) => {
  const filter = req.query.filter as string | undefined;
  res.json(scimService.listUsers(filter));
});

router.post('/Users', requirePermission('security.manage.scim'), (req: Request, res: Response) => {
  const actorId = req.user?.sub ?? 'scim-provisioner';
  const user = scimService.createUser(req.body, actorId);
  res.status(201).json(user);
});

router.get('/Users/:id', requirePermission('security.manage.scim'), (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = scimService.getUser(id);
  if (!user) { scimError(res, 404, `User ${id} not found`); return; }
  res.json(user);
});

router.put('/Users/:id', requirePermission('security.manage.scim'), (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actorId = req.user?.sub ?? 'scim-provisioner';
  const user = scimService.updateUser(id, req.body, actorId);
  if (!user) { scimError(res, 404, `User ${id} not found`); return; }
  res.json(user);
});

router.patch('/Users/:id', requirePermission('security.manage.scim'), (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actorId = req.user?.sub ?? 'scim-provisioner';
  const body = req.body;
  if (!body.schemas?.includes(SCIM_PATCH_SCHEMA)) {
    scimError(res, 400, 'Missing SCIM PatchOp schema'); return;
  }
  const user = scimService.patchUser(id, body, actorId);
  if (!user) { scimError(res, 404, `User ${id} not found`); return; }
  res.json(user);
});

router.delete('/Users/:id', requirePermission('security.manage.scim'), (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actorId = req.user?.sub ?? 'scim-provisioner';
  const ok = scimService.deprovisionUser(id, actorId);
  if (!ok) { scimError(res, 404, `User ${id} not found`); return; }
  res.status(204).send();
});

// ── Groups ──────────────────────────────────────────────────────────────────

router.get('/Groups', requirePermission('security.manage.scim'), (_req: Request, res: Response) => {
  res.json(scimService.listGroups());
});

router.post('/Groups', requirePermission('security.manage.scim'), (req: Request, res: Response) => {
  const actorId = req.user?.sub ?? 'scim-provisioner';
  const group = scimService.createGroup(req.body, actorId);
  res.status(201).json(group);
});

router.get('/Groups/:id', requirePermission('security.manage.scim'), (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const group = scimService.getGroup(id);
  if (!group) { scimError(res, 404, `Group ${id} not found`); return; }
  res.json(group);
});

router.put('/Groups/:id', requirePermission('security.manage.scim'), (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actorId = req.user?.sub ?? 'scim-provisioner';
  const group = scimService.updateGroup(id, req.body, actorId);
  if (!group) { scimError(res, 404, `Group ${id} not found`); return; }
  res.json(group);
});

router.patch('/Groups/:id', requirePermission('security.manage.scim'), (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actorId = req.user?.sub ?? 'scim-provisioner';
  const group = scimService.updateGroup(id, req.body, actorId);
  if (!group) { scimError(res, 404, `Group ${id} not found`); return; }
  res.json(group);
});

router.delete('/Groups/:id', requirePermission('security.manage.scim'), (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actorId = req.user?.sub ?? 'scim-provisioner';
  const ok = scimService.deleteGroup(id, actorId);
  if (!ok) { scimError(res, 404, `Group ${id} not found`); return; }
  res.status(204).send();
});

export default router;
