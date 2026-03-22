import { PersonCost, EmploymentType, IamRole } from '../cost.types';

class PeopleRepository {
  private store = new Map<string, PersonCost>();

  save(person: PersonCost): PersonCost {
    this.store.set(person.personId, person);
    return person;
  }

  saveMany(people: PersonCost[]): void {
    people.forEach(p => this.save(p));
  }

  findAll(): PersonCost[] {
    return Array.from(this.store.values());
  }

  findByType(type: EmploymentType): PersonCost[] {
    return Array.from(this.store.values()).filter(p => p.employmentType === type);
  }

  findByRole(role: IamRole): PersonCost[] {
    return Array.from(this.store.values()).filter(p => p.role === role);
  }

  findByVendor(vendorId: string): PersonCost[] {
    return Array.from(this.store.values()).filter(p => p.vendorId === vendorId);
  }

  totalCost(type?: EmploymentType): number {
    const people = type ? this.findByType(type) : this.findAll();
    return people.reduce((sum, p) => sum + p.annualCost, 0);
  }

  totalFteEquivalent(type?: EmploymentType): number {
    const people = type ? this.findByType(type) : this.findAll();
    return people.reduce((sum, p) => sum + p.fteEquivalent, 0);
  }

  count(): number {
    return this.store.size;
  }
}

export const peopleRepository = new PeopleRepository();
