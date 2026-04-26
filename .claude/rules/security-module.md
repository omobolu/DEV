---
paths:
  - "idvize-api/src/modules/security/**/*.ts"
---

# Security Module Rules

## Sub-module Structure
Security has nested sub-modules: `auth/`, `authz/`, `audit/`, `approval/`, `credentials/`, `vault/`, `scim/`, `masking/`, `secrets/`. Each follows the same controller/service/repository pattern.

## JWT Handling
- Algorithm: HS256, TTL: 8 hours
- Claims (`TokenClaims`): `sub`, `tenantId`, `name`, `roles`, `email`
- Issued via `authService.issueToken()`, verified via `authService.verifyToken()`
- Never log or expose JWT secrets

## RBAC Permissions
- 24 permission IDs defined in `security.types.ts` as `PermissionId` type
- Check via `requirePermission('permission.id')` middleware
- `authzService.check()` returns `{ allowed, reason, matchedPolicy }`
- Every check is audit-logged (both allow and deny)

## Audit Log
- Audit events are append-only — never delete or modify existing events
- Always include: `eventType`, `actorId`, `actorName`, `tenantId`, `timestamp`
- 25+ event types defined in `AuditEventType`
- Log via `auditService.log(event)`, query via `auditService.query()`

## Approval Workflow
- Requests auto-expire after 48 hours
- States: pending → approved/rejected/expired

## Credential Lifecycle
- States: active → rotating → rotated → revoked
- Rotation requires approval workflow
- Vault integration for secret storage

## SCIM 2.0
- Inbound provisioning at `/security/scim/v2/`
- Follow RFC 7644 response format
