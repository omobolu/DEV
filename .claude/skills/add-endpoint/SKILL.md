---
name: add-endpoint
description: Add a new API endpoint to an existing module
user-invocable: true
---

# Add a New API Endpoint

When the user asks to add an endpoint to an existing module:

1. **Identify the target module** from the user's request

2. **Read the existing module files**:
   - `idvize-api/src/modules/<module>/<module>.controller.ts` — existing routes
   - `idvize-api/src/modules/<module>/<module>.service.ts` — existing services
   - `idvize-api/src/modules/<module>/<module>.types.ts` — existing types
   - `idvize-api/src/modules/<module>/<module>.repository.ts` — existing data access

3. **Add types** in `<module>.types.ts` if the endpoint needs new interfaces

4. **Add repository method** if the endpoint needs new data access patterns

5. **Add service method** with the business logic

6. **Add route handler** in the controller:
   - Follow the existing HTTP method + path conventions
   - Apply `requirePermission()` if the endpoint needs authorization
   - Return `{ success: true, data: ... }` on success
   - Return `{ error: "message" }` with appropriate status on failure

7. **Verify** the endpoint handles tenantId correctly (from `req.tenantId`)


## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning
