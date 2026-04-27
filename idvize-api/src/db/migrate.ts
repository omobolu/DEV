/**
 * Database Migration — Schema Setup
 *
 * Creates all PostgreSQL tables for the Enterprise Foundation.
 * Safe to run multiple times (uses IF NOT EXISTS).
 *
 * Usage: npx ts-node src/db/migrate.ts
 */

import 'dotenv/config';
import pool from './pool';

const SCHEMA = `
-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id       TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  domain          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  plan            TEXT NOT NULL DEFAULT 'professional',
  admin_user_id   TEXT,
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  user_id         TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(tenant_id),
  username        TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  first_name      TEXT NOT NULL DEFAULT '',
  last_name       TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL,
  department      TEXT,
  title           TEXT,
  roles           JSONB NOT NULL DEFAULT '[]',
  groups          JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'active',
  auth_provider   TEXT NOT NULL DEFAULT 'local',
  mfa_enrolled    BOOLEAN NOT NULL DEFAULT false,
  password_hash   TEXT,
  attributes      JSONB NOT NULL DEFAULT '{}',
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(tenant_id, LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Applications
CREATE TABLE IF NOT EXISTS applications (
  app_id              TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenants(tenant_id),
  name                TEXT NOT NULL,
  raw_name            TEXT NOT NULL DEFAULT '',
  owner               TEXT NOT NULL DEFAULT '',
  owner_email         TEXT NOT NULL DEFAULT '',
  vendor              TEXT NOT NULL DEFAULT '',
  support_contact     TEXT,
  department          TEXT NOT NULL DEFAULT '',
  risk_tier           TEXT NOT NULL DEFAULT 'medium',
  data_classification TEXT NOT NULL DEFAULT 'internal',
  user_population     INTEGER NOT NULL DEFAULT 0,
  app_type            TEXT NOT NULL DEFAULT 'unknown',
  tags                JSONB NOT NULL DEFAULT '[]',
  source              TEXT NOT NULL DEFAULT 'manual',
  status              TEXT NOT NULL DEFAULT 'active',
  iam_posture         JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_applications_tenant ON applications(tenant_id);

-- Audit Logs (append-only)
CREATE TABLE IF NOT EXISTS audit_logs (
  event_id        TEXT PRIMARY KEY,
  tenant_id       TEXT,
  event_type      TEXT NOT NULL,
  actor_id        TEXT NOT NULL,
  actor_name      TEXT NOT NULL DEFAULT '',
  actor_ip        TEXT,
  target_id       TEXT,
  target_type     TEXT,
  permission_id   TEXT,
  resource        TEXT,
  outcome         TEXT NOT NULL DEFAULT 'success',
  reason          TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  session_id      TEXT,
  request_id      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Control Assessments (per-app, per-control, per-tenant)
CREATE TABLE IF NOT EXISTS control_assessments (
  tenant_id       TEXT NOT NULL REFERENCES tenants(tenant_id),
  app_id          TEXT NOT NULL REFERENCES applications(app_id),
  control_id      TEXT NOT NULL,
  control_name    TEXT NOT NULL,
  pillar          TEXT NOT NULL,
  outcome         TEXT NOT NULL CHECK (outcome IN ('OK', 'ATTN', 'GAP')),
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, app_id, control_id)
);
CREATE INDEX IF NOT EXISTS idx_ca_tenant ON control_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ca_app ON control_assessments(tenant_id, app_id);

-- Agent Execution Sessions
CREATE TABLE IF NOT EXISTS execution_sessions (
  session_id      TEXT NOT NULL,
  tenant_id       TEXT NOT NULL REFERENCES tenants(tenant_id),
  agent_type      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'planning',
  plan            JSONB,
  credential_handles JSONB NOT NULL DEFAULT '[]',
  created_by      TEXT NOT NULL,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_exs_tenant_status ON execution_sessions(tenant_id, status);

-- Agent Execution Approvals
CREATE TABLE IF NOT EXISTS execution_approvals (
  approval_id     TEXT NOT NULL,
  session_id      TEXT NOT NULL,
  tenant_id       TEXT NOT NULL REFERENCES tenants(tenant_id),
  role            TEXT NOT NULL,
  approver_id     TEXT,
  approver_name   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  required_by     TIMESTAMPTZ NOT NULL,
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, approval_id)
);
CREATE INDEX IF NOT EXISTS idx_exa_session ON execution_approvals(tenant_id, session_id);

-- Agent Execution Evidence (append-only)
CREATE TABLE IF NOT EXISTS execution_evidence (
  evidence_id     TEXT NOT NULL,
  session_id      TEXT NOT NULL,
  tenant_id       TEXT NOT NULL REFERENCES tenants(tenant_id),
  step_id         TEXT,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  data            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, evidence_id)
);
CREATE INDEX IF NOT EXISTS idx_eve_session ON execution_evidence(tenant_id, session_id);

-- Add technical_sme columns to applications (idempotent)
DO $$ BEGIN
  ALTER TABLE applications ADD COLUMN technical_sme TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE applications ADD COLUMN technical_sme_email TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Email Configuration (per-tenant SMTP settings)
CREATE TABLE IF NOT EXISTS email_config (
  tenant_id        TEXT PRIMARY KEY REFERENCES tenants(tenant_id),
  host             TEXT NOT NULL,
  port             INTEGER NOT NULL DEFAULT 587,
  username         TEXT NOT NULL,
  password_enc     TEXT NOT NULL,
  from_email       TEXT NOT NULL,
  from_display     TEXT NOT NULL DEFAULT 'IDVIZE',
  use_tls          BOOLEAN NOT NULL DEFAULT true,
  allow_self_signed BOOLEAN NOT NULL DEFAULT false,
  provider         TEXT NOT NULL DEFAULT 'smtp',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       TEXT NOT NULL
);
`;

async function migrate(): Promise<void> {
  console.log('[DB] Running migrations...');
  await pool.query(SCHEMA);
  console.log('[DB] Migrations complete — tables: tenants, users, applications, audit_logs, control_assessments');
  await pool.end();
}

migrate().catch((err) => {
  console.error('[DB] Migration failed:', err);
  process.exit(1);
});
