/**
 * IDVIZE IAM OS — IAM Risk Decision Engine
 *
 * Answers the CISO question: "Across ALL apps — where do I focus first?"
 *
 * Computes a per-application IAM Risk Score (0–100) from:
 *   • Control gaps (SSO / MFA / PAM / IGA / Certifications)
 *   • Risk tier + data classification (criticality weight)
 *   • Financial exposure (from Value Engine)
 *
 * Outputs a ranked portfolio list — most urgent app first.
 */

import { Application } from '../application/application.types';
import { computeAppValue } from '../value/value.engine';
import { DEFAULT_ASSUMPTIONS } from '../value/value.assumptions';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ControlCoverage {
  sso: boolean;
  mfa: boolean;
  pam: boolean;
  jml: boolean;
  scim: boolean;
  certifications: boolean;
}

export interface AppRiskSummary {
  appId: string;
  appName: string;
  riskTier: string;
  dataClassification: string;
  department: string;
  userPopulation: number;

  // IAM Risk Score
  riskScore: number;      // 0–100
  riskLevel: RiskLevel;   // CRITICAL / HIGH / MEDIUM / LOW
  riskDrivers: string[];  // human-readable explanation of score

  // Financial exposure (from Value Engine)
  estimatedExposure: number;       // current annual exposure $
  gapExposure: number;             // additional $ at risk due to open gaps

  // Priority across the portfolio
  priorityRank: number;            // 1 = most urgent

  // Gap list
  gaps: string[];

  // Control coverage map
  controlCoverage: ControlCoverage;
}

// ── Tier and classification weights ──────────────────────────────────────────

const TIER_BONUS: Record<string, number> = {
  critical: 20,
  high:     10,
  medium:    5,
  low:       0,
};

// Multiplier applied to the raw gap score based on data sensitivity
const CLASSIFICATION_MULTIPLIER: Record<string, number> = {
  restricted:   1.0,
  confidential: 0.9,
  internal:     0.7,
  public:       0.5,
};

// ── Core risk computation ─────────────────────────────────────────────────────

/**
 * Compute the IAM Risk Score and summary for a single application.
 * priorityRank is assigned by computePortfolioRisks after full-portfolio sort.
 */
export function computeAppRisk(app: Application): Omit<AppRiskSummary, 'priorityRank'> {
  const posture = app.iamPosture;
  const tier    = app.riskTier ?? 'low';
  const cls     = app.dataClassification ?? 'internal';

  // ── Control coverage ─────────────────────────────────────────────────────
  const cc: ControlCoverage = {
    sso:           posture?.ssoEnabled               ?? false,
    mfa:           posture?.mfaEnforced              ?? false,
    pam:           posture?.privilegedAccountsVaulted ?? false,
    jml:           posture?.jmlAutomated              ?? false,
    scim:          posture?.scimEnabled               ?? false,
    certifications: posture?.certificationsConfigured ?? false,
  };

  // ── Gap list ──────────────────────────────────────────────────────────────
  const gaps: string[] = [];
  if (!cc.sso)           gaps.push('SSO Missing');
  if (!cc.mfa)           gaps.push('MFA Missing');
  if (!cc.pam)           gaps.push('PAM Missing');
  if (!cc.jml && !cc.scim) gaps.push('IGA Not Configured');
  else if (!cc.jml)      gaps.push('JML Automation Missing');
  if (!cc.certifications) gaps.push('No Access Certifications');

  // ── Risk score ────────────────────────────────────────────────────────────
  // Per the user spec:
  //   if (hasCriticalGap) score += 50          → no MFA on high/critical app
  //   if (hasPrivilegedAccounts && noPAM) += 30 → PAM gap on high/critical
  //   if (orphanAccounts > 0) += 20             → no JML = likely orphans

  let rawScore = 0;

  // No MFA on a high or critical risk application — CRITICAL gap
  if (!cc.mfa && (tier === 'critical' || tier === 'high')) rawScore += 50;
  else if (!cc.mfa)                                        rawScore += 20;

  // PAM gap — privileged accounts unprotected
  if (!cc.pam && (tier === 'critical' || tier === 'high')) rawScore += 30;
  else if (!cc.pam)                                        rawScore += 10;

  // IGA gap — orphan account risk (no JML = unmanaged leavers)
  if (!cc.jml && !cc.scim) rawScore += 20;
  else if (!cc.jml)        rawScore += 10;

  // SSO missing — credential sprawl
  if (!cc.sso) rawScore += 10;

  // No access certifications — compliance and over-provisioning risk
  if (!cc.certifications) rawScore += 10;

  // Tier bonus (critical apps are always higher urgency)
  rawScore += TIER_BONUS[tier] ?? 0;

  // Apply data classification multiplier
  const multiplier = CLASSIFICATION_MULTIPLIER[cls] ?? 0.7;
  const riskScore  = Math.min(100, Math.round(rawScore * multiplier));

  // ── Risk level ────────────────────────────────────────────────────────────
  let riskLevel: RiskLevel;
  if (riskScore >= 75)      riskLevel = 'CRITICAL';
  else if (riskScore >= 50) riskLevel = 'HIGH';
  else if (riskScore >= 25) riskLevel = 'MEDIUM';
  else                      riskLevel = 'LOW';

  // ── Risk drivers (human-readable, priority-ordered) ───────────────────────
  const riskDrivers: string[] = [];

  if (!cc.mfa && (tier === 'critical' || tier === 'high')) {
    riskDrivers.push(`No MFA on ${tier}-risk app`);
  } else if (!cc.mfa) {
    riskDrivers.push('MFA not enforced');
  }

  if (!cc.pam && (tier === 'critical' || tier === 'high')) {
    riskDrivers.push('PAM gap — privileged accounts unvaulted');
  } else if (!cc.pam) {
    riskDrivers.push('Privileged accounts unvaulted');
  }

  if (!cc.jml && !cc.scim) {
    riskDrivers.push('IGA gap — orphan account risk');
  } else if (!cc.jml) {
    riskDrivers.push('Lifecycle automation missing');
  }

  if (!cc.sso) riskDrivers.push('No SSO — credential sprawl');
  if (!cc.certifications) riskDrivers.push('Access not certified');

  // ── Financial exposure (from Value Engine) ────────────────────────────────
  let estimatedExposure = 0;
  let gapExposure       = 0;
  try {
    const vp       = computeAppValue(app, DEFAULT_ASSUMPTIONS);
    estimatedExposure = Math.round(vp.currentAnnualExposure);
    gapExposure       = Math.round(vp.potentialAdditionalValue);
  } catch {
    // Value engine is non-critical — risk score still valid without it
  }

  return {
    appId:              app.appId,
    appName:            app.name,
    riskTier:           tier,
    dataClassification: cls,
    department:         app.department ?? 'Unknown',
    userPopulation:     app.userPopulation ?? 0,
    riskScore,
    riskLevel,
    riskDrivers,
    estimatedExposure,
    gapExposure,
    gaps,
    controlCoverage: cc,
  };
}

