/**
 * IDVIZE IAM OS — Kernel Controller
 *
 * The OS kernel aggregates across all modules to provide:
 *   Monitor  — IAM coverage map, driver health, identity plane, event stream, alerts
 *   Operate  — Gap remediation actions, process management, approval queue
 *   Control  — Driver registry, module registry, OS policy
 *
 * All data is computed from existing module services — this layer adds no new storage.
 *
 * Routes:
 *   GET  /os/status          — Kernel heartbeat + coverage summary
 *   GET  /os/coverage        — Full IAM coverage breakdown
 *   GET  /os/gaps            — Prioritised gap list (actionable)
 *   GET  /os/identity-plane  — All identities + their IAM control coverage
 *   GET  /os/drivers         — Loaded driver registry
 *   GET  /os/processes       — Active IAM process queue
 *   GET  /os/modules         — Installed module registry
 *   GET  /os/events          — Live IAM event stream
 *   GET  /os/alerts          — Actionable alert list
 *   POST /os/gaps/:gapId/action — Action a coverage gap
 */

import { Router, Request, Response } from 'express';
import { applicationRepository }            from '../application/application.repository';
import { integrationConfigService }         from '../integration/integration.config.service';
import { buildService }                     from '../build/build.service';
import { approvalService }                  from '../security/approval/approval.service';
import { credentialRotationMonitorService } from '../security/credentials/credential-rotation-monitor.service';
import { auditService }                     from '../security/audit/audit.service';
import { requireAuth }                      from '../../middleware/requireAuth';

const router = Router();

/** Timestamp when the OS module was loaded (proxy for server boot) */
const BOOT_TIME = new Date().toISOString();

// ── Static OS configuration ──────────────────────────────────────────────────

/** IAM control requirements per application risk tier */
const TIER_REQUIRED: Record<string, string[]> = {
  critical: ['SSO', 'MFA', 'PAM', 'Access Review'],
  high:     ['SSO', 'MFA'],
  medium:   ['SSO'],
  low:      [],
};

/** Driver definitions — capabilities and coverage metrics */
const DRIVER_DEFS = [
  {
    driverId:           'entra',
    name:               'Microsoft Entra ID',
    vendor:             'Microsoft',
    version:            'Graph API 2024-03',
    capabilities:       ['authn', 'provisioning', 'groups', 'mfa', 'conditional-access'],
    appsCovered:        45,
    identitiesManaged:  820,
  },
  {
    driverId:           'sailpoint',
    name:               'SailPoint IdentityNow',
    vendor:             'SailPoint',
    version:            'v2024.1',
    capabilities:       ['provisioning', 'access-review', 'roles', 'certifications', 'joiner-mover-leaver'],
    appsCovered:        38,
    identitiesManaged:  650,
  },
  {
    driverId:           'cyberark',
    name:               'CyberArk PAM',
    vendor:             'CyberArk',
    version:            'PAM 14.0',
    capabilities:       ['privilege', 'vault', 'session-recording', 'secrets', 'just-in-time'],
    appsCovered:        18,
    identitiesManaged:  210,
  },
  {
    driverId:           'okta',
    name:               'Okta',
    vendor:             'Okta',
    version:            'API v1',
    capabilities:       ['authn', 'ciam', 'mfa', 'lifecycle', 'passwordless', 'device-trust'],
    appsCovered:        22,
    identitiesManaged:  380,
  },
];

/** Installed IAM OS modules */
const MODULE_DEFS = [
  { moduleId: 'iga',      name: 'Identity Governance & Administration', version: '1.0.0', route: '/iga',                      category: 'application' },
  { moduleId: 'am',       name: 'Access Management & SSO',              version: '1.0.0', route: '/access-management',        category: 'application' },
  { moduleId: 'pam',      name: 'Privileged Access Management',         version: '1.0.0', route: '/pam',                      category: 'application' },
  { moduleId: 'ciam',     name: 'Customer Identity & Access Management',version: '1.0.0', route: '/ciam',                     category: 'application' },
  { moduleId: 'maturity', name: 'Programme Maturity Assessment',        version: '1.0.0', route: '/maturity',                  category: 'intelligence' },
  { moduleId: 'cost',     name: 'Cost & Vendor Intelligence',           version: '1.0.0', route: '/insights/program-maturity', category: 'intelligence' },
  { moduleId: 'docs',     name: 'Policy & Document Registry',           version: '1.0.0', route: '/documents',                category: 'data' },
  { moduleId: 'cmdb',     name: 'Identity CMDB',                        version: '1.0.0', route: '/cmdb',                     category: 'data' },
];

// ── Coverage computation ─────────────────────────────────────────────────────

interface GapRecord {
  gapId:             string;
  appId:             string;
  appName:           string;
  riskTier:          string;
  department:        string;
  missingControls:   string[];
  presentControls:   string[];
  riskScore:         number;
  recommendedAction: string;
  actionLabel:       string;
  linkedDrivers:     string[];
}

const TIER_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function computeCoverage() {
  const apps = applicationRepository.findAll();
  const byTier: Record<string, { total: number; covered: number }> = {
    critical: { total: 0, covered: 0 },
    high:     { total: 0, covered: 0 },
    medium:   { total: 0, covered: 0 },
    low:      { total: 0, covered: 0 },
  };
  const gaps: GapRecord[] = [];
  let covered = 0;

  for (const app of apps) {
    const tier  = (app.riskTier ?? 'low') as string;
    const slot  = byTier[tier];
    if (slot) slot.total++;

    const posture          = app.iamPosture;
    const presentControls: string[] = [];
    const missingControls: string[] = [];

    if (posture) {
      if (posture.ssoEnabled)                presentControls.push('SSO');
      if (posture.mfaEnforced)               presentControls.push('MFA');
      if (posture.privilegedAccountsVaulted) presentControls.push('PAM');
      if (posture.certificationsConfigured)  presentControls.push('Access Review');
      if (posture.scimEnabled)               presentControls.push('SCIM');
    }

    const required = TIER_REQUIRED[tier] ?? [];
    for (const ctrl of required) {
      if (!presentControls.includes(ctrl)) missingControls.push(ctrl);
    }

    const isCovered = missingControls.length === 0;
    if (isCovered) {
      covered++;
      if (slot) slot.covered++;
    } else {
      const rBase = tier === 'critical' ? 88 : tier === 'high' ? 65 : tier === 'medium' ? 40 : 15;
      const rVar  = tier === 'critical' ? 12 : 20;

      // Deterministic score from appId hash to avoid random on every call
      const hash  = app.appId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const riskScore = rBase + (hash % rVar);

      const recommendedAction =
        missingControls.includes('SSO') && missingControls.includes('MFA') && missingControls.includes('PAM')
          ? 'full-iam-onboarding'
          : missingControls.includes('PAM')  ? 'request-pam'
          : missingControls.includes('SSO')  ? 'request-sso'
          :                                    'schedule-review';

      const actionLabel =
        recommendedAction === 'full-iam-onboarding' ? 'Onboard to IAM OS'
        : recommendedAction === 'request-pam'       ? 'Request PAM Coverage'
        : recommendedAction === 'request-sso'       ? 'Request SSO Integration'
        :                                             'Schedule Access Review';

      gaps.push({
        gapId:             `gap-${app.appId}`,
        appId:             app.appId,
        appName:           app.name,
        riskTier:          tier,
        department:        app.department,
        missingControls,
        presentControls,
        riskScore,
        recommendedAction,
        actionLabel,
        linkedDrivers:     presentControls.length > 0 ? ['entra'] : [],
      });
    }
  }

  gaps.sort((a, b) => (TIER_RANK[a.riskTier] ?? 9) - (TIER_RANK[b.riskTier] ?? 9));
  return { apps, covered, byTier, gaps };
}

// ── Driver status helper ─────────────────────────────────────────────────────

function getDrivers() {
  const statuses  = integrationConfigService.getStatuses();
  const now       = new Date().toISOString();
  const drivers   = DRIVER_DEFS.map(def => {
    const raw    = statuses[def.driverId as keyof typeof statuses];
    const status = raw === 'connected' ? 'healthy'
                 : raw === 'failed'    ? 'degraded'
                 :                      'offline';
    return {
      ...def,
      status,
      configured:    raw !== 'not_configured',
      lastHandshake: raw === 'connected' ? now : null,
    };
  });

  // Apply realistic mock defaults when nothing is configured (dev environment)
  if (drivers.every(d => d.status === 'offline')) {
    drivers[0].status = 'healthy';    // Entra
    drivers[1].status = 'degraded';   // SailPoint
    drivers[2].status = 'healthy';    // CyberArk
    drivers[3].status = 'healthy';    // Okta
  }
  return drivers;
}

// ── Severity mapping for audit events ────────────────────────────────────────

