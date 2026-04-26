import { Router, Request, Response } from 'express';
import { documentService } from './document.service';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import { tenantContext } from '../../middleware/tenantContext';

const router = Router();

// Auto-seed on first request (tenantContext must run first so tenantId is available)
router.use(requireAuth, tenantContext, (req, _res, next) => { documentService.ensureSeeded(req.tenantId!); next(); });

// ── List & Stats ──────────────────────────────────────────────────────────────

// GET /documents — list all documents (permission: document.view)
router.get('/', requirePermission('document.view'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { status } = req.query;
  const docs = status
    ? documentService.listByStatus(tenantId, String(status) as Document['status'])
    : documentService.listAll(tenantId);
  res.json({ success: true, data: docs, total: docs.length, timestamp: new Date().toISOString() });
});

// GET /documents/stats — aggregate stats
router.get('/stats', requirePermission('document.view'), (req: Request, res: Response) => {
  res.json({ success: true, data: documentService.getStats(req.tenantId!), timestamp: new Date().toISOString() });
});

// GET /documents/:id — single document with all versions + reviews
router.get('/:id', requirePermission('document.view'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const doc = documentService.getById(tenantId, String(req.params.id));
  if (!doc) {
    res.status(404).json({ success: false, error: 'Document not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: doc, timestamp: new Date().toISOString() });
});

// ── Create / Update ───────────────────────────────────────────────────────────

// POST /documents — create new document (permission: document.view is enough to create)
router.post('/', requirePermission('document.view'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { title, category, content, tags, changeNote } = req.body;
  if (!title || !category || !content) {
    res.status(400).json({ success: false, error: 'title, category, and content are required', timestamp: new Date().toISOString() });
    return;
  }
  const owner = (req as any).user?.email ?? 'anonymous@idvize.io';
  const doc = documentService.create(tenantId, { title, category, content, tags, changeNote, owner });
  res.status(201).json({ success: true, data: doc, timestamp: new Date().toISOString() });
});

// PATCH /documents/:id — update content (creates new version)
router.patch('/:id', requirePermission('document.view'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { content, changeNote, title, category, owner, tags } = req.body;
  if (!content || !changeNote) {
    res.status(400).json({ success: false, error: 'content and changeNote are required', timestamp: new Date().toISOString() });
    return;
  }
  const editorEmail = (req as any).user?.email ?? 'anonymous@idvize.io';
  try {
    const doc = documentService.update(tenantId, String(req.params.id), { content, changeNote, title, category, owner, tags }, editorEmail);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found', timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: doc, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

// ── Workflow ──────────────────────────────────────────────────────────────────

// POST /documents/:id/submit — submit draft for review
router.post('/:id/submit', requirePermission('document.view'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  try {
    const doc = documentService.submitForReview(tenantId, String(req.params.id));
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found', timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: doc, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

// POST /documents/:id/review — approve or reject (permission: document.review)
router.post('/:id/review', requirePermission('document.review'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { outcome, comments } = req.body;
  if (!outcome || !['approved', 'rejected'].includes(outcome)) {
    res.status(400).json({ success: false, error: 'outcome must be "approved" or "rejected"', timestamp: new Date().toISOString() });
    return;
  }
  const reviewerEmail = (req as any).user?.email ?? 'anonymous@idvize.io';
  try {
    const doc = documentService.review(tenantId, String(req.params.id), { outcome, comments }, reviewerEmail);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found', timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: doc, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

// POST /documents/:id/publish — publish approved document (permission: document.publish)
router.post('/:id/publish', requirePermission('document.publish'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const publisherEmail = (req as any).user?.email ?? 'anonymous@idvize.io';
  try {
    const doc = documentService.publish(tenantId, String(req.params.id), publisherEmail);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found', timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: doc, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

// POST /documents/:id/archive — archive document
router.post('/:id/archive', requirePermission('document.publish'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  try {
    const doc = documentService.archive(tenantId, String(req.params.id));
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found', timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: doc, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

// Expose type for TS — not actually used at runtime
type Document = import('./document.types').Document;

export default router;
