export function handleGetSelectedText(input) {
  const { max_chars = 12000 } = input || {};
  const selection = window.getSelection();
  const raw = selection ? String(selection) : '';
  const text = raw.trim();

  if (!text) {
    return JSON.stringify({
      page: { title: document.title, url: location.href },
      selected: false,
      text: '',
      length: 0,
    }, null, 2);
  }

  return JSON.stringify({
    page: { title: document.title, url: location.href },
    selected: true,
    text: text.slice(0, max_chars),
    length: text.length,
    truncated: text.length > max_chars,
  }, null, 2);
}
