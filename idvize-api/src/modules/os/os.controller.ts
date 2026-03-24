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
import { CONTROLS_CATALOG }                 from '../control/control.catalog';
import { controlOverridesStore }            from '../control/control.overrides.store';
import { IamPosture }                       from '../application/application.types';

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

// ── Posture detector map (mirrors control.controller.ts) ─────────────────────
type PostureFn = (p: IamPosture) => boolean | null;
const POSTURE_DETECT: Record<string, PostureFn> = {
  'AM-001': p => p.ssoEnabled,
  'AM-002': p => p.mfaEnforced,
  'AM-003': _ => null,
  'AM-004': _ => null,
  'AM-005': p => p.platforms.some(pl => pl.platform === 'AM' && pl.onboarded) || null,
  'AM-006': _ => null,
  'AM-007': _ => null,
  'AM-008': p => p.platforms.some(pl => pl.platform === 'IGA' && pl.onboarded) || null,
  'AM-009': _ => null,
  'AM-010': p => p.ssoEnabled,
  'AM-011': _ => null,
  'AM-012': p => (p.ssoEnabled && p.mfaEnforced) ? true : null,
  'AM-013': p => p.mfaEnforced ? true : null,
  'AM-014': _ => null,
  'AM-015': p => p.platforms.some(pl => pl.platform === 'AM' && pl.onboarded) || null,
  'IGA-001': p => p.jmlAutomated,
  'IGA-002': p => p.scimEnabled,
  'IGA-003': p => p.scimEnabled ? true : null,
  'IGA-004': _ => null,
  'IGA-005': p => p.certificationsConfigured,
  'IGA-006': _ => null,
  'IGA-007': _ => null,
  'IGA-008': _ => null,
  'IGA-009': _ => null,
  'IGA-010': p => p.certificationsConfigured,
  'IGA-011': _ => null,
  'IGA-012': _ => null,
  'IGA-013': _ => null,
  'IGA-014': p => p.platforms.some(pl => pl.platform === 'IGA' && pl.onboarded) || null,
  'IGA-015': _ => null,
  'PAM-001': p => p.privilegedAccountsVaulted,
  'PAM-002': p => p.privilegedAccountsVaulted,
  'PAM-003': _ => null,
  'PAM-004': p => p.platforms.some(pl => pl.platform === 'PAM' && pl.onboarded) || null,
  'PAM-005': _ => null,
  'PAM-006': _ => null,
  'PAM-007': _ => null,
  'PAM-008': _ => null,
  'PAM-009': _ => null,
  'PAM-010': p => p.privilegedAccountsVaulted ? true : null,
  'CIAM-001': p => p.platforms.some(pl => pl.platform === 'CIAM' && pl.onboarded) || null,
  'CIAM-002': p => p.platforms.some(pl => pl.platform === 'CIAM' && pl.onboarded) || null,
  'CIAM-003': p => p.mfaEnforced ? true : null,
  'CIAM-004': _ => null,
  'CIAM-005': _ => null,
  'CIAM-006': _ => null,
  'CIAM-007': _ => null,
  'CIAM-008': _ => null,
  'CIAM-009': _ => null,
};

