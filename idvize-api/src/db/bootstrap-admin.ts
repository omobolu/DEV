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
 *   - Requires explicit DATABASE_URL (refuses default/local DB)
 *
 * Password input (in order of precedence):
 *   1. IDVIZE_BOOTSTRAP_PASSWORD environment variable
 *   2. Interactive no-echo stdin prompt
 *   The --password CLI argument is NOT supported (leaks via shell history / ps).
 *
 * Usage:
 *   IDVIZE_BOOTSTRAP_PASSWORD=<secure> DATABASE_URL=postgres://... \
 *     npx ts-node src/db/bootstrap-admin.ts \
 *       --email admin@company.com \
 *       [--name "Platform Admin"] \
 *       [--org "My Company"]
 *
 * Or interactively (password prompted on stdin):
 *   DATABASE_URL=postgres://prod-host:5432/idvize \
 *     npx ts-node src/db/bootstrap-admin.ts --email admin@company.com
 */

import 'dotenv/config';
import * as readline from 'readline';
import bcrypt from 'bcryptjs';
import pool from './pool';

const SALT_ROUNDS = 10;
const DEFAULT_DB_PATTERNS = [
  'localhost',
  '127.0.0.1',
  '::1',
  '/tmp/',
  'host.docker.internal',
];

interface BootstrapArgs {
  email: string;
  password: string;
  name: string;
  org: string;
}

function validateDatabaseUrl(): void {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[BOOTSTRAP] FATAL: DATABASE_URL environment variable is not set.');
    console.error('[BOOTSTRAP] This script requires an explicit DATABASE_URL to prevent accidental');
    console.error('[BOOTSTRAP] bootstrap against the wrong database.');
    console.error('');
    console.error('  Example:');
    console.error('    DATABASE_URL=postgres://user:pass@prod-host:5432/idvize \\');
    console.error('      npx ts-node src/db/bootstrap-admin.ts --email admin@company.com');
    process.exit(1);
  }

  const lower = dbUrl.toLowerCase();
  const isLocal = DEFAULT_DB_PATTERNS.some(p => lower.includes(p));
  if (isLocal && process.env.NODE_ENV === 'production') {
    console.error('[BOOTSTRAP] FATAL: DATABASE_URL points to a local/default database but NODE_ENV=production.');
    console.error(`[BOOTSTRAP] DATABASE_URL: ${dbUrl.replace(/\/\/[^@]+@/, '//<redacted>@')}`);
    console.error('[BOOTSTRAP] In production, use a remote/managed PostgreSQL instance.');
    console.error('[BOOTSTRAP] To override for local testing, unset NODE_ENV or set NODE_ENV=development.');
    process.exit(1);
  }

  if (isLocal) {
    console.warn('[BOOTSTRAP] WARNING: DATABASE_URL points to a local database.');
    console.warn('[BOOTSTRAP] Proceeding because NODE_ENV is not "production".');
  }
}

function readPasswordFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      // Piped input — read a single line
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => { data += chunk; });
      process.stdin.on('end', () => {
        const pw = data.trim().split('\n')[0] ?? '';
        if (!pw) reject(new Error('No password provided on stdin'));
        else resolve(pw);
      });
      return;
    }

    // Interactive TTY — no-echo prompt
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr, // write prompt to stderr to avoid stdout capture
    });

    // Disable echo by writing ANSI codes for hidden input
    process.stderr.write('[BOOTSTRAP] Enter password (input hidden): ');
    const stdin = process.stdin as NodeJS.ReadStream;
    if (typeof stdin.setRawMode === 'function') stdin.setRawMode(true);

    let password = '';
    const onData = (ch: Buffer) => {
      const c = ch.toString('utf8');
      if (c === '\n' || c === '\r') {
        if (typeof stdin.setRawMode === 'function') stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        process.stderr.write('\n');
        rl.close();
        resolve(password);
      } else if (c === '\u0003') { // Ctrl+C
        if (typeof stdin.setRawMode === 'function') stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        rl.close();
        process.exit(130);
      } else if (c === '\u007f' || c === '\b') { // Backspace
        password = password.slice(0, -1);
      } else {
        password += c;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function resolvePassword(): Promise<string> {
  // 1. Environment variable (preferred for CI/automation)
  const envPw = process.env.IDVIZE_BOOTSTRAP_PASSWORD;
  if (envPw) {
    console.log('[BOOTSTRAP] Reading password from IDVIZE_BOOTSTRAP_PASSWORD environment variable.');
    return envPw;
  }

  // 2. Interactive stdin prompt
  console.log('[BOOTSTRAP] No IDVIZE_BOOTSTRAP_PASSWORD env var found.');
  return readPasswordFromStdin();
}

async function parseArgs(): Promise<BootstrapArgs> {
  const args = process.argv.slice(2);
  const map = new Map<string, string>();

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const val = args[i + 1];
    if (key && val) map.set(key, val);
  }

  if (map.has('password')) {
    console.error('[BOOTSTRAP] ERROR: --password CLI argument is not supported.');
    console.error('[BOOTSTRAP] Passing passwords on the command line leaks them via shell history and process listings.');
    console.error('');
    console.error('[BOOTSTRAP] Use one of these secure alternatives:');
    console.error('  1. Set IDVIZE_BOOTSTRAP_PASSWORD environment variable');
    console.error('  2. Run interactively (password will be prompted with hidden input)');
    console.error('  3. Pipe from stdin: echo "$PASSWORD" | npx ts-node src/db/bootstrap-admin.ts --email ...');
    process.exit(1);
  }

  const email = map.get('email');
  if (!email) {
    console.error('Usage: DATABASE_URL=postgres://... npx ts-node src/db/bootstrap-admin.ts --email <email> [--name "Name"] [--org "Org"]');
    console.error('');
    console.error('Required:');
    console.error('  --email       Admin email (used as username)');
    console.error('');
    console.error('Password (one of):');
    console.error('  IDVIZE_BOOTSTRAP_PASSWORD env var');
    console.error('  Interactive prompt (if no env var)');
    console.error('');
    console.error('Optional:');
    console.error('  --name        Display name (default: "Platform Admin")');
    console.error('  --org         Organization name (default: "Platform Operations")');
    process.exit(1);
  }

  const password = await resolvePassword();

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
  // Validate DATABASE_URL before anything else
  validateDatabaseUrl();

  const args = await parseArgs();
  const now = new Date().toISOString();

  console.log('[BOOTSTRAP] Production PlatformAdmin bootstrap');
  console.log(`[BOOTSTRAP] Email: ${args.email}`);
  console.log(`[BOOTSTRAP] Org: ${args.org}`);
  console.log(`[BOOTSTRAP] Database: ${(process.env.DATABASE_URL ?? '').replace(/\/\/[^@]+@/, '//<redacted>@')}`);

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
