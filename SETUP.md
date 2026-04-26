# IDVize — Enterprise Foundation Setup

## Prerequisites

- **Node.js** 18+ (with npm)
- **PostgreSQL** 14+

## PostgreSQL Setup

### 1. Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y postgresql

# macOS (Homebrew)
brew install postgresql@14
```

### 2. Start PostgreSQL

```bash
# Ubuntu
sudo pg_ctlcluster 14 main start

# macOS
brew services start postgresql@14
```

### 3. Create Database and User

```bash
sudo -u postgres psql -c "CREATE USER idvize WITH PASSWORD 'idvize_dev_2026';"
sudo -u postgres psql -c "CREATE DATABASE idvize OWNER idvize;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE idvize TO idvize;"
```

### 4. Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set your `DATABASE_URL`:

```
DATABASE_URL=postgresql://idvize:idvize_dev_2026@localhost:5432/idvize
PORT=3001
NODE_ENV=development
```

## Backend Setup

```bash
cd server
npm install
npm run migrate    # Creates all database tables
npm run seed       # Seeds demo data (optional, for development)
npm run dev        # Starts the API server on http://localhost:3001
```

## Frontend Setup

```bash
# From root directory
npm install
npm run dev        # Starts Vite dev server on http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to the backend at `:3001`.

## Demo Accounts (Seed Data)

| Username    | Password     | Role       |
|-------------|-------------|------------|
| admin       | admin123    | admin      |
| jarchitect  | arch123     | architect  |
| lanalyst    | analyst123  | analyst    |
| smanager    | manager123  | manager    |
| mengineer   | eng123      | engineer   |
| adev        | dev123      | developer  |

All passwords are bcrypt-hashed in the database.

## Architecture

```
DEV/
├── src/                    # React frontend (Vite)
│   ├── api/client.ts       # API client with session management
│   ├── context/AuthContext  # Auth provider with login/logout
│   ├── components/          # UI components (LoginPage, etc.)
│   └── App.tsx             # Main app with auth gating
├── server/                 # Express backend (TypeScript)
│   ├── src/
│   │   ├── db/
│   │   │   ├── pool.ts     # PostgreSQL connection pool
│   │   │   ├── migrate.ts  # Schema migrations
│   │   │   └── seed.ts     # Demo data seeder
│   │   ├── middleware/
│   │   │   └── tenant.ts   # Auth + tenant isolation middleware
│   │   ├── routes/
│   │   │   ├── auth.ts     # Login/logout/session
│   │   │   ├── applications.ts
│   │   │   ├── controls.ts
│   │   │   ├── assessments.ts
│   │   │   ├── risks.ts
│   │   │   └── dashboard.ts
│   │   └── utils/
│   │       ├── audit.ts    # Audit logging
│   │       └── validation.ts
│   └── .env.example
└── SETUP.md
```

## Security

- **Password Hashing**: All passwords are hashed with bcrypt (10 rounds)
- **Tenant Isolation**: Every query filters by `tenant_id` via `requireAuth` middleware
- **Audit Logging**: Login, create, update, delete actions are logged to `audit_logs` table
- **Input Validation**: All API inputs are validated before database operations
- **Session-Based Auth**: Sessions stored in PostgreSQL with expiration
- **No Hardcoded Secrets**: All credentials use environment variables
