import { Router, Request, Response } from 'express';
import { controlService } from './control.service';
import { CONTROLS_CATALOG, CATALOG_SUMMARY, IamPillar } from './control.catalog';
import { controlOverridesStore } from './control.overrides.store';
import { applicationRepository } from '../application/application.repository';
import { IamPosture } from '../application/application.types';

const router = Router();

// ── Posture field → catalog control mapping ────────────────────────────────
// Maps each catalog control to the iamPosture field(s) that indicate it.
// null means there is no automatic detection — status derived from overrides or defaults to 'undetected'.

type PostureDetector = (posture: IamPosture) => boolean | null;

const POSTURE_MAP: Record<string, PostureDetector> = {
  // AM — Access Management
  'AM-001': p => p.ssoEnabled,
  'AM-002': p => p.mfaEnforced,
  'AM-003': p => null,                                           // Passwordless — not in basic posture
  'AM-004': p => null,                                           // Adaptive Auth
  'AM-005': p => p.platforms.some(pl => pl.platform === 'AM' && pl.onboarded) || null,
  'AM-006': p => null,                                           // ABAC
  'AM-007': p => null,                                           // PBAC
  'AM-008': p => p.platforms.some(pl => pl.platform === 'IGA' && pl.onboarded) || null,
  'AM-009': p => null,                                           // Dynamic Access
  'AM-010': p => p.ssoEnabled,                                   // Federation implied by SSO
  'AM-011': p => null,                                           // API Security
  'AM-012': p => (p.ssoEnabled && p.mfaEnforced) ? true : null, // Zero Trust — partial signal
  'AM-013': p => p.mfaEnforced ? true : null,                   // Conditional Access — partial
  'AM-014': p => null,                                           // Temp/Session Access
  'AM-015': p => p.platforms.some(pl => pl.platform === 'AM' && pl.onboarded) || null,

  // IGA — Identity Governance & Administration
  'IGA-001': p => p.jmlAutomated,
  'IGA-002': p => p.scimEnabled,
  'IGA-003': p => p.scimEnabled ? true : null,                   // Role prov implied by SCIM
  'IGA-004': p => null,                                          // JIT Provisioning
  'IGA-005': p => p.certificationsConfigured,
  'IGA-006': p => null,                                          // SoD — no posture field
  'IGA-007': p => null,                                          // Role Mining
  'IGA-008': p => null,                                          // Self-Service Requests
  'IGA-009': p => null,                                          // Approval Workflows
  'IGA-010': p => p.certificationsConfigured,
  'IGA-011': p => null,                                          // Password Management
  'IGA-012': p => null,                                          // Audit — always on at platform level
  'IGA-013': p => null,                                          // AI Governance
  'IGA-014': p => p.platforms.some(pl => pl.platform === 'IGA' && pl.onboarded) || null,
  'IGA-015': p => null,                                          // Policy Enforcement

  // PAM — Privileged Access Management
  'PAM-001': p => p.privilegedAccountsVaulted,
  'PAM-002': p => p.privilegedAccountsVaulted,
  'PAM-003': p => null,                                          // JIT Privilege
  'PAM-004': p => p.platforms.some(pl => pl.platform === 'PAM' && pl.onboarded) || null,
  'PAM-005': p => null,                                          // Least Privilege
  'PAM-006': p => null,                                          // Remote Access
  'PAM-007': p => null,                                          // Threat Detection
  'PAM-008': p => null,                                          // Key Management
  'PAM-009': p => null,                                          // Secrets Management
  'PAM-010': p => p.privilegedAccountsVaulted ? true : null,    // PAM Audit implied by vault

  // CIAM — Customer Identity & Access Management
  'CIAM-001': p => p.platforms.some(pl => pl.platform === 'CIAM' && pl.onboarded) || null,
  'CIAM-002': p => p.platforms.some(pl => pl.platform === 'CIAM' && pl.onboarded) || null,
  'CIAM-003': p => p.mfaEnforced ? true : null,
  'CIAM-004': p => null,
  'CIAM-005': p => null,
  'CIAM-006': p => null,
  'CIAM-007': p => null,
  'CIAM-008': p => null,
  'CIAM-009': p => null,
};

/** Derive a control's detected status for a given app posture */
function detectStatus(controlId: string, posture: IamPosture | undefined): 'detected' | 'gap' | 'undetected' {
  if (!posture) return 'undetected';
  const detector = POSTURE_MAP[controlId];
  if (!detector) return 'undetected';
  const result = detector(posture);
  if (result === null) return 'undetected';
  return result ? 'detected' : 'gap';
}

