export function handleExtractLinks(input) {
  const { max_results = 100, same_domain_only = false, include_hash = false } = input || {};
  const pageHost = location.host;
  const links = [];
  const seen = new Set();

  for (const anchor of document.querySelectorAll('a[href]')) {
    const href = (anchor.getAttribute('href') || '').trim();
    if (!href) continue;

    let url;
    try {
      url = new URL(href, location.href);
    } catch {
      continue;
    }

    if (!include_hash) url.hash = '';
    if (same_domain_only && url.host !== pageHost) continue;

    const key = `${url.toString()}::${(anchor.textContent || '').trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const rect = anchor.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0;

    links.push({
      text: (anchor.textContent || '').trim().slice(0, 200),
      title: (anchor.getAttribute('title') || '').trim().slice(0, 200),
      url: url.toString(),
      visible,
      rel: (anchor.getAttribute('rel') || '').trim(),
      target: (anchor.getAttribute('target') || '').trim(),
    });

    if (links.length >= max_results) break;
  }

  return JSON.stringify({
    page: {
      title: document.title,
      url: location.href,
    },
    count: links.length,
    links,
  }, null, 2);
}
