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

### 4. Seed Demo Data

```bash
npm run seed
```

Seeds 2 demo tenants with 5 users each (all passwords bcrypt-hashed):
- **ACME Financial Services** (`ten-acme`) — admin@acme.com / password123
- **Globex Technologies** (`ten-globex`) — admin@globex.io / password123

### 5. Configure Environment

Copy or create `idvize-api/.env`:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=idvize-dev-secret-2026
DATABASE_URL=postgresql://idvize:idvize_dev_2026@localhost:5432/idvize
```

> **Note:** `.env` is gitignored. Never commit real credentials.

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

### Step 1: Insert Tenant

```sql
INSERT INTO tenants (tenant_id, name, slug, domain, status, plan, settings)
VALUES (
  'ten-yourco',
  'YourCo Inc',
  'yourco',
  'yourco.com',
  'active',
  'professional',
  '{"mfaRequired":false,"sessionTimeoutSeconds":28800,"allowedAuthProviders":["oidc"],"maxUsers":100,"maxApps":50}'
);
```

### Step 2: Generate Password Hash

```bash
cd idvize-api
node -e "require('bcryptjs').hash('your-password', 10).then(h => console.log(h))"
```

### Step 3: Insert User

```sql
INSERT INTO users (
  user_id, tenant_id, username, display_name, first_name, last_name,
  email, roles, status, auth_provider, password_hash
) VALUES (
  'usr-yourco-admin-001', 'ten-yourco', 'admin@yourco.com', 'Admin User',
  'Admin', 'User', 'admin@yourco.com', '["Manager"]', 'active', 'local',
  '$2b$10$...'  -- paste the hash from Step 2
);
```

### Step 4: Restart Backend

```bash
# The backend loads tenants from PostgreSQL on startup
# Just restart: Ctrl+C then npm run dev
```

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
