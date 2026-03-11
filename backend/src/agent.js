import OpenAI from 'openai';

export function getConfig() {
  const baseURL = process.env.LLM_BASE_URL || 'https://router.huggingface.co/v1';
  const apiKey = process.env.HF_API_KEY || process.env.HUGGING_FACE_TOKEN || process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'grok-3';
  if (!apiKey) return null;
  return { baseURL, apiKey, model };
}

export async function streamChatResponse({ apiKey, baseURL, model, messages, tools, system, max_tokens, onEvent }) {
  const client = new OpenAI({ apiKey, baseURL });

  const requestMessages = [];

  // System prompt
  if (system && system.length > 0) {
    const systemText = system.map(s => s.text || '').join('\n');
    if (systemText) requestMessages.push({ role: 'system', content: systemText });
  }

  // Convert Anthropic-format messages to OpenAI format
  for (const msg of messages) {
    const converted = convertMessage(msg);
    if (Array.isArray(converted)) {
      requestMessages.push(...converted);
    } else {
      requestMessages.push(converted);
    }
  }

  const params = {
    model,
    messages: requestMessages,
    stream: true,
    max_tokens: max_tokens || 16384,
  };

  // Convert Anthropic tool format to OpenAI tool format
  if (tools && tools.length > 0) {
    params.tools = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  }

  const stream = await client.chat.completions.create(params);

  // Translate OpenAI streaming chunks to Anthropic-style events
  // so the extension uses a single event format
  let contentIndex = 0;
  let toolCalls = {};
  let textStarted = false;

  onEvent({ type: 'message_start', message: { model, role: 'assistant', content: [] } });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    const finishReason = chunk.choices?.[0]?.finish_reason;

    if (delta?.content) {
      if (!textStarted) {
        onEvent({ type: 'content_block_start', index: contentIndex, content_block: { type: 'text', text: '' } });
        textStarted = true;
      }
      onEvent({ type: 'content_block_delta', index: contentIndex, delta: { type: 'text_delta', text: delta.content } });
    }

    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index;
        if (!toolCalls[idx]) {
          if (textStarted) {
            onEvent({ type: 'content_block_stop', index: contentIndex });
            contentIndex++;
            textStarted = false;
          }
          toolCalls[idx] = { id: tc.id || `tool_${idx}`, name: tc.function?.name || '', args: '' };
          onEvent({
            type: 'content_block_start',
            index: contentIndex + idx,
            content_block: { type: 'tool_use', id: toolCalls[idx].id, name: toolCalls[idx].name, input: {} },
          });
        }
        if (tc.function?.arguments) {
          toolCalls[idx].args += tc.function.arguments;
          onEvent({
            type: 'content_block_delta',
            index: contentIndex + idx,
            delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
          });
        }
      }
    }

    if (finishReason) {
      if (textStarted) {
        onEvent({ type: 'content_block_stop', index: contentIndex });
        textStarted = false;
      }
      for (const idx of Object.keys(toolCalls)) {
        onEvent({ type: 'content_block_stop', index: contentIndex + Number(idx) });
      }
      onEvent({
        type: 'message_delta',
        delta: { stop_reason: finishReason === 'tool_calls' ? 'tool_use' : 'end_turn' },
      });
      onEvent({ type: 'message_stop' });
    }
  }
}

function convertMessage(msg) {
  const { role, content } = msg;

  if (typeof content === 'string') {
    return { role, content };
  }

  if (Array.isArray(content)) {
    // Tool results → separate tool messages
    const toolResults = content.filter(b => b.type === 'tool_result');
    if (toolResults.length > 0) {
      return toolResults.map(tr => {
        if (Array.isArray(tr.content)) {
          const hasImage = tr.content.some(c => c.type === 'image');
          if (hasImage) {
            // Build multi-part content for vision-capable models
            const parts = tr.content.map(c => {
              if (c.type === 'image' && c.source) {
                return {
                  type: 'image_url',
                  image_url: {
                    url: c.source.type === 'base64'
                      ? `data:${c.source.media_type};base64,${c.source.data}`
                      : c.source.url,
                  },
                };
              }
              return { type: 'text', text: c.text || '' };
            });
            return { role: 'tool', tool_call_id: tr.tool_use_id, content: parts };
          }
        }
        return {
          role: 'tool',
          tool_call_id: tr.tool_use_id,
          content: Array.isArray(tr.content)
            ? tr.content.map(c => c.text || '').join('\n')
            : (tr.content || ''),
        };
      });
    }

    // Assistant with tool_use blocks
    const toolUses = content.filter(b => b.type === 'tool_use');
    const textBlocks = content.filter(b => b.type === 'text');

    if (toolUses.length > 0) {
      return {
        role: 'assistant',
        content: textBlocks.map(b => b.text).join('\n') || null,
        tool_calls: toolUses.map(tu => ({
          id: tu.id,
          type: 'function',
          function: {
            name: tu.name,
            arguments: JSON.stringify(tu.input),
          },
        })),
      };
    }

    // Text-only
    const text = content.map(b => b.text || '').join('\n');
    return { role, content: text };
  }

  return { role, content: String(content) };
}
