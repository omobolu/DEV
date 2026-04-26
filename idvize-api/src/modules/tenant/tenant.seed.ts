/**
 * Tenant Seed
 *
 * Creates two demo tenants with their own users and application portfolios.
 * Called once on API startup (no-op if tenants already exist).
 *
 * Tenant 1 — ACME Financial Services  (ten-acme)
 * Tenant 2 — Globex Technologies      (ten-globex)
 *
 * On startup:
 *   1. Load tenant cache from PostgreSQL (persistent tenants)
 *   2. Seed in-memory stores for modules not yet migrated to PostgreSQL
 */

import { Tenant } from './tenant.types';
import { tenantRepository } from './tenant.repository';
import { authRepository } from '../security/auth/auth.repository';
import { seedApplications } from '../application/application.seed';
import { User } from '../security/security.types';

const NOW = new Date().toISOString();

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

const ACME_USERS: User[] = [
  {
    userId: 'usr-acme-manager-001', tenantId: 'ten-acme',
    username: 'admin@acme.com', displayName: 'Alex Morgan',
    firstName: 'Alex', lastName: 'Morgan', email: 'admin@acme.com',
    department: 'IAM Program Office', title: 'IAM Program Manager',
    roles: ['Manager'], groups: ['grp-managers'], status: 'active',
    authProvider: 'local', mfaEnrolled: true,
    passwordHash: 'password123',
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
    passwordHash: 'password123',
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
    passwordHash: 'password123',
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
    passwordHash: 'password123',
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
    passwordHash: 'password123',
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
    passwordHash: 'password123',
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
    passwordHash: 'password123',
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
    passwordHash: 'password123',
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
    passwordHash: 'password123',
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
    passwordHash: 'password123',
    attributes: { costCentre: 'ENG-004', clearanceLevel: 'standard' },
    createdAt: NOW, updatedAt: NOW,
  },
];

// ── Entry point ───────────────────────────────────────────────────────────────

export async function seedTenants(): Promise<void> {
  let pgAvailable = false;

  // Try loading tenant cache from PostgreSQL
  try {
    await tenantRepository.loadCache();
    pgAvailable = true;
  } catch (err) {
    console.warn('[SEED] PostgreSQL unavailable, falling back to in-memory only:', (err as Error).message);
  }

  // Seed tenants if not already loaded from PostgreSQL
  if (tenantRepository.countSync() === 0) {
    await tenantRepository.save(TENANT_ACME);
    await tenantRepository.save(TENANT_GLOBEX);
  }

  // Seed in-memory user store (still needed for RBAC, SCIM, and other modules)
  for (const user of ACME_USERS)   authRepository.save('ten-acme',   user);
  for (const user of GLOBEX_USERS) authRepository.save('ten-globex', user);

  // Seed application portfolios in-memory
  seedApplications('ten-acme');
  seedApplications('ten-globex');

  console.log('  \u2713 Tenant seed loaded \u2014 2 tenants (ACME Financial, Globex Technologies)');
  console.log('  \u2713 Users seeded: 5 per tenant (admin@acme.com, admin@globex.io / password123)');
  console.log('  \u2713 Application portfolios seeded: 50 apps \u00d7 2 tenants');
  console.log(`  \u2713 PostgreSQL: ${pgAvailable ? 'connected \u2014 tenants + users persisted with bcrypt passwords' : 'unavailable \u2014 running in-memory only'}`);
}