/**
 * Evaluate ALL applications, sort by risk score (desc), assign priority ranks.
 * Returns portfolio ranked from highest to lowest risk.
 */
export function computePortfolioRisks(apps: Application[]): AppRiskSummary[] {
  const TIER_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const results = apps
    .map(app => computeAppRisk(app))
    .sort((a, b) => {
      // Primary: risk score descending
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
      // Secondary: tier (critical before high)
      return (TIER_ORDER[a.riskTier] ?? 9) - (TIER_ORDER[b.riskTier] ?? 9);
    });

  // Assign priority rank (1 = most urgent)
  return results.map((r, i) => ({ ...r, priorityRank: i + 1 }));
}

// ── Portfolio summary ─────────────────────────────────────────────────────────

export interface PortfolioRiskSummary {
  totalApps: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalExposure: number;
  totalGapExposure: number;
  appsWithGaps: number;
  topRiskDrivers: Array<{ driver: string; count: number }>;
}

export function buildPortfolioRiskSummary(ranked: AppRiskSummary[]): PortfolioRiskSummary {
  // Aggregate all risk drivers to find the most common
  const driverCount = new Map<string, number>();
  for (const app of ranked) {
    for (const d of app.riskDrivers) {
      // Normalise driver text for aggregation
      const key = d.replace(/critical|high|medium|low/gi, '').trim();
      driverCount.set(key, (driverCount.get(key) ?? 0) + 1);
    }
  }

  const topRiskDrivers = [...driverCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([driver, count]) => ({ driver, count }));

  return {
    totalApps:       ranked.length,
    critical:        ranked.filter(r => r.riskLevel === 'CRITICAL').length,
    high:            ranked.filter(r => r.riskLevel === 'HIGH').length,
    medium:          ranked.filter(r => r.riskLevel === 'MEDIUM').length,
    low:             ranked.filter(r => r.riskLevel === 'LOW').length,
    totalExposure:   Math.round(ranked.reduce((s, r) => s + r.estimatedExposure, 0)),
    totalGapExposure:Math.round(ranked.reduce((s, r) => s + r.gapExposure, 0)),
    appsWithGaps:    ranked.filter(r => r.gaps.length > 0).length,
    topRiskDrivers,
  };
}
