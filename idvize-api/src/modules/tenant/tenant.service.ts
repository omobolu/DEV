/**
 * Tenant Service
 *
 * Business logic for tenant lookup, validation, listing, and creation.
 * Uses PostgreSQL-backed tenant repository with in-memory cache.
 */

import bcrypt from 'bcryptjs';
import { Tenant, TenantSummary, TenantPlan } from './tenant.types';
import { tenantRepository } from './tenant.repository';
import { authRepository } from '../security/auth/auth.repository';
import { applicationRepository } from '../application/application.repository';
import { auditService } from '../security/audit/audit.service';
import { User } from '../security/security.types';
import pool from '../../db/pool';

export interface CreateTenantInput {
  name: string;
  slug: string;
  domain: string;
  plan?: string;
  adminEmail: string;
  adminPassword: string;
  adminDisplayName?: string;
}

export interface CreateTenantResult {
  tenant: { tenantId: string; name: string; slug: string; domain: string; status: string; plan: string };
  adminUser: { userId: string; username: string; role: string };
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

class TenantService {
  async getTenant(tenantId: string): Promise<Tenant | undefined> {
    return tenantRepository.findById(tenantId);
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    return tenantRepository.findBySlug(slug);
  }

  /** Throws a typed error if tenantId is invalid or suspended. */
  validateTenant(tenantId: string): Tenant {
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

  validateCreateInput(input: CreateTenantInput): string[] {
    const errors: string[] = [];
    if (!input.name || !input.slug || !input.domain || !input.adminEmail || !input.adminPassword) {
      errors.push('Missing required fields: name, slug, domain, adminEmail, adminPassword');
      return errors;
    }
    if (!SLUG_RE.test(input.slug)) {
      errors.push('slug must be 2-50 lowercase alphanumeric characters or hyphens, starting and ending with alphanumeric');
    }
    if (!EMAIL_RE.test(input.adminEmail)) {
      errors.push('adminEmail must be a valid email address');
    }
    if (input.adminPassword.length < MIN_PASSWORD_LENGTH) {
      errors.push(`adminPassword must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    return errors;
  }

  async createTenant(input: CreateTenantInput, actorId: string, actorName: string): Promise<CreateTenantResult> {
    const tenantId = `ten-${input.slug}`;
    const existing = await tenantRepository.findById(tenantId);
    if (existing) {
      throw Object.assign(new Error(`Tenant already exists: ${tenantId}`), { statusCode: 409 });
    }

    const now = new Date().toISOString();
    const userId = `usr-${input.slug}-admin-001`;
    const passwordHash = await bcrypt.hash(input.adminPassword, 10);
    const plan = (input.plan || 'professional') as TenantPlan;

    const tenant: Tenant = {
      tenantId,
      name: input.name,
      slug: input.slug,
      domain: input.domain,
      status: 'active',
      plan,
      adminUserId: userId,
      settings: {
        mfaRequired: false,
        sessionTimeoutSeconds: 28800,
        allowedAuthProviders: ['oidc'],
        maxUsers: 100,
        maxApps: 50,
      },
      createdAt: now,
      updatedAt: now,
    };

    const user: User = {
      userId,
      tenantId,
      username: input.adminEmail,
      displayName: input.adminDisplayName || 'Admin',
      firstName: 'Admin',
      lastName: 'User',
      email: input.adminEmail,
      department: 'IT',
      title: 'Administrator',
      roles: ['Manager'],
      groups: [],
      status: 'active',
      authProvider: 'local',
      mfaEnrolled: false,
      passwordHash,
      attributes: {},
      createdAt: now,
      updatedAt: now,
    };

    // Atomic PG transaction: both tenant and user must succeed or both roll back
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO tenants (tenant_id, name, slug, domain, status, plan, admin_user_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [tenantId, tenant.name, tenant.slug, tenant.domain, tenant.status, tenant.plan, tenant.adminUserId, JSON.stringify(tenant.settings), now, now]
      );

      await client.query(
        `INSERT INTO users (user_id, tenant_id, username, display_name, first_name, last_name, email, department, title, roles, groups, status, auth_provider, mfa_enrolled, password_hash, attributes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)`,
        [userId, tenantId, input.adminEmail, user.displayName, 'Admin', 'User', input.adminEmail, 'IT', 'Administrator', JSON.stringify(['Manager']), JSON.stringify([]), 'active', 'local', false, passwordHash, JSON.stringify({}), now]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error(`Tenant creation failed: ${(err as Error).message}`), { statusCode: 500 });
    } finally {
      client.release();
    }

    // Update in-memory caches after successful PG transaction
    tenantRepository.addToCache(tenant);
    authRepository.save(tenantId, user);

    // Audit log
    auditService.log({
      eventType: 'tenant.created',
      actorId,
      actorName,
      targetId: tenantId,
      targetType: 'tenant',
      outcome: 'success',
      tenantId: 'system',
      metadata: { tenantName: tenant.name, slug: tenant.slug, adminEmail: input.adminEmail },
    });

    return {
      tenant: { tenantId, name: tenant.name, slug: tenant.slug, domain: tenant.domain, status: 'active', plan: tenant.plan },
      adminUser: { userId, username: input.adminEmail, role: 'Manager' },
    };
  }
}

export const tenantService = new TenantService();
