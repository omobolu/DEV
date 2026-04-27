/**
 * Seed Mode Configuration
 *
 * Controls data initialization strategy:
 *   - "production" (default) — NO seed data. PostgreSQL REQUIRED.
 *   - "demo"                 — Seeds demo tenants. PG fallback allowed.
 *   - "development"          — Same as demo; allows flexible seeding.
 */

export type SeedMode = 'production' | 'demo' | 'development';

export function getSeedMode(): SeedMode {
  const raw = (process.env.SEED_MODE ?? 'production').toLowerCase().trim();
  if (raw === 'demo' || raw === 'development') return raw;
  return 'production';
}
