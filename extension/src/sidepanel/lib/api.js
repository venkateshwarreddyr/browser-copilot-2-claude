import { parseSSE } from './sse-parser.js';
import { getSettings } from './storage.js';

export async function streamChat({ messages, tools, system, model, max_tokens, onEvent }) {
  const settings = await getSettings();
  const backendUrl = settings.backendUrl || 'http://localhost:3001';

  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey) {
    headers['X-API-Key'] = settings.apiKey;
  }

  const body = { messages, tools, system, model: model || settings.model };
  if (max_tokens) body.max_tokens = max_tokens;

  const response = await fetch(`${backendUrl}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backend error ${response.status}: ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, remaining } = parseSSE(buffer);
    buffer = remaining;
    for (const event of events) {
      onEvent(event);
    }
  }

  // Flush remaining
  if (buffer.trim()) {
    const { events } = parseSSE(buffer + '\n\n');
    for (const event of events) {
      onEvent(event);
    }
  }
}
