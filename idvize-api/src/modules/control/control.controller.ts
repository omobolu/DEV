import { Router, Request, Response } from 'express';
import { controlService } from './control.service';
import { CONTROLS_CATALOG, CATALOG_SUMMARY, IamPillar } from './control.catalog';
import { controlOverridesStore } from './control.overrides.store';
import { applicationRepository } from '../application/application.repository';
import { IamPosture } from '../application/application.types';
import { buildService } from '../build/build.service';
import { approvalService } from '../security/approval/approval.service';
import { requireAuth } from '../../middleware/requireAuth';
import { tenantContext } from '../../middleware/tenantContext';

const router = Router();

router.use(requireAuth, tenantContext);

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
router.get('/coverage', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const apps = applicationRepository.findAll(tenantId);
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
  const tenantId = req.tenantId!;
  const controlId = req.params.controlId as string;

  const catalogControl = CONTROLS_CATALOG.find(c => c.controlId === controlId);
  if (!catalogControl) {
    res.status(404).json({ success: false, error: `Control ${controlId} not found`, timestamp: new Date().toISOString() });
    return;
  }

  const tierOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const apps = applicationRepository.findAll(tenantId);
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

// ── GET /controls/app-coverage/:controlId — all apps bucketed by status ───
router.get('/app-coverage/:controlId', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const controlId = req.params.controlId as string;

  const ctrl = CONTROLS_CATALOG.find(c => c.controlId === controlId);
  if (!ctrl) {
    res.status(404).json({ success: false, error: `Control ${controlId} not found`, timestamp: new Date().toISOString() });
    return;
  }

  const tierOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const apps = applicationRepository.findAll(tenantId);

  type AppRow = { appId: string; appName: string; riskTier: string; department: string };
  const implemented: AppRow[] = [];
  const gap:         AppRow[] = [];
  const notApplicable: AppRow[] = [];
  const undetected:  AppRow[] = [];

  for (const app of apps) {
    const row: AppRow = { appId: app.appId, appName: app.name, riskTier: app.riskTier, department: app.department };
    const override = controlOverridesStore.get(app.appId, controlId);
    if (override?.notApplicable) { notApplicable.push(row); continue; }
    const status = detectStatus(controlId, app.iamPosture);
    if      (status === 'detected')   implemented.push(row);
    else if (status === 'gap')        gap.push(row);
    else                              undetected.push(row);
  }

  const sort = (arr: AppRow[]) => arr.sort((a, b) => (tierOrder[a.riskTier] ?? 4) - (tierOrder[b.riskTier] ?? 4));

  res.json({
    success: true,
    data: {
      controlId,
      name:        ctrl.name,
      pillar:      ctrl.pillar,
      category:    ctrl.category,
      description: ctrl.description,
      riskReduction: ctrl.riskReduction,
      implemented:   sort(implemented),
      gap:           sort(gap),
      notApplicable: sort(notApplicable),
      undetected:    sort(undetected),
      summary: {
        implemented:   implemented.length,
        gap:           gap.length,
        notApplicable: notApplicable.length,
        undetected:    undetected.length,
        total:         apps.length,
      },
    },
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
  const tenantId = req.tenantId!;
  const appId = req.params.appId as string;
  const app = applicationRepository.findById(tenantId, appId);
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
  const tenantId  = req.tenantId!;
  const appId     = req.params.appId     as string;
  const controlId = req.params.controlId as string;
  const { notApplicable, notes } = req.body as { notApplicable?: boolean; notes?: string };
  const actor = (req as any).user as { name?: string } | undefined;

  const app = applicationRepository.findById(tenantId, appId);
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
  const tenantId = req.tenantId!;
  const { appId, evaluateAll, forceRefresh } = req.body as {
    appId?: string; evaluateAll?: boolean; forceRefresh?: boolean;
  };

  if (evaluateAll) {
    const results = await controlService.evaluateAll(tenantId);
    res.json({ success: true, data: { total: results.length, results }, timestamp: new Date().toISOString() });
    return;
  }

  if (!appId) {
    res.status(400).json({ success: false, error: '"appId" or "evaluateAll: true" required', timestamp: new Date().toISOString() });
    return;
  }

  const result = await controlService.evaluateApp(tenantId, appId, forceRefresh ?? false);
  if (!result) {
    res.status(404).json({ success: false, error: `Application ${appId} not found`, timestamp: new Date().toISOString() });
    return;
  }

  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
});

// ── Control-pillar form fields — what the AI agent needs to configure each pillar ──
const PILLAR_FORM_FIELDS: Record<string, Array<{ label: string; hint: string; required: boolean }>> = {
  AM: [
    { label: 'Identity Provider',          hint: 'e.g. Microsoft Entra, Okta, ADFS',               required: true },
    { label: 'Protocol',                   hint: 'SAML 2.0 / OIDC / OAuth 2.0',                     required: true },
    { label: 'Metadata / Discovery URL',   hint: 'SP metadata URL or OIDC well-known endpoint',     required: true },
    { label: 'Redirect / ACS URIs',        hint: 'Comma-separated list of allowed callback URLs',    required: true },
    { label: 'User Attribute Mapping',     hint: 'e.g. email → UPN, displayName → full_name',        required: false },
    { label: 'MFA Policy',                 hint: 'Conditional access policy name or "all users"',    required: false },
  ],
  IGA: [
    { label: 'SCIM Endpoint URL',          hint: 'Application SCIM 2.0 base URL',                   required: true },
    { label: 'SCIM API Token / Secret',    hint: 'Bearer token for SCIM provisioning calls',         required: true },
    { label: 'Lifecycle Events',           hint: 'Joiner / Mover / Leaver triggers to automate',     required: true },
    { label: 'Role / Entitlement Mapping', hint: 'HR department or job code → app role mapping',     required: false },
    { label: 'Review Schedule',            hint: 'Certification cadence e.g. quarterly',             required: false },
  ],
  PAM: [
    { label: 'Account Types to Vault',     hint: 'e.g. local admin, service account, domain admin', required: true },
    { label: 'Service Account List',       hint: 'Comma-separated list of svc- accounts',           required: true },
    { label: 'Credential Rotation Policy', hint: 'e.g. every 30 days, on checkout',                 required: true },
    { label: 'Session Recording',          hint: 'Required for privileged sessions? Yes / No',       required: true },
    { label: 'Approver Group',             hint: 'AD group or team that approves PAM access',        required: false },
  ],
  CIAM: [
    { label: 'Customer Journey Type',      hint: 'e.g. B2C registration, partner portal, API',      required: true },
    { label: 'MFA Methods',                hint: 'e.g. TOTP, SMS OTP, WebAuthn',                     required: true },
    { label: 'Social / External IdPs',     hint: 'Google, Apple, LinkedIn — or "none"',              required: false },
    { label: 'Token Lifetime',             hint: 'Access token expiry e.g. 1h, refresh 30d',         required: false },
    { label: 'Branding / Domain',          hint: 'Custom domain for hosted login UI',                required: false },
  ],
};

// ── POST /controls/app/:appId/:controlId/remediate — trigger remediation ──
// Creates:  (1) approval request — represents email sent to app owner + technical admin
//           (2) build job — the AI agent configuration task (pending until info gathered)
// Returns:  both IDs, who was notified, and the form fields the agent will need filled.
router.post('/app/:appId/:controlId/remediate', (req: Request, res: Response) => {
  const tenantId  = req.tenantId!;
  const appId     = req.params.appId     as string;
  const controlId = req.params.controlId as string;
  const actor     = (req as any).user as { userId?: string; name?: string } | undefined;

  const app = applicationRepository.findById(tenantId, appId);
  if (!app) {
    res.status(404).json({ success: false, error: `Application ${appId} not found`, timestamp: new Date().toISOString() });
    return;
  }

  const ctrl = CONTROLS_CATALOG.find(c => c.controlId === controlId);
  if (!ctrl) {
    res.status(404).json({ success: false, error: `Control ${controlId} not found`, timestamp: new Date().toISOString() });
    return;
  }

  try {
    // Step 1 — Create approval (simulates email to Business Owner + Technical Admin)
    const approval = approvalService.requestApproval(tenantId, {
      requesterId:   actor?.userId ?? 'system',
      action:        `IAM Configuration Request — ${ctrl.name} on ${app.name}`,
      resource:      app.name,
      riskLevel:     (app.riskTier === 'critical' || app.riskTier === 'high') ? 'high_risk' : 'standard',
      justification: `Control gap detected: ${ctrl.name} (${controlId}) is not implemented on ${app.name}. ` +
                     `Business owner and technical admin have been notified to provide configuration information.`,
    });

    // Step 2 — Create build job (AI agent configuration task — queued until info received)
    const buildTypeMap: Record<string, string> = {
      AM: 'sso_integration', IGA: 'iga_onboarding', PAM: 'pam_onboarding', CIAM: 'ciam_onboarding',
    };
    const platformMap: Record<string, string> = {
      AM: 'entra', IGA: 'sailpoint', PAM: 'cyberark', CIAM: 'okta',
    };
    const job = buildService.startBuild(tenantId, {
      appId,
      controlGap: controlId as any,
      buildType:  buildTypeMap[ctrl.pillar] as any,
      platform:   platformMap[ctrl.pillar] as any,
      assignedTo: actor?.name ?? 'IAM Team',
    });

    // Who gets notified
    const sentTo = [
      { role: 'Business Owner',  name: app.owner,     email: app.ownerEmail },
      { role: 'Technical Admin', name: 'IAM Team',    email: 'iam-team@corp.com' },
    ];
    if (app.supportContact) sentTo.push({ role: 'Support Contact', name: app.supportContact, email: app.supportContact });

    res.json({
      success: true,
      data: {
        approvalId:  approval.requestId,
        buildId:     (job as any).buildId,
        controlId,
        controlName: ctrl.name,
        pillar:      ctrl.pillar,
        appName:     app.name,
        sentTo,
        formFields:  PILLAR_FORM_FIELDS[ctrl.pillar] ?? [],
        nextSteps: [
          `Email sent to ${sentTo.map(r => r.name).join(' and ')} with configuration form`,
          `AI agent (build ${(job as any).buildId}) queued — will start once form is submitted`,
          `Engineer review approval (${approval.requestId}) will be triggered after configuration completes`,
        ],
        message: `Configuration request sent for ${ctrl.name} on ${app.name}`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, timestamp: new Date().toISOString() });
  }
});

// ── GET /controls/:appId — cached evaluation (legacy) ─────────────────────
router.get('/:appId', async (req: Request, res: Response) => {
  // Intercept 'app' prefix to avoid conflicts with /controls/app/:appId
  if ((req.params.appId as string) === 'app') {
    res.status(400).json({ success: false, error: 'Use /controls/app/:appId for per-app catalog view', timestamp: new Date().toISOString() });
    return;
  }
  const tenantId = req.tenantId!;
  const appIdLegacy = req.params.appId as string;
  let result = controlService.getFromCache(appIdLegacy);
  if (!result) result = await controlService.evaluateApp(tenantId, appIdLegacy) ?? undefined;
  if (!result) {
    res.status(404).json({ success: false, error: `No control evaluation found for ${appIdLegacy}.`, timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
});

// ── GET /controls — evaluation summary for all apps ───────────────────────
router.get('/', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const summary = controlService.getCacheSummary(tenantId);
  res.json({ success: true, data: summary, timestamp: new Date().toISOString() });
});

export default router;
