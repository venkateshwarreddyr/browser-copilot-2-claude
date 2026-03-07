import { streamChatResponse, getConfig } from './agent.js';

function writeSse(stream, payload) {
  stream.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function getBody(event) {
  if (!event?.body) return {};
  if (typeof event.body === 'string') {
    try { return JSON.parse(event.body); } catch { return {}; }
  }
  return event.body;
}

export const chat = awslambda.streamifyResponse(async (event, responseStream) => {
  responseStream.setContentType('text/event-stream');

  const body = getBody(event);
  const { messages, tools, system, model } = body;

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
      messages: Array.isArray(messages) ? messages : [],
      tools: Array.isArray(tools) ? tools : [],
      system: Array.isArray(system) ? system : (typeof system === 'string' ? [{ type: 'text', text: system }] : []),
      onEvent: (evt) => writeSse(responseStream, evt),
    });
  } catch (error) {
    writeSse(responseStream, { type: 'error', message: error?.message || 'Unknown backend error' });
  }

  responseStream.end();
});
