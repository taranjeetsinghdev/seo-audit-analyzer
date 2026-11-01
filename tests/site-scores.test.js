import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSite } from '../lib/site-scores.js';
import { combineScores } from '../lib/overall-score.js';
import { auditHtml } from '../lib/page-audit.js';

const sec = (name, score) => ({ name, slug: name.toLowerCase(), score, earned: score / 10, possible: 10 });
const base = {
  url: 'https://x.com/', requestedUrl: 'https://x.com/', score: 90,
  sections: ['On-page', 'Indexing', 'Social', 'Content', 'Accessibility', 'Rendering', 'Technical'].map((n) => sec(n, 90)),
  checks: [{ id: 'h1', title: 'Single H1', status: 'pass' }, { id: 'canonical', title: 'Canonical URL', status: 'warning' }],
  scoring: { pointsEarned: 72, pointsPossible: 80 },
};
const page = (url, score, fails = []) => ({ url, audit: { score, sections: base.sections.map((s) => ({ ...s, score })), fails, warns: [] } });

test('aggregateSite averages every page and uses the main audit for the entered page', () => {
  const a = aggregateSite([page('https://x.com/', 50), page('https://x.com/a', 70, ['h1']), page('https://x.com/b', 50, ['h1'])], base);
  assert.equal(a.pages, 3);
  assert.equal(a.score, Math.round((90 + 70 + 50) / 3)); // entered page counts as 90, not its raw-HTML 50
  assert.equal(a.sections.find((s) => s.name === 'On-page').score, 70);
  assert.equal(a.problems[0].id, 'h1');
  assert.equal(a.problems[0].fail, 2);
  assert.equal(a.lowest[0].score, 50);
});

test('aggregateSite adds the entered page when the crawl did not include it, and ignores unscored pages', () => {
  const a = aggregateSite([{ url: 'https://x.com/z', verdict: 'error' }, page('https://x.com/a', 70)], base);
  assert.equal(a.pages, 2);
  assert.equal(a.score, 80);
});

test('combineScores: the HTML part becomes the site average', () => {
  const c = combineScores(base, null, null, null, { score: 60 });
  assert.equal(c.overall, 60);
  assert.equal(c.htmlScore, 60);
  assert.equal(combineScores(base, null, null, null, null).overall, 90);
});

test('auditHtml scores a raw page and lists failing checks', () => {
  const good = auditHtml({ html: '<html lang="en"><head><title>A decent page title for testing purposes here</title><meta name="description" content="A reasonable description of the page that is long enough to count as a real description for the test."><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://x.com/"></head><body><h1>Hi</h1><p>' + 'word '.repeat(400) + '</p></body></html>', finalUrl: 'https://x.com/', statusCode: 200, headers: {} });
  const bad = auditHtml({ html: '<html><body><p>hi</p></body></html>', finalUrl: 'https://x.com/', statusCode: 200, headers: {} });
  assert.ok(good.score > bad.score);
  assert.ok(bad.fails.includes('title-exists'));
  assert.ok(good.sections.length === 7);
});

import { auditSitemap } from '../lib/sitemap-audit.js';
import { auditHtml as audit2 } from '../lib/page-audit.js';
import { combineScores as combine2 } from '../lib/overall-score.js';

const crawl = (over = {}) => ({
  origin: 'https://x.com', truncated: false,
  robots: { found: true, blocksAll: false, hasRules: true, sitemaps: ['https://x.com/sitemap.xml'] },
  sitemap: { found: true, urls: ['https://x.com/', 'https://x.com/a'] },
  pages: [{ url: 'https://x.com/', inSitemap: true, verdict: 'ok', status: 200, discoveredBy: 'links' }, { url: 'https://x.com/a', inSitemap: true, verdict: 'ok', status: 200, discoveredBy: 'links' }],
  ...over,
});

test('auditSitemap: a healthy setup scores 100, missing files and blanket disallow score low', () => {
  assert.equal(auditSitemap(crawl()).score, 100);
  const none = auditSitemap(crawl({ robots: { found: false, sitemaps: [] }, sitemap: { found: false, urls: [] } }));
  assert.ok(none.score < 30, `score ${none.score}`);
  const blocked = auditSitemap(crawl({ robots: { found: true, blocksAll: true, sitemaps: [] } }));
  assert.equal(blocked.items.find((i) => i.id === 'robots-open').status, 'fail');
  const dirty = auditSitemap(crawl({ pages: [{ url: 'https://x.com/', inSitemap: true, verdict: 'error', status: 500 }, { url: 'https://x.com/a', inSitemap: true, verdict: 'ok', status: 200 }] }));
  assert.equal(dirty.items.find((i) => i.id === 'sitemap-health').status, 'fail');
});

test('security and sitemap scores join the final score with their weights', () => {
  const b = { score: 80, sections: [], checks: [], scoring: { pointsEarned: 80, pointsPossible: 100 } };
  const c = combine2(b, null, null, null, null, { score: 50, grade: 'D' }, { score: 100 });
  assert.equal(c.security.possible, 8);
  assert.equal(c.sitemap.possible, 6);
  assert.equal(c.overall, Math.round(((80 + 4 + 6) / 114) * 100));
});

test('new per-page checks: accessibility, readability and schema validation are evaluated', () => {
  const html = '<html lang="en"><body><form><input type="text" name="q"><button></button></form><a href="/x"><img src="a.png" alt=""></a><script type="application/ld+json">{"@type":"Product","name":"P"}</script></body></html>';
  const a = audit2({ html, finalUrl: 'https://x.com/', statusCode: 200, headers: {} });
  assert.ok(a.fails.includes('a11y-forms') || a.warns.includes('a11y-forms'));
  assert.ok(a.fails.includes('a11y-names'));
  assert.ok(a.fails.includes('schema-validation'));
  assert.ok(a.warns.includes('a11y-landmarks'));
});
