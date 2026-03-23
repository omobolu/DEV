# IDVIZE — Enterprise IAM Orchestration & Governance Platform

> **Branch:** `prototype` | **Version:** 2.0.0 | **Status:** Active Development

IDVIZE is a full-stack Enterprise Identity & Access Management (IAM) Orchestration and Governance Platform. It provides a unified control plane for managing, assessing, and improving an organisation's IAM program across multiple platforms (Entra ID, SailPoint, CyberArk, Okta), with AI-powered analysis via Claude (Anthropic) and an industry-standard 5-level maturity scoring model.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Prerequisites](#prerequisites)
4. [Repository Structure](#repository-structure)
5. [Backend — idvize-api](#backend--idvize-api)
   - [Environment Variables](#environment-variables)
   - [Installation & Running](#installation--running-backend)
   - [API Reference](#api-reference)
6. [Frontend — idvize](#frontend--idvize)
   - [Installation & Running](#installation--running-frontend)
   - [Application Routes](#application-routes)
7. [Modules](#modules)
   - [Module 1 — Application Governance](#module-1--application-governance)
   - [Module 2 — Control Detection](#module-2--control-detection)
   - [Module 4 — Build Execution](#module-4--build-execution)
   - [Module 5 — Cost & Vendor Intelligence](#module-5--cost--vendor-intelligence)
   - [Module 6 — IAM Platform Integrations](#module-6--iam-platform-integrations)
   - [Module 7 — Security & Identity Governance](#module-7--security--identity-governance)
   - [Document Registry](#document-registry)
   - [Program Maturity Assessment](#program-maturity-assessment)
8. [Authentication & Authorisation](#authentication--authorisation)
9. [IAM Program Maturity Model](#iam-program-maturity-model)
10. [AI Agent Layer](#ai-agent-layer)
11. [Demo Users & Credentials](#demo-users--credentials)
12. [Development Workflow](#development-workflow)
13. [Git Repository](#git-repository)
14. [Known Limitations & Roadmap](#known-limitations--roadmap)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (SPA)                           │
│                  React 19 + Vite + Tailwind CSS                 │
│                     http://localhost:5173                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP/JSON (JWT + API Key)
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    idvize-api (Express 5)                        │
│                TypeScript · Node.js · In-memory                 │
│                     http://localhost:3001                       │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ Module 1 │ │ Module 2 │ │ Module 4 │ │     Module 5       │ │
│  │  App Gov │ │ Controls │ │  Build   │ │  Cost & Vendor     │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ Module 7 │ │   Docs   │ │ Maturity │ │  Integrations      │ │
│  │ Security │ │ Registry │ │  Engine  │ │  Config & Test     │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              AI Agent Layer (Claude / Anthropic)           │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │ OAuth2 / REST / SCIM
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌──────▼─────┐    ┌──────▼──────┐
   │Entra ID │      │ SailPoint  │    │  CyberArk   │
   │(Azure AD│      │IdentityNow │    │    PAM      │
   └─────────┘      └────────────┘    └─────────────┘
                                              │
                                       ┌──────▼──────┐
                                       │    Okta     │
                                       └─────────────┘
```

All data is held **in-memory** at runtime (no database). The platform seeds realistic mock data on startup so that every module is demo-ready immediately.

---

## Technology Stack

### Backend

| Component | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 5.2.1 |
| Language | TypeScript 5.9 (strict) |
| Authentication | JWT (HS256, 8-hour TTL) |
| AI Integration | Anthropic Claude via `@anthropic-ai/sdk` 0.80 |
| Security headers | Helmet 8 |
| CORS | cors 2.8 |
| Logging | Morgan (HTTP) + custom audit service |
| ID generation | UUID v4 |
| Environment | dotenv 17 |

### Frontend

| Component | Technology |
|---|---|
| Framework | React 19.2 |
| Build tool | Vite 7.3 |
| Routing | React Router 7.13 |
| Language | TypeScript 5.9 (strict) |
| Styling | Tailwind CSS 3.4 (dark theme) |
| Charts | Recharts 3.7 |
| Icons | Lucide React 0.575 |
| HTTP client | Shared `apiFetch()` wrapper |

---

## Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- **Anthropic API key** (for AI agents — optional; platform works without it, AI narratives will be absent)
- **Azure AD / SailPoint / CyberArk / Okta credentials** (optional; platform runs fully with mock data)

---

## Repository Structure

```
IAM-Platform/
├── idvize-api/          # Express API backend
│   ├── src/
│   │   ├── agents/      # AI orchestration agents (Claude)
│   │   ├── connectors/  # Legacy Phase 1 platform connectors
│   │   ├── middleware/  # Auth, API key, error handling
│   │   ├── modules/     # Core business modules
│   │   │   ├── application/    # Module 1 — Application Governance
│   │   │   ├── control/        # Module 2 — Control Detection
│   │   │   ├── build/          # Module 4 — Build Execution
│   │   │   ├── cost/           # Module 5 — Cost & Vendor Intelligence
│   │   │   ├── integration/    # Platform adapters & config
│   │   │   ├── security/       # Module 7 — Security & Identity Gov
│   │   │   │   ├── auth/       # JWT authentication
│   │   │   │   ├── authz/      # RBAC / ABAC policy engine
│   │   │   │   ├── audit/      # Immutable audit log
│   │   │   │   ├── scim/       # SCIM 2.0 provisioning
│   │   │   │   ├── credentials/# Credential governance & rotation
│   │   │   │   ├── vault/      # Secret vault abstraction
│   │   │   │   ├── approval/   # Approval workflows
│   │   │   │   └── masking/    # Field-level data masking
│   │   │   ├── document/       # Document registry
│   │   │   └── maturity/       # IAM Program Maturity engine
│   │   │       └── services/   # Evidence, scoring, explainability
│   │   ├── routes/      # Legacy Phase 1 routes
│   │   ├── services/    # Shared services (Claude, gap detection)
│   │   └── types/       # Global type definitions
│   ├── dist/            # Compiled output (generated)
│   ├── tsconfig.json
│   └── package.json
│
├── idvize/              # React SPA frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/  # AppLayout, Header, Sidebar
│   │   │   ├── common/  # Badge, DataTable, KpiCard, TabNav
│   │   │   └── charts/  # Donut, Gauge, Bar, Trend, Combo charts
│   │   ├── context/     # CMDBContext
│   │   ├── data/        # Mock data files
│   │   ├── features/
│   │   │   └── cmdb/    # CMDB detail pages & components
│   │   ├── lib/
│   │   │   └── apiClient.ts  # Shared HTTP client
│   │   ├── pages/       # Route-level page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── applications/
│   │   │   ├── cmdb/
│   │   │   ├── documents/
│   │   │   ├── integrations/
│   │   │   ├── maturity/
│   │   │   ├── iga/
│   │   │   ├── access/
│   │   │   ├── pam/
│   │   │   └── ciam/
│   │   └── types/       # Shared TypeScript interfaces
│   ├── dist/            # Production build (generated)
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
└── README.md            # This file
```

---

## Backend — idvize-api

### Environment Variables

Create `idvize-api/.env` (copy from the template below). All IAM platform credentials are optional — the platform runs fully with mock adapters when they are absent.

```env
# ── Server ────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=development

# ── API Security ──────────────────────────────────────────────────
# Static API key required in x-api-key header for all requests
API_KEY=idvize-dev-key-change-me

# ── JWT ───────────────────────────────────────────────────────────
# Secret used to sign/verify JWTs — change before production
JWT_SECRET=change-me-in-production

# ── Entra ID (Azure Active Directory) ────────────────────────────
ENTRA_TENANT_ID=
ENTRA_CLIENT_ID=
ENTRA_CLIENT_SECRET=

# ── SailPoint IdentityNow ─────────────────────────────────────────
SAILPOINT_BASE_URL=
SAILPOINT_CLIENT_ID=
SAILPOINT_CLIENT_SECRET=

# ── CyberArk PAM ─────────────────────────────────────────────────
CYBERARK_BASE_URL=
CYBERARK_USERNAME=
CYBERARK_PASSWORD=

# ── Okta ──────────────────────────────────────────────────────────
OKTA_DOMAIN=
OKTA_API_TOKEN=

# ── Anthropic Claude AI ───────────────────────────────────────────
# Required for AI executive narratives & agent analysis
ANTHROPIC_API_KEY=
```

### Installation & Running (Backend)

```bash
cd idvize-api

# Install dependencies
npm install

# Development (ts-node, hot-reload)
npm run dev

# Production build
npm run build
node dist/index.js
```

The API starts on **http://localhost:3001**. Verify with:

```bash
curl http://localhost:3001/health
```

Expected response includes all module statuses:
```json
{
  "status": "ok",
  "modules": {
    "Application Governance": "active",
    "Cost & Vendor Intelligence": "active",
    "Security & Identity Governance": "active",
    "Document Registry": "active",
    "Program Maturity": "active"
  }
}
```

---

### API Reference

All endpoints require the following headers unless noted otherwise:

```
x-api-key: idvize-dev-key-change-me
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

---

#### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Service status, module capabilities, integration states |

---

#### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/security/auth/token` | API key only | Issue JWT — body: `{ email, password }` |
| `GET` | `/security/auth/me` | JWT | Current user profile |
| `GET` | `/security/auth/matrix` | JWT | Full permission matrix for current user |

---

#### Module 1 — Application Governance

| Method | Path | Description |
|---|---|---|
| `GET` | `/applications` | List applications (query: `riskTier`, `department`, `search`) |
| `POST` | `/applications` | Create or upsert a single application |
| `GET` | `/applications/:id` | Get single application details |
| `POST` | `/applications/import` | Bulk import via CSV or JSON payload |

---

#### Module 2 — Control Detection

| Method | Path | Description |
|---|---|---|
| `POST` | `/controls/evaluate` | Evaluate controls for one or all applications |
| `GET` | `/controls/:appId` | Get cached control evaluation result |

---

#### Module 4 — Build Execution

| Method | Path | Description |
|---|---|---|
| `POST` | `/build/start` | Start a new build job |
| `GET` | `/build` | List builds (query: `state`, `platform`, `appId`) |
| `GET` | `/build/:id` | Get full build state and artifacts |
| `POST` | `/build/:id/advance` | Advance build to the next state |
| `POST` | `/build/:id/transition` | Explicit state transition |
| `POST` | `/build/:id/data` | Submit technical data for current stage |
| `POST` | `/build/:id/artifacts` | Generate build artifacts |

---

#### Module 5 — Cost & Vendor Intelligence

| Method | Path | Description |
|---|---|---|
| `POST` | `/cost/analyze` | Run full cost analysis engine |
| `POST` | `/cost/analyze/ai` | Claude-powered cost analysis with narrative |
| `GET` | `/cost/report` | Get last generated cost report |
| `GET` | `/cost/summary` | Aggregated cost breakdown (people + tech + partners) |
| `GET` | `/cost/vendor-analysis` | Cost impact analysis for all vendors |
| `GET` | `/cost/vendor-analysis/:vendorId` | Single vendor impact |
| `GET` | `/cost/optimization` | Optimization opportunities with effort/impact ratings |
| `POST` | `/cost/vendors` | Create or update a vendor record |
| `GET` | `/cost/vendors` | List all vendors |
| `POST` | `/cost/contracts` | Create or update a contract |
| `GET` | `/cost/contracts` | List all contracts |
| `POST` | `/cost/people` | Add a people cost record |
| `GET` | `/cost/people` | List all people cost records |

---

#### Module 6 — IAM Platform Integrations

| Method | Path | Description |
|---|---|---|
| `GET` | `/integrations/status` | Connection status for all platforms |
| `GET` | `/integrations/config` | Current saved credentials (secrets redacted) |
| `POST` | `/integrations/configure` | Save platform credentials to runtime environment |
| `POST` | `/integrations/test/:platform` | Test connection using submitted credentials (never saved env) |
| `GET` | `/integrations/entra/apps` | List Entra ID applications |
| `GET` | `/integrations/sailpoint/sources` | List SailPoint identity sources |
| `GET` | `/integrations/cyberark/safes` | List CyberArk safes |
| `GET` | `/integrations/okta/apps` | List Okta applications |
| `POST` | `/integrations/correlate/:appName` | Cross-platform application correlation |

**Platform values for `:platform`:** `entra` | `sailpoint` | `cyberark` | `okta`

Test connection request body example:
```json
{
  "entra": {
    "tenantId": "...",
    "clientId": "...",
    "clientSecret": "..."
  }
}
```

---

#### Module 7 — Security & Identity Governance

**Authorisation:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/security/authz/check` | Check permission (query: `permission=<id>`) |
| `GET` | `/security/authz/my-permissions` | Current user's effective permissions |
| `GET` | `/security/authz/policies` | List all authorisation policies |

**SCIM 2.0 Provisioning:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/security/scim/v2/Users` | List provisioned users |
| `GET` | `/security/scim/v2/Groups` | List provisioned groups |

**Approval Workflows:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/security/approvals` | Create an approval request |

**Audit Log:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/security/audit` | Retrieve audit log events (query: `actor`, `resource`, `limit`) |

**Security Posture:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/security/posture` | Deterministic security posture report |
| `POST` | `/security/posture/ai` | Claude-powered posture analysis with recommendations |

**Field Masking Demo:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/security/masking/demo` | Demonstrate field-level data masking |

**Credential Governance:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/security/credentials` | Register a new credential |
| `GET` | `/security/credentials` | List all credentials |
| `GET` | `/security/credentials/:id` | Get credential detail |
| `POST` | `/security/credentials/:id/rotate` | Trigger credential rotation |
| `POST` | `/security/credentials/:id/revoke` | Revoke a credential |
| `POST` | `/security/credentials/:id/register-reference` | Register an application reference |
| `GET` | `/security/credentials/rotation/report` | Rotation status report |
| `POST` | `/security/credentials/request` | Submit a credential access request |
| `GET` | `/security/credentials/requests` | List credential requests |
| `POST` | `/security/credentials/requests/:id/resolve` | Approve or deny a request |

**Secret Vault:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/security/vault/providers` | Available vault providers (AWS SM, Azure KV, CyberArk, HashiCorp, mock) |
| `GET` | `/security/vault/status` | Active vault integration status |
| `GET` | `/security/vault/events` | Vault access event log |

---

#### Document Registry

| Method | Path | Description |
|---|---|---|
| `GET` | `/documents` | List documents (permission: `document.view`) |
| `GET` | `/documents/stats` | Aggregate statistics by status and type |
| `POST` | `/documents` | Create a new document |
| `GET` | `/documents/:id` | Get document with all versions |
| `PATCH` | `/documents/:id` | Update document metadata or content |
| `POST` | `/documents/:id/submit` | Submit draft for review |
| `POST` | `/documents/:id/review` | Submit a review (approve/reject with comments) |
| `POST` | `/documents/:id/publish` | Publish an approved document |
| `POST` | `/documents/:id/archive` | Archive a document |

---

#### Program Maturity Assessment

| Method | Path | Description |
|---|---|---|
| `GET` | `/maturity/summary` | Overall maturity score, level, top recommendations |
| `GET` | `/maturity/domains` | All 13 domain scores with confidence |
| `GET` | `/maturity/domains/:domainId` | Single domain drill-down: indicators, evidence, explainability, recommendations |
| `POST` | `/maturity/recalculate` | Trigger a fresh assessment run (re-collects all evidence) |
| `GET` | `/maturity/history` | List of past assessment runs |

---

## Frontend — idvize

### Installation & Running (Frontend)

```bash
cd idvize

# Install dependencies
npm install

# Development server (hot module replacement)
npm run dev
# Opens http://localhost:5173

# Production build
npm run build
# Output in dist/

# Preview production build locally
npm run preview
```

### Application Routes

| Path | Page | Description |
|---|---|---|
| `/` | Redirect | Redirects to `/dashboard` if logged in, `/login` otherwise |
| `/login` | LoginPage | JWT authentication form |
| `/dashboard` | Dashboard | Main overview with maturity scores, domain cards |
| `/iga` | IdentityWarehouse | Identity Governance & Administration analytics |
| `/access-management` | AccessManagement | Authentication, SSO & MFA overview |
| `/pam` | PAMDashboard | Privileged Access Management dashboard |
| `/ciam` | CIAMDashboard | Customer Identity & Access Management |
| `/applications/onboarding` | AppOnboarding | Application onboarding workflow |
| `/applications/management` | AppManagement | Application lifecycle management |
| `/applications/orphan-accounts` | OrphanAccounts | Orphan account detection & remediation |
| `/cmdb` | CMDBPage | Configuration Management Database |
| `/cmdb/:appId` | AppDetailPage | Application detail with controls, posture, recommendations |
| `/documents` | DocumentsPage | Document registry & approval workflow |
| `/integrations` | IntegrationsPage | Platform credentials, test & status |
| `/maturity` | MaturityPage | IAM Programme Maturity full report |
| `/maturity/domains/:domainId` | MaturityDomainDetail | Domain-level drill-down with evidence |

---

## Modules

### Module 1 — Application Governance

Manages the application inventory that underpins all IAM decisions.

- **Import**: Bulk ingest applications from CSV/JSON with metadata normalisation
- **CMDB**: Full-featured configuration database with risk tiers, departments, platform tags
- **Application detail**: Controls status, security posture, IAM gap analysis
- **Cross-platform correlation**: Links the same application across Entra, SailPoint, CyberArk, Okta

### Module 2 — Control Detection

Maps applications to expected IAM controls and identifies gaps.

- Evaluates controls (MFA, RBAC, SSO, PAM coverage, SCIM provisioning) per application
- Produces gap scores and risk assessments
- Feeds the Build Execution engine with gap data

### Module 4 — Build Execution

State-machine driven workflow for executing IAM builds (new integrations, remediation).

**States**: `planning → design → review → approved → in_progress → testing → completed`

- Generates build artifacts (configuration files, runbooks, test plans)
- Accepts technical data submissions per stage
- Tracks progress and artifacts at each transition

### Module 5 — Cost & Vendor Intelligence

Full cost visibility across people, technology, and partner spend.

- Aggregates people costs (FTE, contractors) by team and function
- Tracks vendor contracts with renewal dates, negotiation leverage scores
- Produces optimization opportunities with effort/impact ratings
- Claude-powered narrative analysis of cost trends and anomalies

### Module 6 — IAM Platform Integrations

Connects to enterprise IAM platforms with live credential testing.

| Platform | Authentication | Data Retrieved |
|---|---|---|
| Entra ID (Azure AD) | OAuth2 `client_credentials` → Microsoft Graph | Applications, groups, users |
| SailPoint IdentityNow | OAuth2 `client_credentials` | Identity sources, accounts, entitlements |
| CyberArk PAM | Username/password → session token | Safes, accounts, platforms |
| Okta | API token | Applications, users, groups |

**Important**: Connection tests always use the credentials submitted in the request body — they never fall back to previously saved environment variables, preventing false positives.

### Module 7 — Security & Identity Governance

The most comprehensive module, covering:

**Authentication & Sessions**
- JWT-based authentication (HS256, 8-hour TTL)
- OIDC adapter for federated login (SAML adapter scaffolded)
- Role-based token claims

**Authorisation (RBAC/ABAC)**
- Policy engine with role and attribute-based rules
- Permission matrix: `resource.action` format
- Runtime permission checks with full audit trail

**Credential & Secret Governance**
- Credential registry with lifecycle management (active → rotating → revoked)
- Rotation monitoring with overdue alerts
- Access request workflow with approval gates
- Application reference tracking (which apps use which credentials)

**Secret Vault Abstraction**
- Unified interface across: AWS Secrets Manager, Azure Key Vault, CyberArk (vault), HashiCorp Vault, Mock
- Provider status, access event logging

**SCIM 2.0 Provisioning**
- User and group provisioning endpoint
- Lifecycle event tracking

**Audit Log**
- Immutable append-only log for all security-relevant events
- Every integration test, credential rotation, approval, and login is recorded

**Field-Level Masking**
- Demonstrates masking of sensitive fields (email, SSN, account numbers) based on caller role

### Document Registry

Policy and procedure management with approval workflow.

- **Document types**: Policy, Procedure, Standard, Guideline, Runbook
- **Lifecycle**: Draft → In Review → Approved → Published → Archived
- **Versioning**: Full version history with diff tracking
- **Review workflow**: Submit → Review (approve/reject with comments) → Publish
- **Permission gating**: View, create, review, publish — each requires specific role

### Program Maturity Assessment

A deterministic, evidence-grounded IAM maturity scoring engine. See [IAM Program Maturity Model](#iam-program-maturity-model) for full detail.

---

## Authentication & Authorisation

### Obtaining a Token

```bash
curl -X POST http://localhost:3001/security/auth/token \
  -H "Content-Type: application/json" \
  -H "x-api-key: idvize-dev-key-change-me" \
  -d '{"email":"admin@idvize.com","password":"password123"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": { "id": "...", "email": "admin@idvize.com", "role": "admin" },
    "expiresIn": 28800
  }
}
```

### Using the Token

Include the token in every subsequent request:
```
Authorization: Bearer eyJhbGci...
```

The frontend `apiFetch()` client handles this automatically and redirects to `/login` on any 401 response.

### Role Hierarchy

| Role | Key Permissions |
|---|---|
| `admin` | Full access to all modules and operations |
| `iam_manager` | Manage applications, view all reports, approve documents |
| `iam_engineer` | Create/update applications, run builds, manage credentials |
| `auditor` | Read-only access to audit logs, reports, maturity assessments |
| `viewer` | Read-only access to dashboards and documents |

---

## IAM Program Maturity Model

IDVIZE implements an industry-standard **5-level maturity scale** aligned with CMMI, NIST CSF, and ISACA frameworks.

### Maturity Levels

| Level | Score Band | Label | Characteristics |
|---|---|---|---|
| L1 | 0 – 20 | Initial | Ad-hoc processes, no formal IAM programme, reactive posture |
| L2 | 21 – 40 | Developing | Recognised need, early implementation, inconsistent practices |
| L3 | 41 – 60 | Defined | Documented policies, consistently applied, basic automation |
| L4 | 61 – 80 | Managed | Measured and controlled, predictable outcomes, continuous monitoring |
| L5 | 81 – 100 | Optimized | Continuous improvement, full automation, proactive posture |

### Assessment Architecture

```
External Sources           Evidence Layer          Scoring Layer
──────────────            ──────────────          ─────────────
Document Module    ──→    EvidenceItem            NormalizationService
Audit Logs         ──→    quality: live │          → 0–100 per indicator
Approval Workflows ──→            mock  │          → confidence: 0–1
SCIM Provisioning  ──→            est.  │
Application CMDB   ──→            miss  │          ScoringEngine
Cost Module        ──→                 ↓           → confidence-weighted avg
Entra Adapter      ──→    MaturityIndicator        → domain score
SailPoint Adapter  ──→    (50+ indicators)         → overall score
CyberArk Adapter   ──→
Okta Adapter       ──→                             ExplainabilityService
                                                   → narrative
                                                   → key factors
                                                   → limitations

                                                   RecommendationAgent
                                                   → deterministic rules
                                                   → Claude AI narrative
```

### 13 Maturity Domains

| Domain ID | Domain Name |
|---|---|
| `iga` | Identity Governance & Administration |
| `am` | Authentication, SSO & MFA |
| `pam` | Privileged Access Management |
| `ciam` | Customer Identity & Access Management |
| `lifecycle` | Identity Lifecycle Management |
| `access_review` | Access Reviews & Certification |
| `separation_of_duties` | Separation of Duties |
| `audit_compliance` | Audit & Compliance |
| `data_governance` | Data Governance & Classification |
| `vendor_management` | Vendor & Third-party Risk |
| `incident_response` | Incident Response |
| `architecture` | IAM Architecture & Standards |
| `cost_optimisation` | Cost Optimisation |

### Confidence-Weighted Scoring

Scores are never silently inflated by missing or low-quality evidence:

```
Evidence Quality   Confidence Weight
─────────────────  ─────────────────
live               1.0  (real API data)
estimated          0.6  (derived/calculated)
mock               0.4  (placeholder data)
missing            0.1  (no evidence found)

domainScore = Σ(indicator.score × indicator.weight × indicator.confidence)
            / Σ(indicator.weight × indicator.confidence)
```

Low-confidence domains are surfaced in the dashboard with amber warnings.

---

## AI Agent Layer

IDVIZE uses Claude (Anthropic) for three specific, bounded purposes:

| Agent | Trigger | Output |
|---|---|---|
| **Maturity Narrative** | `POST /maturity/recalculate` | Executive summary explaining the overall score, key strengths and gaps |
| **Cost Intelligence** | `POST /cost/analyze/ai` | Cost trend analysis, anomaly identification, optimisation narrative |
| **Security Posture** | `POST /security/posture/ai` | Governance risk narrative with prioritised recommendations |

**Important constraints:**
- Claude **never sets numeric scores** — all scoring is deterministic
- Claude receives only pre-computed facts and evidence summaries
- If `ANTHROPIC_API_KEY` is absent, all features work correctly; AI narratives are simply omitted

---

## Demo Users & Credentials

The API seeds the following demo users on startup:

| Email | Password | Role | Access |
|---|---|---|---|
| `admin@idvize.com` | `password123` | `admin` | Full platform access |
| `manager@idvize.com` | `password123` | `iam_manager` | All modules, no admin settings |
| `engineer@idvize.com` | `password123` | `iam_engineer` | Build, applications, credentials |
| `auditor@idvize.com` | `password123` | `auditor` | Read-only audit & reports |
| `viewer@idvize.com` | `password123` | `viewer` | Dashboard & document view only |

> These credentials are for **development and demonstration only**. Change all secrets before any deployment.

---

## Development Workflow

### Starting Both Servers

**Terminal 1 — Backend:**
```bash
cd idvize-api
npm run build && node dist/index.js
# or for hot-reload:
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd idvize
npm run dev
```

Open **http://localhost:5173** and log in as `admin@idvize.com` / `password123`.

### Building for Production

```bash
# Backend
cd idvize-api && npm run build
# Output: idvize-api/dist/

# Frontend
cd idvize && npm run build
# Output: idvize/dist/  (serve with any static file host)
```

### TypeScript Checking

```bash
# Backend — type check only (no emit)
cd idvize-api && npx tsc --noEmit

# Frontend — type check via Vite
cd idvize && npm run build
```

### Linting

```bash
cd idvize && npm run lint
```

---

## Git Repository

**Remote:** https://github.com/omobolu/Claud-IAM-Platform

| Branch | Purpose |
|---|---|
| `main` | Stable baseline |
| `prototype` | Active development — current working prototype |

### Commit History

```
dad2302  feat: maturity 1-5 scale, dashboard score bubbling, prototype quality
fb70914  Add Enterprise IAM Program Maturity capability
223ca37  Add IAM platform integrations UI with secure connection testing
eb243ee  Initial commit — idvize IAM Orchestration & Governance Platform
```

---

## Known Limitations & Roadmap

### Current Limitations

| Area | Limitation |
|---|---|
| **Persistence** | All data is in-memory. Restarting the API server resets all state (applications, builds, credentials, maturity runs). |
| **Authentication** | Demo JWT secret is hardcoded. Rotate `JWT_SECRET` in production. |
| **API key** | Single static API key. Replace with per-client key management before production. |
| **Platform adapters** | Entra, SailPoint, CyberArk, Okta adapters return mock data when credentials are not configured. Only the Entra test-connection performs a real OAuth2 call. |
| **Frontend bundle** | Single JS chunk (~840 KB minified). Code-splitting not yet applied. |
| **SAML** | SAML adapter is scaffolded but not fully implemented. |
| **Multi-tenancy** | Single-tenant only. |

### Planned Improvements

- [ ] Persistent storage layer (PostgreSQL / MongoDB)
- [ ] Complete live adapters for SailPoint, CyberArk, Okta
- [ ] Code-split frontend bundle
- [ ] Refresh token support
- [ ] Per-client API key management
- [ ] Full SAML 2.0 SP implementation
- [ ] Docker Compose for one-command local setup
- [ ] Unit and integration test suite
- [ ] Maturity trend tracking across assessment runs (historical charting)
- [ ] Export maturity report to PDF

---

## Licence

Internal prototype — all rights reserved. Not for distribution.
