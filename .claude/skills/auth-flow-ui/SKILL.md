---
name: auth-flow-ui
description: Build production-grade authentication flows including login, MFA, registration, and account recovery aligned with CIAM best practices.
---

Use this skill when building authentication UI.

Flows to support:

### Login
- Email/username input
- Password input
- Show/hide password
- Error handling (invalid credentials)

### MFA
- OTP input (6-digit)
- Resend code
- Timeout handling

### Registration
- Progressive profiling (step-by-step)
- Validation per step
- Clear progress indicator

### Password Reset
- Email input
- Verification step
- New password with validation

Rules:
- Never expose sensitive errors
- Always show user-friendly messages
- Must handle edge cases:
  - expired session
  - invalid token
  - retry flows

UX Requirements:
- Clean centered layout
- Clear CTA buttons
- Minimal friction

Before finishing:
- Validate all flows
- Ensure error states exist
- Ensure accessibility basics

## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning