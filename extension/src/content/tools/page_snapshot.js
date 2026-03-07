export function handlePageSnapshot(input) {
  const { max_headings = 40, max_forms = 20 } = input || {};

  const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
    .map((el) => ({
      level: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim().slice(0, 200),
    }))
    .filter((h) => h.text)
    .slice(0, max_headings);

  const forms = Array.from(document.forms)
    .slice(0, max_forms)
    .map((form, idx) => ({
      index: idx,
      id: form.id || null,
      name: form.getAttribute('name') || null,
      action: form.getAttribute('action') || null,
      method: (form.getAttribute('method') || 'get').toLowerCase(),
      fields: Array.from(form.elements)
        .filter((el) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.type || null,
          name: el.getAttribute('name') || null,
          id: el.id || null,
          placeholder: el.getAttribute('placeholder') || null,
          required: Boolean(el.required),
        }))
        .slice(0, 50),
    }));

  const stats = {
    links: document.querySelectorAll('a[href]').length,
    buttons: document.querySelectorAll('button, [role="button"]').length,
    inputs: document.querySelectorAll('input, textarea, select').length,
    images: document.querySelectorAll('img').length,
    forms: document.forms.length,
  };

  return JSON.stringify({
    page: {
      title: document.title,
      url: location.href,
      host: location.host,
    },
    stats,
    headings,
    forms,
  }, null, 2);
}
