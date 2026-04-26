/**
 * Production Bootstrap — First PlatformAdmin Creation
 *
 * One-time CLI script to create the first PlatformAdmin user and their
 * tenant (the "platform" tenant) in a production PostgreSQL database.
 *
 * This script:
 *   - Creates ONLY the platform admin tenant + user
 *   - Does NOT seed demo data (ACME, Globex, etc.)
 *   - Uses an atomic PG transaction (both or neither)
 *   - Hashes the password with bcrypt
 *   - Refuses to run if a PlatformAdmin already exists
 *
 * Usage:
 *   npx ts-node src/db/bootstrap-admin.ts \
 *     --email admin@company.com \
 *     --password <secure_password> \
 *     [--name "Platform Admin"] \
 *     [--org "My Company"]
 *
 * Environment:
 *   DATABASE_URL must point to the production PostgreSQL instance.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from './pool';

const SALT_ROUNDS = 10;

interface BootstrapArgs {
  email: string;
  password: string;
  name: string;
  org: string;
}

function parseArgs(): BootstrapArgs {
  const args = process.argv.slice(2);
  const map = new Map<string, string>();

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const val = args[i + 1];
    if (key && val) map.set(key, val);
  }

  const email = map.get('email');
  const password = map.get('password');

  if (!email || !password) {
    console.error('Usage: npx ts-node src/db/bootstrap-admin.ts --email <email> --password <password> [--name "Name"] [--org "Org"]');
    console.error('');
    console.error('Required:');
    console.error('  --email       Admin email (used as username)');
    console.error('  --password    Admin password (will be bcrypt-hashed)');
    console.error('');
    console.error('Optional:');
    console.error('  --name        Display name (default: "Platform Admin")');
    console.error('  --org         Organization name (default: "Platform Operations")');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('[BOOTSTRAP] Password must be at least 12 characters for production use.');
    process.exit(1);
  }

  return {
    email,
    password,
    name: map.get('name') ?? 'Platform Admin',
    org: map.get('org') ?? 'Platform Operations',
  };
}

async function bootstrap(): Promise<void> {
  const args = parseArgs();
  const now = new Date().toISOString();

  console.log('[BOOTSTRAP] Production PlatformAdmin bootstrap');
  console.log(`[BOOTSTRAP] Email: ${args.email}`);
  console.log(`[BOOTSTRAP] Org: ${args.org}`);

  // Check if a PlatformAdmin already exists
  const existing = await pool.query(
    "SELECT user_id, username FROM users WHERE roles::text LIKE '%PlatformAdmin%' LIMIT 1"
  );
  if (existing.rows.length > 0) {
    console.error(`[BOOTSTRAP] A PlatformAdmin already exists: ${existing.rows[0].username} (${existing.rows[0].user_id})`);
    console.error('[BOOTSTRAP] This script is intended for one-time bootstrap only.');
    await pool.end();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(args.password, SALT_ROUNDS);
  const tenantId = 'ten-platform';
  const userId = `usr-platform-admin-${Date.now()}`;
  const slug = args.org.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create the platform tenant
    await client.query(
      `INSERT INTO tenants (tenant_id, name, slug, domain, status, plan, admin_user_id, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [
        tenantId,
        args.org,
        slug,
        args.email.split('@')[1] ?? 'localhost',
        'active',
        'enterprise',
        userId,
        JSON.stringify({
          mfaRequired: true,
          sessionTimeoutSeconds: 28800,
          allowedAuthProviders: ['oidc', 'saml', 'local'],
          maxUsers: 1000,
          maxApps: 500,
        }),
        now,
      ]
    );

    // Create the PlatformAdmin user
    await client.query(
      `INSERT INTO users (user_id, tenant_id, username, display_name, first_name, last_name, email, department, title, roles, groups, status, auth_provider, mfa_enrolled, password_hash, attributes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)`,
      [
        userId,
        tenantId,
        args.email,
        args.name,
        args.name.split(' ')[0] ?? 'Platform',
        args.name.split(' ').slice(1).join(' ') || 'Admin',
        args.email,
        'Platform Operations',
        'SaaS Platform Administrator',
        JSON.stringify(['PlatformAdmin']),
        JSON.stringify(['grp-platform-admins']),
        'active',
        'local',
        false,
        passwordHash,
        JSON.stringify({ clearanceLevel: 'critical', bootstrapped: true }),
        now,
      ]
    );

    await client.query('COMMIT');

    console.log('[BOOTSTRAP] Success!');
    console.log(`[BOOTSTRAP] Tenant: ${tenantId} (${args.org})`);
    console.log(`[BOOTSTRAP] User: ${userId}`);
    console.log(`[BOOTSTRAP] Login: ${args.email}`);
    console.log('[BOOTSTRAP] No demo data was created.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BOOTSTRAP] Failed:', (err as Error).message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

bootstrap().catch((err) => {
  console.error('[BOOTSTRAP] Unexpected error:', err);
  process.exit(1);
});
