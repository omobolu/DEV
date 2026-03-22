/**
 * IDVIZE Cost Intelligence Service
 * Module 5: IAM Cost, Capacity, Value, and Vendor Impact Intelligence
 */

import type {
  Contract,
  PeopleCost,
  Vendor,
  CostSummaryStats,
  CostBreakdown,
  IAMTower,
} from '../../types/cost-intelligence'
import { recordAudit } from '../../types/audit'

/** In-memory stores */
const contracts: Map<string, Contract> = new Map()
const peopleCosts: Map<string, PeopleCost> = new Map()
const vendors: Map<string, Vendor> = new Map()

export class CostIntelligenceService {
  /** Add or update a contract */
  upsertContract(contract: Contract): Contract {
    contracts.set(contract.id, contract)
    return contract
  }

  /** Add or update a people cost entry */
  upsertPeopleCost(cost: PeopleCost): PeopleCost {
    peopleCosts.set(cost.id, cost)
    return cost
  }

  /** Add or update a vendor */
  upsertVendor(vendor: Vendor): Vendor {
    vendors.set(vendor.id, vendor)
    return vendor
  }

  /** Upload contracts (batch) */
  uploadContracts(contractList: Contract[]): number {
    for (const c of contractList) {
      contracts.set(c.id, c)
    }
    recordAudit(
      'data_access',
      { type: 'system', id: 'cost-service', name: 'CostIntelligenceService' },
      'contracts_uploaded',
      'contracts',
      'success',
      { count: contractList.length },
    )
    return contractList.length
  }

  /** Upload people costs (batch) */
  uploadPeopleCosts(costList: PeopleCost[]): number {
    for (const c of costList) {
      peopleCosts.set(c.id, c)
    }
    recordAudit(
      'data_access',
      { type: 'system', id: 'cost-service', name: 'CostIntelligenceService' },
      'people_costs_uploaded',
      'people_costs',
      'success',
      { count: costList.length },
    )
    return costList.length
  }

  /** Get all contracts */
  getContracts(): Contract[] {
    return Array.from(contracts.values())
  }

  /** Get all people costs */
  getPeopleCosts(): PeopleCost[] {
    return Array.from(peopleCosts.values())
  }

  /** Get all vendors */
  getVendors(): Vendor[] {
    return Array.from(vendors.values())
  }

  /** Get cost summary */
  getCostSummary(): CostSummaryStats {
    const allContracts = Array.from(contracts.values())
    const allPeople = Array.from(peopleCosts.values())

    const activeContracts = allContracts.filter(c => c.status === 'active')
    const totalContractCost = activeContracts.reduce((s, c) => s + c.annualValue, 0)
    const totalPeopleCost = allPeople.reduce((s, p) => s + p.annualSalary, 0)
    const totalAnnualCost = totalContractCost + totalPeopleCost

    const now = Date.now()
    const contractsExpiringIn90Days = allContracts.filter(c => {
      if (!c.endDate) return false
      const daysLeft = (new Date(c.endDate).getTime() - now) / 86400000
      return daysLeft > 0 && daysLeft <= 90
    }).length

    // Find top vendor by cost
    const vendorCosts = new Map<string, number>()
    for (const c of activeContracts) {
      vendorCosts.set(c.vendorName, (vendorCosts.get(c.vendorName) ?? 0) + c.annualValue)
    }
    let topVendorByCost = 'N/A'
    let maxVendorCost = 0
    for (const [name, cost] of vendorCosts) {
      if (cost > maxVendorCost) {
        maxVendorCost = cost
        topVendorByCost = name
      }
    }

    return {
      totalAnnualCost,
      peopleCostPercentage: totalAnnualCost > 0 ? Math.round((totalPeopleCost / totalAnnualCost) * 100) : 0,
      contractCostPercentage: totalAnnualCost > 0 ? Math.round((totalContractCost / totalAnnualCost) * 100) : 0,
      topVendorByCost,
      contractsExpiringIn90Days,
      optimizationPotential: Math.round(totalAnnualCost * 0.1), // Estimated 10% optimization
    }
  }

  /** Get cost breakdown */
  getCostBreakdown(): CostBreakdown {
    const allContracts = Array.from(contracts.values()).filter(c => c.status === 'active')
    const allPeople = Array.from(peopleCosts.values())

    const peopleCostTotal = allPeople.reduce((s, p) => s + p.annualSalary, 0)
    const contractCostTotal = allContracts.reduce((s, c) => s + c.annualValue, 0)

    const byIAMTower: Record<IAMTower, number> = { iga: 0, am: 0, pam: 0, ciam: 0, shared: 0 }
    for (const c of allContracts) {
      if (c.iamTower) byIAMTower[c.iamTower] += c.annualValue
    }
    for (const p of allPeople) {
      if (p.iamTower) byIAMTower[p.iamTower] += p.annualSalary
    }

    const byPlatform: Record<string, number> = {}
    for (const c of allContracts) {
      if (c.platform) byPlatform[c.platform] = (byPlatform[c.platform] ?? 0) + c.annualValue
    }

    const byVendorType: Record<string, number> = {}
    for (const c of allContracts) {
      byVendorType[c.type] = (byVendorType[c.type] ?? 0) + c.annualValue
    }

    return {
      totalCost: peopleCostTotal + contractCostTotal,
      peopleCost: peopleCostTotal,
      contractCost: contractCostTotal,
      byIAMTower,
      byPlatform,
      byVendorType,
    }
  }

  /** Get contracts expiring soon */
  getExpiringContracts(daysAhead = 90): Contract[] {
    const now = Date.now()
    return Array.from(contracts.values()).filter(c => {
      if (!c.endDate) return false
      const daysLeft = (new Date(c.endDate).getTime() - now) / 86400000
      return daysLeft > 0 && daysLeft <= daysAhead
    })
  }
}

/** Singleton cost intelligence service */
export const costIntelligenceService = new CostIntelligenceService()
