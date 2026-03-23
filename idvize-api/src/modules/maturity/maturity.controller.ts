/**
 * Maturity API Routes
 *
 * GET  /maturity/summary          — overall score + domain list + top recs
 * GET  /maturity/domains          — all domain scores with indicators
 * GET  /maturity/domains/:domainId — single domain drill-down
 * POST /maturity/recalculate      — trigger a fresh assessment run
 * GET  /maturity/history          — list of past assessment runs (lightweight)
 */

import { Router, Request, Response } from 'express';
import { maturityService } from './maturity.service';
import { requireAuth }     from '../../middleware/requireAuth';

const router = Router();

// GET /maturity/summary
router.get('/summary', requireAuth, async (_req: Request, res: Response) => {
  try {
    const run = await maturityService.getOrRunAssessment();
    res.json({ success: true, data: maturityService.buildSummary(run), timestamp: new Date().toISOString() });
  } catch (e: unknown) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Error', timestamp: new Date().toISOString() });
  }
});

// GET /maturity/domains
router.get('/domains', requireAuth, async (_req: Request, res: Response) => {
  try {
    const run = await maturityService.getOrRunAssessment();
    res.json({
      success: true,
      data: {
        runId:    run.runId,
        overall:  run.score.overall,
        level:    run.score.level,
        domains:  run.score.domains,
        explanations: run.explanations,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Error', timestamp: new Date().toISOString() });
  }
});

// GET /maturity/domains/:domainId
router.get('/domains/:domainId', requireAuth, async (req: Request, res: Response) => {
  try {
    const run = await maturityService.getOrRunAssessment();
    const domainId = String(req.params.domainId);
    const domain = run.score.domains.find(d => d.domainId === domainId);
    if (!domain) {
      res.status(404).json({ success: false, error: `Domain '${domainId}' not found`, timestamp: new Date().toISOString() });
      return;
    }
    const explanation = run.explanations.find(e => e.domainId === domainId);
    const recommendations = run.recommendations.filter(r => r.domainId === domainId);
    res.json({
      success: true,
      data: { domain, explanation, recommendations, runId: run.runId },
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Error', timestamp: new Date().toISOString() });
  }
});

// POST /maturity/recalculate
router.post('/recalculate', requireAuth, async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.sub ?? 'anonymous';
    const run = await maturityService.runAssessment(actorId);
    res.json({
      success: true,
      data:    maturityService.buildSummary(run),
      message: `Assessment complete: ${run.score.overall}/100 (${run.score.level})`,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    res.status(msg.includes('in progress') ? 409 : 500).json({ success: false, error: msg, timestamp: new Date().toISOString() });
  }
});

// GET /maturity/history
router.get('/history', requireAuth, (_req: Request, res: Response) => {
  const history = maturityRepository_local();
  res.json({ success: true, data: history, timestamp: new Date().toISOString() });
});

// Lazy import to avoid circular
function maturityRepository_local() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { maturityRepository } = require('./maturity.repository');
  return maturityRepository.history().map((r: {
    runId: string; triggeredBy: string; triggeredAt: string; completedAt: string;
    score: { overall: number; level: string; confidence: number };
    evidenceCount: number; lowConfidenceCount: number;
    recommendations: unknown[];
  }) => ({
    runId:              r.runId,
    triggeredBy:        r.triggeredBy,
    triggeredAt:        r.triggeredAt,
    completedAt:        r.completedAt,
    overall:            r.score.overall,
    level:              r.score.level,
    confidence:         r.score.confidence,
    evidenceCount:      r.evidenceCount,
    lowConfidenceCount: r.lowConfidenceCount,
    recommendationCount: r.recommendations.length,
  }));
}

export default router;
