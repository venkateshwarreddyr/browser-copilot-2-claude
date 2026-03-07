import { handleReadPage } from './tools/read-page.js';
import { handleFind } from './tools/find.js';
import { handleFormInput } from './tools/form-input.js';
import { handleComputer } from './tools/computer.js';
import { handleGetPageText } from './tools/get-page-text.js';
import { handleJavascript } from './tools/javascript.js';
import { handleReadConsole } from './tools/console.js';
import { handleReadNetwork } from './tools/network.js';
import { handleExtractLinks } from './tools/extract-links.js';
import { handleGetSelectedText } from './tools/get-selected-text.js';
import { handlePageSnapshot } from './tools/page_snapshot.js';
import { showAgentIndicator, hideAgentIndicator } from './tools/agent-visual-indicator.js';
import { startTeachRecording, stopTeachRecording, teachStatus } from './tools/teach-recorder.js';

// Ref registry (persistent across calls)
const refToElement = new Map();
const elementToRef = new WeakMap();
let refCounter = 0;

function assignRef(element) {
  if (!element) return null;

  const existing = elementToRef.get(element);
  if (existing) return existing;

  refCounter++;
  const refId = `ref_${refCounter}`;
  refToElement.set(refId, new WeakRef(element));
  elementToRef.set(element, refId);
  return refId;
}

function resolveRef(refId) {
  const weakRef = refToElement.get(refId);
  if (!weakRef) return null;

  const el = weakRef.deref();
  if (!el || !document.contains(el)) {
    refToElement.delete(refId);
    return null;
  }

  return el;
}

function pruneRefs() {
  for (const [refId, weakRef] of refToElement.entries()) {
    const el = weakRef.deref();
    if (!el || !document.contains(el)) {
      refToElement.delete(refId);
    }
  }
}

// Console capture
const consoleLogs = [];
const origConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
};

function captureConsole(level, origFn) {
  return function (...args) {
    consoleLogs.push({
      level,
      message: args.map((a) => {
        try {
          return typeof a === 'object' ? JSON.stringify(a) : String(a);
        } catch {
          return String(a);
        }
      }).join(' '),
      timestamp: Date.now(),
    });
    if (consoleLogs.length > 1000) consoleLogs.splice(0, consoleLogs.length - 500);
    origFn(...args);
  };
}

console.log = captureConsole('log', origConsole.log);
console.error = captureConsole('error', origConsole.error);
console.warn = captureConsole('warn', origConsole.warn);
console.info = captureConsole('info', origConsole.info);

// Network capture
const networkRequests = [];
try {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'resource') {
        networkRequests.push({
          url: entry.name,
          type: entry.initiatorType,
          duration: Math.round(entry.duration),
          size: entry.transferSize || 0,
          timestamp: Date.now(),
        });
        if (networkRequests.length > 1000) networkRequests.splice(0, networkRequests.length - 500);
      }
    }
  });
  observer.observe({ type: 'resource', buffered: true });
} catch {
  // PerformanceObserver not available
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SHOW_AGENT_INDICATOR') {
    showAgentIndicator();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'HIDE_AGENT_INDICATOR') {
    hideAgentIndicator();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'TEACH_START') {
    sendResponse(startTeachRecording());
    return false;
  }

  if (msg.type === 'TEACH_STOP') {
    sendResponse(stopTeachRecording());
    return false;
  }

  if (msg.type === 'TEACH_STATUS') {
    sendResponse(teachStatus());
    return false;
  }

  if (msg.type !== 'TOOL_EXEC') return false;

  const handlers = {
    read_page: () => handleReadPage(msg.input, { assignRef, resolveRef, pruneRefs }),
    find: () => handleFind(msg.input, { assignRef }),
    form_input: () => handleFormInput(msg.input, { resolveRef }),
    computer: () => handleComputer(msg.input, { resolveRef }),
    get_page_text: () => handleGetPageText(msg.input),
    javascript_tool: () => handleJavascript(msg.input),
    read_console_messages: () => handleReadConsole(msg.input, consoleLogs),
    read_network_requests: () => handleReadNetwork(msg.input, networkRequests),
    extract_links: () => handleExtractLinks(msg.input),
    get_selected_text: () => handleGetSelectedText(msg.input),
    page_snapshot: () => handlePageSnapshot(msg.input),
  };

  const handler = handlers[msg.tool];
  if (!handler) {
    sendResponse({ error: `Unknown content tool: ${msg.tool}` });
    return false;
  }

  Promise.resolve(handler())
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ error: err.message }));

  return true;
});
