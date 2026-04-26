# Prompt: Generate CLAUDE.md + Agentic Skills/Rules for This Repository

Paste everything below the line into Claude Code from the root of the `IAM-Platform` repository.

---

You are tasked with analyzing this entire repository and generating a complete agentic programming setup following Anthropic's latest best practices for Claude Code. Do this in phases:

## Phase 1 — Deep Repository Analysis

Before generating anything, thoroughly analyze the codebase:

1. **Read all configuration files**: `package.json`, `tsconfig.json`, `.env`, `vite.config.ts`, `tailwind.config.js`, `eslint.config.js` in both `idvize/` and `idvize-api/`
2. **Map the module structure**: Read every `*.controller.ts`, `*.service.ts`, `*.repository.ts`, and `*.types.ts` to understand the domain model
3. **Trace the routing**: Read `idvize-api/src/index.ts` for API route mounting and `idvize/src/App.tsx` for frontend routing
4. **Identify middleware chain**: Read all files in `idvize-api/src/middleware/`
5. **Catalog the tech stack**: Note exact versions from both `package.json` files
6. **Check for existing docs**: Read `README.md`, any existing `CLAUDE.md`, `.claude/` directory contents
7. **Understand data patterns**: Check seed files, repository implementations, and whether a database exists
8. **Map AI integration points**: Find all Anthropic SDK usage and Claude agent patterns
9. **Check for tests**: Look for any test files, test configs, or testing frameworks

## Phase 2 — Generate CLAUDE.md (Root)

Create `CLAUDE.md` at the repository root. Follow these rules strictly:

- **Target: under 200 lines** — every line costs context tokens
- **Be concrete and verifiable** — "Use 2-space indentation" not "Format code nicely"
- **Include only what applies to ALL future work** — no ephemeral state
- **Use markdown headers** to organize sections
- **No emojis** unless the codebase already uses them

### Required Sections:

```
# idvize — IAM Orchestration & Governance Platform

## Project Overview
One-liner: what this project is, who it's for.

## Architecture
- Monorepo structure (frontend + backend)
- Module-per-feature pattern on the backend
- Key architectural decisions (in-memory data, mock adapters, etc.)
- How frontend talks to backend (API client pattern, ports, auth flow)

## Tech Stack
Exact versions for: Node, Express, React, Vite, TypeScript, Tailwind, and key libraries.

## Common Commands
Exact shell commands for:
- Install dependencies (both projects)
- Dev mode (both projects)
- Build (both projects)
- Lint / type-check (both projects)
- Run tests (when they exist)

## Code Style & Conventions
- TypeScript strict mode everywhere
- Module file naming pattern (e.g., `<module>.controller.ts`)
- Import conventions (path aliases, relative vs absolute)
- Frontend component patterns (functional components, Tailwind classes)
- Backend patterns (repository → service → controller layering)

## Authentication & Security
- How API key auth works
- How JWT auth works (algorithm, TTL, middleware)
- RBAC/ABAC pattern
- Demo credentials for local dev (reference, don't hardcode passwords)

## API Conventions
- Base URL, required headers
- Error response format
- Route mounting pattern

## Important Rules
- NEVER commit .env files or real credentials
- All platform adapters fall back to mock mode when credentials are absent
- Data is in-memory only — document any persistence assumptions
- Keep modules self-contained (controller + service + repository + types)
- When adding a new module, follow the existing module template pattern
- Frontend API calls go through the shared apiClient wrapper

## Known Limitations
Brief list of current constraints (no DB, no tests, mock-only adapters, etc.)
```

## Phase 3 — Generate `.claude/rules/` (Path-Scoped Rules)

Create the following scoped rule files. Each file should have YAML frontmatter with `paths:` to scope when it loads. Keep each file under 50 lines.

### `.claude/rules/backend-api.md`
```yaml
---
paths:
  - "idvize-api/src/**/*.ts"
---
```
Rules for backend development:
- Module structure conventions (controller/service/repository/types pattern)
- Express route registration pattern
- Middleware ordering
- Error handling pattern
- How to add a new API endpoint step-by-step
- TypeScript strict mode requirements

### `.claude/rules/frontend-react.md`
```yaml
---
paths:
  - "idvize/src/**/*.{ts,tsx}"
---
```
Rules for frontend development:
- React 19 patterns (functional components, hooks)
- Tailwind CSS conventions (dark theme classes, spacing scale)
- Routing pattern with React Router v7
- API client usage (`apiClient.ts`)
- Component file organization
- State management patterns (Context API)

### `.claude/rules/security-module.md`
```yaml
---
paths:
  - "idvize-api/src/modules/security/**/*.ts"
---
```
Rules specific to the security module:
- JWT token handling
- RBAC permission model
- Audit log immutability
- SCIM endpoint conventions
- Vault adapter pattern
- Credential lifecycle states

### `.claude/rules/testing.md`
```yaml
---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/*.test.tsx"
  - "**/*.spec.tsx"
---
```
Testing conventions (establish these now even though tests don't exist yet):
- Preferred test framework and runner
- Test file naming and co-location
- What to test: unit (services), integration (API endpoints), component (React)
- Mock patterns for in-memory repositories
- How to test AI/Claude integration points

### `.claude/rules/ai-agents.md`
```yaml
---
paths:
  - "idvize-api/src/agents/**/*.ts"
  - "idvize-api/src/services/claude*.ts"
---
```
Rules for AI agent development:
- Anthropic SDK usage patterns
- Tool definition conventions
- Graceful degradation when ANTHROPIC_API_KEY is absent
- Token budget awareness
- Error handling for AI calls

## Phase 4 — Generate `.claude/skills/` (Agentic Workflows)

Create task-specific skills that can be invoked during development. Each skill gets its own directory with a `SKILL.md` file.

### `.claude/skills/new-module/SKILL.md`
```yaml
---
name: new-module
description: Scaffold a new backend module following the idvize pattern
user-invocable: true
---
```
Skill body should instruct Claude to:
1. Create the module directory under `idvize-api/src/modules/<name>/`
2. Generate: `<name>.controller.ts`, `<name>.service.ts`, `<name>.repository.ts`, `<name>.types.ts`
3. Follow the exact patterns from existing modules (read `application` or `document` module as template)
4. Register routes in `idvize-api/src/index.ts`
5. Add appropriate middleware (apiKeyAuth, requireAuth, tenantContext)

### `.claude/skills/new-page/SKILL.md`
```yaml
---
name: new-page
description: Scaffold a new frontend page with routing and sidebar entry
user-invocable: true
---
```
Skill body should instruct Claude to:
1. Create page component in `idvize/src/pages/`
2. Add route in `App.tsx`
3. Add sidebar navigation entry
4. Wire up API client calls if the page needs backend data
5. Follow existing page patterns (Tailwind dark theme, Lucide icons, consistent layout)

### `.claude/skills/add-endpoint/SKILL.md`
```yaml
---
name: add-endpoint
description: Add a new API endpoint to an existing module
user-invocable: true
---
```
Skill body: read the target module's controller, add the endpoint following established patterns, update types if needed, add to route registration.

### `.claude/skills/add-adapter/SKILL.md`
```yaml
---
name: add-adapter
description: Add a new platform integration adapter (e.g., Ping Identity, OneLogin)
user-invocable: true
---
```
Skill body: follow the adapter pattern in `idvize-api/src/modules/integration/adapters/`, create adapter file, register in integration config, add mock fallback data.

### `.claude/skills/security-review/SKILL.md`
```yaml
---
name: security-review
description: Review code changes for security issues relevant to an IAM platform
user-invocable: true
allowed-tools: Read, Grep, Glob
---
```
Skill body: check for hardcoded secrets, SQL injection (future), XSS in React, improper auth checks, missing RBAC enforcement, audit log gaps, credential exposure.

### `.claude/skills/api-test/SKILL.md`
```yaml
---
name: api-test
description: Generate and run curl commands to test API endpoints
user-invocable: true
---
```
Skill body: authenticate via `/security/auth/token`, use the JWT to call target endpoints, validate response shapes, report results.

### `.claude/skills/debug-module/SKILL.md`
```yaml
---
name: debug-module
description: Diagnose issues in a backend module by tracing request flow
user-invocable: true
context: fork
---
```
Skill body: read the module's controller → service → repository chain, check middleware, trace data flow, identify the failure point.

## Phase 5 — Generate Subdirectory CLAUDE.md Files

### `idvize-api/CLAUDE.md`
Backend-specific instructions (under 100 lines):
- How to start the dev server
- Module structure quick reference
- How routes are mounted
- Middleware chain order
- Environment variables reference (names only, not values)

### `idvize/CLAUDE.md`
Frontend-specific instructions (under 100 lines):
- How to start the dev server
- Component organization
- Styling conventions (Tailwind dark theme)
- API client usage
- Path aliases

## Phase 6 — Verification

After generating all files:
1. List every file you created with its line count
2. Verify no file exceeds its target line count
3. Confirm the folder structure matches:
```
IAM-Platform/
├── CLAUDE.md                          # Root project instructions
├── idvize-api/
│   └── CLAUDE.md                      # Backend-specific instructions
├── idvize/
│   └── CLAUDE.md                      # Frontend-specific instructions
└── .claude/
    ├── rules/
    │   ├── backend-api.md             # Backend dev rules
    │   ├── frontend-react.md          # Frontend dev rules
    │   ├── security-module.md         # Security module rules
    │   ├── testing.md                 # Testing conventions
    │   └── ai-agents.md              # AI agent dev rules
    └── skills/
        ├── new-module/SKILL.md        # Scaffold backend module
        ├── new-page/SKILL.md          # Scaffold frontend page
        ├── add-endpoint/SKILL.md      # Add API endpoint
        ├── add-adapter/SKILL.md       # Add platform adapter
        ├── security-review/SKILL.md   # Security review
        ├── api-test/SKILL.md          # API endpoint testing
        └── debug-module/SKILL.md      # Module debugging
```
4. Read back the root `CLAUDE.md` and confirm it's under 200 lines and contains only concrete, actionable instructions

## Important Guidelines

- **Read before writing**: Always read existing files to match patterns exactly
- **No guessing**: If you're unsure about a convention, read 2-3 examples from the codebase first
- **Concrete over abstract**: Every instruction should be verifiable ("run `npm run dev`" not "start the server")
- **No duplication**: Don't repeat in rules what's already in CLAUDE.md
- **Skills reference code, not copy it**: Skills should tell Claude to read existing modules as templates, not embed code patterns that will go stale
- **Keep line counts tight**: Root CLAUDE.md < 200 lines, subdirectory CLAUDE.md < 100 lines, rules < 50 lines each
