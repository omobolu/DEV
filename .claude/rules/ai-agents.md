---
paths:
  - "idvize-api/src/agents/**/*.ts"
  - "idvize-api/src/services/claude*.ts"
---

# AI Agent Development Rules

## Anthropic SDK Usage
- Import: `import Anthropic from '@anthropic-ai/sdk'`
- Model: `claude-opus-4-6` (default in `claude.service.ts`)
- Max tokens: 8192
- Thinking: `{ type: 'adaptive' }` for complex analysis

## Tool-Use Pattern
Use `claude.service.ts` `runClaudeAnalysis()` for agentic loops:
- Define tools as Anthropic tool schemas
- Provide `toolHandlers: Record<string, (input) => Promise<string>>`
- Max 10 iterations per invocation
- Returns `{ narrative, thinking?, inputTokens, outputTokens, modelUsed }`

## Graceful Degradation
- Always check `process.env.ANTHROPIC_API_KEY` before attempting AI calls
- Every AI endpoint must have a deterministic (non-AI) fallback
- Pattern: `POST /module/analyze` (deterministic) + `POST /module/analyze/ai` (Claude-powered)

## Agent Structure
- Extend or follow patterns in `cost-intelligence.agent.ts` or `security-governance.agent.ts`
- `run(tenantId)` — deterministic analysis, always works
- `runWithAI(tenantId)` — Claude-enhanced, requires API key
- Export as singleton: `export const myAgent = new MyAgent()`

## Error Handling
- Catch Anthropic SDK errors separately from business logic errors
- Log token usage for cost monitoring
- Never expose raw AI responses to the client without sanitization

## Token Budget
- Keep system prompts concise — every token costs money
- Use tool-use instead of stuffing data into prompts
- Cap iterations to prevent runaway loops (max 10)
