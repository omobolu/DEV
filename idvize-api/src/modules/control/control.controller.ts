import { Router, Request, Response } from 'express';
import { controlService } from './control.service';
import { CONTROLS_CATALOG, CATALOG_SUMMARY, IamPillar } from './control.catalog';
import { controlOverridesStore } from './control.overrides.store';
import { applicationRepository } from '../application/application.repository';
import { IamPosture } from '../application/application.types';
import { buildService } from '../build/build.service';
import { approvalService } from '../security/approval/approval.service';
import { tenantService } from '../tenant/tenant.service';
import { emailService } from '../email/email.service';
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

// ── POST /controls/app/:appId/:controlId/remediate — sequential approval orchestration ──
// Reads tenant settings → creates approvals for required roles → creates build in AWAITING_APPROVAL
// On all approvals satisfied → fires emails + transitions build to AWAITING_FORM
router.post('/app/:appId/:controlId/remediate', async (req: Request, res: Response) => {
  const tenantId  = req.tenantId!;
  const appId     = req.params.appId     as string;
  const controlId = req.params.controlId as string;
  const actor     = (req as any).user as { userId?: string; name?: string; sub?: string } | undefined;

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
    // Step 1 — Read tenant remediation settings
    const tenant = await tenantService.getTenant(tenantId);
    const rem = tenant?.settings?.remediation;
    const remediationSettings = {
      requireIamManagerApproval: rem?.requireIamManagerApproval ?? true,
      requireAppOwnerApproval: rem?.requireAppOwnerApproval ?? true,
    };

    // Step 2 — Create build job first (so we can use buildId to scope approvals)
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
    const buildId = (job as any).buildId as string;

    // Step 3 — Create approvals scoped to this specific build (prevents stale approval contamination)
    const resourceKey = `${app.name}::${controlId}::${buildId}`;
    const approvals: Array<{ requestId: string; role: string; status: string }> = [];

    if (remediationSettings.requireIamManagerApproval) {
      const approval = await approvalService.requestApproval(tenantId, {
        requesterId:   actor?.sub ?? actor?.userId ?? 'system',
        action:        `IAM Manager Approval — ${ctrl.name} on ${app.name}`,
        resource:      resourceKey,
        riskLevel:     (app.riskTier === 'critical' || app.riskTier === 'high') ? 'high_risk' : 'standard',
        justification: `Remediation requires IAM Manager approval per tenant policy. ` +
                       `Control gap: ${ctrl.name} (${controlId}) on ${app.name}. Build: ${buildId}.`,
      });
      approvals.push({ requestId: approval.requestId, role: 'iam_manager', status: 'pending' });
    }

    if (remediationSettings.requireAppOwnerApproval) {
      const approval = await approvalService.requestApproval(tenantId, {
        requesterId:   actor?.sub ?? actor?.userId ?? 'system',
        action:        `App Owner Approval — ${ctrl.name} on ${app.name}`,
        resource:      resourceKey,
        riskLevel:     'standard',
        justification: `Remediation requires App Owner approval per tenant policy. ` +
                       `Control gap: ${ctrl.name} (${controlId}) on ${app.name}. Owner: ${app.owner}. Build: ${buildId}.`,
      });
      approvals.push({ requestId: approval.requestId, role: 'app_owner', status: 'pending' });
    }

    // Transition to AWAITING_APPROVAL if approvals needed (must go through ASSIGNED first per state machine)
    if (approvals.length > 0) {
      buildService.transition(tenantId, buildId, 'ASSIGNED', 'system',
        `Assigned for remediation — ${approvals.length} approval(s) required`);
      buildService.transition(tenantId, buildId, 'AWAITING_APPROVAL', 'system',
        `Waiting for ${approvals.length} approval(s): ${approvals.map(a => a.role).join(', ')}`);
    } else {
      // No approvals required — chain through to AWAITING_FORM so the build isn't stranded
      buildService.transition(tenantId, buildId, 'ASSIGNED', 'system',
        `Assigned for remediation — no approvals required`);
      buildService.transition(tenantId, buildId, 'AWAITING_APPROVAL', 'system',
        `No approvals required — auto-advancing`);
      buildService.transition(tenantId, buildId, 'AWAITING_FORM', 'system',
        `All approvals satisfied (none required) — ready for form submission`);
    }

    // Who gets notified
    const sentTo = [
      { role: 'Business Owner',  name: app.owner,     email: app.ownerEmail },
    ];
    if (app.technicalSme) {
      sentTo.push({ role: 'Technical SME', name: app.technicalSme, email: app.technicalSmeEmail ?? '' });
    }
    if (app.supportContact) {
      sentTo.push({ role: 'Support Contact', name: app.supportContact, email: app.supportContact });
    }

    res.json({
      success: true,
      data: {
        approvals,
        buildId,
        buildState:  approvals.length > 0 ? 'AWAITING_APPROVAL' : 'AWAITING_FORM',
        controlId,
        controlName: ctrl.name,
        pillar:      ctrl.pillar,
        appName:     app.name,
        sentTo,
        formFields:  PILLAR_FORM_FIELDS[ctrl.pillar] ?? [],
        nextSteps: approvals.length > 0
          ? [
              `${approvals.length} approval(s) required before execution`,
              ...approvals.map(a => `${a.role} approval pending (${a.requestId})`),
              `Build ${buildId} will transition to AWAITING_FORM once all approvals are granted`,
            ]
          : [
              `No approvals required — build proceeding directly`,
              `AI agent (build ${buildId}) queued — will start once form is submitted`,
            ],
        message: approvals.length > 0
          ? `Remediation initiated for ${ctrl.name} on ${app.name} — awaiting ${approvals.length} approval(s)`
          : `Remediation initiated for ${ctrl.name} on ${app.name} — no approvals required`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, timestamp: new Date().toISOString() });
  }
});

