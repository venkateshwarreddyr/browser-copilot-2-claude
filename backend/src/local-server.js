import 'dotenv/config';
import http from 'node:http';
import { streamChatResponse, getConfig } from './agent.js';

const PORT = Number(process.env.PORT || 3001);

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || !req.url.startsWith('/chat')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const config = getConfig();
  if (!config) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Set HF_API_KEY (or HUGGING_FACE_TOKEN / LLM_API_KEY) env var.' }));
    return;
  }

  const body = await collectBody(req);
  const { messages, tools, system, model } = body;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    await streamChatResponse({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: model || config.model,
      messages: Array.isArray(messages) ? messages : [],
      tools: Array.isArray(tools) ? tools : [],
      system: Array.isArray(system) ? system : (typeof system === 'string' ? [{ type: 'text', text: system }] : []),
      onEvent: (evt) => {
        res.write(`data: ${JSON.stringify(evt)}\n\n`);
      },
    });
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error?.message || 'Unknown error' })}\n\n`);
  }

  res.end();
});

server.listen(PORT, () => {
  const config = getConfig();
  console.log(`Local dev server running on http://localhost:${PORT}`);
  console.log(`LLM_BASE_URL: ${config?.baseURL || 'NOT SET'}`);
  console.log(`LLM_MODEL: ${config?.model || 'NOT SET'}`);
});
