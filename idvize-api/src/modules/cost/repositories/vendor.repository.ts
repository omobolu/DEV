import { Vendor, VendorType } from '../cost.types';

class VendorRepository {
  private store = new Map<string, Vendor>();

  save(vendor: Vendor): Vendor {
    this.store.set(vendor.vendorId, vendor);
    return vendor;
  }

  saveMany(vendors: Vendor[]): void {
    vendors.forEach(v => this.save(v));
  }

  findById(id: string): Vendor | undefined {
    return this.store.get(id);
  }

  findByType(type: VendorType): Vendor[] {
    return Array.from(this.store.values()).filter(v => v.type === type);
  }

  findByName(name: string): Vendor | undefined {
    const lower = name.toLowerCase();
    return Array.from(this.store.values()).find(v => v.name.toLowerCase() === lower);
  }

  findAll(): Vendor[] {
    return Array.from(this.store.values());
  }

  count(): number {
    return this.store.size;
  }
}

export const vendorRepository = new VendorRepository();
