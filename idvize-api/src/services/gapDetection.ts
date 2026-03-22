import { v4 as uuidv4 } from 'uuid';
import { Application, IamGap, GapSummary, GapSeverity, IamDomain } from '../types';
import { applications } from '../data/applications';

// ─── Gap Rules ────────────────────────────────────────────────────────────────
// Each rule inspects an application and returns a gap if the condition is met.

type GapRule = (app: Application) => IamGap | null;

const GAP_RULES: GapRule[] = [
  // IGA: All apps with >50 users should have IGA coverage
  (app) => {
    if (!app.iamCoverage.IGA && app.userCount >= 50) {
      return {
        id: uuidv4(),
        appId: app.id,
        appName: app.name,
        domain: 'IGA',
        severity: app.criticality === 'critical' ? 'critical' : app.criticality === 'high' ? 'high' : 'medium',
        description: `${app.name} has ${app.userCount} users but no IGA coverage. User lifecycle (joiner/mover/leaver) is unmanaged.`,
        recommendation: `Onboard ${app.name} to SailPoint IdentityNow. Configure SCIM provisioning if supported.`,
        detectedAt: new Date().toISOString(),
        status: 'open',
      };
    }
    return null;
  },

  // AM: Critical apps without SSO/MFA via Access Management
  (app) => {
    if (!app.iamCoverage.AM && (app.criticality === 'critical' || app.criticality === 'high')) {
      return {
        id: uuidv4(),
        appId: app.id,
        appName: app.name,
        domain: 'AM',
        severity: app.criticality === 'critical' ? 'critical' : 'high',
        description: `${app.name} is a ${app.criticality}-criticality app with no SSO or MFA enforcement via an Access Management solution.`,
        recommendation: `Integrate ${app.name} with Entra ID via ${app.capabilities.includes('OIDC') ? 'OIDC' : app.capabilities.includes('SAML') ? 'SAML' : 'available protocol'}. Apply Conditional Access policy requiring MFA.`,
        detectedAt: new Date().toISOString(),
        status: 'open',
      };
    }
    return null;
  },

  // PAM: Critical apps with privileged access but no PAM
  (app) => {
    const isInfraOrAdmin = app.tags?.some(t => ['infrastructure', 'cloud', 'on-premise', 'erp', 'legacy'].includes(t));
    if (!app.iamCoverage.PAM && app.criticality === 'critical' && isInfraOrAdmin) {
      return {
        id: uuidv4(),
        appId: app.id,
        appName: app.name,
        domain: 'PAM',
        severity: 'critical',
        description: `${app.name} is a critical infrastructure/platform application with no privileged access management. Shared credentials or unmanaged admin accounts are a high-risk vector.`,
        recommendation: `Onboard privileged accounts for ${app.name} into CyberArk. Create a dedicated safe, enable CPM rotation, and restrict direct access via session isolation.`,
        detectedAt: new Date().toISOString(),
        status: 'open',
      };
    }
    return null;
  },

  // Legacy apps with no integrations — flag as critical risk
  (app) => {
    if (app.capabilities.length === 0 && app.criticality !== 'low') {
      return {
        id: uuidv4(),
        appId: app.id,
        appName: app.name,
        domain: 'IGA',
        severity: 'high',
        description: `${app.name} has no detected integration capabilities (no OIDC, SAML, SCIM, or REST). Manual provisioning likely — high compliance risk.`,
        recommendation: `Conduct an integration assessment for ${app.name}. If no modern protocols are available, consider API-based scripted connectors or identity gateway solutions.`,
        detectedAt: new Date().toISOString(),
        status: 'open',
      };
    }
    return null;
  },

  // CIAM: Customer-facing apps without CIAM coverage
  (app) => {
    const isCustomerFacing = app.tags?.includes('customer-facing') || app.userCount > 10000;
    if (!app.iamCoverage.CIAM && isCustomerFacing) {
      return {
        id: uuidv4(),
        appId: app.id,
        appName: app.name,
        domain: 'CIAM',
        severity: 'high',
        description: `${app.name} is customer-facing with ${app.userCount.toLocaleString()} users but has no CIAM solution managing identity, MFA, or consent.`,
        recommendation: `Implement a CIAM platform (e.g., Auth0, Entra External ID) for ${app.name} to handle customer registration, MFA, and progressive profiling.`,
        detectedAt: new Date().toISOString(),
        status: 'open',
      };
    }
    return null;
  },
];

// ─── Service ──────────────────────────────────────────────────────────────────

export function detectGaps(targetApps?: Application[]): GapSummary {
  const apps = targetApps ?? applications;
  const gaps: IamGap[] = [];

  for (const app of apps) {
    for (const rule of GAP_RULES) {
      const gap = rule(app);
      if (gap) gaps.push(gap);
    }
  }

  const bySeverity: Record<GapSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byDomain: Record<IamDomain, number> = { IGA: 0, AM: 0, PAM: 0, CIAM: 0 };

  for (const gap of gaps) {
    bySeverity[gap.severity]++;
    byDomain[gap.domain]++;
  }

  return {
    totalGaps: gaps.length,
    bySeverity,
    byDomain,
    gaps,
  };
}

export function detectGapsForApp(appId: string): GapSummary {
  const app = applications.find(a => a.id === appId);
  if (!app) return { totalGaps: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, byDomain: { IGA: 0, AM: 0, PAM: 0, CIAM: 0 }, gaps: [] };
  return detectGaps([app]);
}
