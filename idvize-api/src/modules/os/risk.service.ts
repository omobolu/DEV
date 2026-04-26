/**
 * IAM Risk Service
 *
 * Business logic layer for the Top IAM Risk Engine.
 * Queries PostgreSQL via riskRepository — no in-memory data.
 * Classification logic (classifyRisk) runs in the application layer.
 *
 * Production fail-closed: if PG is unavailable, throws (controller returns 503).
 */

import { riskRepository } from './risk.repository';
import type { AssessmentRiskLevel, ApplicationRisk, RiskSummary, ControlDriver } from './risk-assessment.engine';
import { CONTROLS_CATALOG } from '../control/control.catalog';
import type { IamPillar } from '../control/control.catalog';

const VALID_LEVELS = new Set<string>(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

const RISK_ORDER: Record<AssessmentRiskLevel, number> = {
  CRITICAL: 0,
  HIGH:     1,
  MEDIUM:   2,
  LOW:      3,
};

export interface PortfolioRiskResult {
  summary: RiskSummary;
  risks: ApplicationRisk[];
}

function classifyRisk(gapCount: number, attentionCount: number): AssessmentRiskLevel {
  if (gapCount >= 3) return 'CRITICAL';
  if (gapCount >= 2) return 'HIGH';
  if (gapCount === 1 && attentionCount >= 2) return 'HIGH';
  if (gapCount === 1) return 'MEDIUM';
  if (attentionCount > 0) return 'MEDIUM';
  return 'LOW';
}

class RiskService {
  /**
   * Assess all applications for a tenant, sorted by highest risk first.
   * Optional level filter restricts results to a single risk level.
   * tenantId MUST come from authenticated context (JWT).
   */
  async getPortfolioRisks(tenantId: string, levelFilter?: string): Promise<PortfolioRiskResult> {
    const rows = await riskRepository.getPortfolioRisks(tenantId);

    const risks: ApplicationRisk[] = rows.map(r => ({
      applicationId: r.appId,
      applicationName: r.applicationName,
      tenantId: r.tenantId,
      riskLevel: classifyRisk(r.gapCount, r.attentionCount),
      gapCount: r.gapCount,
      attentionCount: r.attentionCount,
      drivers: r.drivers as ControlDriver[],
    }));

    risks.sort((a, b) => {
      const levelDiff = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
      if (levelDiff !== 0) return levelDiff;
      if (b.gapCount !== a.gapCount) return b.gapCount - a.gapCount;
      if (b.attentionCount !== a.attentionCount) return b.attentionCount - a.attentionCount;
      return a.applicationName.localeCompare(b.applicationName);
    });

    const summary: RiskSummary = {
      totalApplications: rows.length,
      critical: risks.filter(r => r.riskLevel === 'CRITICAL').length,
      high:     risks.filter(r => r.riskLevel === 'HIGH').length,
      medium:   risks.filter(r => r.riskLevel === 'MEDIUM').length,
      low:      risks.filter(r => r.riskLevel === 'LOW').length,
    };

    const normalised = levelFilter?.toUpperCase();
    const filtered = normalised && VALID_LEVELS.has(normalised)
      ? risks.filter(r => r.riskLevel === normalised as AssessmentRiskLevel)
      : risks;

    return { summary, risks: filtered };
  }

  /**
   * Assess a single application's risk.
   * Looks up by BOTH applicationId AND tenantId via PG.
   * Returns undefined if not found in tenant (prevents cross-tenant access).
   */
  async getApplicationRisk(tenantId: string, applicationId: string): Promise<ApplicationRisk | undefined> {
    const row = await riskRepository.getApplicationRisk(tenantId, applicationId);
    if (!row) return undefined;

    return {
      applicationId: row.appId,
      applicationName: row.applicationName,
      tenantId: row.tenantId,
      riskLevel: classifyRisk(row.gapCount, row.attentionCount),
      gapCount: row.gapCount,
      attentionCount: row.attentionCount,
      drivers: row.drivers as ControlDriver[],
    };
  }

  /**
   * Fetch all 49 controls for an application, enriched with catalog metadata.
   * GAP and ATTN controls include recommended remediation actions from the catalog.
   * Returns undefined if the app doesn't belong to the tenant.
   */
  async getApplicationControls(tenantId: string, applicationId: string): Promise<ApplicationControlsResult | undefined> {
    const rows = await riskRepository.getApplicationControls(tenantId, applicationId);
    if (rows.length === 0) return undefined;

    const catalogMap = new Map(CONTROLS_CATALOG.map(c => [c.controlId, c]));

    const controls: EnrichedControl[] = rows.map(r => {
      const catalog = catalogMap.get(r.controlId);
      return {
        controlId: r.controlId,
        controlName: r.controlName,
        pillar: r.pillar,
        outcome: r.outcome,
        category: catalog?.category ?? 'Unknown',
        description: catalog?.description ?? '',
        riskReduction: catalog?.riskReduction ?? 'medium',
        implementationComplexity: catalog?.implementationComplexity ?? 'medium',
        policyDrivers: catalog?.policyDrivers ?? [],
        capabilities: catalog?.capabilities ?? [],
        recommendedActions: catalog?.platform.agentActions ?? [],
        platformName: catalog?.platform.platformName ?? '',
        evaluatedAt: r.evaluatedAt,
      };
    });

    // Sort: GAP first, then ATTN, then OK. Within same outcome, sort by controlId.
    const OUTCOME_ORDER: Record<string, number> = { GAP: 0, ATTN: 1, OK: 2 };
    controls.sort((a, b) => {
      const outcomeDiff = (OUTCOME_ORDER[a.outcome] ?? 2) - (OUTCOME_ORDER[b.outcome] ?? 2);
      if (outcomeDiff !== 0) return outcomeDiff;
      return a.controlId.localeCompare(b.controlId);
    });

    const gapCount = controls.filter(c => c.outcome === 'GAP').length;
    const attentionCount = controls.filter(c => c.outcome === 'ATTN').length;
    const okCount = controls.filter(c => c.outcome === 'OK').length;

    return {
      applicationId: rows[0].appId,
      applicationName: rows[0].applicationName,
      tenantId: rows[0].tenantId,
      riskLevel: classifyRisk(gapCount, attentionCount),
      summary: { total: controls.length, gap: gapCount, attention: attentionCount, ok: okCount },
      controls,
    };
  }
}

export interface EnrichedControl {
  controlId: string;
  controlName: string;
  pillar: IamPillar;
  outcome: 'OK' | 'ATTN' | 'GAP';
  category: string;
  description: string;
  riskReduction: string;
  implementationComplexity: string;
  policyDrivers: string[];
  capabilities: string[];
  recommendedActions: string[];
  platformName: string;
  evaluatedAt: string;
}

export interface ApplicationControlsResult {
  applicationId: string;
  applicationName: string;
  tenantId: string;
  riskLevel: AssessmentRiskLevel;
  summary: { total: number; gap: number; attention: number; ok: number };
  controls: EnrichedControl[];
}

export const riskService = new RiskService();
