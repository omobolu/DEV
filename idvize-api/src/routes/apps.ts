import { Router, Request, Response } from 'express';
import { applications } from '../data/applications';
import { discoverCapabilities, discoverAllCapabilities, recommendIntegrationPath } from '../services/capabilityDiscovery';
import { ApiResponse, Application, AppCapability } from '../types';

const router = Router();

// GET /api/apps — list all applications
router.get('/', (_req: Request, res: Response) => {
  const response: ApiResponse<Application[]> = {
    success: true,
    data: applications,
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

// GET /api/apps/:id — get a single app
router.get('/:id', (req: Request, res: Response) => {
  const app = applications.find(a => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ success: false, error: 'Application not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: app, timestamp: new Date().toISOString() });
});

// GET /api/apps/:id/capabilities — get integration capabilities for an app
router.get('/:id/capabilities', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const capability = discoverCapabilities(id);
  if (!capability) {
    res.status(404).json({ success: false, error: 'Application not found', timestamp: new Date().toISOString() });
    return;
  }

  const recommendation = recommendIntegrationPath(capability.detectedProtocols);
  const response: ApiResponse<AppCapability & { recommendation: string }> = {
    success: true,
    data: { ...capability, recommendation },
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

// GET /api/apps/capabilities/all — capabilities for all apps
router.get('/capabilities/all', (_req: Request, res: Response) => {
  const all = discoverAllCapabilities();
  const response: ApiResponse<AppCapability[]> = {
    success: true,
    data: all,
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

export default router;