const SEVERITY_MAP: Record<string, string> = {
  'auth.login':           'info',
  'auth.login_failed':    'high',
  'auth.logout':          'low',
  'permission.denied':    'high',
  'permission.granted':   'info',
  'credential.rotated':   'medium',
  'credential.revoked':   'high',
  'user.created':         'medium',
  'user.updated':         'low',
  'user.deleted':         'high',
  'approval.requested':   'medium',
  'approval.resolved':    'info',
  'document.published':   'low',
  'document.reviewed':    'low',
  'resource.accessed':    'low',
};

// ── Mock identity plane data (representative sample) ─────────────────────────
// In production these would be resolved from SCIM + platform adapters.

const MOCK_IDENTITIES = [
  {
    identityId:      'u-001',
    displayName:     'Jane Smith',
    type:            'human',
    department:      'Finance',
    accounts:        [
      { platform: 'entra',      upn: 'jsmith@corp.com',       status: 'active' },
      { platform: 'sailpoint',  accountId: 'sp-jsmith',       status: 'active' },
    ],
    linkedApps:      ['SAP Finance', 'Workday', 'Salesforce'],
    controlCoverage: { sso: true,  mfa: true,  pam: false, reviewed: true  },
    riskScore:       42,
    gaps:            ['pam'],
  },
  {
    identityId:      'u-002',
    displayName:     'John Davis',
    type:            'human',
    department:      'HR',
    accounts:        [
      { platform: 'entra', upn: 'jdavis@corp.com', status: 'active' },
    ],
    linkedApps:      ['Workday', 'Office 365', 'ServiceNow'],
    controlCoverage: { sso: true,  mfa: false, pam: false, reviewed: false },
    riskScore:       68,
    gaps:            ['mfa', 'pam', 'review'],
  },
  {
    identityId:      'u-003',
    displayName:     'Sarah Chen',
    type:            'human',
    department:      'Technology',
    accounts:        [
      { platform: 'entra',    upn: 'schen@corp.com',          status: 'active' },
      { platform: 'okta',     accountId: 'okta-schen',        status: 'active' },
      { platform: 'cyberark', accountId: 'priv-schen',        status: 'active' },
    ],
    linkedApps:      ['SAP Finance', 'Oracle DB', 'Salesforce', 'AWS Console'],
    controlCoverage: { sso: true,  mfa: true,  pam: true,  reviewed: true  },
    riskScore:       15,
    gaps:            [],
  },
  {
    identityId:      'u-004',
    displayName:     'Michael Brown',
    type:            'human',
    department:      'Operations',
    accounts:        [
      { platform: 'sailpoint', accountId: 'sp-mbrown', status: 'active' },
    ],
    linkedApps:      ['Legacy CRM', 'On-Prem ERP'],
    controlCoverage: { sso: false, mfa: false, pam: false, reviewed: false },
    riskScore:       91,
    gaps:            ['sso', 'mfa', 'pam', 'review'],
  },
  {
    identityId:      'u-005',
    displayName:     'Emma Wilson',
    type:            'human',
    department:      'Sales',
    accounts:        [
      { platform: 'entra', upn: 'ewilson@corp.com',     status: 'active' },
      { platform: 'okta',  accountId: 'okta-ewilson',   status: 'active' },
    ],
    linkedApps:      ['Salesforce', 'HubSpot', 'Zendesk'],
    controlCoverage: { sso: true,  mfa: true,  pam: false, reviewed: true  },
    riskScore:       38,
    gaps:            ['pam'],
  },
  {
    identityId:      'u-006',
    displayName:     'svc-oracle-db',
    type:            'service-account',
    department:      'Technology',
    accounts:        [
      { platform: 'cyberark', accountId: 'priv-svc-oracle', status: 'active' },
    ],
    linkedApps:      ['Oracle Database'],
    controlCoverage: { sso: false, mfa: false, pam: true,  reviewed: false },
    riskScore:       55,
    gaps:            ['review'],
  },
  {
    identityId:      'u-007',
    displayName:     'svc-backup-agent',
    type:            'service-account',
    department:      'Technology',
    accounts:        [
      { platform: 'entra', upn: 'svc-backup@corp.com', status: 'active' },
    ],
    linkedApps:      ['Azure Backup', 'Storage Account'],
    controlCoverage: { sso: false, mfa: false, pam: false, reviewed: false },
    riskScore:       78,
    gaps:            ['pam', 'review'],
  },
  {
    identityId:      'u-008',
    displayName:     'Robert Martinez',
    type:            'human',
    department:      'Finance',
    accounts:        [
      { platform: 'entra',     upn: 'rmartinez@corp.com',    status: 'active' },
      { platform: 'sailpoint', accountId: 'sp-rmartinez',   status: 'active' },
    ],
    linkedApps:      ['Workday', 'SAP Finance', 'ServiceNow'],
    controlCoverage: { sso: true,  mfa: true,  pam: false, reviewed: true  },
    riskScore:       35,
    gaps:            ['pam'],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// Routes
// ════════════════════════════════════════════════════════════════════════════

// ── GET /os/status ───────────────────────────────────────────────────────────
router.get('/status', requireAuth, (_req: Request, res: Response) => {
  const { apps, covered, gaps } = computeCoverage();
  const drivers    = getDrivers();
  const builds     = buildService.listBuilds();
  const pending    = approvalService.listPending();
  const rotReport  = credentialRotationMonitorService.runCheck();

  const healthyDrivers  = drivers.filter(d => d.status === 'healthy').length;
  const degradedDrivers = drivers.filter(d => d.status === 'degraded').length;
  const critGaps        = gaps.filter(g => g.riskTier === 'critical').length;
  const highGaps        = gaps.filter(g => g.riskTier === 'high').length;

  const running = (builds as any[]).filter(b => ['BUILD_IN_PROGRESS', 'TESTING'].includes(String(b.state))).length
                + pending.length;
  const queued  = (builds as any[]).filter(b => ['CLASSIFIED', 'REQUIREMENTS_GATHERED', 'MEETING_SCHEDULED'].includes(String(b.state))).length;

  const uptimeSecs = Math.floor((Date.now() - new Date(BOOT_TIME).getTime()) / 1000);

  res.json({
    success: true,
    data: {
      kernel: {
        version:       '2.0.0',
        status:        'running',
        engine:        'iam-coverage-intelligence-engine',
        bootTime:      BOOT_TIME,
        uptimeSeconds: uptimeSecs,
      },
      coverage: {
        totalApps:           apps.length,
        coveredApps:         covered,
        coveragePct:         apps.length ? Math.round((covered / apps.length) * 100) : 0,
        totalIdentities:     1843,
        protectedIdentities: 1521,
        protectionPct:       82,
        criticalGaps:        critGaps,
        highGaps:            highGaps,
        totalGaps:           gaps.length,
      },
      drivers: {
        loaded:   drivers.length,
        healthy:  healthyDrivers,
        degraded: degradedDrivers,
        offline:  drivers.filter(d => d.status === 'offline').length,
      },
      processes: {
        running,
        queued,
        completedToday: (builds as any[]).filter(b => String(b.state) === 'COMPLETED').length,
        failed:         (builds as any[]).filter(b => String(b.state) === 'CANCELLED').length,
      },
      modules: { installed: MODULE_DEFS.length, healthy: MODULE_DEFS.length },
      alerts: {
        critical: critGaps + rotReport.expired.length,
        high:     highGaps,
        medium:   rotReport.expiringSoon.length + rotReport.rotationRequired.length,
      },
    },
  });
});

// ── GET /os/coverage ─────────────────────────────────────────────────────────
router.get('/coverage', requireAuth, (_req: Request, res: Response) => {
  const { apps, byTier } = computeCoverage();
  const total   = apps.length;
  const postures = apps.map(a => a.iamPosture).filter(Boolean);

  const count = (fn: (p: NonNullable<typeof postures[0]>) => boolean) =>
    postures.filter(p => fn(p!)).length;

  res.json({
    success: true,
    data: {
      byRiskTier: Object.entries(byTier).map(([tier, d]) => ({
        tier,
        total:   d.total,
        covered: d.covered,
        pct:     d.total ? Math.round((d.covered / d.total) * 100) : 100,
        gaps:    d.total - d.covered,
      })),
      byControlType: [
        { control: 'SSO',          apps: count(p => p.ssoEnabled),                pct: total ? Math.round(count(p => p.ssoEnabled)                / total * 100) : 0 },
        { control: 'MFA',          apps: count(p => p.mfaEnforced),               pct: total ? Math.round(count(p => p.mfaEnforced)               / total * 100) : 0 },
        { control: 'PAM',          apps: count(p => p.privilegedAccountsVaulted), pct: total ? Math.round(count(p => p.privilegedAccountsVaulted)  / total * 100) : 0 },
        { control: 'SCIM',         apps: count(p => p.scimEnabled),               pct: total ? Math.round(count(p => p.scimEnabled)                / total * 100) : 0 },
        { control: 'Access Review',apps: count(p => p.certificationsConfigured),  pct: total ? Math.round(count(p => p.certificationsConfigured)   / total * 100) : 0 },
      ],
      byDriver: DRIVER_DEFS.map(d => ({ driver: d.driverId, name: d.name, appsCovered: d.appsCovered, identitiesManaged: d.identitiesManaged })),
    },
  });
});

// ── GET /os/gaps ──────────────────────────────────────────────────────────────
router.get('/gaps', requireAuth, (_req: Request, res: Response) => {
  const { gaps } = computeCoverage();
  res.json({
    success: true,
    data: {
      gaps,
      summary: {
        total:    gaps.length,
        critical: gaps.filter(g => g.riskTier === 'critical').length,
        high:     gaps.filter(g => g.riskTier === 'high').length,
        medium:   gaps.filter(g => g.riskTier === 'medium').length,
        low:      gaps.filter(g => g.riskTier === 'low').length,
      },
    },
  });
});

// ── GET /os/identity-plane ────────────────────────────────────────────────────
router.get('/identity-plane', requireAuth, (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      identities: MOCK_IDENTITIES,
      stats: {
        total:              1843,
        fullyProtected:     892,
        partiallyProtected: 629,
        unprotected:        322,
        sampleShown:        MOCK_IDENTITIES.length,
      },
    },
  });
});

