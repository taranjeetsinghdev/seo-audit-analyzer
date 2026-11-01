/** Pure, browser-safe: combine per-page audits into section scores and one site-wide average. */
import { SECTIONS } from './modules.js';

const strip = (u) => {
  try {
    const x = new URL(u);
    x.hash = '';
    return x.href.replace(/\/+$/, '').replace('://www.', '://');
  } catch {
    return String(u || '');
  }
};
const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/**
 * @param pages  crawled pages (each may carry `audit`)
 * @param base   the main report. Its page uses the main audit, which also covers JavaScript rendering.
 * Returns null when no page could be scored.
 */
export function aggregateSite(pages, base) {
  const baseUrls = new Set([strip(base.url), strip(base.requestedUrl)]);
  const scored = [];
  for (const p of pages || []) {
    if (!p.audit || p.audit.score == null) continue;
    const isBase = baseUrls.has(strip(p.finalUrl || p.url)) || baseUrls.has(strip(p.url));
    scored.push({
      url: p.finalUrl || p.url,
      score: isBase ? base.score : p.audit.score,
      sections: isBase ? base.sections : p.audit.sections,
      fails: isBase ? base.checks.filter((c) => c.status === 'fail').map((c) => c.id) : p.audit.fails,
      warns: isBase ? base.checks.filter((c) => c.status === 'warning').map((c) => c.id) : p.audit.warns,
      isBase,
    });
  }
  if (!scored.some((p) => p.isBase)) scored.push({ url: base.url, score: base.score, sections: base.sections, fails: base.checks.filter((c) => c.status === 'fail').map((c) => c.id), warns: base.checks.filter((c) => c.status === 'warning').map((c) => c.id), isBase: true });
  if (!scored.length || scored.every((p) => p.score == null)) return null;

  const sections = SECTIONS.map((name) => {
    const own = scored.map((p) => p.sections.find((s) => s.name === name)).filter((s) => s && s.score != null);
    const ref = base.sections.find((s) => s.name === name);
    const score = mean(own.map((s) => s.score));
    return { name, slug: ref?.slug, score, pages: own.length, earned: score == null ? 0 : Math.round(((score * (ref?.possible || 0)) / 100) * 10) / 10, possible: ref?.possible || 0 };
  });

  const titles = new Map(base.checks.map((c) => [c.id, c.title]));
  const tally = new Map();
  for (const p of scored) {
    for (const id of p.fails) tally.set(id, { ...(tally.get(id) || { id, fail: 0, warn: 0 }), fail: (tally.get(id)?.fail || 0) + 1 });
    for (const id of p.warns) tally.set(id, { ...(tally.get(id) || { id, fail: 0, warn: 0 }), warn: (tally.get(id)?.warn || 0) + 1 });
  }
  const problems = [...tally.values()]
    .map((t) => ({ ...t, title: titles.get(t.id) || t.id, affected: t.fail + t.warn }))
    .sort((a, b) => b.fail - a.fail || b.affected - a.affected)
    .slice(0, 8);

  const ranked = [...scored].sort((a, b) => a.score - b.score);
  return {
    pages: scored.length,
    score: mean(scored.map((p) => p.score)),
    sections,
    problems,
    lowest: ranked.slice(0, 5).map((p) => ({ url: p.url, score: p.score })),
    highest: ranked.slice(-3).reverse().map((p) => ({ url: p.url, score: p.score })),
  };
}
