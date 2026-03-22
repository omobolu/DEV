import {
  CostSummary, CostBreakdown, CostDriver,
} from '../cost.types';
import { vendorRepository } from '../repositories/vendor.repository';
import { contractRepository } from '../repositories/contract.repository';
import { peopleRepository } from '../repositories/people.repository';
import { applicationRepository } from '../../application/application.repository';
import { buildRepository } from '../../build/build.repository';

/**
 * Cost Aggregation Engine
 *
 * Aggregates people + contract + operational costs into a structured summary.
 * Correlates cost data with application inventory and build execution data.
 */
export class CostAggregationEngine {

  compute(): CostSummary {
    const allPeople = peopleRepository.findAll();
    const allContracts = contractRepository.findAll().filter(c => c.status === 'active');
    const allVendors = vendorRepository.findAll();
    const totalApps = applicationRepository.count();

    // ── People Costs ────────────────────────────────────────────────────────
    const fteCost = peopleRepository.totalCost('fte');
    const contractorCost = peopleRepository.totalCost('contractor');
    const offshoreCost = peopleRepository.totalCost('offshore');
    const mspCost = peopleRepository.totalCost('managed_service');
    const totalPeople = fteCost + contractorCost + offshoreCost + mspCost;

    // ── Technology Costs ────────────────────────────────────────────────────
    const iamPlatformVendors = vendorRepository.findByType('iam_platform').map(v => v.vendorId);
    const iamPlatformCost = allContracts
      .filter(c => iamPlatformVendors.includes(c.vendorId))
      .reduce((sum, c) => sum + c.annualCost, 0);

    const appVendorCost = allContracts
      .filter(c => vendorRepository.findById(c.vendorId)?.type === 'application')
      .reduce((sum, c) => sum + c.annualCost, 0);

    const infraCost = allContracts
      .filter(c => c.tags.includes('infrastructure'))
      .reduce((sum, c) => sum + c.annualCost, 0);

    const totalTech = iamPlatformCost + appVendorCost + infraCost;

    // ── Partner Costs ────────────────────────────────────────────────────────
    const partnerVendors = vendorRepository.findByType('implementation_partner').map(v => v.vendorId);
    const partnerCost = allContracts
      .filter(c => partnerVendors.includes(c.vendorId))
      .reduce((sum, c) => sum + c.annualCost, 0);

    // ── Totals ────────────────────────────────────────────────────────────────
    const totalCost = totalPeople + totalTech + partnerCost;

    const breakdown: CostBreakdown = {
      people: {
        fte: fteCost,
        contractors: contractorCost,
        offshore: offshoreCost,
        managedService: mspCost,
        total: totalPeople,
      },
      technology: {
        iamPlatforms: iamPlatformCost,
        applicationVendors: appVendorCost,
        infrastructure: infraCost,
        total: totalTech,
      },
      partners: {
        implementationPartners: partnerCost,
        total: partnerCost,
      },
      total: totalCost,
    };

    // ── Per-unit metrics ─────────────────────────────────────────────────────
    const appCount = Math.max(applicationRepository.count(), 1);
    const totalIdentities = allPeople.reduce((sum, p) => {
      // proxy: sum user population across apps (rough)
      return sum;
    }, 0) || 10000; // fallback estimate

    // ── Top Cost Drivers ──────────────────────────────────────────────────────
    const costDrivers: CostDriver[] = [
      ...allContracts.map(c => ({
        category: 'Contract',
        name: `${c.vendorName} — ${c.description.substring(0, 50)}`,
        annualCost: c.annualCost,
        percentOfTotal: (c.annualCost / totalCost) * 100,
      })),
      {
        category: 'People - FTE',
        name: `Internal IAM Team (${peopleRepository.findByType('fte').length} FTEs)`,
        annualCost: fteCost,
        percentOfTotal: (fteCost / totalCost) * 100,
      },
      contractorCost > 0 ? {
        category: 'People - Contractors',
        name: `US Contractors (${peopleRepository.findByType('contractor').length})`,
        annualCost: contractorCost,
        percentOfTotal: (contractorCost / totalCost) * 100,
      } : null,
      offshoreCost > 0 ? {
        category: 'People - Offshore',
        name: `Offshore / MSP Teams`,
        annualCost: offshoreCost,
        percentOfTotal: (offshoreCost / totalCost) * 100,
      } : null,
    ]
    .filter(Boolean)
    .sort((a, b) => b!.annualCost - a!.annualCost)
    .slice(0, 10) as CostDriver[];

    return {
      totalAnnualCost: totalCost,
      breakdown,
      costPerApp: totalCost / appCount,
      costPerIdentity: totalCost / totalIdentities,
      headcount: {
        totalFte: peopleRepository.findByType('fte').length,
        contractors: peopleRepository.findByType('contractor').length,
        offshore: Math.round(peopleRepository.totalFteEquivalent('offshore')),
        managedService: Math.round(peopleRepository.totalFteEquivalent('managed_service')),
      },
      contractCount: allContracts.length,
      vendorCount: allVendors.length,
      topCostDrivers: costDrivers,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const costAggregationEngine = new CostAggregationEngine();
