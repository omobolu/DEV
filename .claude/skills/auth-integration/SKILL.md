---
name: auth-integration
description: Implement secure authentication and authorization patterns for web frontend and backend applications.
---

Use this skill when working on sign-in, sign-out, token handling, session logic, role-based access, MFA flows, or identity integration.

Standards:
- Never expose secrets in code
- Validate tokens and auth state carefully
- Keep sensitive auth logic on the server where appropriate
- Provide friendly but safe error messages
- Handle expired sessions, invalid tokens, and unauthorized access
- Align frontend auth states with backend authorization behavior

Required considerations:
- login flow
- logout flow
- session/token lifecycle
- protected routes/pages
- protected APIs
- role/permission checks
- MFA and recovery flows when applicable

Before finishing:
- Check auth edge cases
- Check unauthorized handling
- Check secure configuration usage

## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning