import { Router, Request, Response } from 'express';
import { applicationService } from './application.service';
import { ApplicationQuery } from './application.types';
import { requireAuth } from '../../middleware/requireAuth';
import { tenantContext } from '../../middleware/tenantContext';
import { requirePermission } from '../../middleware/requirePermission';
import { auditService } from '../security/audit/audit.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECIPIENT_FIELDS = ['ownerEmail', 'technicalSmeEmail', 'supportContact'] as const;

function validateRecipientEmails(body: Record<string, unknown>): string | null {
  for (const field of RECIPIENT_FIELDS) {
    const val = body[field];
    if (val !== undefined && val !== null && val !== '') {
      if (typeof val !== 'string' || !EMAIL_RE.test(val)) {
        return `"${field}" must be a valid email address`;
      }
    }
  }
  return null;
}

function sanitizeRecipientEmails(body: Record<string, unknown>): void {
  for (const field of RECIPIENT_FIELDS) {
    const val = body[field];
    if (val !== undefined && val !== null && val !== '') {
      if (typeof val !== 'string' || !EMAIL_RE.test(val)) {
        body[field] = '';
      }
    }
  }
}

const router = Router();

router.use(requireAuth, tenantContext);

// POST /applications/import — bulk import from raw JSON array or CSV text
router.post('/import', requirePermission('applications.manage'), (req: Request, res: Response) => {
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
    for (const row of rows) {
      if (row && typeof row === 'object') sanitizeRecipientEmails(row as Record<string, unknown>);
    }
    const result = applicationService.importApplications(tenantId, rows as any[], (source as any) ?? 'api');
    res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() });
    return;
  }

  res.status(400).json({ success: false, error: 'Provide either "rows" (array) or "csv" (string) in request body', timestamp: new Date().toISOString() });
});

// POST /applications — create/upsert a single application
router.post('/', requirePermission('applications.manage'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  if (!req.body?.name) {
    res.status(400).json({ success: false, error: '"name" is required', timestamp: new Date().toISOString() });
    return;
  }
  const emailErr = validateRecipientEmails(req.body);
  if (emailErr) {
    res.status(400).json({ success: false, error: emailErr, timestamp: new Date().toISOString() });
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
router.patch('/:id', requirePermission('applications.manage'), async (req: Request, res: Response) => {
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
      const val = req.body[field];
      if (typeof val !== 'string' || val.length > 500) {
        res.status(400).json({ success: false, error: `"${field}" must be a string (max 500 chars)`, timestamp: new Date().toISOString() });
        return;
      }
      if ((field.endsWith('Email') || field === 'supportContact') && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        res.status(400).json({ success: false, error: `"${field}" must be a valid email address`, timestamp: new Date().toISOString() });
        return;
      }
      updates[field] = val;
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ success: false, error: 'No valid fields to update', timestamp: new Date().toISOString() });
    return;
  }

  const updated = applicationService.updateFields(tenantId, appId, updates as any);
  if (!updated) {
    res.status(404).json({ success: false, error: 'Application not found', timestamp: new Date().toISOString() });
    return;
  }

  await auditService.log({
    tenantId,
    eventType: 'application.updated',
    actorId: req.user?.sub ?? 'unknown',
    actorName: req.user?.name ?? 'unknown',
    targetId: appId,
    targetType: 'application',
    resource: `/applications/${appId}`,
    outcome: 'success',
    metadata: { updatedFields: Object.keys(updates) },
  });

  res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
});

export default router;
