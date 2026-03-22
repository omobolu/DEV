import { Router, Request, Response } from 'express';
import { entraConnector } from '../connectors/entra';
import { sailpointConnector } from '../connectors/sailpoint';
import { cyberarkConnector } from '../connectors/cyberark';
import { ApiResponse, ConnectorHealth } from '../types';

const router = Router();

// GET /api/connectors/health — health check for all connectors
router.get('/health', (_req: Request, res: Response) => {
  const health: ConnectorHealth[] = [
    entraConnector.health(),
    sailpointConnector.health(),
    cyberarkConnector.health(),
  ];
  const response: ApiResponse<ConnectorHealth[]> = {
    success: true,
    data: health,
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

// ─── Entra ID ─────────────────────────────────────────────────────────────────

router.get('/entra/apps', async (_req: Request, res: Response) => {
  try {
    const apps = await entraConnector.listApplications();
    res.json({ success: true, data: apps, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

router.post('/entra/apps', async (req: Request, res: Response) => {
  try {
    const app = await entraConnector.registerApplication(req.body);
    res.status(201).json({ success: true, data: app, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

router.post('/entra/conditional-access', async (req: Request, res: Response) => {
  try {
    const result = await entraConnector.createConditionalAccessPolicy(req.body);
    res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

// ─── SailPoint ────────────────────────────────────────────────────────────────

router.get('/sailpoint/sources', async (_req: Request, res: Response) => {
  try {
    const sources = await sailpointConnector.listSources();
    res.json({ success: true, data: sources, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

router.post('/sailpoint/rules', async (req: Request, res: Response) => {
  try {
    const rule = await sailpointConnector.createRule(req.body);
    res.status(201).json({ success: true, data: rule, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

router.post('/sailpoint/rules/generate', (req: Request, res: Response) => {
  try {
    const { appName, attribute, logic } = req.body as { appName: string; attribute: string; logic: string };
    if (!appName || !attribute || !logic) {
      res.status(400).json({ success: false, error: 'appName, attribute, and logic are required', timestamp: new Date().toISOString() });
      return;
    }
    const rule = sailpointConnector.generateAttributeGeneratorRule({ appName, attribute, logic });
    res.json({ success: true, data: rule, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

// ─── CyberArk ─────────────────────────────────────────────────────────────────

router.get('/cyberark/safes', async (_req: Request, res: Response) => {
  try {
    const safes = await cyberarkConnector.listSafes();
    res.json({ success: true, data: safes, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

router.post('/cyberark/safes', async (req: Request, res: Response) => {
  try {
    const safe = await cyberarkConnector.createSafe(req.body);
    res.status(201).json({ success: true, data: safe, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

router.post('/cyberark/accounts', async (req: Request, res: Response) => {
  try {
    const account = await cyberarkConnector.onboardAccount(req.body);
    res.status(201).json({ success: true, data: account, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

router.get('/cyberark/accounts', async (req: Request, res: Response) => {
  try {
    const safeName = req.query.safeName as string | undefined;
    const accounts = await cyberarkConnector.listAccounts(safeName);
    res.json({ success: true, data: accounts, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

export default router;
