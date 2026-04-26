/**
 * Tenant Seed — Controlled Data Initialization
 *
 * Respects the SEED_MODE environment variable:
 *   - "production" (default)  — NO seed data. PostgreSQL REQUIRED. Fails if PG unavailable.
 *   - "demo"                  — Seeds ACME + Globex demo tenants. PG fallback allowed.
 *   - "development"           — Same as demo; allows flexible seeding + data reset.
 *
 * CRITICAL INVARIANTS:
 *   1. Production must NEVER auto-load demo tenants.
 *   2. Production must NEVER serve in-memory-only data (no PG = crash).
 *   3. Demo seed data ONLY loads when SEED_MODE is explicitly "demo" or "development".
 *
 * Tenant 1 — ACME Financial Services  (ten-acme)
 * Tenant 2 — Globex Technologies      (ten-globex)
 *
 * On startup:
 *   1. Load tenant cache from PostgreSQL
 *   2. In production: if PG fails, abort startup (throw)
 *   3. In demo/development: if PG fails, fall back to in-memory seed data
 *   4. Demo data only seeded when SEED_MODE is demo or development
 */

import { Tenant } from './tenant.types';
import { tenantRepository } from './tenant.repository';
import { authRepository } from '../security/auth/auth.repository';
import { seedApplications } from '../application/application.seed';
import { User } from '../security/security.types';
import { getSeedMode, SeedMode } from '../../config/seed-mode';

const NOW = new Date().toISOString();

// Pre-computed bcrypt hash of 'password123' (cost factor 10).
// All demo users share this hash. In production, users are created via POST /tenants
// with bcrypt hashing at write time — this constant is never used in production mode.
const DEMO_PASSWORD_HASH = '$2b$10$eJbeuHvdE3yRNXovQ1XE..gc4YlXZsxcR8wlru3dAHNUEhIDDO8Gu';

// ── Tenant definitions ────────────────────────────────────────────────────────

const TENANT_ACME: Tenant = {
  tenantId:    'ten-acme',
  name:        'ACME Financial Services',
  slug:        'acme-financial',
  domain:      'acme.com',
  status:      'active',
  plan:        'enterprise',
  adminUserId: 'usr-acme-manager-001',
  settings: {
    mfaRequired:           true,
    sessionTimeoutSeconds: 28800,
    allowedAuthProviders:  ['oidc', 'saml'],
    maxUsers:              500,
    maxApps:               200,
  },
  createdAt: NOW,
  updatedAt: NOW,
};

const TENANT_GLOBEX: Tenant = {
  tenantId:    'ten-globex',
  name:        'Globex Technologies',
  slug:        'globex-tech',
  domain:      'globex.io',
  status:      'active',
  plan:        'professional',
  adminUserId: 'usr-globex-manager-001',
  settings: {
    mfaRequired:           false,
    sessionTimeoutSeconds: 28800,
    allowedAuthProviders:  ['oidc'],
    maxUsers:              200,
    maxApps:               100,
  },
  createdAt: NOW,
  updatedAt: NOW,
};

// ── Users — ACME Financial ────────────────────────────────────────────────────

// ── Platform Admin (SaaS operator) ────────────────────────────────────────────
// In production, the PlatformAdmin is the SaaS operator who manages tenants.
// In demo/dev, we seed one in the ACME tenant for testing tenant CRUD APIs.

const PLATFORM_ADMIN: User = {
  userId: 'usr-platform-admin-001', tenantId: 'ten-acme',
  username: 'platform@idvize.io', displayName: 'Platform Admin',
  firstName: 'Platform', lastName: 'Admin', email: 'platform@idvize.io',
  department: 'Platform Operations', title: 'SaaS Platform Administrator',
  roles: ['PlatformAdmin'], groups: ['grp-platform-admins'], status: 'active',
  authProvider: 'local', mfaEnrolled: true,
  passwordHash: DEMO_PASSWORD_HASH,
  attributes: { clearanceLevel: 'critical' },
  createdAt: NOW, updatedAt: NOW,
};

