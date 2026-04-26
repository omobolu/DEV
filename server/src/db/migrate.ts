import pool from './pool.js'

const migration = `
-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password      TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  email         TEXT,
  role          TEXT NOT NULL CHECK (role IN ('admin','architect','analyst','manager','engineer','developer','business_analyst')),
  department    TEXT,
  title         TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Applications
CREATE TABLE IF NOT EXISTS applications (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  criticality   TEXT NOT NULL DEFAULT 'medium' CHECK (criticality IN ('low','medium','high','critical')),
  description   TEXT,
  owner         TEXT,
  business_unit TEXT,
  auth_method   TEXT,
  data_classification TEXT,
  sox_applicable BOOLEAN DEFAULT FALSE,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IAM Controls
CREATE TABLE IF NOT EXISTS iam_controls (
  id              TEXT PRIMARY KEY,
  application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  control_type    TEXT NOT NULL CHECK (control_type IN ('MFA','SSO','PAM','RBAC','PROVISIONING','CERTIFICATION','LIFECYCLE')),
  status          TEXT NOT NULL CHECK (status IN ('OK','ATTN','GAP')),
  details         TEXT,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Control Assessments
CREATE TABLE IF NOT EXISTS control_assessments (
  id              TEXT PRIMARY KEY,
  application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  control_type    TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('OK','ATTN','GAP')),
  assessed_by     TEXT,
  assessed_at     TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Risk Findings / Gaps
CREATE TABLE IF NOT EXISTS risk_findings (
  id              TEXT PRIMARY KEY,
  application_id  TEXT REFERENCES applications(id) ON DELETE SET NULL,
  category        TEXT NOT NULL,
  description     TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','accepted')),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- Sessions (for auth)
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- Dashboard metrics (materialized stats per tenant)
CREATE TABLE IF NOT EXISTS dashboard_metrics (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_key    TEXT NOT NULL,
  metric_value  JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, metric_key)
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  resource      TEXT NOT NULL,
  resource_id   TEXT,
  details       JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for tenant isolation
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_applications_tenant ON applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_iam_controls_tenant ON iam_controls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_control_assessments_tenant ON control_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_risk_findings_tenant ON risk_findings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_tenant ON dashboard_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
`

async function migrate() {
  console.log('[MIGRATE] Running database migrations...')
  try {
    await pool.query(migration)
    console.log('[MIGRATE] All tables created successfully.')
  } catch (err) {
    console.error('[MIGRATE] Migration failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
