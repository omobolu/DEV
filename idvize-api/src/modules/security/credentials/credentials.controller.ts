/**
 * Credentials Controller
 *
 * POST /credentials/request             — submit a credential request
 * GET  /credentials/requests            — list all credential requests
 * GET  /credentials/requests/:id        — get a specific request (incl. work instructions)
 * POST /credentials/requests/:id/resolve— approve or reject a request
 * GET  /credentials                     — list credentials (metadata view)
 * POST /credentials                     — register a new credential
 * GET  /credentials/:id                 — get credential details (field-restricted)
 * POST /credentials/:id/register-reference — engineer registers vault path after handoff
 * POST /credentials/:id/rotate          — flag for rotation
 * POST /credentials/:id/revoke          — revoke a credential
 * GET  /credentials/rotation/report     — rotation monitor report
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../../middleware/requireAuth';
import { requirePermission } from '../../../middleware/requirePermission';
import { tenantContext } from '../../../middleware/tenantContext';
import { credentialRegistryService } from './credential-registry.service';
import { credentialRequestWorkflowService } from './credential-request-workflow.service';
import { secretAccessPolicyService } from './secret-access-policy.service';
import { credentialRotationMonitorService } from './credential-rotation-monitor.service';
import { vaultAdapterService } from '../vault/vault.adapter.service';

const router = Router();
router.use(requireAuth, tenantContext);

// ── Credential Requests ────────────────────────────────────────────────────

// POST /credentials/request
router.post('/request', requirePermission('secrets.request'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const {
    credentialId, requestType, targetSystem, credentialType, targetEnvironment,
    operatingMode, vaultProvider, justification, assignedTo,
  } = req.body;

  if (!requestType || !targetSystem || !credentialType || !targetEnvironment || !operatingMode || !justification) {
    res.status(400).json({ success: false, error: 'requestType, targetSystem, credentialType, targetEnvironment, operatingMode, and justification are required', timestamp: new Date().toISOString() });
    return;
  }

  const request = credentialRequestWorkflowService.submitRequest(tenantId, {
    requestedBy: req.user!.sub,
    credentialId,
    requestType,
    targetSystem,
    credentialType,
    targetEnvironment,
    operatingMode,
    vaultProvider,
    justification,
    assignedTo,
  });

  res.status(201).json({ success: true, data: request, timestamp: new Date().toISOString() });
});

// GET /credentials/requests
router.get('/requests', requirePermission('secrets.view.metadata'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { status, requestedBy, assignedTo } = req.query;
  const results = credentialRequestWorkflowService.listAll(tenantId, {
    status: status as any,
    requestedBy: requestedBy as string,
    assignedTo: assignedTo as string,
  });
  res.json({ success: true, data: { total: results.length, requests: results }, timestamp: new Date().toISOString() });
});

// GET /credentials/requests/:id
router.get('/requests/:id', requirePermission('secrets.view.metadata'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const request = credentialRequestWorkflowService.getRequest(tenantId, id);
  if (!request) {
    res.status(404).json({ success: false, error: 'Credential request not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: request, timestamp: new Date().toISOString() });
});

// POST /credentials/requests/:id/resolve
router.post('/requests/:id/resolve', requirePermission('secrets.approve'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { decision, comment } = req.body;
  if (!['approved', 'rejected'].includes(decision)) {
    res.status(400).json({ success: false, error: '"decision" must be "approved" or "rejected"', timestamp: new Date().toISOString() });
    return;
  }
  const request = credentialRequestWorkflowService.resolve(tenantId, id, req.user!.sub, decision, comment);
  res.json({ success: true, data: request, timestamp: new Date().toISOString() });
});

// ── Credential Registry ────────────────────────────────────────────────────

// POST /credentials
router.post('/', requirePermission('secrets.request'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const {
    name, description, credentialType, targetSystem, targetEnvironment,
    operatingMode, vaultProvider, expiresAt, rotationIntervalDays,
    ownerId, teamId, applicationId, sensitivityLevel, tags,
  } = req.body;

  if (!name || !credentialType || !targetSystem || !targetEnvironment || !operatingMode) {
    res.status(400).json({ success: false, error: 'name, credentialType, targetSystem, targetEnvironment, and operatingMode are required', timestamp: new Date().toISOString() });
    return;
  }

  const record = credentialRegistryService.register(tenantId, {
    name, description: description ?? '', credentialType, targetSystem, targetEnvironment,
    operatingMode, vaultProvider, expiresAt, rotationIntervalDays,
    ownerId: ownerId ?? req.user!.sub,
    teamId, applicationId, sensitivityLevel, tags,
  }, req.user!.sub);

  res.status(201).json({ success: true, data: record, timestamp: new Date().toISOString() });
});

// GET /credentials
router.get('/', requirePermission('secrets.view.metadata'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { status, targetSystem, ownerId, applicationId } = req.query;
  const all = credentialRegistryService.listAll(tenantId, {
    status: status as any,
    targetSystem: targetSystem as string,
    ownerId: ownerId as string,
    applicationId: applicationId as string,
  });
  // Apply field restrictions per caller
  const restricted = all.map(c => secretAccessPolicyService.applyFieldRestrictions(c, req.user!.sub, tenantId));
  res.json({ success: true, data: { total: restricted.length, credentials: restricted }, timestamp: new Date().toISOString() });
});

// GET /credentials/rotation/report
router.get('/rotation/report', requirePermission('secrets.rotate'), (req: Request, res: Response) => {
  const report = credentialRotationMonitorService.runCheck(req.tenantId!);
  res.json({ success: true, data: report, timestamp: new Date().toISOString() });
});

// GET /credentials/:id
router.get('/:id', requirePermission('secrets.view.metadata'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const record = credentialRegistryService.findById(tenantId, id);
  if (!record) {
    res.status(404).json({ success: false, error: 'Credential not found', timestamp: new Date().toISOString() });
    return;
  }
  const restricted = secretAccessPolicyService.applyFieldRestrictions(record, req.user!.sub, tenantId);
  res.json({ success: true, data: restricted, timestamp: new Date().toISOString() });
});

// POST /credentials/:id/register-reference
router.post('/:id/register-reference', requirePermission('secrets.reference'), async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { vaultPath, vaultSecretName, vaultProvider, vaultReferenceId } = req.body;
  if (!vaultPath || !vaultSecretName || !vaultProvider) {
    res.status(400).json({ success: false, error: 'vaultPath, vaultSecretName, and vaultProvider are required', timestamp: new Date().toISOString() });
    return;
  }
  const record = await credentialRegistryService.registerReference(tenantId, id, { vaultPath, vaultSecretName, vaultProvider, vaultReferenceId }, req.user!.sub);
  res.json({ success: true, data: record, timestamp: new Date().toISOString() });
});

// POST /credentials/:id/rotate
router.post('/:id/rotate', requirePermission('secrets.rotate'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const record = credentialRegistryService.findById(tenantId, id);
  if (!record) {
    res.status(404).json({ success: false, error: 'Credential not found', timestamp: new Date().toISOString() });
    return;
  }

  const policy = secretAccessPolicyService.evaluate(tenantId, req.user!.sub, 'rotate', record, req.requestId);
  if (!policy.allowed) {
    res.status(403).json({ success: false, error: policy.reason, timestamp: new Date().toISOString() });
    return;
  }

  record.status = 'rotation_required';
  record.rotationDue = true;
  record.updatedAt = new Date().toISOString();

  const request = credentialRequestWorkflowService.submitRequest(tenantId, {
    requestedBy: req.user!.sub,
    credentialId: id,
    requestType: 'rotate',
    targetSystem: record.targetSystem,
    credentialType: record.credentialType,
    targetEnvironment: record.targetEnvironment,
    operatingMode: record.operatingMode,
    vaultProvider: record.vaultProvider,
    justification: req.body.reason ?? 'Rotation requested',
  });

  res.json({ success: true, data: { credential: record, rotationRequest: request }, timestamp: new Date().toISOString() });
});

// POST /credentials/:id/revoke
router.post('/:id/revoke', requirePermission('secrets.approve'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const record = credentialRegistryService.revoke(tenantId, id, req.user!.sub, req.body.reason);
  res.json({ success: true, data: record, timestamp: new Date().toISOString() });
});

export default router;