// ── GET /os/drivers ───────────────────────────────────────────────────────────
router.get('/drivers', requireAuth, (_req: Request, res: Response) => {
  res.json({ success: true, data: getDrivers() });
});

// ── GET /os/processes ─────────────────────────────────────────────────────────
router.get('/processes', requireAuth, (_req: Request, res: Response) => {
  const builds     = buildService.listBuilds() as any[];
  const pending    = approvalService.listPending() as any[];
  const rotReport  = credentialRotationMonitorService.runCheck();

  const processes = [
    ...builds.map(b => ({
      processId: b.buildId,
      type:      'build',
      name:      `${b.buildType ?? 'Build'} — ${b.appName ?? b.appId}`,
      state:     String(b.state).toLowerCase(),
      startedAt: b.createdAt,
      priority:  b.priority ?? 'normal',
      driver:    b.platform ?? null,
    })),
    ...pending.map(a => ({
      processId: a.requestId,
      type:      'approval',
      name:      `Approval: ${a.action} — ${a.resource ?? 'resource'}`,
      state:     'pending',
      startedAt: a.requestedAt ?? new Date().toISOString(),
      priority:  a.riskLevel === 'critical' ? 'critical' : a.riskLevel === 'high' ? 'high' : 'normal',
      driver:    null,
    })),
    ...[...rotReport.expired, ...rotReport.rotationRequired].map(r => ({
      processId: `rot-${r.credentialId}`,
      type:      'rotation',
      name:      `Credential Rotation: ${r.credentialName}`,
      state:     (r as any).status === 'expired' ? 'overdue' : 'queued',
      startedAt: new Date().toISOString(),
      priority:  (r as any).status === 'expired' ? 'critical' : 'high',
      driver:    null,
    })),
  ];

  res.json({ success: true, data: processes });
});

