# idvize-api — Backend

## Quick Start

```bash
npm install
npm run dev     # nodemon + ts-node → http://localhost:3001
npm run build   # tsc → dist/
```

## Module Structure

Each module lives in `src/modules/<name>/` with:
- `<name>.controller.ts` — Express Router with route handlers
- `<name>.service.ts` — Business logic (calls repository)
- `<name>.repository.ts` — Data access layer (PostgreSQL for tenants/users/audit; in-memory Map for other modules), partitioned by tenantId
- `<name>.types.ts` — TypeScript interfaces and enums
- `<name>.seed.ts` (optional) — Demo data seeder

## Route Registration

Controllers export an Express Router. Routes are mounted in `src/index.ts`:
```
app.use('/applications', requireAuth, tenantContext, applicationController)
app.use('/security', securityController)  // security handles its own auth internally
app.use('/integrations', integrationController)  // API key only, no JWT
```

## Middleware Chain (order matters)

1. `helmet()` — security headers
2. `cors()` — whitelist: localhost:5173, 5174, 4173, 3000
3. `express.json({ limit: '10mb' })` — body parser
4. `morgan('dev')` — request logging
5. Request correlation ID (X-Request-ID)
6. `apiKeyAuth` — validates X-Api-Key header (bypasses for Bearer-auth routes)
7. Per-route: `requireAuth` → `tenantContext` → `requirePermission(id)`

## Environment Variables

| Variable | Purpose |
|----------|---------|
| PORT | Server port (default: 3001) |
| NODE_ENV | Environment (default: development) |
| API_KEY | Static API key for dev |
| JWT_SIGNING_SECRET | JWT signing secret (REQUIRED in production — no dev default) |
| ANTHROPIC_API_KEY | Claude API (optional — AI features degrade gracefully) |
| ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET | Entra ID (optional) |
| SAILPOINT_BASE_URL, SAILPOINT_CLIENT_ID, SAILPOINT_CLIENT_SECRET | SailPoint (optional) |
| CYBERARK_BASE_URL, CYBERARK_USERNAME, CYBERARK_PASSWORD | CyberArk (optional) |
| DATABASE_URL | PostgreSQL connection string (required) |
| SEED_MODE | Data initialization: production (default, empty), demo, development |

## Key Patterns

- Repositories: PostgreSQL + in-memory Map cache for tenants/users/audit; `Map<tenantId, Map<entityId, Entity>>` for other modules — always scope by tenant
- Seed data: controlled by SEED_MODE env var; production starts empty, demo/development loads ACME + Globex
- Error handler: `src/middleware/errorHandler.ts` — catches all unhandled errors
- AI agents: `src/agents/` — use `claude.service.ts` for tool-use loops
- Connectors: `src/connectors/` — extend `BaseConnector`, check `isConfigured` before live calls
- Health check: `GET /health` — returns version, uptime, module statuses
