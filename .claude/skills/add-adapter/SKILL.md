---
name: add-adapter
description: Add a new platform integration adapter (e.g., Ping Identity, OneLogin)
user-invocable: true
---

# Add a New Platform Adapter

When the user asks to add support for a new IAM platform:

1. **Ask** for the platform name if not provided (e.g., "Ping Identity", "OneLogin", "ForgeRock")

2. **Read existing adapters** to match the pattern:
   - `idvize-api/src/modules/integration/adapters/` — all existing adapter files
   - `idvize-api/src/modules/integration/integration.controller.ts` — route registration
   - `idvize-api/src/connectors/base.ts` — BaseConnector abstract class
   - `idvize-api/src/connectors/entra.ts` — example connector implementation

3. **Create the connector** at `idvize-api/src/connectors/<platform>.ts`:
   - Extend `BaseConnector`
   - Check env vars for credentials in `isConfigured`
   - Implement `health()` check
   - Return mock data when not configured

4. **Create the adapter** at `idvize-api/src/modules/integration/adapters/<platform>.adapter.ts`:
   - Follow the adapter interface pattern from existing adapters
   - Implement platform-specific API calls
   - Include mock fallback data with realistic structure

5. **Register** the adapter:
   - Add platform key to `PlatformKey` type in `integration.types.ts`
   - Add env var references to `idvize-api/.env`
   - Add routes in `integration.controller.ts` for the new platform
   - Add to health check in `src/index.ts` if needed

6. **Add mock data** that represents realistic responses from the platform

## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning
