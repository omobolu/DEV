---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/*.test.tsx"
  - "**/*.spec.tsx"
---

# Testing Conventions

No test framework is installed yet. When adding tests, follow these conventions.

## Framework
- Backend: Vitest (compatible with TypeScript, fast, ESM-friendly)
- Frontend: Vitest + React Testing Library
- Config: `vitest.config.ts` in each project root

## File Naming & Location
- Co-locate tests: `<name>.test.ts` next to `<name>.ts`
- Frontend components: `<Component>.test.tsx` next to `<Component>.tsx`

## What to Test
- **Unit (services)**: Business logic in `*.service.ts` — mock the repository
- **Integration (API)**: HTTP endpoints via supertest — use real in-memory repositories
- **Component (React)**: Render + interaction via React Testing Library
- **AI agents**: Mock `claude.service.ts` responses — never call real Anthropic API in tests

## Repository Mocking
- Repositories are singletons with simple Map storage
- Reset between tests: call `repository.clear()` or create fresh instances
- No database to set up/tear down — in-memory Maps reset naturally

## Multi-Tenant Testing
- Always test with explicit `tenantId` — verify cross-tenant isolation
- Use seed functions from `*.seed.ts` to populate test data

## Assertions
- Prefer `expect(result).toEqual(expected)` for object comparison
- Check both success and error paths
- Verify audit events are logged for security-sensitive operations
