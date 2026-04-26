---
name: debug-module
description: Diagnose issues in a backend module by tracing request flow
user-invocable: true
context: fork
---

# Debug a Backend Module

When the user reports an issue with a module, trace the full request lifecycle:

1. **Identify the failing endpoint** from the user's description (URL, HTTP method, error message)

2. **Trace the middleware chain** — Read these files in order:
   - `idvize-api/src/middleware/apiKey.ts` — Is the route bypassed or checked?
   - `idvize-api/src/middleware/requireAuth.ts` — Is the JWT valid and decoded?
   - `idvize-api/src/middleware/tenantContext.ts` — Is the tenant valid?
   - `idvize-api/src/middleware/requirePermission.ts` — Does the user have the required permission?

3. **Read the controller** — `idvize-api/src/modules/<module>/<module>.controller.ts`
   - Find the exact route handler
   - Check middleware applied to this specific route
   - Check request parameter extraction (params, query, body)

4. **Read the service** — `idvize-api/src/modules/<module>/<module>.service.ts`
   - Trace the business logic
   - Check for error conditions, validation, or missing data

5. **Read the repository** — `idvize-api/src/modules/<module>/<module>.repository.ts`
   - Check data storage/retrieval logic
   - Verify tenant isolation
   - Check if data was seeded (look for `*.seed.ts`)

6. **Check types** — `idvize-api/src/modules/<module>/<module>.types.ts`
   - Verify request/response shapes match expectations

7. **Check route mounting** — `idvize-api/src/index.ts`
   - Verify the module is mounted at the expected path
   - Verify middleware ordering

8. **Report** the diagnosis:
   - Where the failure occurs (middleware, controller, service, or repository)
   - Root cause
   - Suggested fix

## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning
