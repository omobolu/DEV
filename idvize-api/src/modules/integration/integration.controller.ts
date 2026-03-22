import { Router, Request, Response } from 'express';
import { entraAdapter } from './adapters/entra.adapter';
import { sailpointAdapter } from './adapters/sailpoint.adapter';
import { cyberarkAdapter } from './adapters/cyberark.adapter';
import { oktaAdapter } from './adapters/okta.adapter';

const router = Router();

// GET /integrations/status — all platform integration statuses
router.get('/status', (_req: Request, res: Response) => {
  const statuses = [
    entraAdapter.getIntegrationStatus(),
    sailpointAdapter.getIntegrationStatus(),
    cyberarkAdapter.getIntegrationStatus(),
    oktaAdapter.getIntegrationStatus(),
  ];
  res.json({ success: true, data: statuses, timestamp: new Date().toISOString() });
});

// GET /integrations/entra/apps
router.get('/entra/apps', async (_req: Request, res: Response) => {
  const apps = await entraAdapter.listEnterpriseApps();
  res.json({ success: true, data: apps, timestamp: new Date().toISOString() });
});

// GET /integrations/sailpoint/sources
router.get('/sailpoint/sources', async (_req: Request, res: Response) => {
  const sources = await sailpointAdapter.listSources();
  res.json({ success: true, data: sources, timestamp: new Date().toISOString() });
});

// GET /integrations/cyberark/safes
router.get('/cyberark/safes', async (_req: Request, res: Response) => {
  const safes = await cyberarkAdapter.listSafes();
  res.json({ success: true, data: safes, timestamp: new Date().toISOString() });
});

// GET /integrations/okta/apps
router.get('/okta/apps', async (_req: Request, res: Response) => {
  const apps = await oktaAdapter.listApps();
  res.json({ success: true, data: apps, timestamp: new Date().toISOString() });
});

// POST /integrations/correlate/:appName — correlate app across all platforms
router.post('/correlate/:appName', async (req: Request, res: Response) => {
  const appName = decodeURIComponent(req.params.appName as string);
  const [entra, sailpoint, cyberark, okta] = await Promise.all([
    entraAdapter.correlateApp(appName),
    sailpointAdapter.correlateApp(appName),
    cyberarkAdapter.correlateApp(appName),
    oktaAdapter.correlateApp(appName),
  ]);
  res.json({ success: true, data: { appName, correlations: { entra, sailpoint, cyberark, okta } }, timestamp: new Date().toISOString() });
});

export default router;
