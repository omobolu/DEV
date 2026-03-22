import { Router, Request, Response } from 'express';
import { controlService } from './control.service';

const router = Router();

// POST /controls/evaluate — evaluate controls for one or all applications
router.post('/evaluate', async (req: Request, res: Response) => {
  const { appId, evaluateAll, forceRefresh } = req.body as {
    appId?: string;
    evaluateAll?: boolean;
    forceRefresh?: boolean;
  };

  if (evaluateAll) {
    const results = await controlService.evaluateAll();
    res.json({ success: true, data: { total: results.length, results }, timestamp: new Date().toISOString() });
    return;
  }

  if (!appId) {
    res.status(400).json({ success: false, error: '"appId" or "evaluateAll: true" required', timestamp: new Date().toISOString() });
    return;
  }

  const result = await controlService.evaluateApp(appId, forceRefresh ?? false);
  if (!result) {
    res.status(404).json({ success: false, error: `Application ${appId} not found`, timestamp: new Date().toISOString() });
    return;
  }

  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
});

// GET /controls/:appId — get cached control evaluation for an app
router.get('/:appId', async (req: Request, res: Response) => {
  const appId = req.params.appId as string;
  let result = controlService.getFromCache(appId);

  if (!result) {
    // Run fresh evaluation
    result = await controlService.evaluateApp(appId) ?? undefined;
  }

  if (!result) {
    res.status(404).json({ success: false, error: `No control evaluation found for ${appId}. Import the application first.`, timestamp: new Date().toISOString() });
    return;
  }

  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
});

// GET /controls — evaluation summary for all apps
router.get('/', (_req: Request, res: Response) => {
  const summary = controlService.getCacheSummary();
  res.json({ success: true, data: summary, timestamp: new Date().toISOString() });
});

export default router;