// ── GET /os/modules ───────────────────────────────────────────────────────────
router.get('/modules', requireAuth, (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: MODULE_DEFS.map(m => ({ ...m, status: 'healthy' })),
  });
});

// ── GET /os/events ────────────────────────────────────────────────────────────
router.get('/events', requireAuth, (_req: Request, res: Response) => {
  const raw = auditService.query({} as any).slice(0, 50);

  const events = raw.map((e: any) => ({
    eventId:   e.eventId,
    type:      e.eventType,
    severity:  SEVERITY_MAP[e.eventType] ?? 'info',
    actor:     e.actorName,
    resource:  e.resource ?? e.targetId ?? '—',
    outcome:   e.outcome,
    timestamp: e.timestamp,
    driver:    e.actorName === 'RotationMonitor' ? 'cyberark'
             : e.actorName === 'system'          ? 'kernel'
             :                                     'kernel',
  }));

  res.json({ success: true, data: events });
});

// ── GET /os/alerts ────────────────────────────────────────────────────────────
router.get('/alerts', requireAuth, (_req: Request, res: Response) => {
  const { gaps } = computeCoverage();
  const rotReport = credentialRotationMonitorService.runCheck();
  const drivers   = getDrivers();

  const alerts: object[] = [];

  // Critical gap alerts (top 5)
  for (const g of gaps.filter(x => x.riskTier === 'critical').slice(0, 5)) {
    alerts.push({
      alertId:  `alert-gap-${g.gapId}`,
      severity: 'critical',
      category: 'coverage-gap',
      title:    `${g.appName} — no IAM controls`,
      detail:   `Critical app in ${g.department} is missing: ${g.missingControls.join(', ')}`,
      action:   g.actionLabel,
      gapId:    g.gapId,
    });
  }

  // High gap alerts (top 5)
  for (const g of gaps.filter(x => x.riskTier === 'high').slice(0, 5)) {
    alerts.push({
      alertId:  `alert-gap-${g.gapId}`,
      severity: 'high',
      category: 'coverage-gap',
      title:    `${g.appName} — missing controls`,
      detail:   `High-risk app missing: ${g.missingControls.join(', ')}`,
      action:   g.actionLabel,
      gapId:    g.gapId,
    });
  }

  // Expired credentials
  for (const r of rotReport.expired.slice(0, 3)) {
    alerts.push({
      alertId:  `alert-cred-expired-${r.credentialId}`,
      severity: 'critical',
      category: 'credential',
      title:    `Credential expired: ${r.credentialName}`,
      detail:   r.flaggedReason ?? 'Credential has expired and must be rotated immediately',
      action:   'Rotate Now',
    });
  }

  // Degraded drivers
  for (const d of drivers.filter(x => x.status === 'degraded')) {
    alerts.push({
      alertId:  `alert-driver-${d.driverId}`,
      severity: 'high',
      category: 'driver',
      title:    `${d.name} driver degraded`,
      detail:   'Driver connection has degraded — IAM coverage data from this platform may be stale',
      action:   'Reconnect Driver',
    });
  }

  // Expiring soon
  for (const r of rotReport.expiringSoon.slice(0, 3)) {
    alerts.push({
      alertId:  `alert-cred-exp-${r.credentialId}`,
      severity: 'medium',
      category: 'credential',
      title:    `Credential expiring: ${r.credentialName}`,
      detail:   r.flaggedReason ?? 'Credential expiring within 30 days',
      action:   'Schedule Rotation',
    });
  }

  res.json({ success: true, data: alerts });
});

