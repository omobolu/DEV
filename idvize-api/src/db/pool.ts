/**
 * PostgreSQL Connection Pool
 *
 * Shared pool used by all repositories that have been migrated to persistent storage.
 * Configuration comes from DATABASE_URL environment variable.
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://idvize:idvize_dev_2026@localhost:5432/idvize',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

export default pool;