// ── POST /controls/app/:appId/:controlId/remediate/approve — approve a remediation ──
// Resolves an approval; when all approvals for a build are satisfied, fires emails + transitions to AWAITING_FORM
router.post('/app/:appId/:controlId/remediate/approve', async (req: Request, res: Response) => {
  const tenantId   = req.tenantId!;
  const appId      = req.params.appId     as string;
  const controlId  = req.params.controlId as string;
  const actor      = (req as any).user as { sub?: string; name?: string; userId?: string } | undefined;
  const { approvalId, decision } = req.body as { approvalId: string; decision: 'approved' | 'rejected' };

  if (!approvalId || !decision) {
    res.status(400).json({ success: false, error: 'approvalId and decision (approved|rejected) required', timestamp: new Date().toISOString() });
    return;
  }
  if (decision !== 'approved' && decision !== 'rejected') {
    res.status(400).json({ success: false, error: '"decision" must be "approved" or "rejected"', timestamp: new Date().toISOString() });
    return;
  }

  const app = applicationRepository.findById(tenantId, appId);
  if (!app) {
    res.status(404).json({ success: false, error: `Application ${appId} not found`, timestamp: new Date().toISOString() });
    return;
  }

  try {
    const approval = await approvalService.resolveApproval(tenantId, approvalId, {
      decision,
      decidedBy: actor?.sub ?? actor?.userId ?? 'system',
      reason: `${decision} by ${actor?.name ?? 'system'} for ${controlId} on ${app.name}`,
    });

    if (decision === 'rejected') {
      // Transition the associated build to FAILED so it doesn't block future remediation attempts
      const builds = buildService.findByAppAndControl(tenantId, appId, controlId);
      const awaitingBuild = builds.find(b => b.state === 'AWAITING_APPROVAL');
      if (awaitingBuild) {
        try {
          buildService.transition(tenantId, awaitingBuild.buildId, 'FAILED', actor?.sub ?? 'system',
            `Approval ${approvalId} rejected by ${actor?.name ?? 'system'} — remediation cancelled`);
        } catch (transErr) {
          console.warn(`[remediate/approve] Build transition on rejection failed: ${(transErr as Error).message}`);
        }
        // Cancel any remaining pending approvals for this build (uses cancelBySystem to bypass authz)
        const rejResourceKey = `${app.name}::${controlId}::${awaitingBuild.buildId}`;
        const siblingApprovals = await approvalService.listByResource(tenantId, rejResourceKey);
        for (const sib of siblingApprovals) {
          if (sib.status === 'pending' && sib.requestId !== approvalId) {
            await approvalService.cancelBySystem(tenantId, sib.requestId,
              `Auto-cancelled: sibling approval ${approvalId} was rejected`);
          }
        }
      }
      res.json({
        success: true,
        data: { approvalId, decision, status: 'rejected', buildId: awaitingBuild?.buildId, message: `Approval ${approvalId} rejected — build cancelled` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Find the AWAITING_APPROVAL build to scope approval lookup to the current remediation attempt
    const builds = buildService.findByAppAndControl(tenantId, appId, controlId);
    const awaitingBuild = builds.find(b => b.state === 'AWAITING_APPROVAL');

    // If no AWAITING_APPROVAL build found, the build was already terminated (e.g. prior rejection)
    if (!awaitingBuild) {
      const latestBuild = builds[builds.length - 1];
      res.json({
        success: true,
        data: {
          approvalId,
          decision,
          allApprovalsSatisfied: false,
          buildId: latestBuild?.buildId,
          buildState: latestBuild?.state ?? 'UNKNOWN',
          message: `Approval ${approvalId} granted, but the associated build is already in ${latestBuild?.state ?? 'UNKNOWN'} state. No further action needed.`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const currentBuildId = awaitingBuild.buildId;

    // Check approvals scoped to this specific build (prevents stale approvals from prior attempts)
    const resourceKey = `${app.name}::${controlId}::${currentBuildId}`;
    const allApprovals = await approvalService.listByResource(tenantId, resourceKey);
    const pendingApprovals = allApprovals.filter(a => a.status === 'pending');
    const rejectedApprovals = allApprovals.filter(a => a.status === 'rejected');
    const approvedApprovals = allApprovals.filter(a => a.status === 'approved');

    if (approvedApprovals.length === allApprovals.length && allApprovals.length > 0) {
      // All approvals satisfied — fire emails + transition build
      const ctrl = CONTROLS_CATALOG.find(c => c.controlId === controlId);
      const actorId = actor?.sub ?? actor?.userId ?? 'system';
      const actorName = actor?.name ?? 'System';
      if (awaitingBuild) {
        try {
          buildService.transition(tenantId, awaitingBuild.buildId, 'AWAITING_FORM', actorId,
            `All approvals granted — transitioning to AWAITING_FORM`);
        } catch (transErr) {
          console.warn(`[remediate/approve] Build transition failed: ${(transErr as Error).message}`);
        }
      }

      // Fire email notification (best-effort)
      emailService.sendAgentNotification(tenantId, {
        agentId: 'remediation-orchestrator',
        controlId,
        applicationId: appId,
        applicationName: app.name,
        notificationType: 'sso-remediation-plan',
        recipients: [
          { email: app.ownerEmail, name: app.owner },
          ...(app.technicalSmeEmail ? [{ email: app.technicalSmeEmail, name: app.technicalSme ?? 'Technical SME' }] : []),
        ],
        additionalData: {
          status: 'all_approvals_granted',
          controlName: ctrl?.name ?? controlId,
          pillar: ctrl?.pillar ?? 'AM',
          outcome: 'ALL_APPROVALS_GRANTED',
          riskLevel: (app.riskTier === 'critical' || app.riskTier === 'high') ? 'High' : 'Standard',
          remediationSteps: 'Pending technical data collection — form will be sent to app owner and technical SME.',
          estimatedTimeline: 'To be determined after form submission',
        },
      }, actorId, actorName).catch(() => {});

      res.json({
        success: true,
        data: {
          approvalId,
          decision,
          allApprovalsSatisfied: true,
          buildTransition: 'AWAITING_FORM',
          buildId: awaitingBuild?.buildId,
          message: `All approvals granted — build transitioning to AWAITING_FORM. Emails sent to ${app.owner}${app.technicalSme ? ` and ${app.technicalSme}` : ''}.`,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      res.json({
        success: true,
        data: {
          approvalId,
          decision,
          allApprovalsSatisfied: false,
          pendingCount: pendingApprovals.length,
          rejectedCount: rejectedApprovals.length,
          message: rejectedApprovals.length > 0
            ? `Approval ${approvalId} granted but ${rejectedApprovals.length} approval(s) were rejected. Build cannot proceed.`
            : pendingApprovals.length > 0
              ? `Approval ${approvalId} granted. ${pendingApprovals.length} approval(s) still pending.`
              : `Approval ${approvalId} granted but some approvals are expired/cancelled. Build cannot proceed.`,
        },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, timestamp: new Date().toISOString() });
  }
});

// ── GET /controls/app/:appId/:controlId/remediate/status — poll approval state ──
router.get('/app/:appId/:controlId/remediate/status', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const appId    = req.params.appId     as string;
  const controlId = req.params.controlId as string;

  const app = applicationRepository.findById(tenantId, appId);
  if (!app) {
    res.status(404).json({ success: false, error: `Application ${appId} not found`, timestamp: new Date().toISOString() });
    return;
  }

  try {
    // Scope approval lookup to the latest AWAITING_APPROVAL build for this app+control
    const builds = buildService.findByAppAndControl(tenantId, appId, controlId);
    const latestBuild = builds.find(b => b.state === 'AWAITING_APPROVAL') ?? builds[builds.length - 1];
    const resourceKey = latestBuild
      ? `${app.name}::${controlId}::${latestBuild.buildId}`
      : `${app.name}::${controlId}`;
    const allApprovals = await approvalService.listByResource(tenantId, resourceKey);
    const pending  = allApprovals.filter(a => a.status === 'pending');
    const approved = allApprovals.filter(a => a.status === 'approved');
    const rejected = allApprovals.filter(a => a.status === 'rejected');

    res.json({
      success: true,
      data: {
        appId,
        controlId,
        appName: app.name,
        buildId: latestBuild?.buildId,
        totalApprovals: allApprovals.length,
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
        allSatisfied: approved.length === allApprovals.length && allApprovals.length > 0,
        approvals: allApprovals.map(a => ({
          requestId: a.requestId,
          action: a.action,
          status: a.status,
          decidedBy: a.approverId,
          decidedAt: a.resolvedAt,
        })),
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
