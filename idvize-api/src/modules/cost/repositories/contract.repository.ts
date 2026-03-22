import { Contract, ContractStatus } from '../cost.types';

class ContractRepository {
  private store = new Map<string, Contract>();

  save(contract: Contract): Contract {
    this.store.set(contract.contractId, contract);
    return contract;
  }

  saveMany(contracts: Contract[]): void {
    contracts.forEach(c => this.save(c));
  }

  findById(id: string): Contract | undefined {
    return this.store.get(id);
  }

  findByVendor(vendorId: string): Contract[] {
    return Array.from(this.store.values()).filter(c => c.vendorId === vendorId);
  }

  findByStatus(status: ContractStatus): Contract[] {
    return Array.from(this.store.values()).filter(c => c.status === status);
  }

  findAll(): Contract[] {
    return Array.from(this.store.values());
  }

  totalAnnualCost(vendorId?: string): number {
    const contracts = vendorId ? this.findByVendor(vendorId) : this.findAll();
    return contracts
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + c.annualCost, 0);
  }

  count(): number {
    return this.store.size;
  }
}

export const contractRepository = new ContractRepository();
