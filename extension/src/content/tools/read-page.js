function getRole(el) {
  const explicitRole = el.getAttribute('role');
  if (explicitRole) return explicitRole;

  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute('type') || '').toLowerCase();

  const roleMap = {
    a: 'link',
    button: 'button',
    input: type === 'submit' || type === 'button' ? 'button'
      : type === 'checkbox' ? 'checkbox'
      : type === 'radio' ? 'radio'
      : type === 'file' ? 'button'
      : 'textbox',
    select: 'combobox',
    textarea: 'textbox',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    h4: 'heading',
    h5: 'heading',
    h6: 'heading',
    img: 'image',
    nav: 'navigation',
    main: 'main',
    header: 'banner',
    footer: 'contentinfo',
    section: 'region',
    article: 'article',
    aside: 'complementary',
    form: 'form',
    table: 'table',
    ul: 'list',
    ol: 'list',
    li: 'listitem',
    label: 'label',
  };

  return roleMap[tag] || 'generic';
}

function getAccessibleName(el) {
  const tag = el.tagName.toLowerCase();

  if (tag === 'select') {
    const selected = el.querySelector('option[selected]') || el.options?.[el.selectedIndex];
    if (selected?.textContent?.trim()) return selected.textContent.trim();
  }

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) return ariaLabel.trim();

  const placeholder = el.getAttribute('placeholder');
  if (placeholder?.trim()) return placeholder.trim();

  const title = el.getAttribute('title');
  if (title?.trim()) return title.trim();

  const alt = el.getAttribute('alt');
  if (alt?.trim()) return alt.trim();

  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  if (tag === 'input') {
    const inputType = (el.getAttribute('type') || '').toLowerCase();
    const value = el.getAttribute('value') || '';
    if (inputType === 'submit' && value.trim()) return value.trim();
    if (el.value && el.value.length < 50 && el.value.trim()) return el.value.trim();
  }

  if (['button', 'a', 'summary'].includes(tag)) {
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent || '';
    }
    if (text.trim()) return text.trim();
  }

  if (/^h[1-6]$/.test(tag)) {
    const text = el.textContent || '';
    if (text.trim()) return text.trim().slice(0, 100);
  }

  if (tag === 'img') return '';

  let directText = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) directText += node.textContent || '';
  }

  const trimmed = directText.trim();
  if (trimmed.length >= 3) {
    return trimmed.length > 100 ? `${trimmed.slice(0, 100)}...` : trimmed;
  }

  return '';
}

function isVisible(el) {
  const style = window.getComputedStyle(el);
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && style.opacity !== '0'
    && el.offsetWidth > 0
    && el.offsetHeight > 0;
}

function isInteractive(el) {
  const tag = el.tagName.toLowerCase();
  const role = (el.getAttribute('role') || '').toLowerCase();

  return ['a', 'button', 'input', 'select', 'textarea', 'details', 'summary'].includes(tag)
    || el.getAttribute('onclick') !== null
    || el.getAttribute('tabindex') !== null
    || role === 'button'
    || role === 'link'
    || el.getAttribute('contenteditable') === 'true';
}

function isStructural(el) {
  const tag = el.tagName.toLowerCase();
  return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'nav', 'main', 'header', 'footer', 'section', 'article', 'aside'].includes(tag)
    || el.getAttribute('role') !== null;
}

function shouldInclude(el, options) {
  const tag = el.tagName.toLowerCase();

  if (['script', 'style', 'meta', 'link', 'title', 'noscript'].includes(tag)) return false;

  if (options.filter !== 'all') {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (!isVisible(el)) return false;

    // Sample behavior: when not focused by ref, prefer in-viewport nodes for signal/noise ratio
    if (!options.refId) {
      const rect = el.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
      if (!inViewport) return false;
    }
  }

  if (options.filter === 'interactive') return isInteractive(el);

  if (isInteractive(el)) return true;
  if (isStructural(el)) return true;
  if (getAccessibleName(el).length > 0) return true;

  const role = getRole(el);
  return role !== null && role !== 'generic' && role !== 'image';
}

function escapeQuoted(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .slice(0, 100)
    .replace(/"/g, '\\"');
}

function walkTree(el, depth, options, lines, maxDepth, assignRef) {
  if (!el || !el.tagName || depth > maxDepth) return;

  const includeCurrent = shouldInclude(el, options) || (options.refId && depth === 0);

  let nextDepth = depth;
  if (includeCurrent) {
    const role = getRole(el);
    const name = getAccessibleName(el);
    const refId = assignRef(el);

    let line = `${' '.repeat(depth)}${role}`;
    if (name) line += ` "${escapeQuoted(name)}"`;

    line += ` [${refId}]`;

    const href = el.getAttribute('href');
    if (href) line += ` href="${escapeQuoted(href)}"`;

    const type = el.getAttribute('type');
    if (type) line += ` type="${escapeQuoted(type)}"`;

    const placeholder = el.getAttribute('placeholder');
    if (placeholder) line += ` placeholder="${escapeQuoted(placeholder)}"`;

    lines.push(line);
    nextDepth = depth + 1;

    if (el.tagName.toLowerCase() === 'select') {
      for (const option of el.options || []) {
        let optionLine = `${' '.repeat(nextDepth)}option`;
        const optionText = option.textContent?.trim();
        if (optionText) optionLine += ` "${escapeQuoted(optionText)}"`;
        if (option.selected) optionLine += ' (selected)';
        if (option.value && option.value !== optionText) {
          optionLine += ` value="${escapeQuoted(option.value)}"`;
        }
        lines.push(optionLine);
      }
    }
  }

  if (!el.children || depth >= maxDepth) return;
  for (const child of el.children) {
    walkTree(child, nextDepth, options, lines, maxDepth, assignRef);
  }
}

export function handleReadPage(input, { assignRef, resolveRef, pruneRefs }) {
  const { filter = 'all', depth = 15, ref_id, max_chars = 50000 } = input || {};

  const maxDepth = Number.isFinite(depth) ? depth : 15;
  const options = { filter, refId: ref_id || null };

  let root = document.body;
  if (ref_id) {
    root = resolveRef(ref_id);
    if (!root) {
      return `Element with ref_id "${ref_id}" not found. It may have been removed from the page. Use read_page without ref_id to get the current page state.`;
    }
  }

  const lines = [];
  walkTree(root, 0, options, lines, maxDepth, assignRef);
  pruneRefs();

  const output = lines.join('\n');
  if (output.length > max_chars) {
    const prefix = `Output exceeds ${max_chars} character limit (${output.length} characters). `;
    if (ref_id) {
      return `${prefix}The specified element has too much content. Try a smaller depth or focus on a more specific child element.`;
    }
    if (input && Object.prototype.hasOwnProperty.call(input, 'depth')) {
      return `${prefix}Try an even smaller depth or use ref_id to focus on a specific element.`;
    }
    return `${prefix}Try specifying a depth (for example, depth: 5) or use ref_id to focus on a specific element.`;
  }

  return output;
}
