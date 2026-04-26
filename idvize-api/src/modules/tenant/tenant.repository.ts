/**
 * Tenant Repository
 *
 * Global store for tenant metadata. NOT partitioned by tenantId — this IS
 * the top-level namespace that all other repositories are partitioned under.
 * Phase 2: Replace with PostgreSQL tenants table.
 */

import { Tenant } from './tenant.types';

class TenantRepository {
  private store  = new Map<string, Tenant>(); // tenantId → Tenant
  private bySlug = new Map<string, string>(); // slug → tenantId

  save(tenant: Tenant): Tenant {
    this.store.set(tenant.tenantId, tenant);
    this.bySlug.set(tenant.slug, tenant.tenantId);
    return tenant;
  }

  findById(tenantId: string): Tenant | undefined {
    return this.store.get(tenantId);
  }

  findBySlug(slug: string): Tenant | undefined {
    const id = this.bySlug.get(slug);
    return id ? this.store.get(id) : undefined;
  }

  findAll(): Tenant[] {
    return Array.from(this.store.values());
  }

  count(): number {
    return this.store.size;
  }
}

export const tenantRepository = new TenantRepository();
