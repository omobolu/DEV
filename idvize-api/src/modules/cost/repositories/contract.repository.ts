import { Contract, ContractStatus } from '../cost.types';

class ContractRepository {
  private store = new Map<string, Map<string, Contract>>();

  private bucket(tenantId: string): Map<string, Contract> {
    if (!this.store.has(tenantId)) this.store.set(tenantId, new Map());
    return this.store.get(tenantId)!;
  }

  save(tenantId: string, contract: Contract): Contract {
    this.bucket(tenantId).set(contract.contractId, contract);
    return contract;
  }

  saveMany(tenantId: string, contracts: Contract[]): void {
    contracts.forEach(c => this.save(tenantId, c));
  }

  findById(tenantId: string, id: string): Contract | undefined {
    return this.bucket(tenantId).get(id);
  }

  findByVendor(tenantId: string, vendorId: string): Contract[] {
    return Array.from(this.bucket(tenantId).values()).filter(c => c.vendorId === vendorId);
  }

  findByStatus(tenantId: string, status: ContractStatus): Contract[] {
    return Array.from(this.bucket(tenantId).values()).filter(c => c.status === status);
  }

  findAll(tenantId: string): Contract[] {
    return Array.from(this.bucket(tenantId).values());
  }

  totalAnnualCost(tenantId: string, vendorId?: string): number {
    const contracts = vendorId ? this.findByVendor(tenantId, vendorId) : this.findAll(tenantId);
    return contracts
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + c.annualCost, 0);
  }

  count(tenantId: string): number {
    return this.bucket(tenantId).size;
  }
}

export const contractRepository = new ContractRepository();
