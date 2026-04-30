import { Router, Request, Response } from 'express';
import { costService } from './cost.service';
import { costIntelligenceAgent } from '../../agents/cost-intelligence.agent';
import { Vendor, PersonCost } from './cost.types';
import { requireAuth } from '../../middleware/requireAuth';
import { tenantContext } from '../../middleware/tenantContext';
import { requirePermission } from '../../middleware/requirePermission';

const router = Router();

// Auto-seed on first request (tenantContext must run first so tenantId is available)
router.use(requireAuth, tenantContext, (req, _res, next) => { costService.ensureSeeded(req.tenantId!); next(); });

// ── Agent ─────────────────────────────────────────────────────────────────────

// POST /cost/analyze — run full Cost Intelligence Agent analysis
router.post('/analyze', requirePermission('cost.view.summary'), async (req: Request, res: Response) => {
  const report = await costService.runCostAnalysis(req.tenantId!);
  res.json({ success: true, data: report, timestamp: new Date().toISOString() });
});

// POST /cost/analyze/ai — Claude-powered deep analysis (tool-use + adaptive thinking)
router.post('/analyze/ai', requirePermission('cost.view.summary'), async (req: Request, res: Response) => {
  console.log('[POST /cost/analyze/ai] Starting AI analysis...');
  const result = await costIntelligenceAgent.runWithAI(req.tenantId!);
  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
});

// GET /cost/agent/status — agent status + last run metadata
router.get('/agent/status', requirePermission('cost.view.summary'), (req: Request, res: Response) => {
  res.json({ success: true, data: costService.getAgentStatus(req.tenantId!), timestamp: new Date().toISOString() });
});

// GET /cost/report — last full report (without re-running)
router.get('/report', requirePermission('cost.view.summary'), (req: Request, res: Response) => {
  const report = costService.getLastReport(req.tenantId!);
  if (!report) {
    res.status(404).json({ success: false, error: 'No report generated yet. POST /cost/analyze first.', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: report, timestamp: new Date().toISOString() });
});

// ── Core Endpoints ────────────────────────────────────────────────────────────

// GET /cost/summary — cost breakdown (people + tech + partners)
router.get('/summary', requirePermission('cost.view.summary'), (req: Request, res: Response) => {
  const summary = costService.getCostSummary(req.tenantId!);
  res.json({ success: true, data: summary, timestamp: new Date().toISOString() });
});

// GET /cost/vendor-analysis — all vendor impact reports
router.get('/vendor-analysis', requirePermission('cost.view.vendor_analysis'), (req: Request, res: Response) => {
  const { vendorImpactEngine } = require('./engines/vendor-impact.engine');
  const type = req.query.type as string | undefined;
  let impacts = vendorImpactEngine.analyzeAll(req.tenantId!);
  if (type) impacts = impacts.filter((i: { vendorType: string }) => i.vendorType === type);
  res.json({ success: true, data: { total: impacts.length, vendors: impacts }, timestamp: new Date().toISOString() });
});

// GET /cost/vendor-analysis/:vendorId — single vendor impact
router.get('/vendor-analysis/:vendorId', requirePermission('cost.view.vendor_analysis'), (req: Request, res: Response) => {
  const { vendorImpactEngine } = require('./engines/vendor-impact.engine');
  const impact = vendorImpactEngine.analyzeVendor(req.tenantId!, req.params.vendorId as string);
  if (!impact) {
    res.status(404).json({ success: false, error: 'Vendor not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: impact, timestamp: new Date().toISOString() });
});

// GET /cost/optimization — optimization opportunities
router.get('/optimization', requirePermission('cost.view.optimization'), (req: Request, res: Response) => {
  const report = costService.getOptimizationReport(req.tenantId!);
  res.json({ success: true, data: report, timestamp: new Date().toISOString() });
});

// ── Contracts ─────────────────────────────────────────────────────────────────

// POST /contracts/upload — ingest a contract or SOW
router.post('/contracts', requirePermission('vendors.manage'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { vendorId, annualCost, description } = req.body;
  if (!vendorId || !annualCost || !description) {
    res.status(400).json({ success: false, error: '"vendorId", "annualCost", and "description" are required', timestamp: new Date().toISOString() });
    return;
  }
  const contract = costService.upsertContract(tenantId, req.body);
  res.status(201).json({ success: true, data: contract, timestamp: new Date().toISOString() });
});

// GET /cost/contracts — list all contracts
router.get('/contracts', requirePermission('cost.view.summary'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { vendorId } = req.query;
  const contracts = costService.listContracts(tenantId, vendorId as string | undefined);
  res.json({ success: true, data: { total: contracts.length, contracts }, timestamp: new Date().toISOString() });
});

// ── Vendors ───────────────────────────────────────────────────────────────────

// POST /cost/vendors — create/update vendor
router.post('/vendors', requirePermission('vendors.manage'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { name, type } = req.body;
  if (!name || !type) {
    res.status(400).json({ success: false, error: '"name" and "type" are required', timestamp: new Date().toISOString() });
    return;
  }
  const vendor = costService.upsertVendor(tenantId, req.body);
  res.status(201).json({ success: true, data: vendor, timestamp: new Date().toISOString() });
});

// GET /cost/vendors — list vendors (optional ?type= filter)
router.get('/vendors', requirePermission('vendors.view'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const type = req.query.type as Vendor['type'] | undefined;
  const vendors = costService.listVendors(tenantId, type);
  res.json({ success: true, data: { total: vendors.length, vendors }, timestamp: new Date().toISOString() });
});

// ── People ────────────────────────────────────────────────────────────────────

// POST /cost/people — add a person cost record
router.post('/people', requirePermission('cost.view.salary_detail'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { name, role, employmentType, annualCost } = req.body;
  if (!name || !role || !employmentType || !annualCost) {
    res.status(400).json({ success: false, error: '"name", "role", "employmentType", and "annualCost" required', timestamp: new Date().toISOString() });
    return;
  }
  const person = costService.addPersonCost(tenantId, req.body);
  res.status(201).json({ success: true, data: person, timestamp: new Date().toISOString() });
});

// GET /cost/people — list people cost records
router.get('/people', requirePermission('cost.view.salary_detail'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const type = req.query.type as PersonCost['employmentType'] | undefined;
  const people = costService.listPeople(tenantId, type);
  res.json({ success: true, data: { total: people.length, people }, timestamp: new Date().toISOString() });
});

export default router;
