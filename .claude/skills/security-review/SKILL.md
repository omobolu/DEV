---
name: security-review
description: Review code changes for security issues relevant to an IAM platform
user-invocable: true
allowed-tools: Read, Grep, Glob
---

# Security Review

Perform a security review of recent code changes or specified files. Check for:

## Credential & Secret Exposure
- Grep for hardcoded passwords, API keys, JWT secrets, or tokens in source files
- Check that `.env` files are in `.gitignore`
- Verify no secrets in `console.log` or error messages

## Authentication & Authorization
- Verify all new routes have appropriate middleware (`requireAuth`, `tenantContext`, `requirePermission`)
- Check that `requirePermission()` uses the correct permission ID from `security.types.ts`
- Verify JWT token validation is not bypassed

## Multi-Tenant Isolation
- Check all repository queries filter by `tenantId`
- Verify no cross-tenant data leakage in service methods
- Check that `tenantContext` middleware is applied to tenant-scoped routes

## Input Validation
- Check for unvalidated user input passed to queries or operations
- Verify CSV/JSON import sanitizes input
- Check for potential injection in string interpolation

## Audit Trail
- Verify security-sensitive operations log audit events
- Check that authz allow/deny decisions are logged
- Verify audit events include actorId, tenantId, timestamp

## Frontend Security
- Check for `dangerouslySetInnerHTML` usage
- Verify no sensitive data stored in localStorage beyond auth tokens
- Check that 401 responses trigger proper logout/redirect

## Report
Summarize findings as: CRITICAL / HIGH / MEDIUM / LOW with file paths and line numbers.

## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning
