# Testing idvize IAM Platform

End-to-end testing guide for the idvize IAM OS platform.

## Environment Setup

### Start Backend + Frontend

```bash
# Backend (port 3001)
cd idvize-api && npm install && npm run dev

# Frontend (port 5173)
cd idvize && npm install && npm run dev
```

Backend requires PostgreSQL running on localhost:5432. Check startup logs for:
- `PostgreSQL: connected`
- `Application seed loaded — 50 apps for ten-acme`
- `Application seed loaded — 30 apps for ten-globex`

If PG is unavailable, risk endpoints return 503 (fail-closed behavior).

### PostgreSQL Access

```bash
PGPASSWORD=idvize_dev_2026 psql -h localhost -U idvize -d idvize
```

Or use pgweb (web GUI):
```bash
pgweb --host localhost --port 5432 --user idvize --pass idvize_dev_2026 --db idvize --bind 0.0.0.0 --listen 8085
```

## Devin Secrets Needed

No external secrets required for local testing. All credentials below are dev-only defaults.

## Auth Credentials (Dev/Demo Mode)

| User | Password | Tenant | Role |
|------|----------|--------|------|
| admin@acme.com | password123 | ACME Financial Services | Manager |
| admin@globex.io | password123 | Globex Technologies | Manager |
| platform@idvize.io | password123 | ACME (PlatformAdmin) | PlatformAdmin |
| admin@newco-ind.com | password123 | NewCo Industries | Manager |

API key for all requests: `dev-api-key-change-me` (header: `x-api-key`)

## Test Data Reference

| Tenant | Apps | Tables |
|--------|------|--------|
| ACME (ten-acme) | 50 apps (APP-001 to APP-050) | applications, control_assessments |
| Globex (ten-globex) | 30 apps (GLX-001 to GLX-030) | applications, control_assessments |

Each app has 49 control assessments (AM, IGA, PAM, CIAM pillars).

### Useful Test Apps

- **APP-034 (BambooHR)**: CRITICAL risk, 9 GAP / 40 ATTN / 0 OK — good for testing GAP controls and remediation actions
- **APP-001 (SAP Finance)**: MEDIUM risk, 0 GAP / 30 ATTN / 19 OK — good for testing OK controls ("Control Passing" state)
- **GLX-028 (Calendly)**: Globex tenant, CRITICAL risk — good for tenant isolation testing

## Multi-Tenant Testing Pattern

1. Sign in as ACME (admin@acme.com) → verify ACME data (50 apps)
2. Sign out → sign in as Globex (admin@globex.io) → verify Globex data (30 apps, different app names)
3. Verify no ACME data visible in Globex session and vice versa
4. For API testing, use separate JWT tokens per tenant

### API Token Retrieval

```bash
TOKEN=$(curl -s http://localhost:3001/security/auth/token \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key-change-me" \
  -d '{"username":"admin@acme.com","password":"password123"}' \
  | jq -r '.data.token.access_token')
```

## Key Test Scenarios

### Risk Engine (GET /os/risks)
- Portfolio view: ACME returns 50 apps, Globex returns 30
- Level filter: `?level=CRITICAL` returns only CRITICAL apps
- Single app: `GET /os/risks/:appId` returns one app's risk data
- Cross-tenant: ACME token + Globex appId → 404
- SQL injection: `GET /os/risks/app-123' OR '1'='1` → 404, no SQL error
- No auth: Request without token → 401
- PG down: Stop PostgreSQL → 503

### Control Detail View (/risks/:appId/controls)
- Drill-down: Click app row in TopRisks → navigates to controls page
- KPI tiles: Total/GAP/ATTN/OK counts match actual table rows
- Filters: GAP/ATTN/OK buttons reduce table to matching rows
- Search: Filters by control name, ID, category, or pillar
- Sort: Outcome (GAP first), Pillar, Control ID, Risk Reduction
- GAP drawer: Click GAP row → slide-out drawer with numbered "Recommended Actions" in red box
- OK drawer: Click OK row → drawer shows green "Control Passing" with no remediation
- Escape: Press Escape → drawer closes, filter/search state preserved
- Back button: "Back to Top IAM Risks" → navigates to /risks

## Known Automation Quirks

- **Row click navigation issue**: When using browser automation tools, clicking table rows on the Control Detail View page may occasionally trigger unwanted page navigation instead of opening the detail drawer. This might be caused by event timing or element replacement during React render cycles. Workaround: use JavaScript `document.querySelector('tbody tr').click()` via browser console instead of native click automation.
- **Offscreen elements**: The Control Detail View page is long. After filtering or scrolling, elements like the "Back to Top IAM Risks" button may be offscreen. Scroll up before interacting.
- **PG pool reconnect**: After stopping and restarting PostgreSQL, the backend PG pool may take 1-2 seconds to reconnect. Wait briefly before retesting after PG restart.

## Build Verification

```bash
# Backend
cd idvize-api && npm run build

# Frontend  
cd idvize && npm run build

# Backend audit
cd idvize-api && npm audit --omit=dev --audit-level=high
```
