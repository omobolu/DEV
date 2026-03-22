import { Router, Request, Response } from 'express';
import { documentService } from './document.service';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';

const router = Router();

// Auto-seed on first request
router.use((_req, _res, next) => { documentService.ensureSeeded(); next(); });

// ── List & Stats ──────────────────────────────────────────────────────────────

// GET /documents — list all documents (permission: document.view)
router.get('/', requireAuth, requirePermission('document.view'), (req: Request, res: Response) => {
  const { status } = req.query;
  const docs = status
    ? documentService.listByStatus(String(status) as Document['status'])
    : documentService.listAll();
  res.json({ success: true, data: docs, total: docs.length, timestamp: new Date().toISOString() });
});

// GET /documents/stats — aggregate stats
router.get('/stats', requireAuth, requirePermission('document.view'), (_req: Request, res: Response) => {
  res.json({ success: true, data: documentService.getStats(), timestamp: new Date().toISOString() });
});

// GET /documents/:id — single document with all versions + reviews
router.get('/:id', requireAuth, requirePermission('document.view'), (req: Request, res: Response) => {
  const doc = documentService.getById(String(req.params.id));
  if (!doc) {
    res.status(404).json({ success: false, error: 'Document not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: doc, timestamp: new Date().toISOString() });
});

// ── Create / Update ───────────────────────────────────────────────────────────

// POST /documents — create new document (permission: document.view is enough to create)
router.post('/', requireAuth, requirePermission('document.view'), (req: Request, res: Response) => {
  const { title, category, content, tags, changeNote } = req.body;
  if (!title || !category || !content) {
    res.status(400).json({ success: false, error: 'title, category, and content are required', timestamp: new Date().toISOString() });
    return;
  }
  const owner = (req as any).user?.email ?? 'anonymous@idvize.io';
  const doc = documentService.create({ title, category, content, tags, changeNote, owner });
  res.status(201).json({ success: true, data: doc, timestamp: new Date().toISOString() });
});

// PATCH /documents/:id — update content (creates new version)
router.patch('/:id', requireAuth, requirePermission('document.view'), (req: Request, res: Response) => {
  const { content, changeNote, title, category, owner, tags } = req.body;
  if (!content || !changeNote) {
    res.status(400).json({ success: false, error: 'content and changeNote are required', timestamp: new Date().toISOString() });
    return;
  }
  const editorEmail = (req as any).user?.email ?? 'anonymous@idvize.io';
  try {
    const doc = documentService.update(String(req.params.id), { content, changeNote, title, category, owner, tags }, editorEmail);
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
router.post('/:id/submit', requireAuth, requirePermission('document.view'), (req: Request, res: Response) => {
  try {
    const doc = documentService.submitForReview(String(req.params.id));
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
router.post('/:id/review', requireAuth, requirePermission('document.review'), (req: Request, res: Response) => {
  const { outcome, comments } = req.body;
  if (!outcome || !['approved', 'rejected'].includes(outcome)) {
    res.status(400).json({ success: false, error: 'outcome must be "approved" or "rejected"', timestamp: new Date().toISOString() });
    return;
  }
  const reviewerEmail = (req as any).user?.email ?? 'anonymous@idvize.io';
  try {
    const doc = documentService.review(String(req.params.id), { outcome, comments }, reviewerEmail);
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
router.post('/:id/publish', requireAuth, requirePermission('document.publish'), (req: Request, res: Response) => {
  const publisherEmail = (req as any).user?.email ?? 'anonymous@idvize.io';
  try {
    const doc = documentService.publish(String(req.params.id), publisherEmail);
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
router.post('/:id/archive', requireAuth, requirePermission('document.publish'), (req: Request, res: Response) => {
  try {
    const doc = documentService.archive(String(req.params.id));
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