const ACME_USERS: User[] = [
  PLATFORM_ADMIN,
  {
    userId: 'usr-acme-manager-001', tenantId: 'ten-acme',
    username: 'admin@acme.com', displayName: 'Alex Morgan',
    firstName: 'Alex', lastName: 'Morgan', email: 'admin@acme.com',
    department: 'IAM Program Office', title: 'IAM Program Manager',
    roles: ['Manager'], groups: ['grp-managers'], status: 'active',
    authProvider: 'local', mfaEnrolled: true,
    passwordHash: DEMO_PASSWORD_HASH,
    attributes: { costCentre: 'IAM-001', clearanceLevel: 'high' },
    createdAt: NOW, updatedAt: NOW,
  },
  {
    userId: 'usr-acme-architect-001', tenantId: 'ten-acme',
    username: 'sarah.chen@acme.com', displayName: 'Sarah Chen',
    firstName: 'Sarah', lastName: 'Chen', email: 'sarah.chen@acme.com',
    department: 'IAM Architecture', title: 'Senior IAM Architect',
    roles: ['Architect'], groups: ['grp-architects'], status: 'active',
    authProvider: 'local', mfaEnrolled: true,
    passwordHash: DEMO_PASSWORD_HASH,
    attributes: { costCentre: 'IAM-002', clearanceLevel: 'high' },
    createdAt: NOW, updatedAt: NOW,
  },
  {
    userId: 'usr-acme-analyst-001', tenantId: 'ten-acme',
    username: 'james.okafor@acme.com', displayName: 'James Okafor',
    firstName: 'James', lastName: 'Okafor', email: 'james.okafor@acme.com',
    department: 'IAM Business Analysis', title: 'IAM Business Analyst',
    roles: ['BusinessAnalyst'], groups: ['grp-analysts'], status: 'active',
    authProvider: 'local', mfaEnrolled: true,
    passwordHash: DEMO_PASSWORD_HASH,
    attributes: { costCentre: 'IAM-003', clearanceLevel: 'medium' },
    createdAt: NOW, updatedAt: NOW,
  },
  {
    userId: 'usr-acme-engineer-001', tenantId: 'ten-acme',
    username: 'lisa.park@acme.com', displayName: 'Lisa Park',
    firstName: 'Lisa', lastName: 'Park', email: 'lisa.park@acme.com',
    department: 'IAM Engineering', title: 'IAM Engineer',
    roles: ['Engineer'], groups: ['grp-engineers'], status: 'active',
    authProvider: 'local', mfaEnrolled: true,
    passwordHash: DEMO_PASSWORD_HASH,
    attributes: { costCentre: 'IAM-004', clearanceLevel: 'medium' },
    createdAt: NOW, updatedAt: NOW,
  },
  {
    userId: 'usr-acme-developer-001', tenantId: 'ten-acme',
    username: 'raj.patel@acme.com', displayName: 'Raj Patel',
    firstName: 'Raj', lastName: 'Patel', email: 'raj.patel@acme.com',
    department: 'IAM Engineering', title: 'IAM Developer',
    roles: ['Developer'], groups: ['grp-developers'], status: 'active',
    authProvider: 'local', mfaEnrolled: false,
    passwordHash: DEMO_PASSWORD_HASH,
    attributes: { costCentre: 'IAM-005', clearanceLevel: 'standard' },
    createdAt: NOW, updatedAt: NOW,
  },
];

// ── Users — Globex Technologies ───────────────────────────────────────────────

const GLOBEX_USERS: User[] = [
  {
    userId: 'usr-globex-manager-001', tenantId: 'ten-globex',
    username: 'admin@globex.io', displayName: 'Marcus Walsh',
    firstName: 'Marcus', lastName: 'Walsh', email: 'admin@globex.io',
    department: 'Security & Identity', title: 'CISO',
    roles: ['Manager'], groups: ['grp-managers'], status: 'active',
    authProvider: 'local', mfaEnrolled: true,
    passwordHash: DEMO_PASSWORD_HASH,
    attributes: { costCentre: 'SEC-001', clearanceLevel: 'high' },
    createdAt: NOW, updatedAt: NOW,
  },
  {
    userId: 'usr-globex-architect-001', tenantId: 'ten-globex',
    username: 'priya.kumar@globex.io', displayName: 'Priya Kumar',
    firstName: 'Priya', lastName: 'Kumar', email: 'priya.kumar@globex.io',
    department: 'Platform Engineering', title: 'Identity Architect',
    roles: ['Architect'], groups: ['grp-architects'], status: 'active',
    authProvider: 'local', mfaEnrolled: true,
    passwordHash: DEMO_PASSWORD_HASH,
    attributes: { costCentre: 'ENG-002', clearanceLevel: 'high' },
    createdAt: NOW, updatedAt: NOW,
  },
  {
    userId: 'usr-globex-analyst-001', tenantId: 'ten-globex',
    username: 'tom.harris@globex.io', displayName: 'Tom Harris',
    firstName: 'Tom', lastName: 'Harris', email: 'tom.harris@globex.io',
    department: 'GRC', title: 'GRC Analyst',
    roles: ['BusinessAnalyst'], groups: ['grp-analysts'], status: 'active',
    authProvider: 'local', mfaEnrolled: false,
    passwordHash: DEMO_PASSWORD_HASH,
    attributes: { costCentre: 'GRC-001', clearanceLevel: 'medium' },
    createdAt: NOW, updatedAt: NOW,
  },
  {
    userId: 'usr-globex-engineer-001', tenantId: 'ten-globex',
    username: 'anna.schmidt@globex.io', displayName: 'Anna Schmidt',
    firstName: 'Anna', lastName: 'Schmidt', email: 'anna.schmidt@globex.io',
    department: 'Cloud Engineering', title: 'Cloud Identity Engineer',
    roles: ['Engineer'], groups: ['grp-engineers'], status: 'active',
    authProvider: 'local', mfaEnrolled: true,
    passwordHash: DEMO_PASSWORD_HASH,
    attributes: { costCentre: 'ENG-003', clearanceLevel: 'medium' },
    createdAt: NOW, updatedAt: NOW,
  },
  {
    userId: 'usr-globex-developer-001', tenantId: 'ten-globex',
    username: 'wei.zhou@globex.io', displayName: 'Wei Zhou',
    firstName: 'Wei', lastName: 'Zhou', email: 'wei.zhou@globex.io',
    department: 'Software Engineering', title: 'IAM Developer',
    roles: ['Developer'], groups: ['grp-developers'], status: 'active',
    authProvider: 'local', mfaEnrolled: false,
    passwordHash: DEMO_PASSWORD_HASH,
    attributes: { costCentre: 'ENG-004', clearanceLevel: 'standard' },
    createdAt: NOW, updatedAt: NOW,
  },
];

