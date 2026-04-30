import { Router, Request, Response } from 'express';
import { igaService } from './iga.service';
import { requireAuth } from '../../middleware/requireAuth';
import { tenantContext } from '../../middleware/tenantContext';
import { requirePermission } from '../../middleware/requirePermission';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

// Apply auth and tenant context to all routes
router.use(requireAuth, tenantContext);

// ── SNOW Tickets ─────────────────────────────────────────────────────────────

// GET /iga/snow/tickets — list all tickets
router.get('/snow/tickets', asyncHandler(async (req: Request, res: Response) => {
  const tickets = igaService.listTickets(req.tenantId!);
  res.json({ success: true, data: tickets, timestamp: new Date().toISOString() });
}));

// GET /iga/snow/tickets/:id — get single ticket
router.get('/snow/tickets/:id', asyncHandler(async (req: Request, res: Response) => {
  const ticket = igaService.getTicket(req.tenantId!, String(req.params.id));
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: ticket, timestamp: new Date().toISOString() });
}));

// POST /iga/snow/tickets/:id/accept — accept a ticket
router.post('/snow/tickets/:id/accept', requirePermission('iga.manage'), asyncHandler(async (req: Request, res: Response) => {
  const acceptedBy = (req as any).user?.email ?? 'anonymous@idvize.io';
  try {
    const ticket = igaService.acceptTicket(req.tenantId!, String(req.params.id), acceptedBy);
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found', timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: ticket, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
}));

// POST /iga/snow/tickets/:id/investigate — run investigation
router.post('/snow/tickets/:id/investigate', requirePermission('iga.manage'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const ticket = igaService.investigateTicket(req.tenantId!, String(req.params.id));
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found', timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: ticket, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
}));

// POST /iga/snow/tickets/:id/agent/plan — generate agent plan
router.post('/snow/tickets/:id/agent/plan', requirePermission('iga.manage'), asyncHandler(async (req: Request, res: Response) => {
  const { instructions } = req.body;
  if (!instructions || typeof instructions !== 'string') {
    res.status(400).json({ success: false, error: 'instructions (string) is required', timestamp: new Date().toISOString() });
    return;
  }
  try {
    const ticket = igaService.generateAgentPlan(req.tenantId!, String(req.params.id), instructions);
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found', timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: ticket, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
}));

// POST /iga/snow/tickets/:id/agent/approve — approve agent plan
router.post('/snow/tickets/:id/agent/approve', requirePermission('iga.approve'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const ticket = igaService.approveAgentPlan(req.tenantId!, String(req.params.id));
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found', timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: ticket, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
}));

// POST /iga/snow/tickets/:id/agent/execute — execute agent plan
router.post('/snow/tickets/:id/agent/execute', requirePermission('iga.execute'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const ticket = await igaService.executeAgentPlan(req.tenantId!, String(req.params.id));
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found', timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: ticket, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
}));

// POST /iga/snow/tickets/:id/feedback — submit feedback
router.post('/snow/tickets/:id/feedback', requirePermission('iga.manage'), asyncHandler(async (req: Request, res: Response) => {
  const { feedback } = req.body;
  if (!feedback || typeof feedback !== 'string') {
    res.status(400).json({ success: false, error: 'feedback (string) is required', timestamp: new Date().toISOString() });
    return;
  }
  try {
    const ticket = igaService.submitFeedback(req.tenantId!, String(req.params.id), feedback);
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found', timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: ticket, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
}));

// ── Certifications ───────────────────────────────────────────────────────────

// GET /iga/certifications — list all campaigns
router.get('/certifications', asyncHandler(async (req: Request, res: Response) => {
  const campaigns = igaService.listCampaigns(req.tenantId!);
  res.json({ success: true, data: campaigns, timestamp: new Date().toISOString() });
}));

// GET /iga/certifications/:id — get single campaign
router.get('/certifications/:id', asyncHandler(async (req: Request, res: Response) => {
  const campaign = igaService.getCampaign(req.tenantId!, String(req.params.id));
  if (!campaign) {
    res.status(404).json({ success: false, error: 'Campaign not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: campaign, timestamp: new Date().toISOString() });
}));

export default router;
