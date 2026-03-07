let isRecording = false;
let startedAt = 0;
let steps = [];
let listeners = [];

const BADGE_ID = 'browser-copilot-teach-badge';

function selectorFor(el) {
  if (!el || !el.tagName) return 'unknown';

  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts = [];
  let current = el;
  let depth = 0;

  while (current && current.nodeType === 1 && depth < 5) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }

    const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
    if (siblings.length <= 1) {
      parts.unshift(tag);
    } else {
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
    }

    current = parent;
    depth++;
  }

  return parts.join(' > ');
}

function textFor(el) {
  if (!el) return '';

  const candidates = [
    el.getAttribute?.('aria-label'),
    el.getAttribute?.('placeholder'),
    el.getAttribute?.('title'),
    el.getAttribute?.('name'),
    el.textContent,
  ].filter(Boolean);

  const first = String(candidates[0] || '').replace(/\s+/g, ' ').trim();
  return first.slice(0, 120);
}

function pushStep(step) {
  const timeOffsetMs = Date.now() - startedAt;
  const full = { ...step, timeOffsetMs };

  const last = steps[steps.length - 1];
  if (last && last.type === full.type && last.selector === full.selector) {
    // Collapse noisy duplicate events
    if (timeOffsetMs - last.timeOffsetMs < 1200) {
      steps[steps.length - 1] = full;
      return;
    }
  }

  steps.push(full);
  if (steps.length > 200) steps = steps.slice(-200);
}

function ensureBadge() {
  let badge = document.getElementById(BADGE_ID);
  if (badge) return badge;

  badge = document.createElement('div');
  badge.id = BADGE_ID;
  badge.textContent = 'Teach mode: recording';
  badge.style.cssText = [
    'position: fixed',
    'top: 16px',
    'right: 16px',
    'z-index: 2147483647',
    'padding: 8px 12px',
    'border-radius: 999px',
    'border: 1px solid #fecaca',
    'background: #fff1f2',
    'color: #9f1239',
    'font-size: 12px',
    'font-weight: 700',
    'font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    'pointer-events: none',
    'box-shadow: 0 8px 20px rgba(0,0,0,0.12)',
  ].join(';');

  document.body.appendChild(badge);
  return badge;
}

function removeBadge() {
  const badge = document.getElementById(BADGE_ID);
  if (badge?.parentNode) badge.parentNode.removeChild(badge);
}

function onClick(event) {
  const rawTarget = event.target;
  const target = rawTarget?.closest?.('button,a,input,select,textarea,[role="button"],[onclick]') || rawTarget;
  if (!target) return;

  pushStep({
    type: 'click',
    selector: selectorFor(target),
    tag: target.tagName?.toLowerCase() || 'unknown',
    label: textFor(target),
  });
}

function onChange(event) {
  const target = event.target;
  if (!target || !target.tagName) return;

  const tag = target.tagName.toLowerCase();
  if (!['input', 'textarea', 'select'].includes(tag)) return;

  const inputType = (target.type || '').toLowerCase();
  let value = '';

  if (inputType === 'password') {
    value = '[REDACTED]';
  } else if (inputType === 'checkbox' || inputType === 'radio') {
    value = String(Boolean(target.checked));
  } else if (tag === 'select') {
    const optionText = target.selectedOptions?.[0]?.textContent?.trim();
    value = optionText || String(target.value || '');
  } else {
    value = String(target.value || '').slice(0, 120);
  }

  pushStep({
    type: 'input',
    selector: selectorFor(target),
    tag,
    label: textFor(target),
    value,
  });
}

function onKeydown(event) {
  if (event.key !== 'Enter') return;
  const target = event.target;
  if (!target || !target.tagName) return;

  const tag = target.tagName.toLowerCase();
  if (!['input', 'textarea'].includes(tag)) return;

  pushStep({
    type: 'press_enter',
    selector: selectorFor(target),
    tag,
    label: textFor(target),
  });
}

export function startTeachRecording() {
  if (isRecording) {
    return { ok: true, message: 'Teach recording already active.' };
  }

  isRecording = true;
  steps = [];
  startedAt = Date.now();

  ensureBadge();

  const handlers = [
    ['click', onClick, true],
    ['change', onChange, true],
    ['keydown', onKeydown, true],
  ];

  for (const [type, handler, capture] of handlers) {
    document.addEventListener(type, handler, capture);
    listeners.push({ type, handler, capture });
  }

  return { ok: true, message: 'Teach recording started.' };
}

export function stopTeachRecording() {
  if (!isRecording) {
    return {
      ok: false,
      message: 'Teach recording is not active.',
      steps: [],
      durationMs: 0,
      page: { title: document.title, url: location.href },
    };
  }

  for (const l of listeners) {
    document.removeEventListener(l.type, l.handler, l.capture);
  }
  listeners = [];

  isRecording = false;
  removeBadge();

  return {
    ok: true,
    message: 'Teach recording stopped.',
    durationMs: Date.now() - startedAt,
    steps,
    page: {
      title: document.title,
      url: location.href,
    },
  };
}

export function teachStatus() {
  return {
    ok: true,
    isRecording,
    stepCount: steps.length,
  };
}
