import { PersonCost, EmploymentType, IamRole } from '../cost.types';

class PeopleRepository {
  private store = new Map<string, Map<string, PersonCost>>();

  private bucket(tenantId: string): Map<string, PersonCost> {
    if (!this.store.has(tenantId)) this.store.set(tenantId, new Map());
    return this.store.get(tenantId)!;
  }

  save(tenantId: string, person: PersonCost): PersonCost {
    this.bucket(tenantId).set(person.personId, person);
    return person;
  }

  saveMany(tenantId: string, people: PersonCost[]): void {
    people.forEach(p => this.save(tenantId, p));
  }

  findAll(tenantId: string): PersonCost[] {
    return Array.from(this.bucket(tenantId).values());
  }

  findByType(tenantId: string, type: EmploymentType): PersonCost[] {
    return Array.from(this.bucket(tenantId).values()).filter(p => p.employmentType === type);
  }

  findByRole(tenantId: string, role: IamRole): PersonCost[] {
    return Array.from(this.bucket(tenantId).values()).filter(p => p.role === role);
  }

  findByVendor(tenantId: string, vendorId: string): PersonCost[] {
    return Array.from(this.bucket(tenantId).values()).filter(p => p.vendorId === vendorId);
  }

  totalCost(tenantId: string, type?: EmploymentType): number {
    const people = type ? this.findByType(tenantId, type) : this.findAll(tenantId);
    return people.reduce((sum, p) => sum + p.annualCost, 0);
  }

  totalFteEquivalent(tenantId: string, type?: EmploymentType): number {
    const people = type ? this.findByType(tenantId, type) : this.findAll(tenantId);
    return people.reduce((sum, p) => sum + p.fteEquivalent, 0);
  }

  count(tenantId: string): number {
    return this.bucket(tenantId).size;
  }
}

export const peopleRepository = new PeopleRepository();
