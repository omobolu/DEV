/**
 * Tenant Service
 *
 * Business logic for tenant lookup, validation, and listing.
 * Uses PostgreSQL-backed tenant repository with in-memory cache.
 */

import { Tenant, TenantSummary } from './tenant.types';
import { tenantRepository } from './tenant.repository';
import { authRepository } from '../security/auth/auth.repository';
import { applicationRepository } from '../application/application.repository';

class TenantService {
  async getTenant(tenantId: string): Promise<Tenant | undefined> {
    return tenantRepository.findById(tenantId);
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    return tenantRepository.findBySlug(slug);
  }

  /** Throws a typed error if tenantId is invalid or suspended. */
  validateTenant(tenantId: string): Tenant {
    // Uses sync cache accessor — cache is loaded at startup
    const tenant = tenantRepository.findByIdSync(tenantId);
    if (!tenant) {
      throw Object.assign(new Error(`Tenant not found: ${tenantId}`), { statusCode: 404 });
    }
    if (tenant.status === 'suspended') {
      throw Object.assign(new Error(`Tenant suspended: ${tenant.name}`), { statusCode: 403 });
    }
    return tenant;
  }

  async listTenants(): Promise<TenantSummary[]> {
    const tenants = await tenantRepository.findAll();
    return tenants.map(t => ({
      tenantId:  t.tenantId,
      name:      t.name,
      slug:      t.slug,
      domain:    t.domain,
      status:    t.status,
      plan:      t.plan,
      userCount: authRepository.count(t.tenantId),
      appCount:  applicationRepository.count(t.tenantId),
      createdAt: t.createdAt,
    }));
  }
}

export const tenantService = new TenantService();
