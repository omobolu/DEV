# IDVIZE IAM OS — The IAM Operating System

> **Branch:** `develop` | **Version:** 2.1.0 | **Status:** Active Development
> **URL:** http://localhost:5173 (frontend) · http://localhost:3001 (API)

IDVIZE is an **IAM Operating System** — the management layer that sits above all enterprise IAM platforms and below business applications. From a single control plane, a CISO or IAM leader can **Monitor** every application and identity for IAM control coverage, **Operate** on identified gaps with one-click remediation, and **Control** the drivers, policies, and modules that govern the IAM program.

```
IDVIZE IAM OS Kernel — IAM Coverage Intelligence Engine
════════════════════════════════════════════════════════════════════

Inputs                          Processing                   Output
──────                          ──────────                   ──────
Enterprise App Catalog (CMDB) ─→ Coverage evaluation      ─→ App Coverage Map
IAM Platforms (4 drivers)     ─→ Identity reconciliation  ─→ Identity Protection Map
3rd Party Risk                ─→ Risk contextualisation   ─→ Gap Priority Matrix
Leadership Strategic Plans    ─→ Objective alignment      ─→ Strategic Gap List
Audit Events                  ─→ Access intelligence      ─→ User Control Profile
```

---

## Table of Contents

1. [Enterprise Foundation (New)](#enterprise-foundation)
2. [Feature Status](#feature-status)
3. [Architecture Overview](#architecture-overview)
4. [Technology Stack](#technology-stack)
5. [Prerequisites & Quick Start](#prerequisites--quick-start)
6. [Repository Structure](#repository-structure)
7. [API Reference](#api-reference)
8. [IAM OS Kernel](#iam-os-kernel)
9. [Controls Library](#controls-library)
10. [All Modules](#all-modules)
11. [IAM Program Maturity Model](#iam-program-maturity-model)
12. [AI Agent Layer](#ai-agent-layer)
13. [Authentication & Authorisation](#authentication--authorisation)
14. [Demo Users](#demo-users)
15. [What's Left](#whats-left)
16. [Known Limitations](#known-limitations)

---

## Enterprise Foundation

The **Enterprise Foundation** PR introduces the persistence layer, multi-tenant architecture, and security-by-design changes required for enterprise SaaS readiness.

### What Was Done

| Area | Change |
|---|---|
| **PostgreSQL Persistence** | Added `pg` driver, connection pool (`db/pool.ts`), migration script (`db/migrate.ts`), and seed script (`db/seed.ts`). Tenants, users, and audit logs persist across restarts. |
| **Multi-Tenant Architecture** | All entities include `tenantId`. All queries filter by `tenantId`. JWT tokens encode tenant context. Users only see their own tenant's data. |
| **Bcrypt Password Hashing** | All user passwords stored as bcrypt hashes (`$2b$10$`). No plaintext passwords anywhere. |
| **Audit Logging to PostgreSQL** | Login success/failure, token issuance, and security events written to `audit_logs` table. Visible in UI via System Events page. |
| **Clean Login Page** | Demo tenant names (ACME, Globex) removed from login UI. Clean username/password/sign-in form only. |
| **System Events Page** | Dedicated `/system-events` page under System sidebar showing live IAM event stream from PostgreSQL with search and severity filters. |
| **Graceful Degradation** | If PostgreSQL is unavailable, the app falls back to in-memory seed data. Server always starts. |

### What Remains Node.js (Temporary)

The current Node.js/Express backend is **temporary**. The target backend is **Go/Golang**.

| Component | Current State | Go Migration Plan |
|---|---|---|
| Auth (login, JWT) | Node.js + bcrypt + jsonwebtoken | Rewrite with Go `golang-jwt/jwt` + `bcrypt` |
| Tenant resolution | Node.js middleware | Go middleware with `pgx` |
| Audit logging | Node.js fire-and-forget to PG | Go goroutine with channel-based writes |
| Application CRUD | In-memory Map | Go + PostgreSQL (applications table ready) |
| Control evaluation | In-memory | Go + PostgreSQL |
| SCIM provisioning | In-memory | Go REST handlers |
| All other modules | In-memory | Go services with PostgreSQL repositories |

The PostgreSQL schema is **Go-compatible** — snake_case columns, standard SQL types, JSONB for flexible fields, designed for `pgx` or `database/sql`.

---

## Feature Status

### ✅ Working — Implemented & Live

#### IAM OS Layer
| Feature | Route / Endpoint | Notes |
|---|---|---|
| **OS Control Panel** | `/os` | 3-tab interface: MONITOR / OPERATE / CONTROL |
| **MONITOR tab** | `/os` | Kernel status bar, 6 KPI tiles, coverage-by-risk-tier bars, driver health cards, control-type coverage grid, top unprotected apps, alert feed |
| **OPERATE tab** | `/os` | Gap remediation queue with action buttons, pending approvals with Approve/Deny, active processes table |
| **CONTROL tab** | `/os` | Driver manager cards, coverage policies display, installed modules grid |
| **Kernel heartbeat** | `GET /os/status` | Coverage %, identity protection %, critical gaps, driver health, process count |
| **Coverage map** | `GET /os/coverage` | By risk tier (critical/high/medium/low), by control type (SSO/MFA/PAM/SCIM/Access Review), by driver |
| **Gap list** | `GET /os/gaps` | Prioritised gaps with missing controls, risk scores, recommended actions |
| **Identity plane** | `GET /os/identity-plane` | All identities + control coverage (mock cross-platform reconciliation) |
| **Driver registry** | `GET /os/drivers` | 4 drivers: Entra (healthy), SailPoint (degraded), CyberArk (healthy), Okta (healthy) |
| **Process aggregator** | `GET /os/processes` | Active builds + pending approvals + overdue rotations |
| **Module registry** | `GET /os/modules` | 8 installed modules with health status |
| **Event stream** | `GET /os/events` | Last 50 IAM events from PostgreSQL with severity and driver tags |
| **Alert feed** | `GET /os/alerts` | Actionable alerts: critical gaps, expiring credentials, degraded drivers, low-maturity domains |
| **Gap action** | `POST /os/gaps/:gapId/action` | Routes to build job (onboard-iam, request-sso) or approval (request-pam, schedule-review) |

#### Controls Library
| Feature | Route / Endpoint | Notes |
|---|---|---|
| **Controls Library page** | `/controls/library` | Pillar filter tabs, search, risk-reduction summary, expandable control cards |
| **AM controls (15)** | `GET /controls/catalog?pillar=AM` | SSO, MFA, Passwordless, Adaptive Auth, RBAC, ABAC, PBAC, Entitlement Mgmt, Dynamic Access, Zero Trust, Federation, API Security, Conditional Access, Temp Access, Cloud IAM |
| **IGA controls (15)** | `GET /controls/catalog?pillar=IGA` | JML Lifecycle, Provisioning, Role Provisioning, JIT Prov, Access Review, SoD, Role Mining, Self-Service Requests, Approval Workflows, Certification, Password Mgmt, Audit/Compliance, AI Governance, Entitlement Reporting, Policy Enforcement |
| **PAM controls (10)** | `GET /controls/catalog?pillar=PAM` | Privileged Session Mgmt, Credential Vault, JIT Privilege, Session Recording, Least Privilege, Remote Access, Threat Detection, Key Management, Secrets Management, PAM Audit |
| **CIAM controls (9)** | `GET /controls/catalog?pillar=CIAM` | Registration, Social Login, Customer MFA/Passwordless, Self-Service Portal, Delegation, Consent/Privacy, Auto-Fulfilment, Fraud Detection, B2B Identity |
| **Catalog filters** | `GET /controls/catalog` | Filter by `pillar`, `category`, `tag` query params |

#### Module 1 — Application Governance
| Feature | Route / Endpoint | Notes |
|---|---|---|
| Application CMDB | `GET /applications` | Full inventory with risk tiers, departments, platform tags |
| Application detail | `GET /applications/:id` | Controls status, posture, IAM gap analysis |
| Bulk import | `POST /applications/import` | CSV or JSON payload |
| Create / upsert | `POST /applications` | Single application |
| CMDB UI | `/cmdb` | Searchable, filterable application list |
| App detail UI | `/cmdb/:appId` | Controls, posture score, cross-platform correlation |
| App onboarding | `/applications/onboarding` | Step-by-step workflow |
| App management | `/applications/management` | Lifecycle management |
| Orphan accounts | `/applications/orphan-accounts` | Detection and remediation |

#### Module 2 — Control Detection
| Feature | Route / Endpoint | Notes |
|---|---|---|
| Control evaluation | `POST /controls/evaluate` | Per-app or all apps |
| Cached results | `GET /controls/:appId` | IAM posture, gap scores, risk assessment |
| Controls catalog | `GET /controls/catalog` | 49 controls across 4 pillars |

#### Module 4 — Build Execution
| Feature | Route / Endpoint | Notes |
|---|---|---|
| Start build | `POST /build/start` | Creates state-machine job |
| Build list | `GET /build` | Filter by state, platform, appId |
| Build detail | `GET /build/:id` | Full state and artifacts |
| Advance | `POST /build/:id/advance` | Next state |
| Transition | `POST /build/:id/transition` | Explicit state jump |
| Submit data | `POST /build/:id/data` | Stage technical data |
| Generate artifacts | `POST /build/:id/artifacts` | Config files, runbooks, test plans |

**States:** `planning → design → review → approved → in_progress → testing → completed`

#### Module 5 — Cost & Vendor Intelligence
| Feature | Route / Endpoint | Notes |
|---|---|---|
| Cost analysis | `POST /cost/analyze` | Full cost engine |
| AI cost narrative | `POST /cost/analyze/ai` | Claude-powered cost analysis |
| Cost report | `GET /cost/report` | Last generated report |
| Cost summary | `GET /cost/summary` | People + tech + partner aggregation |
| Vendor analysis | `GET /cost/vendor-analysis` | Per-vendor cost impact |
| Optimization | `GET /cost/optimization` | Opportunities with effort/impact ratings |
| Vendor CRUD | `POST/GET /cost/vendors` | Vendor records |
| Contract CRUD | `POST/GET /cost/contracts` | Contract management with renewal alerts |
| People costs | `POST/GET /cost/people` | FTE and contractor cost records |

#### Module 6 — IAM Platform Integrations
| Feature | Route / Endpoint | Notes |
|---|---|---|
| Integration status | `GET /integrations/status` | All 4 platforms |
| Test connection | `POST /integrations/test/:platform` | Uses submitted credentials, never saves |
| Configure | `POST /integrations/configure` | Save credentials to runtime |
| Entra apps | `GET /integrations/entra/apps` | Mock (live when credentials set) |
| SailPoint sources | `GET /integrations/sailpoint/sources` | Mock |
| CyberArk safes | `GET /integrations/cyberark/safes` | Mock |
| Okta apps | `GET /integrations/okta/apps` | Mock |
| Cross-platform correlation | `POST /integrations/correlate/:appName` | Links app across platforms |
| Integrations UI | `/integrations` | Credentials, test & status |

#### Module 7 — Security & Identity Governance
| Feature | Route / Endpoint | Notes |
|---|---|---|
| JWT authentication | `POST /security/auth/token` | HS256, 8-hour TTL |
| Current user | `GET /security/auth/me` | Profile + roles |
| Permission matrix | `GET /security/auth/matrix` | Full RBAC map |
| RBAC/ABAC policy engine | `GET /security/authz/check` | Runtime permission checks |
| My permissions | `GET /security/authz/my-permissions` | Effective permissions |
| SCIM 2.0 users | `GET /security/scim/v2/Users` | Provisioned users |
| SCIM 2.0 groups | `GET /security/scim/v2/Groups` | Provisioned groups |
| Approval workflow | `POST /security/approvals` | Create approval request |
| Resolve approval | `POST /security/approvals/:id/resolve` | Approve / deny |
| Audit log | `GET /security/audit` | Immutable event log (PostgreSQL-backed) |
| Security posture | `GET /security/posture` | Deterministic posture report |
| AI posture analysis | `POST /security/posture/ai` | Claude-powered recommendations |
| Field-level masking | `GET /security/masking/demo` | Role-based data masking demo |
| Credential registry | `POST/GET /security/credentials` | Lifecycle management |
| Credential rotation | `POST /security/credentials/:id/rotate` | Trigger rotation |
| Credential revoke | `POST /security/credentials/:id/revoke` | Revoke |
| Rotation report | `GET /security/credentials/rotation/report` | Overdue alerts |
| Secret vault | `GET /security/vault/providers` | AWS SM, Azure KV, CyberArk, HashiCorp, Mock |
| Vault status | `GET /security/vault/status` | Active provider status |
| Vault events | `GET /security/vault/events` | Access event log |

#### Document Registry
| Feature | Route / Endpoint | Notes |
|---|---|---|
| Document list | `GET /documents` | Filtered by status, category |
| Create document | `POST /documents` | Types: Policy, Procedure, Standard, Guideline, Runbook |
| Document detail | `GET /documents/:id` | Full version history + reviews |
| Update | `PATCH /documents/:id` | Metadata or content |
| Submit for review | `POST /documents/:id/submit` | Draft → In Review |
| Review | `POST /documents/:id/review` | Approve / reject with comments |
| Publish | `POST /documents/:id/publish` | In Review (approved) → Published |
| Archive | `POST /documents/:id/archive` | Published / Draft → Archived |
| Document UI | `/documents` | List + document detail with workflow actions |

#### Program Maturity Assessment
| Feature | Route / Endpoint | Notes |
|---|---|---|
| Maturity summary | `GET /maturity/summary` | Overall score, level, top recommendations |
| All domains | `GET /maturity/domains` | 13 domain scores with confidence |
| Domain drill-down | `GET /maturity/domains/:domainId` | Indicators, evidence, explainability |
| Recalculate | `POST /maturity/recalculate` | Fresh assessment with Claude narrative |
| History | `GET /maturity/history` | Past assessment runs |
| Maturity UI | `/maturity` | Full report with domain cards |
| Domain detail UI | `/maturity/domains/:domainId` | Evidence and recommendations |

#### Frontend UI (All Pages)
| Page | Route | Status |
|---|---|---|
| Login | `/` | ✅ Clean login (no demo tenants visible) |
| OS Control Panel | `/os` | ✅ MONITOR / OPERATE / CONTROL tabs |
| IAM Overview (Dashboard) | `/dashboard` | ✅ Maturity strip, domain cards |
| Controls Library | `/controls/library` | ✅ 49 controls, pillar filter, search |
| IGA | `/iga` | ✅ Identity governance analytics |
| Access Management | `/access-management` | ✅ SSO & MFA overview |
| PAM Dashboard | `/pam` | ✅ Privileged access dashboard |
| CIAM Dashboard | `/ciam` | ✅ Customer identity dashboard |
| App Onboarding | `/applications/onboarding` | ✅ Step-by-step workflow |
| App Management | `/applications/management` | ✅ Lifecycle management |
| Orphan Accounts | `/applications/orphan-accounts` | ✅ Detection & remediation |
| CMDB | `/cmdb` | ✅ Searchable application inventory |
| App Detail | `/cmdb/:appId` | ✅ Controls, posture, correlation |
| Documents | `/documents` | ✅ Registry + approval workflow |
| Integrations | `/integrations` | ✅ Platform credentials & testing |
| Maturity | `/maturity` | ✅ Full programme maturity report |
| Maturity Domain | `/maturity/domains/:domainId` | ✅ Evidence drill-down |
| System Events | `/system-events` | ✅ Live IAM event stream from PostgreSQL, search + severity filters |

---

### ✅ Recently Completed (Enterprise Foundation PR)

| Item | Status | Notes |
|---|---|---|
| PostgreSQL persistence | Done | Tenants, users, audit logs persist across restarts |
| Database migrations & seeding | Done | `npm run migrate` + `npm run seed` |
| Multi-tenancy | Done | All queries scoped by `tenantId`, JWT encodes tenant context |
| Bcrypt password hashing | Done | All passwords stored as bcrypt hashes |
| Audit logging (PostgreSQL) | Done | Login events, token issuance persisted to `audit_logs` table |
| Clean login page | Done | No demo tenants visible on login |
| System Events page | Done | Dedicated `/system-events` with search + severity filters |
| Tenant registration API | Done | `POST /tenants` — create tenants + users without restart |

### 🔲 Pending — Not Yet Implemented

#### Go Backend Migration (Next PR)
| Item | Priority | Notes |
|---|---|---|
| Go API server | High | Replace Node.js/Express with Go. PostgreSQL schema is already Go-compatible (snake_case, JSONB) |
| Migrate all modules to Go | High | Application CRUD, controls, build, cost, integrations, maturity, documents |
| PostgreSQL for all entities | High | Applications, controls, assessments still in-memory in Node.js |
| Session persistence | Medium | Builds, credentials, approvals reset on restart (not yet in PostgreSQL) |

#### Live Platform Adapters
| Item | Priority | Notes |
|---|---|---|
| Live Entra ID adapter (full) | High | Only test-connection performs a real OAuth2 call; all data reads are mock |
| Live SailPoint IdentityNow adapter | High | Mock only |
| Live CyberArk PAM adapter | High | Mock only |
| Live Okta adapter | High | Mock only |
| Real CMDB integration (ServiceNow, etc.) | Medium | CMDB currently uses seeded mock data |

#### Security & Authentication
| Item | Priority | Notes |
|---|---|---|
| OIDC integration (Entra ID / Okta) | High | Auth currently local only; prepare for federated login |
| Refresh token support | High | Current JWTs are 8-hour, no refresh |
| RBAC enforcement | Medium | Role field exists in user model; enforcement not yet wired |
| Full SAML 2.0 SP implementation | Medium | Adapter scaffolded but not functional |
| MFA enforcement (login) | Medium | Evaluated per app but not enforced at login UI |

#### Infrastructure & DevOps
| Item | Priority | Notes |
|---|---|---|
| Docker Compose setup | Medium | One-command local launch (app + PostgreSQL) |
| Code-split frontend bundle (~882 KB) | Low | Single JS chunk |
| Unit and integration test suite | High | No tests currently |
| CI/CD pipeline (GitHub Actions) | Medium | No automation |

#### Reporting & Analytics
| Item | Priority | Notes |
|---|---|---|
| Maturity trend charting (historical) | Medium | History endpoint exists; no UI chart |
| PDF export for maturity reports | Medium | UI report exists; no export |
| IAM programme roadmap view | Medium | Gap list exists; no timeline/roadmap view |
| SoD policy violation report | Medium | SoD is in the controls catalog but not detected live |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Browser (SPA)                                │
│              React 19 + Vite + Tailwind CSS                      │
│                   http://localhost:5173                          │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTP/JSON (JWT + API Key)
┌────────────────────────▼─────────────────────────────────────────┐
│              IDVIZE IAM OS Kernel (Express 5 / TypeScript)       │
│                     http://localhost:3001                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │            IAM Coverage Intelligence Engine  /os            │ │
│  │   status · coverage · gaps · identity-plane · alerts        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ App Gov  │ │ Controls │ │  Build   │ │  Cost & Vendor     │  │
│  │ Module 1 │ │ Catalog  │ │ Module 4 │ │  Module 5          │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Security │ │   Docs   │ │ Maturity │ │  Integrations      │  │
│  │ Module 7 │ │ Registry │ │  Engine  │ │  Adapters          │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │               AI Agent Layer (Claude / Anthropic)           │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────────┘
                            │
               ┌────────────▼─────────────────┐
               │  PostgreSQL 14+              │
               │  tenants · users             │
               │  audit_logs · applications   │
               └────────────┬─────────────────┘
                            │ OAuth2 / REST / SCIM (mock in dev)
          ┌─────────────────┼─────────────────┐
     ┌────▼────┐      ┌─────▼──────┐    ┌─────▼──────┐  ┌──────┐
     │Entra ID │      │ SailPoint  │    │  CyberArk  │  │ Okta │
     └─────────┘      └────────────┘    └────────────┘  └──────┘
```

---

## Technology Stack

### Backend

| Component | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 5.2.1 |
| Language | TypeScript 5.9 (strict) |
| Database | PostgreSQL 14+ via `pg` driver |
| Authentication | JWT (HS256, 8-hour TTL) + bcrypt password hashing |
| AI Integration | Anthropic Claude via `@anthropic-ai/sdk` |
| Security headers | Helmet 8 |
| CORS | cors 2.8 |
| Logging | Morgan (HTTP) + PostgreSQL-backed audit service |
| Environment | dotenv 17 |

### Frontend

| Component | Technology |
|---|---|
| Framework | React 19.2 |
| Build tool | Vite 7.3 |
| Routing | React Router 7.13 |
| Language | TypeScript 5.9 (strict) |
| Styling | Tailwind CSS 3.4 (dark theme) |
| Icons | Lucide React |
| HTTP client | Shared `apiFetch()` wrapper |

---

## Prerequisites & Quick Start

**Requirements:** Node.js 18+, npm 9+, PostgreSQL 14+

```bash
# 1. Set up PostgreSQL
sudo -u postgres psql -c "CREATE USER idvize WITH PASSWORD 'idvize_dev_2026';"
sudo -u postgres psql -c "CREATE DATABASE idvize OWNER idvize;"

# 2. Backend
cd idvize-api
npm install
cp .env.example .env        # edit DATABASE_URL if needed
npm run migrate             # create tables
npm run seed                # seed demo tenants + users
npm run dev                 # → http://localhost:3001

# 3. Frontend (new terminal)
cd idvize
npm install
npm run dev                 # → http://localhost:5173
```

Login at **http://localhost:5173** with `admin@acme.com` / `password123`

The API key for all requests: `idvize-dev-key-change-me`

---

## Repository Structure

```
DEV/
├── idvize-api/              # Express API backend (temporary — target is Go)
│   ├── src/
│   │   ├── db/              # PostgreSQL layer (NEW)
│   │   │   ├── pool.ts         # Connection pool (pg)
│   │   │   ├── migrate.ts      # Schema migrations
│   │   │   └── seed.ts         # Demo data seeder
│   │   ├── middleware/      # Auth, API key, error handling
│   │   ├── modules/
│   │   │   ├── tenant/      # Multi-tenant management (NEW)
│   │   │   │   ├── tenant.repository.ts  # PG + in-memory cache
│   │   │   │   ├── tenant.service.ts     # Tenant operations
│   │   │   │   ├── tenant.controller.ts  # REST endpoints
│   │   │   │   └── tenant.seed.ts        # Seed data
│   │   │   ├── application/ # Module 1 — Application Governance
│   │   │   ├── control/     # Module 2 — Control Detection + Catalog
│   │   │   ├── build/       # Module 4 — Build Execution
│   │   │   ├── cost/        # Module 5 — Cost & Vendor Intelligence
│   │   │   ├── integration/ # Module 6 — Platform Adapters
│   │   │   ├── security/    # Module 7 — Security & Identity Gov
│   │   │   │   ├── auth/       # JWT + bcrypt authentication (PG-backed)
│   │   │   │   ├── authz/      # RBAC / ABAC policy engine
│   │   │   │   ├── audit/      # Immutable audit log (PG-backed)
│   │   │   │   ├── scim/       # SCIM 2.0 provisioning
│   │   │   │   ├── credentials/# Credential governance & rotation
│   │   │   │   ├── vault/      # Secret vault abstraction
│   │   │   │   ├── approval/   # Approval workflows
│   │   │   │   └── masking/    # Field-level data masking
│   │   │   ├── document/    # Document registry & workflow
│   │   │   ├── maturity/    # IAM Program Maturity engine
│   │   │   └── os/          # IAM OS Kernel (Coverage Intelligence Engine)
│   │   └── index.ts         # Express app, routes, startup banner
│   ├── .env.example         # Environment template
│   └── package.json
│
├── idvize/                  # React SPA frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/      # AppLayout, Header, Sidebar (System Events nav)
│   │   │   ├── common/      # Badge, DataTable, KpiCard, TabNav
│   │   │   └── charts/      # Donut, Gauge, Bar, Trend charts
│   │   ├── pages/
│   │   │   ├── os/          # OS Control Panel + SystemEventsPage (NEW)
│   │   │   ├── controls/    # Controls Library (49 controls, 4 pillars)
│   │   │   ├── Dashboard.tsx # IAM Overview
│   │   │   ├── LoginPage.tsx # Clean login (no demo tenants)
│   │   │   ├── applications/
│   │   │   ├── cmdb/
│   │   │   ├── documents/
│   │   │   ├── integrations/
│   │   │   ├── maturity/
│   │   │   ├── iga/
│   │   │   ├── access/
│   │   │   ├── pam/
│   │   │   └── ciam/
│   │   └── lib/apiClient.ts # Shared HTTP client
│   └── package.json
│
├── SETUP.md                 # PostgreSQL setup + tenant creation guide
└── README.md
```

---

## API Reference

All endpoints (except `/health` and `/security/auth/token`) require:
```
x-api-key: idvize-dev-key-change-me
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Tenant Management (`/tenants`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/tenants/me` | Current user's tenant info |
| `GET` | `/tenants` | List all tenants (Manager only) |
| `GET` | `/tenants/:tenantId` | Get one tenant |
| `POST` | `/tenants` | Create new tenant + admin user (no restart required) |

### IAM OS Kernel (`/os`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/os/status` | Kernel heartbeat: coverage %, gaps, driver health, process count |
| `GET` | `/os/coverage` | Coverage by risk tier, control type, and driver |
| `GET` | `/os/gaps` | Prioritised gap list with missing controls and recommended actions |
| `GET` | `/os/identity-plane` | All identities with control coverage map |
| `GET` | `/os/drivers` | Driver registry: Entra, SailPoint, CyberArk, Okta |
| `GET` | `/os/processes` | Active builds + pending approvals + overdue rotations |
| `GET` | `/os/modules` | Installed module registry with health |
| `GET` | `/os/events` | Last 50 IAM events with severity and driver tags |
| `GET` | `/os/alerts` | Actionable alerts: gaps, expiring credentials, degraded drivers |
| `POST` | `/os/gaps/:gapId/action` | Action a gap: `onboard-iam` \| `request-sso` \| `request-pam` \| `schedule-review` |

### Controls Catalog (`/controls`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/controls/catalog` | Full 49-control catalog. Filters: `?pillar=AM\|IGA\|PAM\|CIAM`, `?category=`, `?tag=` |
| `POST` | `/controls/evaluate` | Evaluate controls for one app or all apps |
| `GET` | `/controls/:appId` | Cached control evaluation for an application |

### Application Governance (`/applications`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/applications` | List (query: `riskTier`, `department`, `search`) |
| `POST` | `/applications` | Create or upsert |
| `GET` | `/applications/:id` | Detail |
| `POST` | `/applications/import` | Bulk import via CSV or JSON |

### Build Execution (`/build`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/build/start` | Start a build job |
| `GET` | `/build` | List builds |
| `GET` | `/build/:id` | Build detail + artifacts |
| `POST` | `/build/:id/advance` | Advance to next state |
| `POST` | `/build/:id/transition` | Explicit state transition |
| `POST` | `/build/:id/data` | Submit stage data |
| `POST` | `/build/:id/artifacts` | Generate artifacts |

### Cost & Vendor Intelligence (`/cost`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/cost/analyze` | Run cost analysis |
| `POST` | `/cost/analyze/ai` | Claude-powered analysis + narrative |
| `GET` | `/cost/report` | Last report |
| `GET` | `/cost/summary` | Aggregated totals |
| `GET` | `/cost/vendor-analysis` | Per-vendor cost impact |
| `GET` | `/cost/optimization` | Optimization opportunities |
| `POST/GET` | `/cost/vendors` | Vendor CRUD |
| `POST/GET` | `/cost/contracts` | Contract CRUD |
| `POST/GET` | `/cost/people` | People cost CRUD |

### IAM Platform Integrations (`/integrations`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/integrations/status` | All 4 platform statuses |
| `POST` | `/integrations/test/:platform` | Test connection (entra\|sailpoint\|cyberark\|okta) |
| `POST` | `/integrations/configure` | Save credentials |
| `GET` | `/integrations/entra/apps` | Entra applications |
| `GET` | `/integrations/sailpoint/sources` | SailPoint identity sources |
| `GET` | `/integrations/cyberark/safes` | CyberArk safes |
| `GET` | `/integrations/okta/apps` | Okta applications |
| `POST` | `/integrations/correlate/:appName` | Cross-platform correlation |

### Security & Identity Governance (`/security`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/security/auth/token` | Issue JWT |
| `GET` | `/security/auth/me` | Current user profile |
| `GET` | `/security/auth/matrix` | Full permission matrix |
| `GET` | `/security/authz/check` | Check permission (`?permission=`) |
| `GET` | `/security/authz/my-permissions` | Effective permissions |
| `GET` | `/security/scim/v2/Users` | SCIM users |
| `GET` | `/security/scim/v2/Groups` | SCIM groups |
| `POST` | `/security/approvals` | Create approval request |
| `POST` | `/security/approvals/:id/resolve` | Approve / deny |
| `GET` | `/security/audit` | Audit log |
| `GET` | `/security/posture` | Security posture report |
| `POST` | `/security/posture/ai` | Claude posture analysis |
| `GET` | `/security/masking/demo` | Field-level masking demo |
| `POST/GET` | `/security/credentials` | Credential registry |
| `POST` | `/security/credentials/:id/rotate` | Rotate |
| `POST` | `/security/credentials/:id/revoke` | Revoke |
| `GET` | `/security/credentials/rotation/report` | Rotation status |
| `POST/GET` | `/security/credentials/request(s)` | Credential access requests |
| `POST` | `/security/credentials/requests/:id/resolve` | Approve / deny request |
| `GET` | `/security/vault/providers` | Vault providers |
| `GET` | `/security/vault/status` | Active vault status |
| `GET` | `/security/vault/events` | Vault access events |

### Document Registry (`/documents`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/documents` | List documents |
| `POST` | `/documents` | Create document |
| `GET` | `/documents/:id` | Detail + versions + reviews |
| `PATCH` | `/documents/:id` | Update |
| `POST` | `/documents/:id/submit` | Submit for review |
| `POST` | `/documents/:id/review` | Review (approve/reject) |
| `POST` | `/documents/:id/publish` | Publish |
| `POST` | `/documents/:id/archive` | Archive |

### Program Maturity (`/maturity`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/maturity/summary` | Overall score, level, recommendations |
| `GET` | `/maturity/domains` | All 13 domain scores |
| `GET` | `/maturity/domains/:domainId` | Domain drill-down: indicators, evidence |
| `POST` | `/maturity/recalculate` | Fresh assessment + Claude narrative |
| `GET` | `/maturity/history` | Past assessment runs |

---

## IAM OS Kernel

The kernel is the **IAM Coverage Intelligence Engine** — it reads from all existing modules and computes which enterprise applications and identities are protected by IAM controls, and which are not.

### Coverage Logic

```
For each application in the CMDB:
  Required controls = TIER_REQUIRED[app.riskTier]
    critical: [SSO, MFA, PAM, Access Review]
    high:     [SSO, MFA]
    medium:   [SSO]
    low:      []

  present  = controls detected in app.iamPosture
  missing  = required - present
  riskScore = f(tier, missingCount)

  → if missing.length > 0: add to gap list
```

### OS Concept Map

| OS Concept | IAM OS Equivalent |
|---|---|
| Kernel | IAM Coverage Intelligence Engine |
| Device Drivers | Platform adapters (Entra, SailPoint, CyberArk, Okta) |
| Process Manager | Workflow engine (builds, approvals, rotations) |
| Applications | IAM capability modules (IGA, AM, PAM, CIAM) |
| File System | Universal Identity Plane |
| System Monitor | Maturity & posture engine |
| Shell | IDVIZE API + frontend UI |

---

## Controls Library

**49 IAM controls** extracted from industry frameworks (NIST SP 800-53, SOX, PCI-DSS, HIPAA, Zero Trust, FIDO, ISO 27001, COBIT) and categorised across the four IAM pillars.

| Pillar | Count | Focus |
|---|---|---|
| AM — Access Management | 15 | Authentication, authorisation, federation, Zero Trust |
| IGA — Identity Governance & Administration | 15 | Lifecycle, governance, SoD, certification, audit |
| PAM — Privileged Access Management | 10 | Vaulting, session recording, key & secrets management |
| CIAM — Customer Identity & Access Management | 9 | Registration, social login, consent, fraud detection |

Each control includes: description, capabilities list, policy drivers, applicable risk tiers, implementation complexity, and tags.

---

## IAM Program Maturity Model

**5-level scale** aligned with CMMI, NIST CSF, and ISACA frameworks.

| Level | Band | Label |
|---|---|---|
| L1 | 0–20 | Initial — ad-hoc, reactive |
| L2 | 21–40 | Developing — early implementation |
| L3 | 41–60 | Defined — documented, consistent |
| L4 | 61–80 | Managed — measured, monitored |
| L5 | 81–100 | Optimized — automated, proactive |

**13 Domains:** IGA · AM · PAM · CIAM · Identity Lifecycle · Access Reviews · SoD · Audit & Compliance · Data Governance · Vendor Management · Incident Response · IAM Architecture · Cost Optimisation

**Confidence-weighted scoring:**
```
Evidence quality:  live=1.0 · estimated=0.6 · mock=0.4 · missing=0.1
domainScore = Σ(score × weight × confidence) / Σ(weight × confidence)
```

---

## AI Agent Layer

Claude (Anthropic) is used for three bounded purposes — all scoring remains deterministic:

| Agent | Trigger | Output |
|---|---|---|
| Maturity Narrative | `POST /maturity/recalculate` | Executive summary of score, strengths, gaps |
| Cost Intelligence | `POST /cost/analyze/ai` | Cost trend analysis, anomaly identification |
| Security Posture | `POST /security/posture/ai` | Risk narrative with prioritised recommendations |

If `ANTHROPIC_API_KEY` is absent, all features work; AI narratives are omitted.

---

## Authentication & Authorisation

```bash
# Get a token (ACME tenant)
curl -X POST http://localhost:3001/security/auth/token \
  -H "Content-Type: application/json" \
  -H "x-api-key: idvize-dev-key-change-me" \
  -d '{"username":"admin@acme.com","password":"password123"}'
```

### Role Hierarchy

| Role | Key Permissions |
|---|---|
| `admin` | Full access to all modules and operations |
| `iam_manager` | Manage applications, view all reports, approve documents |
| `iam_engineer` | Create/update applications, run builds, manage credentials |
| `auditor` | Read-only audit logs, reports, maturity assessments |
| `viewer` | Read-only dashboards and documents |

---

## Demo Users

### Tenant 1 — ACME Financial Services (`ten-acme`)

| Email | Password | Role |
|---|---|---|
| `admin@acme.com` | `password123` | Manager (full access) |
| `sarah.chen@acme.com` | `password123` | Architect |
| `james.okafor@acme.com` | `password123` | Business Analyst |
| `lisa.park@acme.com` | `password123` | Engineer |
| `raj.patel@acme.com` | `password123` | Developer |

### Tenant 2 — Globex Technologies (`ten-globex`)

| Email | Password | Role |
|---|---|---|
| `admin@globex.io` | `password123` | Manager (full access) |
| `priya.kumar@globex.io` | `password123` | Architect |
| `tom.harris@globex.io` | `password123` | Business Analyst |
| `anna.schmidt@globex.io` | `password123` | Engineer |
| `wei.zhou@globex.io` | `password123` | Developer |

All passwords are bcrypt-hashed in PostgreSQL. Each tenant sees only its own data.

> Development and demonstration only. Rotate all secrets before any deployment.

---

## What's Left

### Next PR: Go Backend Foundation (`feature/go-backend-foundation-devin-YYYYMMDD-HHMM`)

| Task | Description |
|---|---|
| Go API server | Replace Node.js/Express with Go. Reuse existing PostgreSQL schema. |
| Migrate auth to Go | `golang-jwt/jwt` + `bcrypt` for login, JWT issuance |
| Migrate all modules | Application CRUD, controls, build, cost, integrations, maturity, documents |
| Full PostgreSQL persistence | Move applications, controls, assessments from in-memory to PG |
| RBAC enforcement | Wire role-based access control using the existing `roles` JSONB field |
| OIDC preparation | Entra ID / Okta federated login support |

### Other Pending Work

| Task | Priority |
|---|---|
| Live platform adapters (Entra, SailPoint, CyberArk, Okta) | High |
| Refresh token support | High |
| Docker Compose setup | Medium |
| Unit and integration test suite | High |
| CI/CD pipeline (GitHub Actions) | Medium |
| Frontend code-splitting | Low |

---

## Known Limitations

| Area | Limitation |
|---|---|
| **Partial persistence** | Tenants, users, and audit logs are in PostgreSQL. Applications, controls, builds, credentials, and other modules remain in-memory and reset on restart. |
| **Node.js backend (temporary)** | The Express backend is a temporary implementation. Target is Go/Golang. |
| **Platform adapters** | All four adapters (Entra, SailPoint, CyberArk, Okta) return mock data unless live credentials are provided. Only the Entra test-connection performs a real OAuth2 call. |
| **Identity plane** | Cross-platform identity reconciliation uses representative mock records. Real reconciliation requires live adapters. |
| **JWT** | No refresh tokens. 8-hour TTL requires re-login. |
| **API key** | Single static key in `.env`. |
| **SAML** | Adapter scaffolded but not functional. |
| **RBAC** | Role field exists in user model but enforcement is not yet wired. |
| **Bundle size** | Single JS chunk (~882 KB). No code-splitting applied. |
| **Tests** | No unit or integration test suite. |

---

## Git Repository

**Remote:** https://github.com/omobolu/DEV
**Active branch:** `develop`
**Enterprise Foundation PR:** https://github.com/omobolu/DEV/pull/10

---

*IDVIZE IAM OS — Internal prototype. All rights reserved.*
