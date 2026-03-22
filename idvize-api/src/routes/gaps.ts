import { Router, Request, Response } from 'express';
import { detectGaps, detectGapsForApp } from '../services/gapDetection';
import { ApiResponse, GapSummary } from '../types';

const router = Router();

// GET /api/gaps — all gaps across all apps
router.get('/', (_req: Request, res: Response) => {
  const summary = detectGaps();
  const response: ApiResponse<GapSummary> = {
    success: true,
    data: summary,
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

// GET /api/gaps/:appId — gaps for a specific app
router.get('/:appId', (req: Request, res: Response) => {
  const appId = Array.isArray(req.params.appId) ? req.params.appId[0] : req.params.appId;
  const summary = detectGapsForApp(appId);
  const response: ApiResponse<GapSummary> = {
    success: true,
    data: summary,
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

export default router;