// ── GET /controls/coverage — per-control coverage across all apps ──────────
router.get('/coverage', (_req: Request, res: Response) => {
  const apps = applicationRepository.findAll();
  const total = apps.length;

  const tierOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const controls = CONTROLS_CATALOG.map(ctrl => {
    let implemented = 0, gap = 0, notApplicable = 0;

    for (const app of apps) {
      const override = controlOverridesStore.get(app.appId, ctrl.controlId);
      if (override?.notApplicable) { notApplicable++; continue; }
      const status = detectStatus(ctrl.controlId, app.iamPosture);
      if (status === 'detected') implemented++;
      else if (status === 'gap') gap++;
    }

    const detectable = implemented + gap;
    const effectiveTotal = total - notApplicable;
    const pct = detectable > 0 ? Math.round((implemented / detectable) * 100) : null;

    return {
      controlId: ctrl.controlId,
      name: ctrl.name,
      pillar: ctrl.pillar,
      riskReduction: ctrl.riskReduction,
      implemented,
      gap,
      undetected: effectiveTotal - implemented - gap,
      notApplicable,
      detectable,
      total,
      pct,
    };
  });

  res.json({ success: true, data: { controls, total }, timestamp: new Date().toISOString() });
});

// ── GET /controls/gaps/:controlId — apps where control is a confirmed gap ──
router.get('/gaps/:controlId', (req: Request, res: Response) => {
  const controlId = req.params.controlId as string;

  const catalogControl = CONTROLS_CATALOG.find(c => c.controlId === controlId);
  if (!catalogControl) {
    res.status(404).json({ success: false, error: `Control ${controlId} not found`, timestamp: new Date().toISOString() });
    return;
  }

  const tierOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const apps = applicationRepository.findAll();
  const gaps: Array<{ appId: string; appName: string; riskTier: string; department: string; status: string }> = [];

  for (const app of apps) {
    const override = controlOverridesStore.get(app.appId, controlId);
    if (override?.notApplicable) continue;
    const status = detectStatus(controlId, app.iamPosture);
    if (status === 'gap') {
      gaps.push({ appId: app.appId, appName: app.name, riskTier: app.riskTier, department: app.department, status: 'gap' });
    }
  }

  gaps.sort((a, b) => (tierOrder[a.riskTier] ?? 4) - (tierOrder[b.riskTier] ?? 4));

  res.json({
    success: true,
    data: { controlId, control: catalogControl, gaps, summary: { total: gaps.length } },
    timestamp: new Date().toISOString(),
  });
});

// ── GET /controls/catalog ──────────────────────────────────────────────────
router.get('/catalog', (req: Request, res: Response) => {
  const pillar   = req.query.pillar   as IamPillar | undefined;
  const category = req.query.category as string    | undefined;
  const tag      = req.query.tag      as string    | undefined;

  let controls = CONTROLS_CATALOG;
  if (pillar)   controls = controls.filter(c => c.pillar === pillar.toUpperCase());
  if (category) controls = controls.filter(c => c.category.toLowerCase() === category.toLowerCase());
  if (tag)      controls = controls.filter(c => c.tags.includes(tag.toLowerCase()));

  const pillars = ['AM', 'IGA', 'PAM', 'CIAM'] as IamPillar[];
  const byPillar = Object.fromEntries(pillars.map(p => [p, controls.filter(c => c.pillar === p)]));

  res.json({
    success: true,
    data: { summary: { ...CATALOG_SUMMARY, filtered: controls.length }, byPillar, controls },
    timestamp: new Date().toISOString(),
  });
});

// ── GET /controls/app/:appId — all 49 controls with per-app status ─────────
router.get('/app/:appId', (req: Request, res: Response) => {
  const appId = req.params.appId as string;
  const app = applicationRepository.findById(appId);
  if (!app) {
    res.status(404).json({ success: false, error: `Application ${appId} not found`, timestamp: new Date().toISOString() });
    return;
  }

  const overrides  = controlOverridesStore.getAll(appId);
  const posture    = app.iamPosture;

  const controls = CONTROLS_CATALOG.map(c => {
    const override = overrides[c.controlId];
    const detected = detectStatus(c.controlId, posture);

    let status: 'implemented' | 'gap' | 'not_applicable' | 'undetected';
    if (override?.notApplicable) {
      status = 'not_applicable';
    } else if (detected === 'detected') {
      status = 'implemented';
    } else if (detected === 'gap') {
      status = 'gap';
    } else {
      status = 'undetected';
    }

    return {
      ...c,
      status,
      notes:     override?.notes     ?? '',
      updatedAt: override?.updatedAt ?? null,
      updatedBy: override?.updatedBy ?? null,
    };
  });

  const summary = {
    total:          controls.length,
    implemented:    controls.filter(c => c.status === 'implemented').length,
    gap:            controls.filter(c => c.status === 'gap').length,
    not_applicable: controls.filter(c => c.status === 'not_applicable').length,
    undetected:     controls.filter(c => c.status === 'undetected').length,
  };

  const pillars = ['AM', 'IGA', 'PAM', 'CIAM'] as IamPillar[];
  const byPillar = Object.fromEntries(pillars.map(p => [p, controls.filter(c => c.pillar === p)]));

  res.json({
    success: true,
    data: { appId, appName: app.name, summary, controls, byPillar },
    timestamp: new Date().toISOString(),
  });
});

// ── PATCH /controls/app/:appId/:controlId — update override ───────────────
router.patch('/app/:appId/:controlId', (req: Request, res: Response) => {
  const appId     = req.params.appId     as string;
  const controlId = req.params.controlId as string;
  const { notApplicable, notes } = req.body as { notApplicable?: boolean; notes?: string };
  const actor = (req as any).user as { name?: string } | undefined;

  const app = applicationRepository.findById(appId);
  if (!app) {
    res.status(404).json({ success: false, error: `Application ${appId} not found`, timestamp: new Date().toISOString() });
    return;
  }

  const catalogControl = CONTROLS_CATALOG.find(c => c.controlId === controlId);
  if (!catalogControl) {
    res.status(404).json({ success: false, error: `Control ${controlId} not found in catalog`, timestamp: new Date().toISOString() });
    return;
  }

  const existing = controlOverridesStore.get(appId, controlId);
  const updated  = controlOverridesStore.set(appId, controlId, {
    notApplicable: notApplicable ?? existing?.notApplicable ?? false,
    notes:         notes         !== undefined ? notes : (existing?.notes ?? ''),
    updatedBy:     actor?.name   ?? 'system',
  });

  res.json({
    success: true,
    data: { appId, controlId, override: updated },
    timestamp: new Date().toISOString(),
  });
});

// ── POST /controls/evaluate ────────────────────────────────────────────────
router.post('/evaluate', async (req: Request, res: Response) => {
  const { appId, evaluateAll, forceRefresh } = req.body as {
    appId?: string; evaluateAll?: boolean; forceRefresh?: boolean;
  };

  if (evaluateAll) {
    const results = await controlService.evaluateAll();
    res.json({ success: true, data: { total: results.length, results }, timestamp: new Date().toISOString() });
    return;
  }

  if (!appId) {
    res.status(400).json({ success: false, error: '"appId" or "evaluateAll: true" required', timestamp: new Date().toISOString() });
    return;
  }

  const result = await controlService.evaluateApp(appId, forceRefresh ?? false);
  if (!result) {
    res.status(404).json({ success: false, error: `Application ${appId} not found`, timestamp: new Date().toISOString() });
    return;
  }

  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
});

// ── GET /controls/:appId — cached evaluation (legacy) ─────────────────────
router.get('/:appId', async (req: Request, res: Response) => {
  // Intercept 'app' prefix to avoid conflicts with /controls/app/:appId
  if ((req.params.appId as string) === 'app') {
    res.status(400).json({ success: false, error: 'Use /controls/app/:appId for per-app catalog view', timestamp: new Date().toISOString() });
    return;
  }
  const appIdLegacy = req.params.appId as string;
  let result = controlService.getFromCache(appIdLegacy);
  if (!result) result = await controlService.evaluateApp(appIdLegacy) ?? undefined;
  if (!result) {
    res.status(404).json({ success: false, error: `No control evaluation found for ${appIdLegacy}.`, timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
});

// ── GET /controls — evaluation summary for all apps ───────────────────────
router.get('/', (_req: Request, res: Response) => {
  const summary = controlService.getCacheSummary();
  res.json({ success: true, data: summary, timestamp: new Date().toISOString() });
});

export default router;