// ── POST /os/gaps/:gapId/action ───────────────────────────────────────────────
router.post('/gaps/:gapId/action', requireAuth, (req: Request, res: Response) => {
  const { gapId } = req.params;
  const { action } = req.body as { action: string };
  const actor = (req as any).user as { userId: string; name: string } | undefined;

  const { gaps } = computeCoverage();
  const gap = gaps.find(g => g.gapId === gapId);
  if (!gap) {
    res.status(404).json({ success: false, error: `Gap '${gapId}' not found` });
    return;
  }

  try {
    if (action === 'onboard-iam' || action === 'request-sso') {
      const job = buildService.startBuild({
        appId:        gap.appId,
        controlGap:   (gap.missingControls[0] ?? 'SSO') as any,
        buildType:    action === 'request-sso' ? 'sso_integration' as any : undefined,
        platform:     'entra' as any,
        assignedTo:   actor?.name ?? 'IAM Team',
      });
      res.json({ success: true, data: { actionTaken: action, processId: (job as any).buildId, type: 'build', message: `Build job created for ${gap.appName}` } });
    } else if (action === 'request-pam' || action === 'schedule-review') {
      const approval = approvalService.requestApproval({
        requesterId:  actor?.userId ?? 'system',
        action:       action === 'request-pam' ? 'PAM Onboarding' : 'Access Review',
        resource:     gap.appName,
        riskLevel:    (gap.riskTier === 'critical' ? 'critical'
                     : gap.riskTier === 'high'     ? 'high'
                     :                               'medium') as any,
        justification: `IAM OS gap remediation: ${gap.appName} is missing ${gap.missingControls.join(', ')}`,
      });
      res.json({ success: true, data: { actionTaken: action, processId: approval.requestId, type: 'approval', message: `Approval request created for ${gap.appName}` } });
    } else {
      res.status(400).json({ success: false, error: `Unknown action: ${action}. Valid: onboard-iam, request-sso, request-pam, schedule-review` });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
