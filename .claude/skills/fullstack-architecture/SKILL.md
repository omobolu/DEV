---
name: fullstack-architecture
description: Design and implement enterprise-grade web frontend and server backend applications with clean separation of concerns.
---

Use this skill when the task spans frontend and backend.

Architecture principles:
- Frontend and backend must have clear boundaries
- API contracts must be explicit
- Authentication and authorization must be designed first
- UI state should align with backend responses
- Shared business concepts should be modeled consistently
- Favor maintainability over shortcuts

Required layers:
- frontend pages/components
- API routes/controllers
- service layer
- validation layer
- config/environment layer
- logging/error handling layer

Before implementation:
1. Define the user flow
2. Define the backend endpoints required
3. Define request/response shapes
4. Define validation and error cases
5. Define frontend states for success/failure/loading

Before finishing:
- Confirm frontend/backend contract alignment
- Confirm security considerations
- Confirm scalability and maintainability

## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning