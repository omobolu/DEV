import { v4 as uuidv4 } from 'uuid';
import { Vendor, Contract, PersonCost } from './cost.types';
import { vendorRepository } from './repositories/vendor.repository';
import { contractRepository } from './repositories/contract.repository';
import { peopleRepository } from './repositories/people.repository';
import { costIntelligenceAgent } from '../../agents/cost-intelligence.agent';
import { SEED_VENDORS, SEED_CONTRACTS, SEED_PEOPLE } from './cost.seed';

let seeded = false;

export class CostService {

  /**
   * Seed demo data on first call if store is empty.
   */
  ensureSeeded(): void {
    if (seeded || vendorRepository.count() > 0) return;
    vendorRepository.saveMany(SEED_VENDORS);
    contractRepository.saveMany(SEED_CONTRACTS);
    peopleRepository.saveMany(SEED_PEOPLE);
    seeded = true;
    console.log(`[CostService] Demo data seeded: ${SEED_VENDORS.length} vendors, ${SEED_CONTRACTS.length} contracts, ${SEED_PEOPLE.length} people records`);
  }

  // ── Vendor CRUD ─────────────────────────────────────────────────────────────

  upsertVendor(data: Partial<Vendor> & { name: string; type: Vendor['type'] }): Vendor {
    const existing = data.vendorId ? vendorRepository.findById(data.vendorId) : undefined;
    const now = new Date().toISOString();
    const vendor: Vendor = {
      vendorId: data.vendorId ?? `v-${uuidv4().split('-')[0]}`,
      name: data.name,
      type: data.type,
      category: data.category,
      supportedStandards: data.supportedStandards ?? [],
      integrationComplexity: data.integrationComplexity ?? 'unknown',
      apiMaturity: data.apiMaturity ?? 3,
      documentationQuality: data.documentationQuality ?? 3,
      marketPresence: data.marketPresence ?? 'niche',
      website: data.website,
      notes: data.notes,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    return vendorRepository.save(vendor);
  }

  listVendors(type?: Vendor['type']) {
    return type ? vendorRepository.findByType(type) : vendorRepository.findAll();
  }

  // ── Contract CRUD ───────────────────────────────────────────────────────────

  upsertContract(data: Partial<Contract> & { vendorId: string; annualCost: number; description: string }): Contract {
    const vendor = vendorRepository.findById(data.vendorId);
    const now = new Date().toISOString();
    const contract: Contract = {
      contractId: data.contractId ?? `c-${uuidv4().split('-')[0]}`,
      vendorId: data.vendorId,
      vendorName: vendor?.name ?? data.vendorId,
      serviceType: data.serviceType ?? 'professional_services',
      description: data.description,
      annualCost: data.annualCost,
      totalContractValue: data.totalContractValue,
      currency: data.currency ?? 'USD',
      startDate: data.startDate ?? now.split('T')[0],
      endDate: data.endDate ?? new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      autoRenew: data.autoRenew ?? false,
      status: data.status ?? 'active',
      owner: data.owner ?? 'IAM Team',
      tags: data.tags ?? [],
      linkedAppIds: data.linkedAppIds,
      linkedPlatforms: data.linkedPlatforms,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    };
    return contractRepository.save(contract);
  }

  listContracts(vendorId?: string) {
    return vendorId ? contractRepository.findByVendor(vendorId) : contractRepository.findAll();
  }

  // ── People CRUD ─────────────────────────────────────────────────────────────

  addPersonCost(data: Omit<PersonCost, 'personId' | 'createdAt'>): PersonCost {
    const person: PersonCost = {
      ...data,
      personId: `p-${uuidv4().split('-')[0]}`,
      createdAt: new Date().toISOString(),
    };
    return peopleRepository.save(person);
  }

  listPeople(type?: PersonCost['employmentType']) {
    return type ? peopleRepository.findByType(type) : peopleRepository.findAll();
  }

  // ── Agent Invocation ────────────────────────────────────────────────────────

  async runCostAnalysis() {
    this.ensureSeeded();
    return costIntelligenceAgent.run();
  }

  getCostSummary() {
    this.ensureSeeded();
    const { costAggregationEngine } = require('./engines/cost-aggregation.engine');
    return costAggregationEngine.compute();
  }

  getVendorAnalysis() {
    this.ensureSeeded();
    const { vendorImpactEngine } = require('./engines/vendor-impact.engine');
    return vendorImpactEngine.analyzeAll();
  }

  getOptimizationReport() {
    this.ensureSeeded();
    const { vendorImpactEngine } = require('./engines/vendor-impact.engine');
    const { optimizationEngine } = require('./engines/optimization.engine');
    const impacts = vendorImpactEngine.analyzeAll();
    return optimizationEngine.generate(impacts);
  }

  getAgentStatus() {
    return costIntelligenceAgent.getStatus();
  }

  getLastReport() {
    return costIntelligenceAgent.getLastReport();
  }
}

export const costService = new CostService();
