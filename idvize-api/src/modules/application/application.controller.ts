import { Router, Request, Response } from 'express';
import { applicationService } from './application.service';
import { ApplicationQuery } from './application.types';
import { requireAuth } from '../../middleware/requireAuth';
import { tenantContext } from '../../middleware/tenantContext';

const router = Router();

router.use(requireAuth, tenantContext);

// POST /applications/import — bulk import from raw JSON array or CSV text
router.post('/import', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { rows, csv, source } = req.body as {
    rows?: Record<string, unknown>[];
    csv?: string;
    source?: string;
  };

  if (csv) {
    const result = applicationService.importFromCsv(tenantId, csv);
    res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() });
    return;
  }

  if (rows && Array.isArray(rows)) {
    const result = applicationService.importApplications(tenantId, rows as any[], (source as any) ?? 'api');
    res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() });
    return;
  }

  res.status(400).json({ success: false, error: 'Provide either "rows" (array) or "csv" (string) in request body', timestamp: new Date().toISOString() });
});

// POST /applications — create/upsert a single application
router.post('/', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  if (!req.body?.name) {
    res.status(400).json({ success: false, error: '"name" is required', timestamp: new Date().toISOString() });
    return;
  }
  const app = applicationService.upsertApplication(tenantId, req.body);
  res.status(201).json({ success: true, data: app, timestamp: new Date().toISOString() });
});

// GET /applications — list with optional filters
router.get('/', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const query: ApplicationQuery = {
    riskTier: req.query.riskTier as any,
    department: req.query.department as string,
    search: req.query.search as string,
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
  };
  const { apps, total } = applicationService.listApplications(tenantId, query);
  res.json({ success: true, data: { apps, total, page: query.page ?? 1 }, timestamp: new Date().toISOString() });
});

// GET /applications/:id — get single application
router.get('/:id', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const app = applicationService.getApplication(tenantId, req.params.id as string);
  if (!app) {
    res.status(404).json({ success: false, error: 'Application not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: app, timestamp: new Date().toISOString() });
});

// PATCH /applications/:id — update application fields (e.g. technicalSme)
router.patch('/:id', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const appId = req.params.id as string;
  const existing = applicationService.getApplication(tenantId, appId);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Application not found', timestamp: new Date().toISOString() });
    return;
  }

  const allowedFields = ['technicalSme', 'technicalSmeEmail', 'owner', 'ownerEmail', 'supportContact', 'department'] as const;
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  const updated = applicationService.updateFields(tenantId, appId, updates as any);
  if (!updated) {
    res.status(404).json({ success: false, error: 'Application not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
});

export default router;
