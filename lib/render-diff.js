/** Compare signals extracted from the raw server HTML with the live rendered DOM. */

const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

function item(field, label, raw, rendered) {
  const a = norm(raw);
  const b = norm(rendered);
  let result = 'same';
  if (!a && b) result = 'added';
  else if (a && !b) result = 'removed';
  else if (a !== b) result = 'changed';
  return { field, label, raw: a, rendered: b, result };
}

const robotsOf = (s) => [s.metadata.robots, s.metadata.googlebot].filter(Boolean).join(', ');

export function compareSignals(raw, rendered) {
  const items = [
    item('title', 'Title', raw.metadata.title, rendered.metadata.title),
    item('description', 'Meta description', raw.metadata.description, rendered.metadata.description),
    item('canonical', 'Canonical', raw.metadata.canonical, rendered.metadata.canonical),
    item('robots', 'Robots directives', robotsOf(raw), robotsOf(rendered)),
    item('h1', 'First H1', raw.headings.h1[0], rendered.headings.h1[0]),
    item('og-title', 'og:title', raw.metadata.og.title, rendered.metadata.og.title),
    item('og-image', 'og:image', raw.metadata.og.image, rendered.metadata.og.image),
    item('lang', 'html lang', raw.metadata.lang, rendered.metadata.lang),
  ];

  const counts = [
    ['Words', raw.content.wordCount, rendered.content.wordCount],
    ['H2 headings', raw.headings.h2.length, rendered.headings.h2.length],
    ['Internal links', raw.links.internal, rendered.links.internal],
    ['Images', raw.images.total, rendered.images.total],
    ['Structured data blocks', raw.structuredData.items.length, rendered.structuredData.items.length],
  ].map(([label, a, b]) => ({ label, raw: a, rendered: b, result: a === b ? 'same' : b > a ? 'added' : 'removed' }));

  const wordsRaw = raw.content.wordCount;
  const wordsRendered = rendered.content.wordCount;
  const added = Math.max(0, wordsRendered - wordsRaw);
  const dependence = wordsRendered ? Math.round((added / wordsRendered) * 100) : 0;
  const level = dependence >= 50 ? 'high' : dependence >= 10 ? 'moderate' : 'low';

  return {
    items,
    counts,
    wordsRaw,
    wordsRendered,
    dependence,
    level,
    internalLinksRaw: raw.links.internal,
    internalLinksRendered: rendered.links.internal,
  };
}
