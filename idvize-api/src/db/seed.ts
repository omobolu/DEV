/**
 * Database Seed — Populate PostgreSQL with demo data
 *
 * Seeds tenants, users (with bcrypt-hashed passwords), and applications.
 * Safe to run multiple times (uses ON CONFLICT DO NOTHING).
 *
 * Usage: npx ts-node src/db/seed.ts
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from './pool';

const SALT_ROUNDS = 10;
const NOW = new Date().toISOString();

// ── Tenant data ──────────────────────────────────────────────────────────────

const TENANTS = [
  {
    tenant_id: 'ten-acme',
    name: 'ACME Financial Services',
    slug: 'acme-financial',
    domain: 'acme.com',
    status: 'active',
    plan: 'enterprise',
    admin_user_id: 'usr-acme-manager-001',
    settings: {
      mfaRequired: true,
      sessionTimeoutSeconds: 28800,
      allowedAuthProviders: ['oidc', 'saml'],
      maxUsers: 500,
      maxApps: 200,
    },
  },
  {
    tenant_id: 'ten-globex',
    name: 'Globex Technologies',
    slug: 'globex-tech',
    domain: 'globex.io',
    status: 'active',
    plan: 'professional',
    admin_user_id: 'usr-globex-manager-001',
    settings: {
      mfaRequired: false,
      sessionTimeoutSeconds: 28800,
      allowedAuthProviders: ['oidc'],
      maxUsers: 200,
      maxApps: 100,
    },
  },
];

// ── User data ────────────────────────────────────────────────────────────────

const USERS = [
  // Platform Admin (SaaS operator — can manage tenants via POST /tenants)
  { user_id: 'usr-platform-admin-001', tenant_id: 'ten-acme', username: 'platform@idvize.io', display_name: 'Platform Admin', first_name: 'Platform', last_name: 'Admin', email: 'platform@idvize.io', department: 'Platform Operations', title: 'SaaS Platform Administrator', roles: ['PlatformAdmin'], groups: ['grp-platform-admins'], status: 'active', auth_provider: 'local', mfa_enrolled: true, password: 'password123', attributes: { clearanceLevel: 'critical' } },
  // ACME
  { user_id: 'usr-acme-manager-001', tenant_id: 'ten-acme', username: 'admin@acme.com', display_name: 'Alex Morgan', first_name: 'Alex', last_name: 'Morgan', email: 'admin@acme.com', department: 'IAM Program Office', title: 'IAM Program Manager', roles: ['Manager'], groups: ['grp-managers'], status: 'active', auth_provider: 'local', mfa_enrolled: true, password: 'password123', attributes: { costCentre: 'IAM-001', clearanceLevel: 'high' } },
  { user_id: 'usr-acme-architect-001', tenant_id: 'ten-acme', username: 'sarah.chen@acme.com', display_name: 'Sarah Chen', first_name: 'Sarah', last_name: 'Chen', email: 'sarah.chen@acme.com', department: 'IAM Architecture', title: 'Senior IAM Architect', roles: ['Architect'], groups: ['grp-architects'], status: 'active', auth_provider: 'local', mfa_enrolled: true, password: 'password123', attributes: { costCentre: 'IAM-002', clearanceLevel: 'high' } },
  { user_id: 'usr-acme-analyst-001', tenant_id: 'ten-acme', username: 'james.okafor@acme.com', display_name: 'James Okafor', first_name: 'James', last_name: 'Okafor', email: 'james.okafor@acme.com', department: 'IAM Business Analysis', title: 'IAM Business Analyst', roles: ['BusinessAnalyst'], groups: ['grp-analysts'], status: 'active', auth_provider: 'local', mfa_enrolled: true, password: 'password123', attributes: { costCentre: 'IAM-003', clearanceLevel: 'medium' } },
  { user_id: 'usr-acme-engineer-001', tenant_id: 'ten-acme', username: 'lisa.park@acme.com', display_name: 'Lisa Park', first_name: 'Lisa', last_name: 'Park', email: 'lisa.park@acme.com', department: 'IAM Engineering', title: 'IAM Engineer', roles: ['Engineer'], groups: ['grp-engineers'], status: 'active', auth_provider: 'local', mfa_enrolled: true, password: 'password123', attributes: { costCentre: 'IAM-004', clearanceLevel: 'medium' } },
  { user_id: 'usr-acme-developer-001', tenant_id: 'ten-acme', username: 'raj.patel@acme.com', display_name: 'Raj Patel', first_name: 'Raj', last_name: 'Patel', email: 'raj.patel@acme.com', department: 'IAM Engineering', title: 'IAM Developer', roles: ['Developer'], groups: ['grp-developers'], status: 'active', auth_provider: 'local', mfa_enrolled: false, password: 'password123', attributes: { costCentre: 'IAM-005', clearanceLevel: 'standard' } },
  // Globex
  { user_id: 'usr-globex-manager-001', tenant_id: 'ten-globex', username: 'admin@globex.io', display_name: 'Marcus Walsh', first_name: 'Marcus', last_name: 'Walsh', email: 'admin@globex.io', department: 'Security & Identity', title: 'CISO', roles: ['Manager'], groups: ['grp-managers'], status: 'active', auth_provider: 'local', mfa_enrolled: true, password: 'password123', attributes: { costCentre: 'SEC-001', clearanceLevel: 'high' } },
  { user_id: 'usr-globex-architect-001', tenant_id: 'ten-globex', username: 'priya.kumar@globex.io', display_name: 'Priya Kumar', first_name: 'Priya', last_name: 'Kumar', email: 'priya.kumar@globex.io', department: 'Platform Engineering', title: 'Identity Architect', roles: ['Architect'], groups: ['grp-architects'], status: 'active', auth_provider: 'local', mfa_enrolled: true, password: 'password123', attributes: { costCentre: 'ENG-002', clearanceLevel: 'high' } },
  { user_id: 'usr-globex-analyst-001', tenant_id: 'ten-globex', username: 'tom.harris@globex.io', display_name: 'Tom Harris', first_name: 'Tom', last_name: 'Harris', email: 'tom.harris@globex.io', department: 'GRC', title: 'GRC Analyst', roles: ['BusinessAnalyst'], groups: ['grp-analysts'], status: 'active', auth_provider: 'local', mfa_enrolled: false, password: 'password123', attributes: { costCentre: 'GRC-001', clearanceLevel: 'medium' } },
  { user_id: 'usr-globex-engineer-001', tenant_id: 'ten-globex', username: 'anna.schmidt@globex.io', display_name: 'Anna Schmidt', first_name: 'Anna', last_name: 'Schmidt', email: 'anna.schmidt@globex.io', department: 'Cloud Engineering', title: 'Cloud Identity Engineer', roles: ['Engineer'], groups: ['grp-engineers'], status: 'active', auth_provider: 'local', mfa_enrolled: true, password: 'password123', attributes: { costCentre: 'ENG-003', clearanceLevel: 'medium' } },
  { user_id: 'usr-globex-developer-001', tenant_id: 'ten-globex', username: 'wei.zhou@globex.io', display_name: 'Wei Zhou', first_name: 'Wei', last_name: 'Zhou', email: 'wei.zhou@globex.io', department: 'Software Engineering', title: 'IAM Developer', roles: ['Developer'], groups: ['grp-developers'], status: 'active', auth_provider: 'local', mfa_enrolled: false, password: 'password123', attributes: { costCentre: 'ENG-004', clearanceLevel: 'standard' } },
];

async function seed(): Promise<void> {
  const mode = (process.env.SEED_MODE ?? 'production').toLowerCase().trim();
  if (mode === 'production') {
    console.log('[SEED] SEED_MODE=production — refusing to seed demo data.');
    console.log('[SEED] Set SEED_MODE=demo or SEED_MODE=development to load demo tenants.');
    await pool.end();
    return;
  }
  console.log(`[SEED] SEED_MODE=${mode} — seeding PostgreSQL with demo data...`);

  // Tenants
  for (const t of TENANTS) {
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, slug, domain, status, plan, admin_user_id, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [t.tenant_id, t.name, t.slug, t.domain, t.status, t.plan, t.admin_user_id, JSON.stringify(t.settings), NOW]
    );
  }
  console.log(`[SEED] Tenants: ${TENANTS.length}`);

  // Users (with bcrypt-hashed passwords)
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
    await pool.query(
      `INSERT INTO users (user_id, tenant_id, username, display_name, first_name, last_name, email, department, title, roles, groups, status, auth_provider, mfa_enrolled, password_hash, attributes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
       ON CONFLICT (user_id) DO NOTHING`,
      [u.user_id, u.tenant_id, u.username, u.display_name, u.first_name, u.last_name, u.email, u.department, u.title, JSON.stringify(u.roles), JSON.stringify(u.groups), u.status, u.auth_provider, u.mfa_enrolled, hash, JSON.stringify(u.attributes), NOW]
    );
  }
  console.log(`[SEED] Users: ${USERS.length} (passwords bcrypt-hashed)`);

  console.log('[SEED] Complete');
  await pool.end();
}

seed().catch((err) => {
  console.error('[SEED] Failed:', err);
  process.exit(1);
});
