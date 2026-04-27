/**
 * PostgreSQL Connection Pool
 *
 * Shared pool used by all repositories that have been migrated to persistent storage.
 * Configuration comes from DATABASE_URL environment variable.
 */

import { Pool } from 'pg';
import { getSeedMode } from '../config/seed-mode';

const DEV_FALLBACK = 'postgresql://idvize:idvize_dev_2026@localhost:5432/idvize';

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (getSeedMode() === 'production') {
    throw new Error('[FATAL] SEED_MODE=production but DATABASE_URL is not set. Production must not use a fallback database.');
  }
  return DEV_FALLBACK;
}

const pool = new Pool({
  connectionString: getConnectionString(),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

export default pool;