// ── Entry point ───────────────────────────────────────────────────────────────

// Re-export for backward compatibility (index.ts and others import from here)
export { getSeedMode, SeedMode } from '../../config/seed-mode';

export async function seedTenants(): Promise<void> {
  const mode = getSeedMode();
  let pgAvailable = false;

  // Step 1: Attempt to load tenant cache from PostgreSQL
  try {
    await tenantRepository.loadCache();
    pgAvailable = true;
    // Load all users from PG into in-memory authRepository for ALL modes.
    // Without this, authzService, SCIM, and user endpoints return empty after restart.
    const userCount = await authRepository.loadAllUsersFromPg();
    if (userCount > 0) {
      console.log(`  [SEED] Loaded ${userCount} user(s) from PostgreSQL into memory`);
    }
  } catch (err) {
    // Step 2: Production mode REQUIRES PostgreSQL — abort startup
    if (mode === 'production') {
      console.error('[FATAL] SEED_MODE=production but PostgreSQL is unavailable.');
      console.error('[FATAL] Production must never serve in-memory-only data.');
      console.error('[FATAL] Fix the DATABASE_URL or start PostgreSQL, then retry.');
      throw new Error(`Production startup aborted: PostgreSQL unavailable — ${(err as Error).message}`);
    }
    // Demo/development: allow in-memory fallback
    console.warn('[SEED] PostgreSQL unavailable, falling back to in-memory only:', (err as Error).message);
  }

  // Step 3: In production mode, skip all demo data seeding
  if (mode === 'production') {
    const count = tenantRepository.countSync();
    console.log('  [SEED] SEED_MODE=production -- no demo data loaded');
    console.log(`  [SEED] Tenants in database: ${count}`);
    console.log(`  [SEED] PostgreSQL: connected`);
    if (count === 0) {
      console.log('  [SEED] Database is empty. Create tenants via POST /tenants API.');
    }
    return;
  }

  // ── GUARD: Demo data ONLY loads when SEED_MODE is explicitly demo or development ──
  if (mode !== 'demo' && mode !== 'development') {
    return; // Should not be reachable, but prevents accidental demo data loading
  }

  // Step 4: In demo/development mode, seed demo tenants if not already present
  if (tenantRepository.countSync() === 0) {
    await tenantRepository.save(TENANT_ACME);
    await tenantRepository.save(TENANT_GLOBEX);
  }

  // Seed in-memory user store only if PG didn't already provide them
  if (authRepository.count('ten-acme') === 0) {
    for (const user of ACME_USERS) authRepository.save('ten-acme', user);
  }
  if (authRepository.count('ten-globex') === 0) {
    for (const user of GLOBEX_USERS) authRepository.save('ten-globex', user);
  }

  // Seed application portfolios in-memory
  seedApplications('ten-acme');
  seedApplications('ten-globex');

  console.log(`  [SEED] SEED_MODE=${mode} -- demo data loaded`);
  console.log('  \u2713 Tenant seed loaded \u2014 2 tenants (ACME Financial, Globex Technologies)');
  console.log('  \u2713 Users seeded: 6 ACME (incl. platform@idvize.io PlatformAdmin), 5 Globex');
  console.log('  \u2713 Application portfolios seeded: ACME=50 apps, Globex=30 apps');
  console.log(`  \u2713 PostgreSQL: ${pgAvailable ? 'connected \u2014 tenants + users persisted with bcrypt passwords' : 'unavailable \u2014 running in-memory only'}`);
}
