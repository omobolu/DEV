# idvize — IAM Orchestration & Governance Platform

Enterprise IAM operating system for application governance, control detection, build execution, cost intelligence, and security posture management. Multi-tenant, module-per-feature architecture.

## Architecture

- **Monorepo**: `idvize/` (React frontend) + `idvize-api/` (Express backend)
- **Backend**: Module-per-feature — each module has `controller.ts`, `service.ts`, `repository.ts`, `types.ts`
- **Frontend**: Page-per-route with shared layout, common components, and chart library
- **Data**: All in-memory (Map-based repositories partitioned by tenantId) — no database
- **Multi-tenancy**: JWT claims carry `tenantId`; middleware enforces tenant isolation
- **External integrations**: Entra, SailPoint, CyberArk, Okta — all fall back to mock data when credentials absent
- **AI**: Anthropic SDK (`claude-opus-4-6`) for cost analysis and security posture — gracefully degrades without API key
- **Communication**: Frontend calls `http://localhost:3001` via `apiClient.ts` wrapper; backend on port 3001, frontend on port 5173

## Tech Stack

| Component | Version |
|-----------|---------|
| Express | 5.2.1 |
| React | 19.2.0 |
| React Router | 7.13.1 |
| Vite | 7.3.1 |
| TypeScript | 5.9.3 (strict mode, both projects) |
| Tailwind CSS | 3.4.19 |
| Recharts | 3.7.0 |
| Lucide React | 0.575.0 |
| jsonwebtoken | 9.0.3 |
| @anthropic-ai/sdk | 0.80.0 |
| Node target | ES2020 (backend), ES2022 (frontend) |

## Common Commands

```bash
# Backend
cd idvize-api && npm install
npm run dev          # nodemon + ts-node on port 3001
npm run build        # tsc → dist/

# Frontend
cd idvize && npm install
npm run dev          # vite on port 5173 (auto-opens browser)
npm run build        # tsc -b && vite build
npm run lint         # eslint
```

## Code Style & Conventions

- TypeScript strict mode in both projects (`noUnusedLocals`, `noUnusedParameters`)
- Backend: CommonJS modules, ES2020 target
- Frontend: ESNext modules, ES2022 target, path alias `@/*` → `src/*`
- 2-space indentation, single quotes in frontend, double quotes acceptable in backend
- Backend file naming: `<module>.controller.ts`, `<module>.service.ts`, `<module>.repository.ts`, `<module>.types.ts`
- Frontend: functional components only, Tailwind utility classes, Lucide icons
- Repositories export singletons: `export const fooRepository = new FooRepository()`
- Services call repositories; controllers call services; never skip layers

## Backend Modules

| Module | Route Prefix | Auth | Description |
|--------|-------------|------|-------------|
| application | `/applications` | JWT + tenant | App inventory, CSV/JSON import, posture |
| control | `/controls` | JWT + tenant | 49-control catalog, coverage detection |
| build | `/build` | JWT + tenant | Build job state machine (12 states) |
| integration | `/integrations` | API key only | Platform adapter status, config, correlation |
| cost | `/cost` | JWT + tenant | Vendor, contract, people cost tracking + AI analysis |
| security | `/security` | Mixed | Auth, AuthZ, SCIM, audit, approvals, vault, credentials |
| document | `/documents` | JWT + tenant | Policy/runbook registry with review workflow |
| os | `/os` | JWT + tenant | IAM OS kernel, gap engine, alerts |
| tenant | `/tenants` | JWT | Tenant management |
| maturity | `/maturity` | JWT + tenant | IAM program maturity scoring |
| value | `/value` | JWT + tenant | Business value metrics |

## Authentication & Security

- **API key**: `X-Api-Key` header or `api_key` query param; dev key in `.env`
- **JWT**: HS256, 8-hour TTL; issued via `POST /security/auth/token`
- **Middleware chain**: `helmet → cors → json(10mb) → morgan → apiKeyAuth → [requireAuth → tenantContext → requirePermission]`
- **RBAC**: 24 permission IDs checked via `requirePermission(permissionId)` middleware
- **Roles**: Manager, Architect, BusinessAnalyst, Engineer, Developer
- **Demo tenants**: `ten-acme` (ACME Financial, enterprise), `ten-globex` (Globex Tech, professional)
- **Demo login**: See `LoginPage.tsx` for accounts; all passwords: `password123`

## API Conventions

- Base URL: `http://localhost:3001`
- Headers: `Content-Type: application/json`, `x-api-key`, `Authorization: Bearer <jwt>`
- Success: `{ success: true, data: ... }` or `{ success: true, ...fields }`
- Error: `{ error: "message" }` with appropriate HTTP status
- Request correlation: `X-Request-ID` header (auto-generated UUID if absent)

## Important Rules

- NEVER commit `.env` files or real credentials
- All platform adapters must fall back to mock mode when credentials are absent
- Data is in-memory only — document any persistence assumptions before adding a database
- Keep modules self-contained (controller + service + repository + types in one directory)
- When adding a new module, read an existing module (e.g., `document`) as a template
- Frontend API calls go through `apiClient.ts` `apiFetch()` — never use raw `fetch()`
- Every authorization decision must be audit-logged via `auditService.log()`
- Seed data files (`*.seed.ts`) are lazy-loaded on first request, not on startup (except tenants)
- CORS whitelist in `index.ts` must include any new frontend dev ports

## Known Limitations

- No database — all data lost on restart
- No test framework installed; zero test coverage
- No Docker/containerization setup
- No refresh tokens — JWT expires after 8 hours, requires full re-login
- All platform connectors return mock data (no live integrations configured)
- No code splitting / lazy loading on frontend routes
- Single static API key for dev (not per-client)
- SCIM endpoints scaffolded but limited functionality

## UI Skill Usage

- Always use iam-ui-patterns for IAM-related UI
- Always use auth-flow-ui for authentication flows
- Always use design-system-enforcer for all UI work
- Always use enterprise-ui as the base UI standard





# Application Direction

This project must be implemented as an enterprise-grade application with:
- a web frontend
- a server backend
- clear separation of concerns
- secure authentication and authorization
- production-grade error handling, validation, and logging

## Skill usage

- Use enterprise-frontend for frontend UI work
- Use enterprise-backend for server/backend/API work
- Use fullstack-architecture for cross-layer implementation
- Use auth-integration for authentication, authorization, MFA, token, and session work

## Engineering standards

- Prefer maintainable architecture over shortcuts
- Do not build demo-only code unless explicitly requested
- Keep frontend and backend modular
- Validate all inputs
- Centralize error handling
- Use structured logging
- Keep secrets and config in environment variables
- Add tests where practical

## Execution Mode

Operate in autonomous engineering mode.

- Do not ask unnecessary clarification questions
- Make reasonable assumptions and proceed
- Default to enterprise-grade best practices
- Prioritize execution over discussion

If assumptions are made:
- state them briefly
- continue implementation

Do not pause for confirmation unless explicitly instructed.


## Default Technology Choices

Unless specified otherwise:

Frontend:
- React + TypeScript
- Tailwind CSS

Backend:
- Go (preferred) or Node.js if required
- REST APIs

Architecture:
- Modular structure
- Separation of concerns

Auth:
- OAuth / OIDC (Entra External ID)

Validation:
- Strong input validation

Logging:
- Structured logging

Testing:
- Unit tests for core logic

# Default Technology Stack

Unless explicitly instructed otherwise, use the following stack for this project.

## Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod

## Backend
- Go
- Chi router
- REST API
- OpenAPI documentation
- Structured logging
- Environment-based configuration

## Data
- PostgreSQL

## Authentication
- Microsoft Entra External ID
- OAuth 2.0 / OpenID Connect
- Authorization Code Flow with PKCE for browser-based sign-in
- Backend APIs must validate auth and authorization properly

## Architecture
- Web frontend with server backend
- SPA frontend
- BFF-style backend boundary where appropriate
- Clear separation of concerns:
  - handlers/controllers
  - services
  - repositories
  - middleware
  - config

## Engineering Standards
- Do not ask unnecessary clarification questions for standard implementation details
- Make reasonable assumptions and proceed
- Use production-grade patterns, not demo shortcuts
- Prefer maintainability over cleverness
- Validate all input
- Centralize error handling
- Use structured logs
- Use environment variables for secrets/config
- Add tests for core business logic
