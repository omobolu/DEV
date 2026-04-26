---
paths:
  - "idvize-api/src/**/*.ts"
---

# Backend Development Rules

## Module Structure
Every module directory contains exactly: `<name>.controller.ts`, `<name>.service.ts`, `<name>.repository.ts`, `<name>.types.ts`. Optional: `<name>.seed.ts`, `engines/`, `parsers/`.

## Adding a New Endpoint
1. Define types in `<module>.types.ts`
2. Add repository method if new data access is needed
3. Add service method with business logic
4. Add route handler in controller with appropriate middleware
5. Mount in `src/index.ts` if it's a new module

## Route Registration Pattern
```typescript
const router = Router();
router.get('/', async (req, res) => { ... });
export { router as myController };
```
Mount in `index.ts`: `app.use('/prefix', requireAuth, tenantContext, myController)`

## Middleware Ordering (per route)
`requireAuth` → `tenantContext` → `requirePermission('permission.id')` → handler

## Error Handling
- Throw errors in services; the global `errorHandler` middleware catches them
- Return `{ error: "message" }` with appropriate status codes (400, 401, 403, 404, 500)
- Never expose stack traces in production

## Repository Pattern
- Store: `Map<tenantId, Map<entityId, Entity>>`
- Always filter by `tenantId` — never return cross-tenant data
- Export singleton: `export const fooRepository = new FooRepository()`

## TypeScript
- Strict mode enforced — no `any` unless absolutely necessary
- Define all interfaces in `*.types.ts` files
- Use enums or string unions for finite sets (statuses, roles, tiers)
