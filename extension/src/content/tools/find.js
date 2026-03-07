function elementScore(el, queryLower) {
  const text = (el.innerText || '').trim().toLowerCase();
  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
  const title = (el.getAttribute('title') || '').toLowerCase();
  const alt = (el.getAttribute('alt') || '').toLowerCase();
  const role = (el.getAttribute('role') || '').toLowerCase();
  const tag = el.tagName.toLowerCase();

  let score = 0;
  if (text.includes(queryLower)) score += 4;
  if (ariaLabel.includes(queryLower)) score += 5;
  if (placeholder.includes(queryLower)) score += 4;
  if (title.includes(queryLower)) score += 3;
  if (alt.includes(queryLower)) score += 2;
  if (role.includes(queryLower)) score += 3;
  if (tag.includes(queryLower)) score += 1;

  // Prefer elements with short focused text over huge containers
  if (text.length > 0 && text.length < 180) score += 1;
  if (isInteractive(el)) score += 2;
  if (isVisible(el)) score += 2;

  return score;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function isInteractive(el) {
  const tag = el.tagName;
  if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return true;
  const role = (el.getAttribute('role') || '').toLowerCase();
  return ['button', 'link', 'tab', 'menuitem', 'combobox'].includes(role) || el.tabIndex >= 0;
}

export function handleFind(input, { assignRef }) {
  const { query, max_results = 20, interactive_only = false, visible_only = true } = input;
  const queryLower = String(query || '').toLowerCase().trim();

  if (!queryLower) return 'find query is required';

  const ranked = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node;
  while ((node = walker.nextNode())) {
    const el = node;

    if (interactive_only && !isInteractive(el)) continue;
    if (visible_only && !isVisible(el)) continue;

    const score = elementScore(el, queryLower);
    if (score <= 0) continue;

    ranked.push({ el, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, Math.max(1, Math.min(50, max_results)));

  if (top.length === 0) return `No elements found matching "${query}"`;

  const results = top.map(({ el, score }) => {
    const refId = assignRef(el);
    return {
      ref: refId,
      score,
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || '').trim().slice(0, 160),
      ariaLabel: (el.getAttribute('aria-label') || '').slice(0, 120),
      role: el.getAttribute('role') || '',
      visible: isVisible(el),
      interactive: isInteractive(el),
    };
  });

  return JSON.stringify(results, null, 2);
}
