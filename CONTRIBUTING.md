# Contribution Guidelines

## AI Developer Attribution (REQUIRED)

All feature branches and pull requests MUST indicate which AI system generated the work.

### Required AI Developers
- Devin.ai (Execution / Full-stack)
- Claude.ai (UI / Feature Development)
- Codex (Code Review / Optimization)

### Branch Naming Requirement (Updated)

feature/<feature-name>-<ai>-YYYYMMDD-HHMM

Examples:
- feature/top-iam-risks-devin-20260425-1700
- feature/ui-risk-dashboard-claude-20260425-1715
- feature/api-optimization-codex-20260425-1730

### Rules
- Must include AI name in branch
- Must include timestamp
- Must use lowercase
- No spaces allowed

---

### Purpose

This ensures:
- Traceability of AI-generated code
- Ability to evaluate AI performance
- Clear ownership of features



---

## Pull Request Requirements

All changes MUST be submitted via Pull Request.

Each PR must include:
- Feature description
- AI that developed it
- Problem statement
- Solution overview
- Screenshots (if UI)
- Acceptance criteria

---

## Development Principles

All features must support:

Detect → Prioritize → Fix

We are building an IAM Operating System for CISOs.

---

## Restrictions

- Do NOT commit directly to main or develop
- Do NOT create branches without timestamp
- Do NOT bypass PR process