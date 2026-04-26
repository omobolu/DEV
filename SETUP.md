# IDVIZE — Enterprise Foundation Setup

## Prerequisites

- **Node.js** 18+ (20 recommended)
- **PostgreSQL** 14+
- **npm** 9+

## PostgreSQL Setup

### 1. Install PostgreSQL

**macOS:** `brew install postgresql@14 && brew services start postgresql`
**Ubuntu/Debian:** `sudo apt install postgresql-14 && sudo systemctl start postgresql`
**Windows:** Download from https://www.postgresql.org/download/windows/

### 2. Create Database and User

```bash
sudo -u postgres psql -c "CREATE USER idvize WITH PASSWORD 'idvize_dev_2026';"
sudo -u postgres psql -c "CREATE DATABASE idvize OWNER idvize;"
```

### 3. Run Migrations

```bash
cd idvize-api
npm install
npm run migrate
```

This creates the following tables:
- `tenants` — Multi-tenant organization records
- `users` — User accounts with bcrypt-hashed passwords
- `applications` — Application inventory (placeholder for Go migration)
- `audit_logs` — Append-only security event log

### 4. Configure Environment

Copy or create `idvize-api/.env`:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=idvize-dev-secret-2026
DATABASE_URL=postgresql://idvize:idvize_dev_2026@localhost:5432/idvize
SEED_MODE=development
```

> **Note:** `.env` is gitignored. Never commit real credentials.

### 5. Data Initialization Strategy

The system supports three modes of operation via the `SEED_MODE` environment variable:

| Mode | Value | Behavior |
|------|-------|----------|
| **Production** | `production` (default) | NO demo data. System starts empty. For real SaaS customers. |
| **Demo** | `demo` | Seeds ACME + Globex demo tenants with full application portfolios. |
| **Development** | `development` | Same as demo; allows flexible seeding + data reset. |

**Production mode is the default.** If `SEED_MODE` is not set, no demo data is loaded.

#### Seed Demo Data (Demo/Dev modes only)

```bash
# Set SEED_MODE before seeding
SEED_MODE=demo npm run seed
```

Seeds 2 demo tenants with 5 users each (all passwords bcrypt-hashed):
- **ACME Financial Services** (`ten-acme`) — admin@acme.com / password123
- **Globex Technologies** (`ten-globex`) — admin@globex.io / password123

#### Production Mode

In production, the database starts empty. Tenants are created exclusively via the `POST /tenants` API. No demo data is ever auto-loaded.

```bash
# Production — no demo data
SEED_MODE=production npm run dev
```

## Running the Application

**Backend:**
```bash
cd idvize-api
npm run dev    # → http://localhost:3001
```

**Frontend:**
```bash
cd idvize
npm install
npm run dev    # → http://localhost:5173
```

## Creating a New Tenant

### Option A: API (Recommended — No Restart Required)

Create a tenant and admin user with a single API call. No restart needed — the new tenant is immediately available for login.

```bash
# First, get a token from an existing Manager account
TOKEN=$(curl -s -X POST http://localhost:3001/security/auth/token \
  -H "Content-Type: application/json" \
  -H "x-api-key: idvize-dev-key-change-me" \
  -d '{"username":"admin@acme.com","password":"password123"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# Create the new tenant + admin user
curl -X POST http://localhost:3001/tenants \
  -H "Content-Type: application/json" \
  -H "x-api-key: idvize-dev-key-change-me" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "YourCo Inc",
    "slug": "yourco",
    "domain": "yourco.com",
    "plan": "professional",
    "adminEmail": "admin@yourco.com",
    "adminPassword": "your-secure-password",
    "adminDisplayName": "Admin User"
  }'
```

The new admin can immediately log in at the login page — no restart needed.

### Option B: Direct SQL (Requires Restart)

If you prefer to insert directly into PostgreSQL:

```bash
# Step 1: Generate password hash
cd idvize-api
node -e "require('bcryptjs').hash('your-password', 10).then(h => console.log(h))"
```

```sql
-- Step 2: Insert tenant
INSERT INTO tenants (tenant_id, name, slug, domain, status, plan, settings)
VALUES (
  'ten-yourco', 'YourCo Inc', 'yourco', 'yourco.com', 'active', 'professional',
  '{"mfaRequired":false,"sessionTimeoutSeconds":28800,"allowedAuthProviders":["oidc"],"maxUsers":100,"maxApps":50}'
);

-- Step 3: Insert admin user (paste bcrypt hash from Step 1)
INSERT INTO users (
  user_id, tenant_id, username, display_name, first_name, last_name,
  email, roles, status, auth_provider, password_hash
) VALUES (
  'usr-yourco-admin-001', 'ten-yourco', 'admin@yourco.com', 'Admin User',
  'Admin', 'User', 'admin@yourco.com', '["Manager"]', 'active', 'local',
  '$2b$10$...'  -- paste the hash from Step 1
);
```

> **Note:** Direct SQL inserts require a backend restart (`Ctrl+C` then `npm run dev`) because the in-memory tenant cache only loads at startup. The API approach (Option A) avoids this by updating both PostgreSQL and the cache in one call.

## Multi-Tenant Testing

Login as users from different tenants to verify data isolation:

| Tenant | Username | Password | Role |
|--------|----------|----------|------|
| ACME Financial | admin@acme.com | password123 | Manager |
| ACME Financial | sarah.chen@acme.com | password123 | Architect |
| Globex Tech | admin@globex.io | password123 | Manager |
| Globex Tech | priya.kumar@globex.io | password123 | Architect |

Each tenant sees only its own applications, controls, and audit events.

## PostgreSQL Schema (Go-Compatible)

The schema uses snake_case columns, standard SQL types, and JSONB for flexible fields — designed to be consumed directly by a Go backend with `pgx` or `database/sql`:

```
tenants         — tenant_id (PK), name, slug, domain, status, plan, settings (JSONB)
users           — user_id (PK), tenant_id (FK), username, password_hash, roles (JSONB)
applications    — app_id (PK), tenant_id (FK), name, risk_tier, status, iam_posture (JSONB)
audit_logs      — event_id (PK), tenant_id, event_type, actor_id, outcome, metadata (JSONB)
```

All tenant-owned tables include `tenant_id` for strict isolation.

## Tenant Isolation Confirmation

Each tenant (customer organization) has **complete data isolation**:

| Layer | Enforcement |
|-------|-------------|
| **Database** | Every tenant-owned table includes `tenant_id`. All queries filter by `tenant_id`. |
| **Middleware** | `requireAuth` extracts `tenantId` from JWT and attaches it to `req.tenantId`. |
| **Repositories** | All repository methods accept `tenantId` and scope data access. In-memory caches are partitioned by `tenantId`. |
| **Controllers** | All route handlers use `req.tenantId` (120+ occurrences across codebase). |
| **Frontend** | `apiFetch()` sends JWT with embedded `tenantId`. Backend returns only the authenticated user's tenant data. |
| **Audit logs** | Every audit event is tagged with `tenantId`. |

**No customer can ever see another customer's data.**

## How Tenant Admin Users Are Created

### Via POST /tenants API (Recommended)

When a new tenant is created via the API, an admin user is atomically created in the same transaction:

1. Caller provides `name`, `slug`, `domain`, `adminEmail`, `adminPassword`
2. System validates all inputs (slug format, email format, password length, plan value)
3. Both tenant and admin user are inserted in a single PostgreSQL transaction (COMMIT or ROLLBACK)
4. Admin user gets the `Manager` role (full access)
5. In-memory caches are updated immediately — no restart required
6. Audit event `tenant.created` is logged with the actual actor's identity

### Via Direct SQL (Dev/Migration only)

See "Creating a New Tenant — Option B" above. Requires manual bcrypt hashing and backend restart.

## SaaS Readiness — What Still Needs Improvement

### Ready Now
- Strict tenant isolation (all queries scoped by `tenantId`)
- Bcrypt password hashing (no plaintext)
- JWT-based authentication with role-based permissions
- Audit logging for security-relevant actions
- Input validation on tenant creation
- Controlled data initialization (production starts empty)
- API-based tenant provisioning (no restart required)

### Needs Improvement Before Production SaaS

| Area | Current State | Needed |
|------|--------------|--------|
| **Authentication** | Local bcrypt passwords + JWT | OIDC integration (Entra ID / Okta) for SSO |
| **RBAC** | Role-based permissions in JWT | Fine-grained policy engine (ABAC) |
| **Backend** | Node.js/Express (temporary) | Go/Golang backend (next PR) |
| **Application data** | In-memory seed (not persisted to PG) | Full PostgreSQL persistence for applications, controls |
| **Tenant management** | API + direct SQL | Admin portal UI for tenant CRUD |
| **Rate limiting** | None | Per-tenant rate limiting |
| **Encryption** | TLS not enforced | HTTPS required, encryption at rest |
| **Secrets management** | `.env` file | Vault / KMS integration |
| **Monitoring** | Console logging | Structured logging, APM, alerts |
| **Billing** | Not implemented | Subscription management per plan tier |
| **Data retention** | No policies | Tenant data lifecycle policies |
| **Compliance** | Audit log exists | SOC2 / FedRAMP audit evidence generation |
