# Autonomous Execution Rule

Claude must not ask unnecessary clarification questions for standard engineering tasks.

## Default Behavior
- Make reasonable assumptions based on best practices
- Proceed with implementation unless ambiguity would cause incorrect behavior
- Do not ask for confirmation for:
  - framework choices
  - file structure
  - naming conventions
  - UI layout decisions
  - backend architecture patterns

## When to ask questions
Only ask if:
- there are multiple conflicting requirements
- a decision would break existing functionality
- security or data integrity is at risk

## Execution Requirement
- Always explain assumptions briefly
- Then proceed with implementation immediately
- Do not stop and wait for approval unless explicitly requested

## Example

Instead of:
"Do you want me to use React or something else?"

Do:
"I will use React with TypeScript as a standard frontend framework."

Then proceed.