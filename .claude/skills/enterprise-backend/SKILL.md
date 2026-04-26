---
name: enterprise-backend
description: Build production-grade server backends with modular architecture, validation, security, error handling, and clean API design.
---

Use this skill for backend and API work.

Standards:
- Use modular server-side architecture
- Separate routes/controllers, services, and data access
- Validate all inputs at the API boundary
- Use centralized error handling
- Use structured logging
- Avoid hardcoded secrets or environment values
- Keep business logic out of route handlers
- Use clear API contracts and response models

Implementation approach:
1. Inspect existing backend module structure first
2. Add endpoints using existing patterns
3. Keep handlers thin and services focused
4. Use DTOs/schemas for validation
5. Add useful error messages without exposing internals

Before finishing:
- Check validation
- Check error handling
- Check auth/security impact
- Summarize changed endpoints and backend risks

## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning