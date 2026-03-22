import { Router, Request, Response } from 'express';
import { applicationService } from './application.service';
import { ApplicationQuery } from './application.types';

const router = Router();

// POST /applications/import — bulk import from raw JSON array or CSV text
router.post('/import', (req: Request, res: Response) => {
  const { rows, csv, source } = req.body as {
    rows?: Record<string, unknown>[];
    csv?: string;
    source?: string;
  };

  if (csv) {
    const result = applicationService.importFromCsv(csv);
    res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() });
    return;
  }

  if (rows && Array.isArray(rows)) {
    const result = applicationService.importApplications(rows as any[], (source as any) ?? 'api');
    res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() });
    return;
  }

  res.status(400).json({ success: false, error: 'Provide either "rows" (array) or "csv" (string) in request body', timestamp: new Date().toISOString() });
});

// POST /applications — create/upsert a single application
router.post('/', (req: Request, res: Response) => {
  if (!req.body?.name) {
    res.status(400).json({ success: false, error: '"name" is required', timestamp: new Date().toISOString() });
    return;
  }
  const app = applicationService.upsertApplication(req.body);
  res.status(201).json({ success: true, data: app, timestamp: new Date().toISOString() });
});

// GET /applications — list with optional filters
router.get('/', (req: Request, res: Response) => {
  const query: ApplicationQuery = {
    riskTier: req.query.riskTier as any,
    department: req.query.department as string,
    search: req.query.search as string,
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
  };
  const { apps, total } = applicationService.listApplications(query);
  res.json({ success: true, data: { apps, total, page: query.page ?? 1 }, timestamp: new Date().toISOString() });
});

// GET /applications/:id — get single application
router.get('/:id', (req: Request, res: Response) => {
  const app = applicationService.getApplication(req.params.id as string);
  if (!app) {
    res.status(404).json({ success: false, error: 'Application not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: app, timestamp: new Date().toISOString() });
});

export default router;
