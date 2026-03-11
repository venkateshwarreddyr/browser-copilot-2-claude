import 'dotenv/config';
import http from 'node:http';
import { streamChatResponse, getConfig } from './agent.js';

const PORT = Number(process.env.PORT || 3001);
const API_SECRET = process.env.API_SECRET || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1_048_576); // 1 MB
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000); // 1 min
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 30); // requests per window

// ── In-memory sliding-window rate limiter ──────────────────────────
const hits = new Map(); // key: ip → value: [timestamps]

function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  let timestamps = hits.get(ip) || [];
  timestamps = timestamps.filter(t => t > windowStart);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    hits.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  hits.set(ip, timestamps);
  return false;
}

// Periodically purge stale entries to prevent memory leak
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [ip, timestamps] of hits) {
    const fresh = timestamps.filter(t => t > cutoff);
    if (fresh.length === 0) hits.delete(ip);
    else hits.set(ip, fresh);
  }
}, RATE_LIMIT_WINDOW_MS);

// ── Helpers ────────────────────────────────────────────────────────
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
}

function isOriginAllowed(origin) {
  if (ALLOWED_ORIGINS.length === 0) return true; // no restriction configured
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => {
    if (allowed === origin) return true;
    // Support wildcard chrome-extension://* pattern
    if (allowed === 'chrome-extension://*' && origin.startsWith('chrome-extension://')) return true;
    return false;
  });
}

function setCorsHeaders(res, origin) {
  const allowedOrigin = (ALLOWED_ORIGINS.length === 0) ? '*' : (isOriginAllowed(origin) ? origin : 'null');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  res.setHeader('Vary', 'Origin');
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function collectBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error('BODY_TOO_LARGE'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function validatePayload(body) {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object';
  if (!Array.isArray(body.messages) || body.messages.length === 0) return '"messages" must be a non-empty array';
  for (const msg of body.messages) {
    if (!msg.role || typeof msg.role !== 'string') return 'Each message must have a "role" string';
    if (msg.content === undefined && msg.content === null) return 'Each message must have "content"';
  }
  return null;
}

// ── Server ─────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  setCorsHeaders(res, origin);
  setSecurityHeaders(res);

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // CORS origin check (skip for non-browser clients that don't send Origin)
  if (origin && !isOriginAllowed(origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Origin not allowed' }));
    return;
  }

  // Route check
  if (req.method !== 'POST' || !req.url.startsWith('/chat')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // API key authentication
  if (API_SECRET) {
    const provided = req.headers['x-api-key'];
    if (provided !== API_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or missing API key' }));
      return;
    }
  }

  // Rate limiting
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) });
    res.end(JSON.stringify({ error: 'Too many requests. Please try again later.' }));
    return;
  }

  // LLM config check
  const config = getConfig();
  if (!config) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Set HF_API_KEY (or HUGGING_FACE_TOKEN / LLM_API_KEY) env var.' }));
    return;
  }

  // Body parsing with size limit
  let body;
  try {
    body = await collectBody(req, MAX_BODY_BYTES);
  } catch (err) {
    if (err.message === 'BODY_TOO_LARGE') {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Request body exceeds ${MAX_BODY_BYTES} bytes` }));
      return;
    }
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad request' }));
    return;
  }

  // Input validation
  const validationError = validatePayload(body);
  if (validationError) {
    res.writeHead(422, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: validationError }));
    return;
  }

  const { messages, tools, system, model, max_tokens } = body;

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
      messages,
      tools: Array.isArray(tools) ? tools : [],
      system: Array.isArray(system) ? system : (typeof system === 'string' ? [{ type: 'text', text: system }] : []),
      max_tokens,
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
  console.log(`API_SECRET: ${API_SECRET ? 'configured' : 'NOT SET (no auth)'}`);
  console.log(`ALLOWED_ORIGINS: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : 'all (no restriction)'}`);
  console.log(`Rate limit: ${RATE_LIMIT_MAX} req / ${RATE_LIMIT_WINDOW_MS / 1000}s`);
});
