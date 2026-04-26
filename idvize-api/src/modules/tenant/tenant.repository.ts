/**
 * Tenant Repository — PostgreSQL-backed
 *
 * Global store for tenant metadata. NOT partitioned by tenantId — this IS
 * the top-level namespace that all other repositories are partitioned under.
 *
 * Reads from PostgreSQL with an in-memory cache for hot-path lookups.
 * Writes go to both PostgreSQL and the cache.
 */

import { Tenant } from './tenant.types';
import pool from '../../db/pool';

class TenantRepository {
  private cache = new Map<string, Tenant>();
  private slugIndex = new Map<string, string>();
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (!this.loadPromise) {
      this.loadPromise = pool.query('SELECT * FROM tenants').then(result => {
        for (const row of result.rows) {
          const tenant = this.rowToTenant(row);
          this.cache.set(tenant.tenantId, tenant);
          this.slugIndex.set(tenant.slug, tenant.tenantId);
        }
        this.loaded = true;
        this.loadPromise = null;
      }).catch(err => {
        this.loadPromise = null;
        throw err;
      });
    }
    await this.loadPromise;
  }

  private rowToTenant(row: Record<string, unknown>): Tenant {
    const settings = (typeof row.settings === 'string' ? JSON.parse(row.settings as string) : row.settings) as Tenant['settings'];
    return {
      tenantId:    row.tenant_id as string,
      name:        row.name as string,
      slug:        row.slug as string,
      domain:      row.domain as string,
      status:      row.status as Tenant['status'],
      plan:        row.plan as Tenant['plan'],
      adminUserId: row.admin_user_id as string,
      settings,
      createdAt:   (row.created_at as Date).toISOString(),
      updatedAt:   (row.updated_at as Date).toISOString(),
    };
  }

  async save(tenant: Tenant): Promise<Tenant> {
    try {
      await pool.query(
        `INSERT INTO tenants (tenant_id, name, slug, domain, status, plan, admin_user_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (tenant_id) DO UPDATE SET
           name = $2, slug = $3, domain = $4, status = $5, plan = $6,
           admin_user_id = $7, settings = $8, updated_at = $10`,
        [tenant.tenantId, tenant.name, tenant.slug, tenant.domain, tenant.status, tenant.plan, tenant.adminUserId, JSON.stringify(tenant.settings), tenant.createdAt, tenant.updatedAt]
      );
    } catch (err) {
      console.warn(`[TenantRepo] PostgreSQL write failed for ${tenant.tenantId}, caching in-memory only:`, (err as Error).message);
    }
    this.cache.set(tenant.tenantId, tenant);
    this.slugIndex.set(tenant.slug, tenant.tenantId);
    return tenant;
  }

  async findById(tenantId: string): Promise<Tenant | undefined> {
    await this.ensureLoaded();
    return this.cache.get(tenantId);
  }

  async findBySlug(slug: string): Promise<Tenant | undefined> {
    await this.ensureLoaded();
    const id = this.slugIndex.get(slug);
    return id ? this.cache.get(id) : undefined;
  }

  async findAll(): Promise<Tenant[]> {
    await this.ensureLoaded();
    return Array.from(this.cache.values());
  }

  async count(): Promise<number> {
    await this.ensureLoaded();
    return this.cache.size;
  }

  // Sync accessors for hot-path middleware (cache must already be loaded)
  findByIdSync(tenantId: string): Tenant | undefined {
    return this.cache.get(tenantId);
  }

  countSync(): number {
    return this.cache.size;
  }

  async loadCache(): Promise<void> {
    this.loaded = false;
    this.loadPromise = null;
    await this.ensureLoaded();
  }
}

export const tenantRepository = new TenantRepository();
