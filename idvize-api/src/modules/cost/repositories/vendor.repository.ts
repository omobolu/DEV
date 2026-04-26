import { Vendor, VendorType } from '../cost.types';

class VendorRepository {
  private store = new Map<string, Map<string, Vendor>>();

  private bucket(tenantId: string): Map<string, Vendor> {
    if (!this.store.has(tenantId)) this.store.set(tenantId, new Map());
    return this.store.get(tenantId)!;
  }

  save(tenantId: string, vendor: Vendor): Vendor {
    this.bucket(tenantId).set(vendor.vendorId, vendor);
    return vendor;
  }

  saveMany(tenantId: string, vendors: Vendor[]): void {
    vendors.forEach(v => this.save(tenantId, v));
  }

  findById(tenantId: string, id: string): Vendor | undefined {
    return this.bucket(tenantId).get(id);
  }

  findByType(tenantId: string, type: VendorType): Vendor[] {
    return Array.from(this.bucket(tenantId).values()).filter(v => v.type === type);
  }

  findByName(tenantId: string, name: string): Vendor | undefined {
    const lower = name.toLowerCase();
    return Array.from(this.bucket(tenantId).values()).find(v => v.name.toLowerCase() === lower);
  }

  findAll(tenantId: string): Vendor[] {
    return Array.from(this.bucket(tenantId).values());
  }

  count(tenantId: string): number {
    return this.bucket(tenantId).size;
  }
}

export const vendorRepository = new VendorRepository();
