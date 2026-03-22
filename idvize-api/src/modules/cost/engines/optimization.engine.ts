import { v4 as uuidv4 } from 'uuid';
import { OptimizationOpportunity, OptimizationReport, VendorImpact } from '../cost.types';
import { contractRepository } from '../repositories/contract.repository';
import { peopleRepository } from '../repositories/people.repository';
import { vendorRepository } from '../repositories/vendor.repository';

/**
 * Optimization Recommendation Engine
 *
 * Scans cost data, vendor impacts, and people data to surface
 * actionable cost reduction and risk reduction opportunities.
 */
export class OptimizationEngine {

  generate(vendorImpacts: VendorImpact[]): OptimizationReport {
    const opportunities: OptimizationOpportunity[] = [
      ...this.findVendorConsolidationOpportunities(vendorImpacts),
      ...this.findContractRenewalOpportunities(),
      ...this.findStaffingOptimizations(),
      ...this.findIntegrationStandardizationOpportunities(vendorImpacts),
      ...this.findRedundancyOpportunities(vendorImpacts),
    ];

    // Sort by estimated saving descending
    opportunities.sort((a, b) => (b.estimatedAnnualSaving ?? 0) - (a.estimatedAnnualSaving ?? 0));

    const quickWins = opportunities.filter(o => o.effort === 'low' && (o.estimatedAnnualSaving ?? 0) > 20000);
    const strategicMoves = opportunities.filter(o => o.effort === 'high' && (o.estimatedAnnualSaving ?? 0) > 50000);
    const totalPotential = opportunities.reduce((sum, o) => sum + (o.estimatedAnnualSaving ?? 0), 0);

    return {
      totalPotentialSaving: totalPotential,
      opportunities,
      quickWins,
      strategicMoves,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Vendor Consolidation ───────────────────────────────────────────────────

  private findVendorConsolidationOpportunities(impacts: VendorImpact[]): OptimizationOpportunity[] {
    const opps: OptimizationOpportunity[] = [];

    // Find duplicate category coverage (e.g., two SI partners doing same work)
    const partnerImpacts = impacts.filter(i => i.vendorType === 'implementation_partner');
    if (partnerImpacts.length >= 2) {
      const totalPartnerCost = partnerImpacts.reduce((sum, p) => sum + p.totalAnnualCost, 0);
      opps.push({
        opportunityId: uuidv4(),
        type: 'vendor_consolidation',
        title: 'Consolidate Implementation Partners',
        description: `${partnerImpacts.length} implementation partners engaged simultaneously. Consolidating to 1 primary partner typically reduces overhead by 15–25%.`,
        estimatedAnnualSaving: Math.round(totalPartnerCost * 0.20),
        implementationCost: 20000,
        netBenefit: Math.round(totalPartnerCost * 0.20) - 20000,
        paybackMonths: 2,
        priority: 'high',
        effort: 'medium',
        confidence: 70,
        rationale: 'Multiple SI partners create coordination overhead, knowledge fragmentation, and inflated rates due to lack of competitive pressure',
        assumptions: ['Preferred partner selection process completed', 'Knowledge transfer plan in place', 'No active contract termination penalties'],
        affectedVendors: partnerImpacts.map(p => p.vendorName),
      });
    }

    // High-cost low-efficiency vendors
    const highCostLowValue = impacts.filter(i =>
      i.totalAnnualCost > 150000 && i.efficiencyScore < 40 && i.vendorType !== 'iam_platform'
    );
    for (const v of highCostLowValue) {
      opps.push({
        opportunityId: uuidv4(),
        type: 'vendor_replacement',
        title: `Evaluate Replacement: ${v.vendorName}`,
        description: `${v.vendorName} has high cost ($${v.totalAnnualCost.toLocaleString()}/yr) with low efficiency score (${v.efficiencyScore}/100). Evaluate market alternatives.`,
        estimatedAnnualSaving: Math.round(v.totalAnnualCost * 0.25),
        priority: 'medium',
        effort: 'high',
        confidence: 50,
        rationale: 'Efficiency-cost ratio significantly below benchmark — vendor is not delivering proportionate value',
        assumptions: ['Replacement vendor identified', 'Migration plan feasible within 12 months', 'No locked-in contract terms'],
        affectedVendors: [v.vendorName],
      });
    }

    return opps;
  }

  // ── Contract Renewals ──────────────────────────────────────────────────────

  private findContractRenewalOpportunities(): OptimizationOpportunity[] {
    const opps: OptimizationOpportunity[] = [];
    const today = new Date();
    const sixMonths = new Date(today);
    sixMonths.setMonth(sixMonths.getMonth() + 6);

    const expiringContracts = contractRepository.findAll().filter(c => {
      const end = new Date(c.endDate);
      return c.status === 'active' && end <= sixMonths && end >= today;
    });

    if (expiringContracts.length > 0) {
      const totalExpiring = expiringContracts.reduce((sum, c) => sum + c.annualCost, 0);
      opps.push({
        opportunityId: uuidv4(),
        type: 'renegotiate_contract',
        title: `${expiringContracts.length} Contract(s) Up for Renewal — Negotiate Now`,
        description: `${expiringContracts.map(c => c.vendorName).join(', ')} contracts expire within 6 months. Early negotiation leverage can yield 10–20% reduction.`,
        estimatedAnnualSaving: Math.round(totalExpiring * 0.12),
        priority: 'immediate',
        effort: 'low',
        confidence: 75,
        rationale: 'Renewal negotiations 3–6 months before expiry give maximum leverage. Auto-renew without negotiation typically results in 5–15% price increase.',
        assumptions: ['Legal review completed', 'Business case for renewal prepared', 'Market pricing benchmarks obtained'],
        affectedVendors: expiringContracts.map(c => c.vendorName),
      });
    }

    // Auto-renewing contracts not reviewed in 18 months
    const stalledAutoRenew = contractRepository.findAll().filter(c =>
      c.autoRenew && c.status === 'active' && c.annualCost > 100000
    );
    if (stalledAutoRenew.length > 0) {
      const totalStalled = stalledAutoRenew.reduce((sum, c) => sum + c.annualCost, 0);
      opps.push({
        opportunityId: uuidv4(),
        type: 'renegotiate_contract',
        title: 'Review Auto-Renewing High-Value Contracts',
        description: `${stalledAutoRenew.length} contracts set to auto-renew with total value $${totalStalled.toLocaleString()}/yr. No review cycle in place.`,
        estimatedAnnualSaving: Math.round(totalStalled * 0.08),
        priority: 'medium',
        effort: 'low',
        confidence: 65,
        rationale: 'Auto-renewing contracts without periodic review allow vendor price creep and prevent market comparison',
        assumptions: ['Review cadence of 12 months minimum established', 'Procurement engaged'],
        affectedVendors: stalledAutoRenew.map(c => c.vendorName),
      });
    }

    return opps;
  }

  // ── Staffing Optimizations ─────────────────────────────────────────────────

  private findStaffingOptimizations(): OptimizationOpportunity[] {
    const opps: OptimizationOpportunity[] = [];

    const contractors = peopleRepository.findByType('contractor');
    const offshore = peopleRepository.findByType('offshore');
    const ftes = peopleRepository.findByType('fte');

    const contractorCost = contractors.reduce((sum, p) => sum + p.annualCost, 0);
    const offshoreCost = offshore.reduce((sum, p) => sum + p.annualCost, 0);
    const avgFteCost = ftes.length > 0
      ? ftes.reduce((sum, p) => sum + p.annualCost, 0) / ftes.length
      : 130000;

    // Contractor to FTE conversion
    if (contractors.length >= 2 && contractorCost > 200000) {
      const fteCostEquiv = contractors.reduce((sum, p) => sum + (avgFteCost * p.fteEquivalent), 0);
      const saving = contractorCost - fteCostEquiv;
      if (saving > 20000) {
        opps.push({
          opportunityId: uuidv4(),
          type: 'contractor_to_fte',
          title: `Convert ${contractors.length} Long-Term Contractors to FTE`,
          description: `${contractors.length} US contractors costing $${contractorCost.toLocaleString()}/yr. FTE equivalent would cost ~$${fteCostEquiv.toLocaleString()}/yr.`,
          estimatedAnnualSaving: Math.round(saving),
          implementationCost: 30000, // Recruitment + onboarding
          paybackMonths: Math.round((30000 / saving) * 12),
          priority: saving > 80000 ? 'high' : 'medium',
          effort: 'medium',
          confidence: 60,
          rationale: `Contractor premium over FTE is $${Math.round(saving).toLocaleString()}/yr. Long-term engagements (>12 months) rarely justify contractor rates`,
          assumptions: ['Contractors willing to convert or new hires recruited', 'HR headcount approval', 'Benefits cost included in FTE estimate'],
        });
      }
    }

    // Offshore optimization — very high headcount relative to internal team
    const offshoreRatio = ftes.length > 0 ? offshore.reduce((s, p) => s + p.fteEquivalent, 0) / ftes.length : 0;
    if (offshoreRatio > 0.8 && offshoreCost > 150000) {
      opps.push({
        opportunityId: uuidv4(),
        type: 'contractor_to_fte',
        title: 'Rebalance Offshore/FTE Ratio — Knowledge Risk',
        description: `Offshore FTEs represent ${Math.round(offshoreRatio * 100)}% of internal team size. Excessive offshoring creates knowledge dependency and operational risk.`,
        estimatedAnnualSaving: Math.round(offshoreCost * 0.15),
        priority: 'medium',
        effort: 'high',
        confidence: 55,
        rationale: 'Over-reliance on offshore resources for core IAM operations creates institutional knowledge risk and limits strategic agility',
        assumptions: ['Internal upskilling plan exists', 'Transition plan does not disrupt operations'],
      });
    }

    return opps;
  }

  // ── Integration Standardization ────────────────────────────────────────────

  private findIntegrationStandardizationOpportunities(impacts: VendorImpact[]): OptimizationOpportunity[] {
    const opps: OptimizationOpportunity[] = [];

    const manualVendors = impacts.filter(i =>
      (i.averageIntegrationComplexity === 'manual' || i.averageIntegrationComplexity === 'custom') &&
      i.totalAnnualCost > 0
    );

    if (manualVendors.length > 0) {
      const manualCostImpact = manualVendors.reduce((sum, v) => sum + (v.totalAnnualCost * 0.15), 0);
      opps.push({
        opportunityId: uuidv4(),
        type: 'standardize_integration',
        title: `Standardize ${manualVendors.length} Manual/Custom Integrations to SCIM/OIDC`,
        description: `${manualVendors.map(v => v.vendorName).join(', ')} use manual or custom integrations. Standardising reduces ongoing maintenance cost by ~15%.`,
        estimatedAnnualSaving: Math.round(manualCostImpact),
        priority: 'medium',
        effort: 'high',
        confidence: 60,
        rationale: 'Manual integrations require ongoing human intervention for provisioning/deprovisioning, increasing error risk and operational cost',
        assumptions: ['Vendor has roadmap for SCIM/SAML support', 'Migration timeline 6–18 months', 'SailPoint connector available'],
        affectedVendors: manualVendors.map(v => v.vendorName),
      });
    }

    return opps;
  }

  // ── Redundancy Detection ──────────────────────────────────────────────────

  private findRedundancyOpportunities(impacts: VendorImpact[]): OptimizationOpportunity[] {
    const opps: OptimizationOpportunity[] = [];

    // If we have both Entra and Okta for non-CIAM use cases, flag potential overlap
    const hasEntra = impacts.find(i => i.vendorName === 'Microsoft Entra ID');
    const hasOkta = impacts.find(i => i.vendorName === 'Okta');
    if (hasEntra && hasOkta && (hasEntra.totalAnnualCost + hasOkta.totalAnnualCost) > 300000) {
      opps.push({
        opportunityId: uuidv4(),
        type: 'eliminate_redundancy',
        title: 'Review Entra ID vs Okta Scope — Potential Overlap',
        description: 'Both Entra ID and Okta are active. Ensure clear scope boundaries (Entra = workforce, Okta = CIAM) to avoid feature overlap and duplicate spend.',
        estimatedAnnualSaving: 40000,
        priority: 'medium',
        effort: 'low',
        confidence: 50,
        rationale: 'Without clear platform boundary, teams license and configure overlapping features across both platforms',
        assumptions: ['Platform ownership clearly defined', 'CIAM scope confirmed to Okta only'],
        affectedVendors: ['Microsoft Entra ID', 'Okta'],
      });
    }

    return opps;
  }
}

export const optimizationEngine = new OptimizationEngine();
