import { streamChatResponse, getConfig } from './agent.js';

const API_SECRET = process.env.API_SECRET || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1_048_576); // 1 MB

function writeSse(stream, payload) {
  stream.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function getBody(event) {
  if (!event?.body) return {};
  const raw = typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
  if (raw.length > MAX_BODY_BYTES) return { __oversized: true };
  if (typeof event.body === 'string') {
    try { return JSON.parse(event.body); } catch { return {}; }
  }
  return event.body;
}

function isOriginAllowed(origin) {
  if (ALLOWED_ORIGINS.length === 0) return true;
  if (!origin) return true; // Lambda URL may not forward Origin
  return ALLOWED_ORIGINS.some(allowed => {
    if (allowed === origin) return true;
    if (allowed === 'chrome-extension://*' && origin.startsWith('chrome-extension://')) return true;
    return false;
  });
}

function validatePayload(body) {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object';
  if (!Array.isArray(body.messages) || body.messages.length === 0) return '"messages" must be a non-empty array';
  for (const msg of body.messages) {
    if (!msg.role || typeof msg.role !== 'string') return 'Each message must have a "role" string';
  }
  return null;
}

export const chat = awslambda.streamifyResponse(async (event, responseStream) => {
  responseStream.setContentType('text/event-stream');

  // Origin check
  const origin = event.headers?.origin;
  if (origin && !isOriginAllowed(origin)) {
    writeSse(responseStream, { type: 'error', message: 'Origin not allowed' });
    responseStream.end();
    return;
  }

  // API key authentication
  if (API_SECRET) {
    const provided = event.headers?.['x-api-key'];
    if (provided !== API_SECRET) {
      writeSse(responseStream, { type: 'error', message: 'Invalid or missing API key' });
      responseStream.end();
      return;
    }
  }

  const body = getBody(event);

  // Body size check
  if (body.__oversized) {
    writeSse(responseStream, { type: 'error', message: `Request body exceeds ${MAX_BODY_BYTES} bytes` });
    responseStream.end();
    return;
  }

  // Input validation
  const validationError = validatePayload(body);
  if (validationError) {
    writeSse(responseStream, { type: 'error', message: validationError });
    responseStream.end();
    return;
  }

  const { messages, tools, system, model, max_tokens } = body;

  const config = getConfig();
  if (!config) {
    writeSse(responseStream, { type: 'error', message: 'Set HF_API_KEY (or HUGGING_FACE_TOKEN / LLM_API_KEY) env var.' });
    responseStream.end();
    return;
  }

  try {
    await streamChatResponse({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: model || config.model,
      messages,
      tools: Array.isArray(tools) ? tools : [],
      system: Array.isArray(system) ? system : (typeof system === 'string' ? [{ type: 'text', text: system }] : []),
      max_tokens,
      onEvent: (evt) => writeSse(responseStream, evt),
    });
  } catch (error) {
    writeSse(responseStream, { type: 'error', message: error?.message || 'Unknown backend error' });
  }

  responseStream.end();
});