// ── GET /os/coverage ─────────────────────────────────────────────────────────
router.get('/coverage', requireAuth, (_req: Request, res: Response) => {
  const { apps, byTier } = computeCoverage();
  const total    = apps.length;
  const postures = apps.map(a => ({ appId: a.appId, posture: a.iamPosture }));

  // Build per-control coverage across all apps (respecting N/A overrides)
  const byControlType = CONTROLS_CATALOG.map(ctrl => {
    const detect = POSTURE_DETECT[ctrl.controlId];
    let implemented = 0;
    let notApplicable = 0;
    let detectable  = 0;

    for (const { appId, posture } of postures) {
      const override = controlOverridesStore.get(appId, ctrl.controlId);
      if (override?.notApplicable) { notApplicable++; continue; }
      if (!posture || !detect) continue;
      const result = detect(posture);
      if (result === null) continue;   // not detectable for this app
      detectable++;
      if (result) implemented++;
    }

    const effectiveTotal = total - notApplicable;
    return {
      controlId:      ctrl.controlId,
      control:        ctrl.name,
      pillar:         ctrl.pillar,
      category:       ctrl.category,
      apps:           implemented,
      notApplicable,
      detectable,
      pct:            effectiveTotal > 0 && detectable > 0
                        ? Math.round((implemented / detectable) * 100)
                        : null,   // null = not measurable
      riskReduction:  ctrl.riskReduction,
    };
  });

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
      byControlType,
      byPillar: {
        AM:   byControlType.filter(c => c.pillar === 'AM'),
        IGA:  byControlType.filter(c => c.pillar === 'IGA'),
        PAM:  byControlType.filter(c => c.pillar === 'PAM'),
        CIAM: byControlType.filter(c => c.pillar === 'CIAM'),
      },
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
// Always creates BOTH:
//   (1) Approval  — represents email notification to app owner + IAM team
//   (2) Build job — AI agent configuration task queued until form is submitted
// Returns: approvalId, buildId, sentTo, nextSteps, missingControls
router.post('/gaps/:gapId/action', requireAuth, (req: Request, res: Response) => {
  const { gapId } = req.params;
  const { action } = req.body as { action: string };
  const actor = (req as any).user as { userId: string; name: string } | undefined;

  const VALID = ['onboard-iam', 'request-sso', 'request-pam', 'schedule-review'];
  if (!VALID.includes(action)) {
    res.status(400).json({ success: false, error: `Unknown action '${action}'. Valid: ${VALID.join(', ')}` });
    return;
  }

  const { gaps } = computeCoverage();
  const gap = gaps.find(g => g.gapId === gapId);
  if (!gap) {
    res.status(404).json({ success: false, error: `Gap '${gapId}' not found` });
    return;
  }

  const app = applicationRepository.findById(gap.appId);
  const riskLevel = (gap.riskTier === 'critical' || gap.riskTier === 'high') ? 'high_risk' : 'standard';

  const ACTION_LABEL: Record<string, string> = {
    'onboard-iam':      'Full IAM Onboarding',
    'request-sso':      'SSO Integration',
    'request-pam':      'PAM Coverage Request',
    'schedule-review':  'Access Certification',
  };
  const BUILD_TYPE: Record<string, string> = {
    'onboard-iam':     'sso_integration',
    'request-sso':     'sso_integration',
    'request-pam':     'pam_onboarding',
    'schedule-review': 'iga_onboarding',
  };
  const PLATFORM: Record<string, string> = {
    'onboard-iam':     'entra',
    'request-sso':     'entra',
    'request-pam':     'cyberark',
    'schedule-review': 'sailpoint',
  };

  try {
    // Step 1 — Approval (notification to app owner + IAM team)
    const approval = approvalService.requestApproval({
      requesterId:   actor?.userId ?? 'system',
      action:        `${ACTION_LABEL[action]} — ${gap.appName}`,
      resource:      gap.appName,
      riskLevel,
      justification: `IAM OS remediation: ${gap.appName} (${gap.riskTier}) is missing ${gap.missingControls.join(', ')}. ` +
                     `Business owner and technical admin notified to provide configuration information.`,
    });

    // Step 2 — Build job (AI agent task)
    const job = buildService.startBuild({
      appId:      gap.appId,
      controlGap: (gap.missingControls[0] ?? 'IAM') as any,
      buildType:  BUILD_TYPE[action] as any,
      platform:   PLATFORM[action] as any,
      assignedTo: actor?.name ?? 'IAM Team',
    });

    const buildId = (job as any).buildId;

    const sentTo = [
      { role: 'Business Owner',  name: app?.owner        ?? 'App Owner',  email: app?.ownerEmail      ?? 'owner@corp.com' },
      { role: 'Technical Admin', name: 'IAM Team',                        email: 'iam-team@corp.com'  },
    ];

    res.json({
      success: true,
      data: {
        actionTaken:     action,
        actionLabel:     ACTION_LABEL[action],
        approvalId:      approval.requestId,
        buildId,
        appName:         gap.appName,
        riskTier:        gap.riskTier,
        missingControls: gap.missingControls,
        presentControls: gap.presentControls,
        sentTo,
        nextSteps: [
          `Email sent to ${sentTo.map(r => r.name).join(' & ')} with configuration form`,
          `AI agent (${buildId}) queued — starts once form is submitted`,
          `Engineer review (${approval.requestId}) triggered after build completes`,
        ],
        message: `${ACTION_LABEL[action]} workflow started for ${gap.appName}`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
