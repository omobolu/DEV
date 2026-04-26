import { v4 as uuidv4 } from 'uuid';
import { Vendor, Contract, PersonCost } from './cost.types';
import { vendorRepository } from './repositories/vendor.repository';
import { contractRepository } from './repositories/contract.repository';
import { peopleRepository } from './repositories/people.repository';
import { costIntelligenceAgent } from '../../agents/cost-intelligence.agent';
import { SEED_VENDORS, SEED_CONTRACTS, SEED_PEOPLE } from './cost.seed';
import { getSeedMode } from '../../config/seed-mode';

export class CostService {

  /**
   * Seed demo data on first call if store is empty for this tenant.
   * Blocked in production mode — production starts with no demo data.
   */
  ensureSeeded(tenantId: string): void {
    if (vendorRepository.count(tenantId) > 0) return;
    if (getSeedMode() === 'production') return;
    vendorRepository.saveMany(tenantId, SEED_VENDORS);
    contractRepository.saveMany(tenantId, SEED_CONTRACTS);
    peopleRepository.saveMany(tenantId, SEED_PEOPLE);
    console.log(`[CostService] Demo data seeded for ${tenantId}: ${SEED_VENDORS.length} vendors, ${SEED_CONTRACTS.length} contracts, ${SEED_PEOPLE.length} people records`);
  }

  // ── Vendor CRUD ─────────────────────────────────────────────────────────────

  upsertVendor(tenantId: string, data: Partial<Vendor> & { name: string; type: Vendor['type'] }): Vendor {
    const existing = data.vendorId ? vendorRepository.findById(tenantId, data.vendorId) : undefined;
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
    return vendorRepository.save(tenantId, vendor);
  }

  listVendors(tenantId: string, type?: Vendor['type']) {
    return type ? vendorRepository.findByType(tenantId, type) : vendorRepository.findAll(tenantId);
  }

  // ── Contract CRUD ───────────────────────────────────────────────────────────

  upsertContract(tenantId: string, data: Partial<Contract> & { vendorId: string; annualCost: number; description: string }): Contract {
    const vendor = vendorRepository.findById(tenantId, data.vendorId);
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
    return contractRepository.save(tenantId, contract);
  }

  listContracts(tenantId: string, vendorId?: string) {
    return vendorId ? contractRepository.findByVendor(tenantId, vendorId) : contractRepository.findAll(tenantId);
  }

  // ── People CRUD ─────────────────────────────────────────────────────────────

  addPersonCost(tenantId: string, data: Omit<PersonCost, 'personId' | 'createdAt'>): PersonCost {
    const person: PersonCost = {
      ...data,
      personId: `p-${uuidv4().split('-')[0]}`,
      createdAt: new Date().toISOString(),
    };
    return peopleRepository.save(tenantId, person);
  }

  listPeople(tenantId: string, type?: PersonCost['employmentType']) {
    return type ? peopleRepository.findByType(tenantId, type) : peopleRepository.findAll(tenantId);
  }

  // ── Agent Invocation ────────────────────────────────────────────────────────

  async runCostAnalysis(tenantId: string) {
    this.ensureSeeded(tenantId);
    return costIntelligenceAgent.run(tenantId);
  }

  getCostSummary(tenantId: string) {
    this.ensureSeeded(tenantId);
    const { costAggregationEngine } = require('./engines/cost-aggregation.engine');
    return costAggregationEngine.compute(tenantId);
  }

  getVendorAnalysis(tenantId: string) {
    this.ensureSeeded(tenantId);
    const { vendorImpactEngine } = require('./engines/vendor-impact.engine');
    return vendorImpactEngine.analyzeAll(tenantId);
  }

  getOptimizationReport(tenantId: string) {
    this.ensureSeeded(tenantId);
    const { vendorImpactEngine } = require('./engines/vendor-impact.engine');
    const { optimizationEngine } = require('./engines/optimization.engine');
    const impacts = vendorImpactEngine.analyzeAll(tenantId);
    return optimizationEngine.generate(tenantId, impacts);
  }

  getAgentStatus(tenantId: string) {
    return costIntelligenceAgent.getStatus(tenantId);
  }

  getLastReport() {
    return costIntelligenceAgent.getLastReport();
  }
}

export const costService = new CostService();
