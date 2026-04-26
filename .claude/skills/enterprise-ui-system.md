# Enterprise UI System (MASTER SKILL)

## Purpose

This skill defines how ALL UI must be built for the IAM Operating System.

This is a CISO-grade enterprise application.

---

## Mandatory Rule

All UI must follow:

- ui-system.md
- ux-principles.md
- iam-ui-patterns.md
- design-tokens.md
- component-standards.md

These are NOT optional.

---

## Product Context

This is NOT a dashboard tool.

This is an:

IAM Decision Engine

Every screen must answer:

"What should I fix first?"

Every tile must show:

"What the data is and the importance of the data"

---

## UI Priorities

1. Clarity over visuals
2. Data over decoration
3. Action over information

---

## Required UI Behavior

Every screen MUST:

- Show status (OK / ATTN / GAP)
- Show meaning (risk / impact)
- Show action (what to do next)

---

## Empty State Requirement

When no data exists:

- Show clear message
- Example:
  "No applications onboarded"
  "Start by adding your first application"

NEVER:
- blank screens
- broken layouts
- undefined values

---

## Data Presentation

Prefer:
- tables
- summary cards
- structured lists

Avoid:
- unnecessary charts
- decorative UI

---

## IAM-Specific Rules

Applications must show:
- criticality
- IAM controls
- gaps
- risk level

Controls must show:
- OK (green)
- ATTN (yellow)
- GAP (red)

---

## UX Behavior

- Every page must guide decision making
- Avoid unnecessary clicks
- Keep navigation shallow

---

## Enforcement

If a UI does NOT follow these rules:

It is considered INVALID

---

## Instruction to Claude

When building UI:

- Always apply this system
- Do not invent new patterns
- Do not ignore existing design rules