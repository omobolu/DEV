/**
 * Claude AI Service
 *
 * Shared service that wraps the Anthropic SDK for use by agents throughout
 * the platform. Uses claude-opus-4-6 with adaptive thinking for deep analysis.
 *
 * All agent callers should go through this service rather than instantiating
 * their own Anthropic clients.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';

const apiKey = process.env.ANTHROPIC_API_KEY;

// Lazy-initialise so missing key only errors on first call, not startup
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add it to .env to enable AI analysis.'
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export interface ClaudeAnalysisResult {
  narrative: string;
  thinking?: string;
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
}

/**
 * Run a tool-use conversation with Claude.
 *
 * Executes a full agentic loop: Claude calls tools to fetch data it needs,
 * you supply the tool implementations, and the loop runs until Claude
 * produces a final text response.
 *
 * @param systemPrompt  System instructions for the analysis persona
 * @param userPrompt    The question / analysis request
 * @param tools         Tool definitions Claude can invoke
 * @param toolHandlers  Map of tool name → async function that executes the tool
 */
export async function runClaudeAnalysis(
  systemPrompt: string,
  userPrompt: string,
  tools: Tool[],
  toolHandlers: Record<string, (input: Record<string, unknown>) => unknown>,
): Promise<ClaudeAnalysisResult> {
  const client = getClient();

  const messages: MessageParam[] = [{ role: 'user', content: userPrompt }];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let thinkingText = '';
  let finalNarrative = '';
  const MAX_ITERATIONS = 10;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      tools,
      messages,
    });

    const response = await stream.finalMessage();

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Collect thinking blocks from this iteration
    for (const block of response.content) {
      if (block.type === 'thinking') {
        thinkingText += block.thinking + '\n';
      }
    }

    if (response.stop_reason === 'end_turn') {
      // Extract final text
      for (const block of response.content) {
        if (block.type === 'text') {
          finalNarrative += block.text;
        }
      }
      break;
    }

    if (response.stop_reason === 'tool_use') {
      // Append assistant message to history
      messages.push({ role: 'assistant', content: response.content });

      // Execute each tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const handler = toolHandlers[block.name];
          let result: unknown;
          if (handler) {
            try {
              result = await handler(block.input as Record<string, unknown>);
            } catch (err) {
              result = { error: String(err) };
            }
          } else {
            result = { error: `Unknown tool: ${block.name}` };
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // pause_turn or unexpected stop — re-send to continue
    messages.push({ role: 'assistant', content: response.content });
  }

  return {
    narrative: finalNarrative || 'No narrative generated.',
    thinking: thinkingText || undefined,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    modelUsed: 'claude-opus-4-6',
  };
}

/**
 * Simple single-shot analysis (no tool use).
 * Good for shorter summaries where all data can be supplied in the prompt.
 */
export async function runSimpleAnalysis(
  systemPrompt: string,
  userPrompt: string,
): Promise<ClaudeAnalysisResult> {
  const client = getClient();

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const response = await stream.finalMessage();

  let thinkingText = '';
  let narrative = '';
  for (const block of response.content) {
    if (block.type === 'thinking') thinkingText += block.thinking + '\n';
    if (block.type === 'text') narrative += block.text;
  }

  return {
    narrative: narrative || 'No narrative generated.',
    thinking: thinkingText || undefined,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    modelUsed: 'claude-opus-4-6',
  };
}
