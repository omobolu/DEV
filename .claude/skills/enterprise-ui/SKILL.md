---
name: enterprise-ui
description: Build enterprise-grade, customer-facing UI with responsive layouts, accessibility, polished states, and production-ready structure.
---

Use this skill when working on frontend UI, dashboards, forms, or customer-facing pages.

Rules:
- UI must be production-grade (no demo UI)
- Must include:
  - loading states
  - error states
  - empty states
  - success states
- Must be responsive (desktop + mobile)
- Must be accessible (labels, keyboard nav, contrast)
- Avoid hardcoded placeholder UI

Approach:
1. Inspect existing components first
2. Reuse patterns before creating new ones
3. Keep layout clean and consistent
4. Ensure forms have validation and feedback

Before finishing:
- Check responsiveness
- Check accessibility
- Check UI consistency

## Design Philosophy

- Clean, minimal, professional
- Built for CISO, IAM Director, Security Teams
- Data-driven, not decorative
- Prioritize clarity over visuals

---

## Layout

- Use consistent spacing (8px grid)
- Use card-based layout for all data views
- Use left navigation + top header
- Avoid clutter

---

## Typography

- Clear hierarchy:
  - Title
  - Section
  - Label
  - Value
- Avoid excessive font sizes
- Use consistent weight and spacing

---

## Colors

- Neutral base (white, gray)
- Accent colors for meaning:
  - Green = OK
  - Yellow = Attention
  - Red = Risk
  - Blue = Info

---

## Data Presentation

- Always prioritize:
  - tables
  - summaries
  - clear metrics
- Avoid unnecessary charts

---

## Empty States

When no data:
- Show:
  "No applications onboarded"
  "Get started by adding your first application"

Never show:
- broken UI
- blank screens


## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning