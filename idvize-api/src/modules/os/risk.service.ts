/**
 * IAM Risk Service
 *
 * Business logic layer for the Top IAM Risk Engine.
 * Controller calls this service; this service calls the risk-assessment engine
 * and the application repository.
 */

import { applicationRepository } from '../application/application.repository';
import { assessPortfolioRisks, assessApplicationRisk, buildRiskSummary } from './risk-assessment.engine';
import type { ApplicationRisk, RiskSummary, AssessmentRiskLevel } from './risk-assessment.engine';

const VALID_LEVELS = new Set<string>(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

export interface PortfolioRiskResult {
  summary: RiskSummary;
  risks: ApplicationRisk[];
}

class RiskService {
  /**
   * Assess all applications for a tenant, sorted by highest risk first.
   * Optional level filter restricts results to a single risk level.
   * tenantId MUST come from authenticated context (JWT).
   */
  getPortfolioRisks(tenantId: string, levelFilter?: string): PortfolioRiskResult {
    const apps = applicationRepository.findAll(tenantId);
    const risks = assessPortfolioRisks(apps, tenantId);
    const summary = buildRiskSummary(risks);

    const normalised = levelFilter?.toUpperCase();
    const filtered = normalised && VALID_LEVELS.has(normalised)
      ? risks.filter(r => r.riskLevel === normalised as AssessmentRiskLevel)
      : risks;

    return { summary, risks: filtered };
  }

  /**
   * Assess a single application's risk.
   * Looks up the app by BOTH applicationId AND tenantId.
   * Returns undefined if not found in the tenant (prevents cross-tenant access).
   */
  getApplicationRisk(tenantId: string, applicationId: string): ApplicationRisk | undefined {
    const app = applicationRepository.findById(tenantId, applicationId);
    if (!app) return undefined;
    return assessApplicationRisk(app, tenantId);
  }
}

export const riskService = new RiskService();
