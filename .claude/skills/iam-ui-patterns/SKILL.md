---
name: iam-ui-patterns
description: Build IAM-specific enterprise UI such as identity dashboards, access reviews, entitlements, and governance views.
---

Use this skill when building IAM-related UI.

Core UI patterns:

### Identity List
- Table with:
  - name
  - email
  - lifecycle state
  - source system
  - last login
- Search + filters required
- Row click → detail view

### Identity Detail Page
- Sections:
  - profile info
  - accounts (AD, apps)
  - entitlements
  - roles
- Use tabs or cards

### Access Request UI
- Select application
- Select access/role
- Show approval flow preview
- Submit + confirmation

### Dashboard
- KPI cards:
  - orphan accounts
  - inactive users
  - access violations
- Charts:
  - bar (by app)
  - trend (over time)

Rules:
- No raw JSON dumps
- No unstructured lists
- Must be clean, readable, enterprise-grade

Before finishing:
- Ensure filtering works
- Ensure layout is scalable
- Ensure data hierarchy is clear

## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning