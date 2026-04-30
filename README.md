# IDVIZE IAM OS — The IAM Operating System

> **Branch:** `develop` | **Version:** 3.0.0 | **Status:** Active Development
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

1. [Enterprise Foundation](#enterprise-foundation)
2. [Agent Execution Framework (New)](#agent-execution-framework)
3. [Feature Status](#feature-status)
4. [Architecture Overview](#architecture-overview)
5. [Technology Stack](#technology-stack)
6. [Prerequisites & Quick Start](#prerequisites--quick-start)
7. [Repository Structure](#repository-structure)
8. [API Reference](#api-reference)
9. [IAM OS Kernel](#iam-os-kernel)
10. [Controls Library](#controls-library)
11. [All Modules](#all-modules)
12. [IAM Program Maturity Model](#iam-program-maturity-model)
13. [AI Agent Layer](#ai-agent-layer)
14. [Authentication & Authorisation](#authentication--authorisation)
15. [Demo Users](#demo-users)
16. [What's Left](#whats-left)
17. [Known Limitations](#known-limitations)

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
| **Controlled Data Initialization** | `SEED_MODE` env var: `production` (default, empty), `demo`, `development`. Production never auto-loads demo data. |
| **API Tenant Provisioning** | `POST /tenants` creates tenant + admin user atomically in a single PG transaction. No restart required. |
| **Differentiated Tenant Data** | ACME: 50 financial/banking apps. Globex: 30 tech/platform/SRE apps. Different names, counts, vendors, IAM postures. |

### Data Initialization Strategy

The system supports **three modes** via the `SEED_MODE` environment variable:

- **`production`** (default) — NO demo data. System starts empty. Tenants created exclusively via API.
- **`demo`** — Seeds ACME + Globex demo tenants with differentiated application portfolios.
- **`development`** — Same as demo; allows flexible seeding + data reset.

**Production mode is the default.** If `SEED_MODE` is not set, no demo tenants are created. See [SETUP.md](SETUP.md) for full details.

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

## Agent Execution Framework

The **Agent Execution Framework** (Phases 1–3) adds autonomous IAM remediation — the system can detect a missing control (e.g. SSO not configured, MFA not enforced) and execute a multi-step plan to fix it across Microsoft Entra ID, SailPoint IdentityNow, ServiceNow, and app-side connectors.

### What Was Built

#### Phase 1 — Execution Foundation (PR #22)
| Area | What It Does |
|---|---|
| **Execution Sessions** | Full lifecycle: `planning → pending_approval → approved → executing → completed/failed/cancelled` |
| **Plan Generation** | SSO and MFA agents generate multi-step execution plans with system targets, blast radius, prerequisites, and rollback steps |
| **Approval Workflow** | Multi-gate approval (security_review → platform_admin → app_owner) with configurable thresholds and expiry |
| **Tool Broker** | Central choke point for all external API calls — enforces session status, tenant match, action allowlist, permissions, dry-run mode |
| **Stub Adapters** | Entra, SailPoint, ServiceNow, App Connector, Verification adapters with structured inputs/outputs |

#### Phase 2 — Execution UI + Email Notifications (PRs #27, #28)
| Area | What It Does |
|---|---|
| **Execution UI** | Session list, plan review, approval workflow, step-by-step progress, evidence viewer |
| **Email Notifications** | Plan created, approval requested, execution completed notifications with SMTP config |
| **Sequential Approval** | Multi-gate approvals execute in order; each gate blocks until resolved |
| **13 HIGH Security Fixes** | RBAC on all endpoints, immutable approval binding, stale approval rejection, SMTP fail-closed, approval domain isolation |

#### Phase 3 — Real API Integrations (PR #29)
| Area | What It Does |
|---|---|
| **Entra ID Adapter** | Real Microsoft Graph API: create enterprise apps, configure SAML SSO/OIDC, create security groups, assign groups to apps, create Conditional Access policies, configure MFA authentication methods |
| **SailPoint Adapter** | Real IdentityNow v3 API: create sources, access profiles, roles, trigger aggregation, create certification campaigns |
| **ServiceNow Adapter** | Real Table/Catalog API: create catalog items, request mappings, Flow Designer workflows |
| **App Connector** | Human-assisted mode with credential escrow for app-side SSO/SCIM configuration |
| **Verification Adapter** | Automated verification via Graph API: test SSO login, verify MFA enforcement, validate group membership |
| **Base API Infrastructure** | OAuth2 token cache (tenant-scoped), retry with exponential backoff, circuit breaker (tenant/provider scoped), evidence capture with redaction |
| **SSRF Protection** | Block private IPs, localhost, metadata endpoints, IPv6 loopback, IPv4-mapped IPv6 (dotted and hex forms), require HTTPS |
| **Rollback Tracker** | Session-scoped rollback tracking by external object ID, honest `rollback_required` status |
| **Tenant Lock** | Single-deployment enforcement — first tenant locks each external system |

### Security Architecture (12 Domains)

| Domain | Implementation |
|---|---|
| **Tenant Isolation** | tenantId from JWT only, tenant-scoped token cache keys, tenant-scoped evidence/rollback/errors |
| **Authorization** | Tool Broker enforces: approved session, tenant match, action allowlist, per-system permissions, dry-run mode, replay protection |
| **OAuth & Secrets** | Credentials from env only, token cache in memory with TTL + jitter, no token persistence, errors never include tokens |
| **Input Validation** | Strict field validation, URL sanitization, `encodeURIComponent` for path interpolation, reject unknown fields |
| **SSRF Prevention** | Block private IPs/IPv6/metadata, HTTPS-only, trusted config for base URLs |
| **Evidence Capture** | Sanitized request/response summaries, redaction of auth headers/tokens/secrets/certs |
| **External API Safety** | Centralized timeout, max response size, retry only for transient failures, tenant/provider-scoped circuit breakers |
| **Idempotency** | Search by session tag before creating, store created object IDs, avoid duplicates on retry |
| **Rollback** | Session-scoped, by stored object ID only (never by name), ownership validation |
| **Scope Immutability** | Post-approval inputs can only fill missing placeholders — cannot overwrite already-resolved scope-sensitive values |
| **Simulation Detection** | `completed_simulation` status when any step used stub adapters, preserved across pause/resume |
| **Fail Closed** | Missing provider credentials in production → rejection (not silent simulation) |

### Agent Execution API

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/agent-execution/sessions` | `agents.execute.request` | Create execution session with plan |
| `GET` | `/agent-execution/sessions` | `agents.use` | List sessions (sanitized) |
| `GET` | `/agent-execution/sessions/:id` | `agents.use` | Session detail + plan + evidence |
| `POST` | `/agent-execution/sessions/:id/approve` | `agents.execute.approve` | Approve execution plan |
| `POST` | `/agent-execution/sessions/:id/execute` | `agents.execute.request` | Execute approved plan |
| `POST` | `/agent-execution/sessions/:id/cancel` | `agents.execute.request` | Cancel session + rollback |
| `PATCH` | `/agent-execution/sessions/:id/inputs` | `agents.execute.request` | Supply missing placeholder inputs |
| `POST` | `/agent-execution/sessions/:id/steps/:stepId/confirm` | `agents.execute.request` | Confirm/reject manual step |

### Execution Flow

```
User selects "Remediate SSO" on an application
    │
    ▼
Planning Service generates multi-step plan
    │  (Entra enterprise app → SAML SSO → security group → group assignment
    │   → SailPoint access profile → ServiceNow catalog → app-side SSO → verify)
    ▼
Plan enters approval workflow (security_review → platform_admin → app_owner)
    │
    ▼
Tool Broker executes each step through the appropriate adapter
    │  (tenant isolation, replay protection, evidence capture, SSRF blocking)
    │
    ├── Step succeeds → record evidence, advance to next step
    ├── Step needs manual action → pause session, wait for operator confirmation
    ├── Step fails → rollback all created objects, fail session
    └── All steps succeed → verification adapter confirms controls are active
    │
    ▼
Session completes with full evidence trail and audit log
```

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

#### Module 8 — Agent Execution Framework
| Feature | Route / Endpoint | Notes |
|---|---|---|
| Create execution session | `POST /agent-execution/sessions` | Plan generation for SSO or MFA remediation |
| Session list | `GET /agent-execution/sessions` | Sanitized for `agents.use` role |
| Session detail | `GET /agent-execution/sessions/:id` | Full plan, steps, evidence, rollback state |
| Approve plan | `POST /agent-execution/sessions/:id/approve` | Multi-gate approval workflow |
| Execute plan | `POST /agent-execution/sessions/:id/execute` | Runs through Tool Broker |
| Cancel + rollback | `POST /agent-execution/sessions/:id/cancel` | Marks objects `rollback_required`, cancels session |
| Supply inputs | `PATCH /agent-execution/sessions/:id/inputs` | Fill placeholder values; scope-sensitive keys immutable after approval |
| Confirm manual step | `POST /agent-execution/sessions/:id/steps/:stepId/confirm` | Accept or reject human-assisted steps |
| Entra ID adapter | — | Graph API: enterprise apps, SAML/OIDC, groups, CA policies, MFA |
| SailPoint adapter | — | IdentityNow v3: sources, access profiles, roles, aggregation, campaigns |
| ServiceNow adapter | — | Table/Catalog API: catalog items, request mappings, workflows |
| App Connector | — | Human-assisted SSO/SCIM config with credential escrow |
| Verification adapter | — | Automated SSO/MFA/group verification via Graph API |
| Tool Broker | — | 10-step security enforcement: session, tenant, permission, allowlist, replay, blast radius |
| Rollback tracker | — | Session-scoped external object tracking with `rollback_required` status |
| Evidence store | — | Sanitized API evidence with token/secret redaction |
| Credential escrow | — | One-time-use credential handles, destroyed after use/failure/expiry |

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
| Agent Execution | `/agent-execution` | ✅ Session list, plan review, approval workflow, step progress, evidence viewer |

---

### ✅ Recently Completed

#### Agent Execution Framework — Phases 1–3 (PRs #22, #27, #28, #29)

| Item | Status | Notes |
|---|---|---|
| Execution session lifecycle | Done | planning → pending_approval → approved → executing → completed/failed/cancelled |
| SSO + MFA plan generation | Done | Multi-step plans with system targets, blast radius, prerequisites |
| Multi-gate approval workflow | Done | Sequential security_review → platform_admin → app_owner gates |
| Tool Broker security enforcement | Done | 10-step enforcement: session, tenant, permission, allowlist, replay, blast radius, dry-run |
| Real Entra ID adapter (Graph API) | Done | Enterprise apps, SAML SSO, OIDC, security groups, CA policies, MFA |
| Real SailPoint adapter (v3 API) | Done | Sources, access profiles, roles, aggregation, certification campaigns |
| Real ServiceNow adapter (Table API) | Done | Catalog items, request mappings, Flow Designer workflows |
| Human-assisted App Connector | Done | Credential escrow, one-time-use handles, destroyed after use |
| Verification adapter | Done | Automated SSO/MFA/group verification via Graph API |
| SSRF protection | Done | Private IPs, IPv6, IPv4-mapped IPv6 (dotted + hex), metadata endpoints |
| Evidence capture with redaction | Done | Sanitized summaries, redaction of auth/tokens/secrets/certs |
| Rollback tracker | Done | Session-scoped by object ID, `rollback_required` status, ownership validation |
| Scope-sensitive input immutability | Done | Post-approval scope keys cannot be overwritten |
| Simulation detection | Done | `completed_simulation` when any step used stubs, preserved across pause/resume |
| Fail-closed production mode | Done | Missing provider credentials → rejection, not silent simulation |
| Tenant lock (single-deployment) | Done | First tenant locks each external system |
| Execution UI | Done | Session list, plan review, approval, step progress, evidence |
| Email notifications | Done | Plan created, approval requested, execution completed |
| 13 HIGH security fixes (Phase 2) | Done | RBAC, approval isolation, SMTP fail-closed |
| 8 HIGH + 34 Devin Review fixes (Phase 3) | Done | 4 Codex rounds + 19 Devin Review rounds |

#### Enterprise Foundation (PR #10)

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

#### Phase 4 — E2E Testing & Real Provider Validation
| Item | Priority | Notes |
|---|---|---|
| E2E tests with real Entra tenant | High | Requires test tenant with Graph API credentials |
| E2E tests with real SailPoint sandbox | High | Requires IdentityNow sandbox with client credentials |
| E2E tests with real ServiceNow instance | High | Requires PDI or sub-production instance |
| Automated test suite for security edge cases | High | Scope immutability, IPv6 normalization, empty array rejection, approval domain isolation |
| Provider rollback execution | Medium | Currently marks `rollback_required` — Phase 4 should call provider DELETE APIs |
| Tenant-scoped provider credentials | Medium | Currently global env vars — move to per-tenant encrypted config for multi-tenant SaaS |

#### Additional Platform Adapters
| Item | Priority | Notes |
|---|---|---|
| Live CyberArk PAM adapter | High | Integration module test-connection only; no execution adapter |
| Live Okta adapter | High | Integration module test-connection only; no execution adapter |
| Real CMDB integration (ServiceNow) | Medium | CMDB currently uses seeded mock data; ServiceNow adapter only handles catalog/workflow |
| PAM session management adapter | Medium | PAM controls detected but not remediable through execution framework |

#### Go Backend Migration
| Item | Priority | Notes |
|---|---|---|
| Go API server | High | Replace Node.js/Express with Go. PostgreSQL schema is already Go-compatible (snake_case, JSONB) |
| Migrate all modules to Go | High | Application CRUD, controls, build, cost, integrations, maturity, documents, agent-execution |
| PostgreSQL for all entities | High | Applications, controls, assessments still in-memory in Node.js |
| Session persistence | Medium | Execution sessions, builds, credentials, approvals reset on restart (not yet in PostgreSQL) |

#### Security & Authentication
| Item | Priority | Notes |
|---|---|---|
| OIDC integration (Entra ID / Okta) | High | Auth currently local JWT only; prepare for federated login |
| Refresh token support | High | Current JWTs are 8-hour, no refresh |
| Full SAML 2.0 SP implementation | Medium | Entra adapter configures SAML for apps; platform itself doesn't act as SP |
| MFA enforcement (login) | Medium | MFA evaluated and enforced per target app via CA policies but not at IDVIZE login UI itself |

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
| Execution history dashboard | Medium | Session completion rates, average execution time, failure trends |
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
│  │          Agent Execution Framework (Module 8)               │ │
│  │  Planning → Approval → Tool Broker → Adapters → Verify     │ │
│  │  ┌─────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────┐  │ │
│  │  │ Entra   │ │ SailPoint │ │ServiceNow│ │App Connector │  │ │
│  │  │ Adapter │ │  Adapter  │ │ Adapter  │ │  (human)     │  │ │
│  │  └─────────┘ └───────────┘ └──────────┘ └──────────────┘  │ │
│  │  Evidence Store · Rollback Tracker · Credential Escrow     │ │
│  └─────────────────────────────────────────────────────────────┘ │
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
                            │ OAuth2 / REST / SCIM
          ┌─────────────────┼─────────────────┐
     ┌────▼────┐      ┌─────▼──────┐    ┌─────▼──────┐  ┌──────┐
     │Entra ID │      │ SailPoint  │    │  CyberArk  │  │ Okta │
     │(Graph)  │      │(IdentityNow│    │  (mock)    │  │(mock)│
     └─────────┘      └────────────┘    └────────────┘  └──────┘
          │                │                                 │
     ┌────▼────────────────▼─────────────────────────────────▼───┐
     │              ServiceNow (Table / Catalog API)             │
     └───────────────────────────────────────────────────────────┘
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
│   │   │   ├── agent-execution/  # Module 8 — Agent Execution Framework
│   │   │   │   ├── adapters/        # Entra, SailPoint, ServiceNow, App Connector, Verification
│   │   │   │   ├── execution-orchestrator.service.ts
│   │   │   │   ├── planning.service.ts
│   │   │   │   ├── tool-broker.service.ts
│   │   │   │   ├── rollback-tracker.service.ts
│   │   │   │   ├── evidence-store.service.ts
│   │   │   │   └── credential-escrow.service.ts
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

### Agent Execution (`/agent-execution`)

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/agent-execution/sessions` | `agents.execute.request` | Create execution session — generates SSO or MFA remediation plan |
| `GET` | `/agent-execution/sessions` | `agents.use` | List sessions (plan internals and credential handles stripped) |
| `GET` | `/agent-execution/sessions/:id` | `agents.use` | Session detail with full plan, steps, evidence, rollback state |
| `POST` | `/agent-execution/sessions/:id/approve` | `agents.execute.approve` | Approve execution plan (multi-gate: security → platform → app owner) |
| `POST` | `/agent-execution/sessions/:id/execute` | `agents.execute.request` | Execute approved plan through Tool Broker |
| `POST` | `/agent-execution/sessions/:id/cancel` | `agents.execute.request` | Cancel session, mark created objects `rollback_required` |
| `PATCH` | `/agent-execution/sessions/:id/inputs` | `agents.execute.request` | Supply missing placeholder inputs (scope-sensitive keys immutable after approval) |
| `POST` | `/agent-execution/sessions/:id/steps/:stepId/confirm` | `agents.execute.request` | Confirm or reject a human-assisted manual step |

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

### Phase 4 — E2E Testing & Real Provider Validation (Next)

| Task | Priority | Description |
|---|---|---|
| E2E tests with real Entra tenant | High | Full SSO + MFA plan execution against a test Azure AD tenant with Graph API credentials |
| E2E tests with real SailPoint sandbox | High | Source creation, access profiles, roles, aggregation against IdentityNow sandbox |
| E2E tests with real ServiceNow instance | High | Catalog item + workflow creation against PDI or sub-production instance |
| Automated security edge-case tests | High | Scope immutability, IPv6 normalization, empty array rejection, approval domain isolation, SSRF blocking |
| Provider rollback execution | Medium | Currently marks objects `rollback_required` — need to call actual provider DELETE/cleanup APIs |
| Tenant-scoped provider credentials | Medium | Move from global env vars to per-tenant encrypted config for multi-tenant SaaS |

### Additional Platform Adapters

| Task | Priority | Description |
|---|---|---|
| CyberArk PAM execution adapter | High | Integration module has test-connection; execution adapter needed for PAM remediation |
| Okta execution adapter | High | Integration module has test-connection; execution adapter needed for AM remediation |
| CMDB integration (ServiceNow) | Medium | CMDB uses seeded data; ServiceNow adapter currently handles catalog/workflow only |
| PAM session management | Medium | PAM controls detected but not remediable through execution framework |

### Go Backend Migration

| Task | Priority | Description |
|---|---|---|
| Go API server | High | Replace Node.js/Express with Go. PostgreSQL schema is already Go-compatible (snake_case, JSONB) |
| Migrate all modules to Go | High | Application CRUD, controls, build, cost, integrations, maturity, documents, agent-execution |
| Full PostgreSQL persistence | High | Applications, controls, assessments, execution sessions still in-memory in Node.js |
| OIDC preparation | High | Entra ID / Okta federated login support |

### Other Pending Work

| Task | Priority |
|---|---|
| Refresh token support | High |
| Unit and integration test suite | High |
| CI/CD pipeline (GitHub Actions) | Medium |
| Docker Compose setup | Medium |
| Execution history dashboard (completion rates, failure trends) | Medium |
| Frontend code-splitting (~882 KB bundle) | Low |

---

## Known Limitations

| Area | Limitation |
|---|---|
| **Partial persistence** | Tenants, users, and audit logs are in PostgreSQL. Applications, controls, builds, execution sessions, and other modules remain in-memory and reset on restart. |
| **Node.js backend (temporary)** | The Express backend is a temporary implementation. Target is Go/Golang. |
| **Execution adapters** | Entra, SailPoint, and ServiceNow adapters make real API calls when credentials are configured. CyberArk and Okta still use mock data. Without credentials, adapters run in simulation mode (dev/demo) or reject execution (production). |
| **Rollback** | Rollback tracker marks external objects as `rollback_required` but does not yet call provider DELETE APIs. Rollback must be completed manually or by re-running cleanup. |
| **Single-deployment tenant lock** | Agent execution uses global env vars for provider credentials. Only one tenant can execute against each external system. Multi-tenant SaaS requires per-tenant encrypted credential config. |
| **Identity plane** | Cross-platform identity reconciliation uses representative mock records. Real reconciliation requires live adapters. |
| **JWT** | No refresh tokens. 8-hour TTL requires re-login. |
| **API key** | Single static key in `.env`. |
| **Bundle size** | Single JS chunk (~882 KB). No code-splitting applied. |
| **Tests** | No unit or integration test suite. Security edge cases verified through Codex code review only. |

---

## Git Repository

**Remote:** https://github.com/omobolu/DEV
**Active branch:** `develop`

### Key PRs

| PR | Description |
|---|---|
| [#10](https://github.com/omobolu/DEV/pull/10) | Enterprise Foundation — PostgreSQL, bcrypt, multi-tenancy |
| [#12](https://github.com/omobolu/DEV/pull/12) | Top IAM Risk Engine — Control-Assessment Risk Classification |
| [#16](https://github.com/omobolu/DEV/pull/16) | Control Detail View — Per-Application Control Assessment |
| [#19](https://github.com/omobolu/DEV/pull/19) | Agent Framework v1 — MFA and SSO Control Agents |
| [#20](https://github.com/omobolu/DEV/pull/20) | Email Service — SMTP Config, Templated Emails |
| [#22](https://github.com/omobolu/DEV/pull/22) | Phase 1 — Controlled Execution Agent Framework Foundation |
| [#27](https://github.com/omobolu/DEV/pull/27) | Phase 2 — Execution UI + Post-Merge Bug Fixes |
| [#28](https://github.com/omobolu/DEV/pull/28) | Phase 2-3 — Agent Email, CMDB Settings, Sequential Approval |
| [#29](https://github.com/omobolu/DEV/pull/29) | Phase 3 — Real API Integrations with 12-Domain Security |

---

*IDVIZE IAM OS — Internal prototype. All rights reserved.*
