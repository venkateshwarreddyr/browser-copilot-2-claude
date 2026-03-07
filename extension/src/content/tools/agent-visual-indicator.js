const OVERLAY_ID = 'browser-copilot-agent-indicator-overlay';
const BADGE_ID = 'browser-copilot-agent-indicator-badge';

function ensureStyles() {
  if (document.getElementById('browser-copilot-agent-indicator-style')) return;
  const style = document.createElement('style');
  style.id = 'browser-copilot-agent-indicator-style';
  style.textContent = `
    @keyframes browser-copilot-pulse {
      0% { box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.20), inset 0 0 24px rgba(37, 99, 235, 0.14); }
      50% { box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.30), inset 0 0 30px rgba(37, 99, 235, 0.22); }
      100% { box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.20), inset 0 0 24px rgba(37, 99, 235, 0.14); }
    }
  `;
  document.head.appendChild(style);
}

function ensureOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = [
      'position: fixed',
      'inset: 0',
      'pointer-events: none',
      'z-index: 2147483646',
      'opacity: 0',
      'transition: opacity 180ms ease',
      'animation: browser-copilot-pulse 1.8s ease-in-out infinite',
    ].join(';');
    document.body.appendChild(overlay);
  }
  return overlay;
}

function ensureBadge() {
  let badge = document.getElementById(BADGE_ID);
  if (!badge) {
    badge = document.createElement('div');
    badge.id = BADGE_ID;
    badge.textContent = 'Browser Copilot is active';
    badge.style.cssText = [
      'position: fixed',
      'right: 16px',
      'bottom: 16px',
      'z-index: 2147483647',
      'font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
      'font-size: 12px',
      'font-weight: 600',
      'letter-spacing: 0.2px',
      'padding: 8px 10px',
      'border-radius: 999px',
      'background: #eff6ff',
      'color: #1d4ed8',
      'border: 1px solid #bfdbfe',
      'box-shadow: 0 8px 20px rgba(0,0,0,0.12)',
      'opacity: 0',
      'transition: opacity 180ms ease',
      'pointer-events: none',
    ].join(';');
    document.body.appendChild(badge);
  }
  return badge;
}

export function showAgentIndicator() {
  if (!document.body) return;
  ensureStyles();
  const overlay = ensureOverlay();
  const badge = ensureBadge();
  overlay.style.opacity = '1';
  badge.style.opacity = '1';
}

export function hideAgentIndicator() {
  const overlay = document.getElementById(OVERLAY_ID);
  const badge = document.getElementById(BADGE_ID);
  if (overlay) overlay.style.opacity = '0';
  if (badge) badge.style.opacity = '0';
}
