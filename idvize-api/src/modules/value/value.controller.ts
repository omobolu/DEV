/**
 * Module 10 — Business Value & Risk Intelligence
 * Quantifies the financial value of IAM controls and the cost of gaps.
 *
 * Endpoints:
 *   GET  /value/summary      — portfolio-level KPIs, tier breakdown, top risks
 *   GET  /value/applications — per-app value profiles (sortable)
 *   GET  /value/controls     — per-control value attribution
 *   POST /value/simulate     — what-if scenario analysis
 *   GET  /value/presets      — available simulation presets
 */

import { Router, Request, Response } from 'express';
import { applicationRepository } from '../application/application.repository';
import { DEFAULT_ASSUMPTIONS } from './value.assumptions';
import {
  computePortfolioValue,
  computeControlValues,
  buildPortfolioSummary,
  simulateScenario,
} from './value.engine';
import { SimulationInput, ControlKey } from './value.types';

const router = Router();

// ── GET /value/summary ────────────────────────────────────────────────────────
router.get('/summary', (_req: Request, res: Response) => {
  const apps = applicationRepository.findAll();
  const profiles      = computePortfolioValue(apps, DEFAULT_ASSUMPTIONS);
  const controlValues = computeControlValues(profiles, DEFAULT_ASSUMPTIONS);
  const portfolio     = buildPortfolioSummary(profiles, controlValues, DEFAULT_ASSUMPTIONS);

  res.json({
    success: true,
    data: {
      portfolio,
      controls:    controlValues,
      assumptions: DEFAULT_ASSUMPTIONS,
    },
    generatedAt: new Date().toISOString(),
  });
});

// ── GET /value/applications ───────────────────────────────────────────────────
router.get('/applications', (req: Request, res: Response) => {
  const apps     = applicationRepository.findAll();
  const sort     = (req.query.sort as string) ?? 'exposure';
  const tierFilter = req.query.tier as string | undefined;

  let profiles = computePortfolioValue(apps, DEFAULT_ASSUMPTIONS);
  if (tierFilter) profiles = profiles.filter(p => p.riskTier === tierFilter);

  const sorters: Record<string, (a: typeof profiles[0], b: typeof profiles[0]) => number> = {
    exposure: (a, b) => b.currentAnnualExposure   - a.currentAnnualExposure,
    value:    (a, b) => b.valueProtected          - a.valueProtected,
    roi:      (a, b) => b.roi                     - a.roi,
    gap:      (a, b) => b.potentialAdditionalValue - a.potentialAdditionalValue,
    base:     (a, b) => b.baseAnnualExposure       - a.baseAnnualExposure,
  };
  profiles.sort(sorters[sort] ?? sorters.exposure);

  res.json({
    success: true,
    data: { applications: profiles, total: profiles.length },
    timestamp: new Date().toISOString(),
  });
});

// ── GET /value/controls ───────────────────────────────────────────────────────
router.get('/controls', (_req: Request, res: Response) => {
  const apps          = applicationRepository.findAll();
  const profiles      = computePortfolioValue(apps, DEFAULT_ASSUMPTIONS);
  const controlValues = computeControlValues(profiles, DEFAULT_ASSUMPTIONS);
  controlValues.sort((a, b) => b.totalValueProtected - a.totalValueProtected);

  res.json({
    success: true,
    data: { controls: controlValues },
    timestamp: new Date().toISOString(),
  });
});

// ── Preset scenarios ──────────────────────────────────────────────────────────
const PRESETS: Record<string, SimulationInput> = {
  'extend-mfa-critical': {
    scenarioName: 'Extend MFA to all critical apps',
    changes: [{ type: 'add-control', control: 'mfa' as ControlKey, applyToTier: 'critical' }],
  },
  'extend-pam-critical': {
    scenarioName: 'Vault all critical privileged accounts (PAM)',
    changes: [{ type: 'add-control', control: 'pam' as ControlKey, applyToTier: 'critical' }],
  },
  'extend-mfa-high': {
    scenarioName: 'Extend MFA to all high-risk apps',
    changes: [{ type: 'add-control', control: 'mfa' as ControlKey, applyToTier: 'high' }],
  },
  'extend-sso-medium': {
    scenarioName: 'Extend SSO to all medium-risk apps',
    changes: [{ type: 'add-control', control: 'sso' as ControlKey, applyToTier: 'medium' }],
  },
  'extend-jml-high': {
    scenarioName: 'Automate JML on all high-risk apps',
    changes: [{ type: 'add-control', control: 'jml' as ControlKey, applyToTier: 'high' }],
  },
  'full-critical-coverage': {
    scenarioName: 'Full IAM coverage on all critical apps',
    changes: [{ type: 'close-all-gaps', tier: 'critical' }],
  },
  'full-portfolio-coverage': {
    scenarioName: 'Full IAM coverage across entire portfolio',
    changes: [{ type: 'close-all-gaps', tier: 'all' }],
  },
};

// ── GET /value/presets ─────────────────────────────────────────────────────────
router.get('/presets', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.entries(PRESETS).map(([id, s]) => ({
      scenarioId:   id,
      scenarioName: s.scenarioName,
    })),
  });
});

// ── POST /value/simulate ──────────────────────────────────────────────────────
router.post('/simulate', (req: Request, res: Response) => {
  const body = req.body as { scenarioId?: string } & Partial<SimulationInput>;

  let input: SimulationInput;

  if (body.scenarioId && PRESETS[body.scenarioId]) {
    input = PRESETS[body.scenarioId];
  } else if (body.scenarioName && Array.isArray(body.changes) && body.changes.length > 0) {
    input = { scenarioName: body.scenarioName, changes: body.changes as SimulationInput['changes'] };
  } else {
    res.status(400).json({
      success: false,
      error: 'Provide scenarioId (see GET /value/presets) or { scenarioName, changes }',
      availablePresets: Object.keys(PRESETS),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const apps   = applicationRepository.findAll();
  const result = simulateScenario(apps, input, DEFAULT_ASSUMPTIONS);

  res.json({
    success: true,
    data: result,
    availablePresets: Object.keys(PRESETS),
    timestamp: new Date().toISOString(),
  });
});

export default router;
