# Testing idvize E2E

End-to-end testing procedures for the idvize IAM platform.

## Environment Setup

1. Ensure PostgreSQL is running: `sudo systemctl status postgresql`
2. Start backend: `cd idvize-api && SEED_MODE=development npm run dev` (port 3001)
3. Start frontend: `cd idvize && npm run dev` (port 5173)
4. Wait for backend to finish seeding — look for `[Seed]` log messages confirming tenant/app/control data loaded

## Devin Secrets Needed

None required for local dev/demo testing. Demo credentials are built into the seed data.

## Demo Credentials

- **ACME tenant**: `admin@acme.com` / `password123`
- **Globex tenant**: `admin@globex.io` / `password123`
- **API key**: `dev-api-key-change-me` (x-api-key header)

## Authentication for Shell Tests

Get a JWT token via:
```bash
TOKEN=$(curl -s http://localhost:3001/security/auth/token \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: dev-api-key-change-me' \
  -d '{"username": "admin@acme.com", "password": "password123"}' \
  | jq -r '.data.token.access_token')
```

Note: The auth response structure is `{ data: { token: { access_token: "..." } } }` — not a top-level `token` field.

## API Endpoints

All protected endpoints require both `x-api-key` and `Authorization: Bearer <token>` headers.

Key test endpoints:
- `GET /os/risks` — portfolio risk summary (tenant-scoped)
- `GET /os/risks/:appId` — single app risk detail
- `GET /os/risks?level=HIGH` — filtered by risk level

## Multi-Tenant Testing Pattern

1. Get tokens for both tenants (ACME and Globex)
2. Verify each tenant sees only their own data:
   - ACME: 50 apps, tenantId='ten-acme'
   - Globex: 30 apps, tenantId='ten-globex'
3. Cross-tenant access test: use ACME token to request a Globex app ID → expect 404
4. No auth test: request without token → expect 401
5. SQL injection test: request with `app-123' OR '1'='1` as appId → expect 404, no SQL error

## PG Fail-Closed Testing

To test production fail-closed behavior:
```bash
# Stop PostgreSQL
sudo systemctl stop postgresql

# Expect 503
curl -s http://localhost:3001/os/risks \
  -H 'x-api-key: dev-api-key-change-me' \
  -H "Authorization: Bearer $TOKEN"
# Should return: {"success":false,"error":"Risk data temporarily unavailable"}

# Restart PostgreSQL
sudo systemctl start postgresql

# Verify recovery — may need to wait a few seconds for pool reconnect
curl -s http://localhost:3001/os/risks \
  -H 'x-api-key: dev-api-key-change-me' \
  -H "Authorization: Bearer $TOKEN"
# Should return 200 with data
```

## Browser Testing Tips

- The app is dark-mode only — screenshots will have dark backgrounds
- Login page is at the root URL; after login, app redirects to `/os` (Control Panel)
- Sidebar navigation: "Top IAM Risks" is under the "Intelligence" section
- After signing out, the browser stays on the current URL but shows the login form
- Filter buttons on the risks page show counts (e.g., `CRITICAL44`) — clicking them filters the table
- The header shows the tenant name (e.g., "ACME Financial Services" or "Globex Technologies") which is useful for verifying which tenant is logged in

## Risk Classification Reference

| Risk Level | Criteria |
|-----------|----------|
| CRITICAL | gapCount >= 3 |
| HIGH | gapCount >= 2 OR (gapCount == 1 AND attentionCount >= 2) |
| MEDIUM | gapCount == 1 (with < 2 ATTN) OR attentionCount > 0 (no gaps) |
| LOW | all controls OK |

## Common Issues

- **Token extraction**: The JWT is nested at `.data.token.access_token` in the auth response, not `.token`
- **PG pool reconnect**: After restarting PostgreSQL, the connection pool may need a few seconds to reconnect. If the first request after restart fails with 503, wait 2-3 seconds and retry.
- **Seed data timing**: The backend seeds data on startup. If you restart the backend, wait for seed completion before testing.
- **Frontend HMR**: The frontend uses Vite HMR. If you modify frontend files, the browser auto-reloads without needing to restart the dev server.
