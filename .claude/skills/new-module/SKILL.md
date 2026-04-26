---
name: new-module
description: Scaffold a new backend module following the idvize pattern
user-invocable: true
---

# Scaffold a New Backend Module

When the user asks to create a new backend module, follow these steps:

1. **Ask** for the module name if not provided (e.g., "compliance", "workflow")

2. **Read templates** — Read these files to match the exact patterns:
   - `idvize-api/src/modules/document/document.controller.ts`
   - `idvize-api/src/modules/document/document.service.ts`
   - `idvize-api/src/modules/document/document.repository.ts`
   - `idvize-api/src/modules/document/document.types.ts`

3. **Create module directory**: `idvize-api/src/modules/<name>/`

4. **Generate four files** following the template patterns:
   - `<name>.types.ts` — Define interfaces, enums, and type aliases
   - `<name>.repository.ts` — In-memory Map store partitioned by tenantId, export singleton
   - `<name>.service.ts` — Business logic calling the repository, export singleton
   - `<name>.controller.ts` — Express Router with route handlers, apply `requireAuth`, `tenantContext`

5. **Register routes** in `idvize-api/src/index.ts`:
   - Import the controller
   - Mount: `app.use('/<name>', requireAuth, tenantContext, <name>Controller)`

6. **Optionally create** `<name>.seed.ts` if the module needs demo data

7. **Verify** the module follows multi-tenant patterns (all repository methods accept/filter by tenantId)

## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning
