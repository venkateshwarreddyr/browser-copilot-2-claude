/**
 * Agent loop — streams LLM responses, executes tool calls, manages conversation history.
 * Stateless module: all mutable state is passed in via the `ctx` object.
 */

import { streamChat } from './api.js';
import { pruneTools } from './tools.js';
import { buildSystemPrompt } from './prompt.js';

// ── Cache helpers ────────────────────────────────────────────────────

/** Add cache_control breakpoint to the last item in an array. */
export function withCacheBreakpoint(arr) {
  if (!arr || arr.length === 0) return arr;
  const copy = arr.map(item => ({ ...item }));
  copy[copy.length - 1] = { ...copy[copy.length - 1], cache_control: { type: 'ephemeral' } };
  return copy;
}

/** Add cache_control to the last content block of the last user message. */
export function withMessageCacheBreakpoint(msgs) {
  if (!msgs || msgs.length === 0) return msgs;
  const copy = msgs.map(m => ({ ...m }));
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i].role === 'user' && Array.isArray(copy[i].content)) {
      const content = copy[i].content.map(b => ({ ...b }));
      if (content.length > 0) {
        content[content.length - 1] = { ...content[content.length - 1], cache_control: { type: 'ephemeral' } };
      }
      copy[i] = { ...copy[i], content };
      break;
    }
  }
  return copy;
}

// ── Tool result formatting ───────────────────────────────────────────

function formatToolResult(toolCallId, result) {
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
  if (resultStr.startsWith('data:image/')) {
    const match = resultStr.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (match) {
      return {
        type: 'tool_result',
        tool_use_id: toolCallId,
        content: [
          { type: 'text', text: `Successfully captured screenshot (${match[1]})` },
          { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } },
        ],
      };
    }
  }
  return {
    type: 'tool_result',
    tool_use_id: toolCallId,
    content: [{ type: 'text', text: resultStr }],
  };
}

// ── Tool execution ───────────────────────────────────────────────────

async function executeTool(toolCall, settings, ctx) {
  if (toolCall.name === 'turn_answer_start') {
    return 'Proceed with your response.';
  }

  if (toolCall.name === 'update_plan') {
    if (settings.autoApprovePlans) {
      const plan = toolCall.input || { approach: [] };
      ctx.addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `Auto-approved plan for domains: ${(toolCall.input?.domains || []).join(', ') || 'N/A'}`,
      });
      return `User has approved your plan. You can now start executing the plan.\n\nPlan steps:\n${(plan.approach || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nStart by using the TodoWrite tool to track your progress through these steps.`;
    }
    return ctx.handlePlanApproval(toolCall.input);
  }

  const result = await chrome.runtime.sendMessage({
    type: 'EXECUTE_TOOL',
    toolName: toolCall.name,
    toolInput: toolCall.input,
  });

  if (typeof result === 'object' && result?.error) return `Error: ${result.error}`;
  if (typeof result === 'object') return JSON.stringify(result);
  return result;
}

// ── Main agent loop ──────────────────────────────────────────────────

/**
 * @param {object} ctx - Mutable context bag provided by the chat orchestrator
 * @param {() => Array} ctx.getConversationHistory
 * @param {(history: Array) => void} ctx.setConversationHistory
 * @param {(msg: object) => void} ctx.addMessage
 * @param {(id: string, updates: object) => void} ctx.updateMessage
 * @param {() => boolean} ctx.isStopRequested
 * @param {(text: string|null) => void} ctx.setProgress
 * @param {(name: string, input: object, status?: string) => string} ctx.pushStep
 * @param {(id: string, status: string) => void} ctx.updateStep
 * @param {() => Array} ctx.getSteps
 * @param {(input: object) => Promise<string>} ctx.handlePlanApproval
 * @param {() => Promise<void>} ctx.persistSession
 * @param {object} settings
 */
export async function runAgentLoop(ctx, settings) {
  const maxIterations = 80;
  let iteration = 0;

  // Extract user text from the first user message for tool pruning
  const history = ctx.getConversationHistory();
  const firstUserMsg = history.find(m => m.role === 'user');
  const userText = firstUserMsg?.content
    ?.filter(b => b.type === 'text' && !b.text.startsWith('<nexus-ctx>'))
    .map(b => b.text)
    .join(' ') || '';
  const prunedTools = pruneTools(userText);

  while (iteration < maxIterations) {
    if (ctx.isStopRequested()) {
      ctx.addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Stopped the current run. Send another message to continue.',
      });
      return;
    }

    iteration++;
    const system = buildSystemPrompt(settings.systemPrompt);

    // Stream the response
    const assistantBlocks = [];
    let currentTextBlock = null;
    let currentToolBlock = null;
    const assistantMsgId = Date.now().toString();
    let streamingText = '';
    let msgAdded = false;

    const cachedTools = withCacheBreakpoint(prunedTools);
    const cachedMessages = withMessageCacheBreakpoint(ctx.getConversationHistory());

    await streamChat({
      messages: cachedMessages,
      tools: cachedTools,
      system,
      model: settings.model,
      max_tokens: 10000,
      onEvent: (event) => {
        switch (event.type) {
          case 'content_block_start': {
            if (event.content_block?.type === 'text') {
              currentTextBlock = { type: 'text', text: '' };
              if (!msgAdded) {
                ctx.addMessage({ id: assistantMsgId, role: 'assistant', content: '', isStreaming: true });
                msgAdded = true;
              }
            } else if (event.content_block?.type === 'tool_use') {
              currentToolBlock = {
                type: 'tool_use',
                id: event.content_block.id,
                name: event.content_block.name,
                input: {},
                _inputJson: '',
              };
              ctx.setProgress(`Running ${event.content_block.name}...`);
            }
            break;
          }
          case 'content_block_delta': {
            if (event.delta?.type === 'text_delta' && currentTextBlock) {
              currentTextBlock.text += event.delta.text;
              streamingText += event.delta.text;
              if (msgAdded) {
                ctx.updateMessage(assistantMsgId, { content: streamingText });
              }
            } else if (event.delta?.type === 'input_json_delta' && currentToolBlock) {
              currentToolBlock._inputJson += event.delta.partial_json;
            }
            break;
          }
          case 'content_block_stop': {
            if (currentTextBlock) {
              assistantBlocks.push({ type: 'text', text: currentTextBlock.text });
              currentTextBlock = null;
            }
            if (currentToolBlock) {
              try {
                currentToolBlock.input = JSON.parse(currentToolBlock._inputJson);
              } catch {
                currentToolBlock.input = {};
              }
              const { _inputJson, ...toolBlock } = currentToolBlock;
              assistantBlocks.push(toolBlock);
              currentToolBlock = null;
            }
            break;
          }
        }
      },
    });

    if (msgAdded) {
      ctx.updateMessage(assistantMsgId, { isStreaming: false });
    }

    const conversationHistory = ctx.getConversationHistory();
    ctx.setConversationHistory([...conversationHistory, { role: 'assistant', content: assistantBlocks }]);

    const toolCalls = assistantBlocks.filter(b => b.type === 'tool_use');
    if (toolCalls.length === 0) {
      await ctx.persistSession();
      return;
    }

    // Execute tool calls
    const toolResults = [];
    for (const toolCall of toolCalls) {
      if (ctx.isStopRequested()) break;

      const stepId = ctx.pushStep(toolCall.name, toolCall.input, 'running');
      ctx.setProgress(`Running ${toolCall.name}...`);

      let result;
      try {
        result = await executeTool(toolCall, settings, ctx);
      } catch (err) {
        result = `Error executing ${toolCall.name}: ${err.message}`;
        ctx.updateStep(stepId, 'error');
      }

      // Mark step done (unless already marked error)
      const currentStep = ctx.getSteps().find(s => s.id === stepId);
      if (currentStep && currentStep.status === 'running') {
        ctx.updateStep(stepId, 'done');
      }

      toolResults.push(formatToolResult(toolCall.id, result));
    }

    if (ctx.isStopRequested()) continue;

    const updated = ctx.getConversationHistory();
    ctx.setConversationHistory([...updated, { role: 'user', content: toolResults }]);
    ctx.setProgress(null);
    await ctx.persistSession();
  }

  ctx.addMessage({
    id: Date.now().toString(),
    role: 'assistant',
    content: 'Reached iteration limit while executing tools. Try a narrower prompt.',
  });
}
