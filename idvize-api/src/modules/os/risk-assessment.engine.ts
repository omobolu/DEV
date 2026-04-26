/**
 * IDVIZE IAM OS — Control-Assessment Risk Engine (v1)
 *
 * Calculates per-application IAM risk based on the 49-control catalog
 * assessment outcomes:
 *
 *   OK   = control detected / implemented
 *   ATTN = undetected (needs attention — status unknown)
 *   GAP  = confirmed missing
 *
 * Risk classification rules:
 *   CRITICAL — >= 3 GAP controls
 *   HIGH     — >= 2 GAP controls OR (1 GAP + >= 2 ATTN)
 *   MEDIUM   — only ATTN controls (zero GAPs)
 *   LOW      — all OK (zero GAPs, zero ATTNs)
 *
 * This engine is separate from the existing risk.engine.ts which scores
 * risk from posture fields (SSO/MFA/PAM). This engine uses the full
 * 49-control catalog with the detectStatus() logic from control evaluation.
 */

import { Application, IamPosture } from '../application/application.types';
import { CONTROLS_CATALOG, IamPillar } from '../control/control.catalog';
import { controlOverridesStore } from '../control/control.overrides.store';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssessmentRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ControlOutcome = 'OK' | 'ATTN' | 'GAP';

export interface ControlDriver {
  controlId: string;
  controlName: string;
  pillar: IamPillar;
  outcome: 'GAP' | 'ATTN';
}

export interface ApplicationRisk {
  applicationId: string;
  applicationName: string;
  tenantId: string;
  riskLevel: AssessmentRiskLevel;
  gapCount: number;
  attentionCount: number;
  okCount: number;
  totalControls: number;
  drivers: ControlDriver[];
}

export interface RiskSummary {
  totalApplications: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

// ── Risk level sort order (for descending sort: CRITICAL first) ──────────────

const RISK_ORDER: Record<AssessmentRiskLevel, number> = {
  CRITICAL: 0,
  HIGH:     1,
  MEDIUM:   2,
  LOW:      3,
};

// ── Control detection (mirrors control.controller.ts detectStatus) ───────────

type PostureDetector = (posture: IamPosture) => boolean | null;

const POSTURE_MAP: Record<string, PostureDetector> = {
  'AM-001':  p => p.ssoEnabled,
  'AM-002':  p => p.mfaEnforced,
  'AM-003':  () => null,
  'AM-004':  () => null,
  'AM-005':  p => p.platforms.some(pl => pl.platform === 'AM' && pl.onboarded) || null,
  'AM-006':  () => null,
  'AM-007':  () => null,
  'AM-008':  p => p.platforms.some(pl => pl.platform === 'IGA' && pl.onboarded) || null,
  'AM-009':  () => null,
  'AM-010':  p => p.ssoEnabled,
  'AM-011':  () => null,
  'AM-012':  p => (p.ssoEnabled && p.mfaEnforced) ? true : null,
  'AM-013':  p => p.mfaEnforced ? true : null,
  'AM-014':  () => null,
  'AM-015':  p => p.platforms.some(pl => pl.platform === 'AM' && pl.onboarded) || null,
  'IGA-001': p => p.jmlAutomated,
  'IGA-002': p => p.scimEnabled,
  'IGA-003': p => p.scimEnabled ? true : null,
  'IGA-004': () => null,
  'IGA-005': p => p.certificationsConfigured,
  'IGA-006': () => null,
  'IGA-007': () => null,
  'IGA-008': () => null,
  'IGA-009': () => null,
  'IGA-010': p => p.certificationsConfigured,
  'IGA-011': () => null,
  'IGA-012': () => null,
  'IGA-013': () => null,
  'IGA-014': p => p.platforms.some(pl => pl.platform === 'IGA' && pl.onboarded) || null,
  'IGA-015': () => null,
  'PAM-001': p => p.privilegedAccountsVaulted,
  'PAM-002': p => p.privilegedAccountsVaulted,
  'PAM-003': () => null,
  'PAM-004': p => p.platforms.some(pl => pl.platform === 'PAM' && pl.onboarded) || null,
  'PAM-005': () => null,
  'PAM-006': () => null,
  'PAM-007': () => null,
  'PAM-008': () => null,
  'PAM-009': () => null,
  'PAM-010': p => p.privilegedAccountsVaulted ? true : null,
  'CIAM-001': p => p.platforms.some(pl => pl.platform === 'CIAM' && pl.onboarded) || null,
  'CIAM-002': p => p.platforms.some(pl => pl.platform === 'CIAM' && pl.onboarded) || null,
  'CIAM-003': p => p.mfaEnforced ? true : null,
  'CIAM-004': () => null,
  'CIAM-005': () => null,
  'CIAM-006': () => null,
  'CIAM-007': () => null,
  'CIAM-008': () => null,
  'CIAM-009': () => null,
};

function detectOutcome(controlId: string, posture: IamPosture | undefined): ControlOutcome {
  if (!posture) return 'ATTN';
  const detector = POSTURE_MAP[controlId];
  if (!detector) return 'ATTN';
  const result = detector(posture);
  if (result === null) return 'ATTN';
  return result ? 'OK' : 'GAP';
}

// ── Per-app risk assessment ──────────────────────────────────────────────────

function assessControlOutcome(controlId: string, appId: string, posture: IamPosture | undefined): ControlOutcome {
  const override = controlOverridesStore.get(appId, controlId);
  if (override?.notApplicable) return 'OK';
  return detectOutcome(controlId, posture);
}

/**
 * Classify risk level from GAP and ATTN counts.
 *
 *   CRITICAL — >= 3 GAP controls
 *   HIGH     — >= 2 GAP controls OR (1 GAP + >= 2 ATTN)
 *   MEDIUM   — only ATTN controls (zero GAPs but ATTN > 0)
 *   LOW      — all OK (zero GAPs and zero ATTNs)
 */
function classifyRisk(gapCount: number, attentionCount: number): AssessmentRiskLevel {
  if (gapCount >= 3) return 'CRITICAL';
  if (gapCount >= 2) return 'HIGH';
  if (gapCount === 1 && attentionCount >= 2) return 'HIGH';
  if (attentionCount > 0) return 'MEDIUM';
  return 'LOW';
}

/**
 * Compute risk for a single application using the 49-control catalog.
 */
export function assessApplicationRisk(app: Application, tenantId: string): ApplicationRisk {
  let gapCount = 0;
  let attentionCount = 0;
  let okCount = 0;
  const drivers: ControlDriver[] = [];

  for (const ctrl of CONTROLS_CATALOG) {
    const outcome = assessControlOutcome(ctrl.controlId, app.appId, app.iamPosture);
    if (outcome === 'GAP') {
      gapCount++;
      drivers.push({
        controlId: ctrl.controlId,
        controlName: ctrl.name,
        pillar: ctrl.pillar,
        outcome: 'GAP',
      });
    } else if (outcome === 'ATTN') {
      attentionCount++;
      drivers.push({
        controlId: ctrl.controlId,
        controlName: ctrl.name,
        pillar: ctrl.pillar,
        outcome: 'ATTN',
      });
    } else {
      okCount++;
    }
  }

  return {
    applicationId: app.appId,
    applicationName: app.name,
    tenantId,
    riskLevel: classifyRisk(gapCount, attentionCount),
    gapCount,
    attentionCount,
    okCount,
    totalControls: CONTROLS_CATALOG.length,
    drivers,
  };
}

/**
 * Assess all applications for a tenant, sorted by highest risk first.
 * Tie-breaking: gapCount desc → attentionCount desc → name asc.
 */
export function assessPortfolioRisks(apps: Application[], tenantId: string): ApplicationRisk[] {
  return apps
    .map(app => assessApplicationRisk(app, tenantId))
    .sort((a, b) => {
      const levelDiff = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
      if (levelDiff !== 0) return levelDiff;
      if (b.gapCount !== a.gapCount) return b.gapCount - a.gapCount;
      if (b.attentionCount !== a.attentionCount) return b.attentionCount - a.attentionCount;
      return a.applicationName.localeCompare(b.applicationName);
    });
}

/**
 * Build summary counts from assessed risks.
 */
export function buildRiskSummary(risks: ApplicationRisk[]): RiskSummary {
  return {
    totalApplications: risks.length,
    critical: risks.filter(r => r.riskLevel === 'CRITICAL').length,
    high:     risks.filter(r => r.riskLevel === 'HIGH').length,
    medium:   risks.filter(r => r.riskLevel === 'MEDIUM').length,
    low:      risks.filter(r => r.riskLevel === 'LOW').length,
  };
}
