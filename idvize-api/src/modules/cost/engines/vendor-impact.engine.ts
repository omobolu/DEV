import {
  VendorImpact, VendorRecommendation, IntegrationComplexity,
  VendorRiskLevel, SupportedStandard,
} from '../cost.types';
import { vendorRepository } from '../repositories/vendor.repository';
import { contractRepository } from '../repositories/contract.repository';
import { applicationRepository } from '../../application/application.repository';
import { buildRepository } from '../../build/build.repository';

/**
 * Vendor Impact Scoring Engine
 *
 * For each vendor, computes:
 * - Total cost contribution
 * - Dependency score (how many apps/platforms depend on them)
 * - Integration complexity score
 * - Efficiency score (value delivered per dollar)
 * - Risk score (switching complexity, single-point-of-failure risk)
 * - Recommendations
 */
export class VendorImpactEngine {

  analyzeAll(): VendorImpact[] {
    return vendorRepository.findAll().map(v => this.analyzeVendor(v.vendorId)).filter(Boolean) as VendorImpact[];
  }

  analyzeVendor(vendorId: string): VendorImpact | null {
    const vendor = vendorRepository.findById(vendorId);
    if (!vendor) return null;

    const contracts = contractRepository.findByVendor(vendorId).filter(c => c.status === 'active');
    const totalCost = contracts.reduce((sum, c) => sum + c.annualCost, 0);

    // ── Apps supported ───────────────────────────────────────────────────────
    const allApps = applicationRepository.findAll();
    const appsFromVendor = allApps.filter(a =>
      a.vendor?.toLowerCase().includes(vendor.name.toLowerCase()) ||
      vendor.name.toLowerCase().includes((a.vendor ?? '').toLowerCase()) ||
      // Also check via contract app links
      contracts.some(c => c.linkedAppIds?.includes(a.appId))
    );

    // ── Build data correlation ────────────────────────────────────────────────
    const builds = buildRepository.findAll();
    const buildsForVendor = builds.filter(b => b.platform === vendor.category || contracts.some(c => c.linkedPlatforms?.includes(b.platform)));
    const completedBuilds = buildsForVendor.filter(b => b.state === 'COMPLETED');

    // ── Scoring ──────────────────────────────────────────────────────────────
    const dependencyScore = computeDependencyScore(vendor, appsFromVendor.length, contracts);
    const integrationScore = computeIntegrationScore(vendor);
    const efficiencyScore = computeEfficiencyScore(totalCost, appsFromVendor.length, vendor.type);
    const riskScore = computeRiskScore(vendor, dependencyScore, totalCost);
    const riskLevel = riskLevelFromScore(riskScore);

    const switchingComplexity = deriveSwitchingComplexity(vendor, dependencyScore);

    // ── Recommendations ──────────────────────────────────────────────────────
    const recommendations = generateRecommendations(
      vendor, totalCost, dependencyScore, integrationScore, efficiencyScore, riskScore, appsFromVendor.length
    );

    return {
      vendorId,
      vendorName: vendor.name,
      vendorType: vendor.type,

      totalAnnualCost: totalCost,
      contractCount: contracts.length,

      numberOfAppsSupported: appsFromVendor.length,
      numberOfPlatformsCovered: contracts.reduce((sum, c) => sum + (c.linkedPlatforms?.length ?? 0), 0),
      dependencyScore,
      switchingComplexity,
      switchingCostEstimate: estimateSwitchingCost(vendor, totalCost, dependencyScore),

      averageIntegrationComplexity: vendor.integrationComplexity,
      standardsSupported: vendor.supportedStandards,
      customBuildRequired: vendor.integrationComplexity === 'custom' || vendor.integrationComplexity === 'manual',
      integrationScore,

      costPerApp: appsFromVendor.length > 0 ? Math.round(totalCost / appsFromVendor.length) : totalCost,
      efficiencyScore,

      riskLevel,
      riskScore,
      riskFactors: identifyRiskFactors(vendor, dependencyScore, totalCost, appsFromVendor.length),

      recommendations,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

// ── Scoring Functions ─────────────────────────────────────────────────────────

function computeDependencyScore(vendor: any, appCount: number, contracts: any[]): number {
  let score = 0;

  // More apps = higher dependency
  if (appCount >= 10) score += 40;
  else if (appCount >= 5) score += 30;
  else if (appCount >= 2) score += 20;
  else if (appCount >= 1) score += 10;

  // Core IAM platform = high dependency
  if (vendor.type === 'iam_platform') score += 30;
  if (vendor.type === 'implementation_partner') score += 20;
  if (vendor.type === 'staff_augmentation') score += 15;

  // High cost = dependency signal
  const totalCost = contracts.filter(c => c.status === 'active').reduce((s: number, c: any) => s + c.annualCost, 0);
  if (totalCost > 400000) score += 20;
  else if (totalCost > 200000) score += 10;
  else if (totalCost > 100000) score += 5;

  // Auto-renew contracts = entrenched
  if (contracts.some((c: any) => c.autoRenew)) score += 10;

  return Math.min(score, 100);
}

function computeIntegrationScore(vendor: any): number {
  // Higher = easier/better integration (standardized, documented, native)
  let score = 0;
  score += vendor.apiMaturity * 10;           // 0–50
  score += vendor.documentationQuality * 6;   // 0–30

  const complexityBonus: Record<IntegrationComplexity, number> = {
    native: 20, standard: 15, custom: 5, manual: 0, unknown: 5,
  };
  score += complexityBonus[vendor.integrationComplexity as IntegrationComplexity] ?? 5;

  // Standards support bonus
  const standards = vendor.supportedStandards as SupportedStandard[];
  if (standards.includes('SCIM')) score += 10;
  if (standards.includes('OIDC')) score += 5;

  return Math.min(score, 100);
}

function computeEfficiencyScore(totalCost: number, appCount: number, vendorType: string): number {
  if (totalCost === 0) return 50;

  let score = 50; // base

  // Cost per app relative to industry benchmark
  const benchmarks: Record<string, number> = {
    iam_platform: 50000,        // $50K/app is good for IAM platform
    application: 20000,         // $20K/app
    implementation_partner: 15000, // $15K/integration
    staff_augmentation: 40000,  // $40K/FTE
  };

  const benchmark = benchmarks[vendorType] ?? 30000;
  const costPerApp = appCount > 0 ? totalCost / appCount : totalCost;

  if (costPerApp < benchmark * 0.5) score += 30;        // Very efficient
  else if (costPerApp < benchmark) score += 15;          // Efficient
  else if (costPerApp < benchmark * 1.5) score -= 0;     // Average
  else if (costPerApp < benchmark * 2) score -= 15;      // Expensive
  else score -= 30;                                       // Very expensive

  // IAM platforms always provide core infrastructure value
  if (vendorType === 'iam_platform') score += 10;

  return Math.min(Math.max(score, 0), 100);
}

function computeRiskScore(vendor: any, dependencyScore: number, totalCost: number): number {
  let score = 0;

  // Dependency is the biggest risk driver
  score += dependencyScore * 0.4;

  // Single-vendor concentration risk
  if (totalCost > 400000) score += 25;
  else if (totalCost > 200000) score += 15;
  else if (totalCost > 100000) score += 8;

  // Legacy or manual integration = high risk
  if (vendor.integrationComplexity === 'manual') score += 20;
  if (vendor.integrationComplexity === 'custom') score += 10;
  if (vendor.marketPresence === 'legacy') score += 15;
  if (vendor.marketPresence === 'niche') score += 5;

  // Low API maturity = risk
  if (vendor.apiMaturity <= 2) score += 10;
  if (vendor.documentationQuality <= 2) score += 5;

  return Math.min(score, 100);
}

function riskLevelFromScore(score: number): VendorRiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function deriveSwitchingComplexity(vendor: any, dependencyScore: number): VendorImpact['switchingComplexity'] {
  if (vendor.type === 'iam_platform' && dependencyScore > 60) return 'very_high';
  if (dependencyScore > 70) return 'very_high';
  if (dependencyScore > 50 || vendor.integrationComplexity === 'custom') return 'high';
  if (dependencyScore > 30) return 'medium';
  return 'low';
}

function estimateSwitchingCost(vendor: any, currentAnnualCost: number, dependencyScore: number): number {
  // Rough estimate: 0.5x to 3x annual cost depending on complexity
  const multiplier = vendor.type === 'iam_platform' ? 2.5
    : vendor.type === 'implementation_partner' ? 0.5
    : vendor.integrationComplexity === 'manual' ? 2.0
    : 1.0;
  return Math.round(currentAnnualCost * multiplier * (dependencyScore / 100) * 1.5);
}

function identifyRiskFactors(vendor: any, dependencyScore: number, totalCost: number, appCount: number): string[] {
  const risks: string[] = [];

  if (dependencyScore > 70) risks.push('High organisational dependency — vendor exit would be highly disruptive');
  if (totalCost > 400000) risks.push('Significant cost concentration — budget exposure if pricing changes');
  if (vendor.integrationComplexity === 'manual') risks.push('Manual integration process — high operational risk and human error exposure');
  if (vendor.integrationComplexity === 'custom') risks.push('Custom integration required — creates maintenance burden and skills dependency');
  if (vendor.marketPresence === 'legacy') risks.push('Legacy vendor — end-of-life or support risk');
  if (vendor.marketPresence === 'niche') risks.push('Niche market presence — limited talent pool and support options');
  if (vendor.apiMaturity <= 2) risks.push('Low API maturity — limited automation capability, high manual effort');
  if (vendor.documentationQuality <= 2) risks.push('Poor documentation quality — onboarding and knowledge transfer risk');
  if (appCount === 0 && totalCost > 0) risks.push('Cost without measurable app coverage — value difficult to quantify');
  if (vendor.type === 'staff_augmentation') risks.push('Knowledge concentration in external resources — institutional knowledge risk');

  return risks;
}

function generateRecommendations(
  vendor: any,
  totalCost: number,
  dependencyScore: number,
  integrationScore: number,
  efficiencyScore: number,
  riskScore: number,
  appCount: number
): VendorRecommendation[] {
  const recs: VendorRecommendation[] = [];

  // High cost + low efficiency = renegotiate or replace
  if (totalCost > 300000 && efficiencyScore < 40) {
    recs.push({
      type: 'renegotiate',
      priority: 'high',
      description: `Renegotiate ${vendor.name} contract — high cost with below-average efficiency score`,
      estimatedSaving: Math.round(totalCost * 0.15),
      confidence: 70,
      rationale: `Annual cost $${totalCost.toLocaleString()} with efficiency score ${efficiencyScore}/100 suggests pricing above market value`,
      assumptions: ['Market benchmarking data available', 'Vendor willing to negotiate', 'Contract renewal window approaching'],
    });
  }

  // Manual integration = standardize
  if (vendor.integrationComplexity === 'manual' || vendor.integrationComplexity === 'custom') {
    recs.push({
      type: 'standardize',
      priority: 'high',
      description: `Standardize ${vendor.name} integrations — migrate from ${vendor.integrationComplexity} to SCIM/OIDC where possible`,
      estimatedSaving: Math.round(totalCost * 0.08),
      confidence: 65,
      rationale: 'Manual/custom integrations create ongoing maintenance burden, increase error risk, and slow down onboarding',
      assumptions: ['Vendor has roadmap for standard protocol support', 'Migration effort < 6 months'],
    });
  }

  // Very high dependency = reduce risk
  if (dependencyScore > 70 && vendor.type !== 'iam_platform') {
    recs.push({
      type: 'reduce_dependency',
      priority: 'medium',
      description: `Reduce dependency on ${vendor.name} — develop internal capability or identify alternative`,
      confidence: 60,
      rationale: `Dependency score ${dependencyScore}/100 represents single-point-of-failure risk for IAM operations`,
      assumptions: ['Internal team capacity available for upskilling', 'Alternative vendor or capability exists'],
    });
  }

  // Staff augmentation with high cost = contractor-to-FTE analysis
  if (vendor.type === 'staff_augmentation' && totalCost > 200000) {
    const estimatedFteSaving = Math.round(totalCost * 0.25);
    recs.push({
      type: 'reduce_dependency',
      priority: 'medium',
      description: `Evaluate converting high-cost ${vendor.name} resources to FTE — potential long-term saving`,
      estimatedSaving: estimatedFteSaving,
      confidence: 55,
      rationale: `Staff augmentation cost at $${totalCost.toLocaleString()} — FTE conversion typically yields 20–30% saving on fully loaded basis`,
      assumptions: ['Talent market accessible for direct hire', 'Internal HR approval', 'Knowledge transfer feasible'],
    });
  }

  // High risk + IAM platform = invest in redundancy
  if (riskScore > 70 && vendor.type === 'iam_platform') {
    recs.push({
      type: 'invest',
      priority: 'high',
      description: `Invest in ${vendor.name} resilience — high dependency warrants robust DR, skill depth, and vendor SLAs`,
      confidence: 80,
      rationale: `Risk score ${riskScore}/100 for a core IAM platform. Lack of resilience could result in identity outage across ${appCount} applications`,
      assumptions: ['Risk tolerance assessment completed', 'DR budget available'],
    });
  }

  // Partner high cost + high rework = performance review
  if (vendor.type === 'implementation_partner' && totalCost > 250000) {
    recs.push({
      type: 'renegotiate',
      priority: 'medium',
      description: `Review ${vendor.name} delivery SLAs and performance metrics — high engagement cost warrants formal KPIs`,
      confidence: 75,
      rationale: 'Implementation partner engagements at this cost level should have measurable delivery KPIs and rework penalties',
      assumptions: ['Contract allows SLA amendments', 'Delivery data available for benchmarking'],
    });
  }

  return recs;
}

export const vendorImpactEngine = new VendorImpactEngine();
