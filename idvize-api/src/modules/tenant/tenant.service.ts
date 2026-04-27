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

const VALID_PLANS: TenantPlan[] = ['enterprise', 'professional', 'trial'];

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
    if (!input || typeof input !== 'object') {
      errors.push('Request body must be a JSON object');
      return errors;
    }
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
    const existingBySlug = await tenantRepository.findBySlug(input.slug);
    if (existingBySlug) {
      throw Object.assign(new Error(`Slug already in use: ${input.slug}`), { statusCode: 409 });
    }

    // Prevent duplicate adminEmail across tenants (would cause 409 "Ambiguous login" on auth)
    let existingUser = authRepository.findByUsernameGlobal(input.adminEmail);
    if (!existingUser) {
      try {
        existingUser = await authRepository.findByUsernameGlobalPg(input.adminEmail);
      } catch (err) {
        if ((err as { statusCode?: number }).statusCode) throw err;
        throw Object.assign(new Error('Cannot verify email uniqueness — database temporarily unavailable'), { statusCode: 503 });
      }
    }
    if (existingUser) {
      throw Object.assign(new Error('adminEmail is already in use as a username in another tenant'), { statusCode: 409 });
    }

    const now = new Date().toISOString();
    const userId = `usr-${input.slug}-admin-001`;
    const passwordHash = await bcrypt.hash(input.adminPassword, 10);
    const plan: TenantPlan = VALID_PLANS.includes(input.plan as TenantPlan) ? (input.plan as TenantPlan) : 'professional';

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

    // Atomic PG transaction via repository layer: both tenant and user must succeed or both roll back
    await tenantRepository.createTenantWithAdmin(tenant, user);
    authRepository.save(tenantId, user);

    // Audit log — fire-and-forget so audit failure doesn't mask a successful creation
    auditService.log({
      eventType: 'tenant.created',
      actorId,
      actorName,
      targetId: tenantId,
      targetType: 'tenant',
      outcome: 'success',
      tenantId: 'system',
      metadata: { tenantName: tenant.name, slug: tenant.slug, adminEmail: input.adminEmail },
    }).catch(err => {
      console.error('[TenantService] Audit log failed after tenant creation (tenant was created successfully):', (err as Error).message);
    });

    return {
      tenant: { tenantId, name: tenant.name, slug: tenant.slug, domain: tenant.domain, status: 'active', plan: tenant.plan },
      adminUser: { userId, username: input.adminEmail, role: 'Manager' },
    };
  }
}

export const tenantService = new TenantService();
