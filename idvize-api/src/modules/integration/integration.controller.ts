import { Router, Request, Response } from 'express';
import { entraAdapter } from './adapters/entra.adapter';
import { sailpointAdapter } from './adapters/sailpoint.adapter';
import { cyberarkAdapter } from './adapters/cyberark.adapter';
import { oktaAdapter } from './adapters/okta.adapter';
import { integrationConfigService, PlatformKey } from './integration.config.service';
import { requireAuth } from '../../middleware/requireAuth';
import { tenantContext } from '../../middleware/tenantContext';
import { requirePermission } from '../../middleware/requirePermission';

const router = Router();

// GET /integrations/status — all platform integration statuses
router.get('/status', requireAuth, tenantContext, requirePermission('integrations.view'), (_req: Request, res: Response) => {
  const statuses = [
    entraAdapter.getIntegrationStatus(),
    sailpointAdapter.getIntegrationStatus(),
    cyberarkAdapter.getIntegrationStatus(),
    oktaAdapter.getIntegrationStatus(),
  ];
  res.json({ success: true, data: statuses, timestamp: new Date().toISOString() });
});

// GET /integrations/entra/apps
router.get('/entra/apps', requireAuth, tenantContext, requirePermission('integrations.view'), async (_req: Request, res: Response) => {
  const apps = await entraAdapter.listEnterpriseApps();
  res.json({ success: true, data: apps, timestamp: new Date().toISOString() });
});

// GET /integrations/sailpoint/sources
router.get('/sailpoint/sources', requireAuth, tenantContext, requirePermission('integrations.view'), async (_req: Request, res: Response) => {
  const sources = await sailpointAdapter.listSources();
  res.json({ success: true, data: sources, timestamp: new Date().toISOString() });
});

// GET /integrations/cyberark/safes
router.get('/cyberark/safes', requireAuth, tenantContext, requirePermission('integrations.view'), async (_req: Request, res: Response) => {
  const safes = await cyberarkAdapter.listSafes();
  res.json({ success: true, data: safes, timestamp: new Date().toISOString() });
});

// GET /integrations/okta/apps
router.get('/okta/apps', requireAuth, tenantContext, requirePermission('integrations.view'), async (_req: Request, res: Response) => {
  const apps = await oktaAdapter.listApps();
  res.json({ success: true, data: apps, timestamp: new Date().toISOString() });
});

// POST /integrations/correlate/:appName — correlate app across all platforms
router.post('/correlate/:appName', requireAuth, tenantContext, requirePermission('integrations.view'), async (req: Request, res: Response) => {
  const appName = decodeURIComponent(req.params.appName as string);
  const [entra, sailpoint, cyberark, okta] = await Promise.all([
    entraAdapter.correlateApp(appName),
    sailpointAdapter.correlateApp(appName),
    cyberarkAdapter.correlateApp(appName),
    oktaAdapter.correlateApp(appName),
  ]);
  res.json({ success: true, data: { appName, correlations: { entra, sailpoint, cyberark, okta } }, timestamp: new Date().toISOString() });
});

// GET /integrations/config — current config (masked secrets) + statuses
router.get('/config', requireAuth, tenantContext, requirePermission('integrations.view'), (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      statuses: integrationConfigService.getStatuses(),
      config:   integrationConfigService.getMaskedConfig(),
    },
    timestamp: new Date().toISOString(),
  });
});

// POST /integrations/configure — save credentials for one or more platforms
router.post('/configure', requireAuth, tenantContext, requirePermission('integrations.manage'), async (req: Request, res: Response) => {
  try {
    const actorId   = req.user?.sub  ?? 'anonymous';
    const actorName = req.user?.name ?? 'Anonymous';
    await integrationConfigService.save(req.body, actorId, actorName);
    res.json({
      success: true,
      data: { statuses: integrationConfigService.getStatuses() },
      message: 'Credentials saved',
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Save failed';
    const isValidation = msg.includes('is required') || msg.includes('must not contain') || msg.includes('blocked') || msg.includes('HTTPS required') || msg.includes('Invalid URL') || msg.includes('Unsupported protocol') || msg.includes('resolves to blocked') || msg.includes('could not be resolved');
    res.status(isValidation ? 400 : 500).json({ success: false, error: msg, timestamp: new Date().toISOString() });
  }
});

// POST /integrations/test/:platform — test live connection using credentials in request body
// The body must contain the platform credentials to test — we NEVER use previously saved values
// so that entering wrong credentials always fails, even if correct ones are already saved.
router.post('/test/:platform', requireAuth, tenantContext, requirePermission('integrations.manage'), async (req: Request, res: Response) => {
  const platform  = String(req.params.platform) as PlatformKey;
  const actorId   = req.user?.sub  ?? 'anonymous';
  const actorName = req.user?.name ?? 'Anonymous';

  // req.body must be: { entra: {...} } or { sailpoint: {...} } etc.
  if (!req.body || !req.body[platform]) {
    res.status(400).json({
      success: false,
      error:   `Request body must contain a "${platform}" credentials object`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const result = await integrationConfigService.testConnection(platform, req.body, actorId, actorName);
  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
});

export default router;
