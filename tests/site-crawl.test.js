import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, parseSitemap } from '../lib/robots.js';
import { analyzeCrawl } from '../lib/site-analysis.js';

test('robots.txt: longest match wins, wildcards, agent groups, sitemaps', () => {
  const r = parseRobots(`
    User-agent: *
    Disallow: /private/
    Allow: /private/public.html
    Disallow: /*.pdf$
    Sitemap: https://e.com/sitemap.xml
    User-agent: SEOAuditAnalyzerBot
    Disallow: /bot-only/
  `);
  assert.equal(r.isAllowed('/bot-only/x', 'SEOAuditAnalyzerBot'), false);
  assert.equal(r.isAllowed('/private/a', 'OtherBot'), false);
  assert.equal(r.isAllowed('/private/a', 'SEOAuditAnalyzerBot'), true); // specific group replaces *
  assert.equal(r.isAllowed('/private/public.html', 'OtherBot'), true);
  assert.equal(r.isAllowed('/file.pdf', 'OtherBot'), false);
  assert.equal(r.isAllowed('/file.pdf?x=1', 'OtherBot'), true); // $ anchors the end
  assert.deepEqual(r.sitemaps, ['https://e.com/sitemap.xml']);
  assert.equal(parseRobots('User-agent: *\nDisallow: /').blocksAll('x'), true);
  assert.equal(parseRobots('User-agent: *\nDisallow:').blocksAll('x'), false);
});

test('sitemap parser handles urlset, index and CDATA', () => {
  assert.deepEqual(parseSitemap('<urlset><url><loc>https://e.com/a</loc></url><url><loc><![CDATA[https://e.com/b?x=1&amp;y=2]]></loc></url></urlset>').urls,
    ['https://e.com/a', 'https://e.com/b?x=1&y=2']);
  assert.equal(parseSitemap('<sitemapindex><sitemap><loc>https://e.com/s1.xml</loc></sitemap></sitemapindex>').isIndex, true);
});

const page = (path, over = {}) => ({
  url: `https://e.com${path}`, finalUrl: `https://e.com${path}`, status: 200, verdict: 'ok', depth: 1, inlinks: 2, redirects: 0, inSitemap: true,
  discoveredBy: 'links', title: `T ${path}`, description: `D ${path}`, h1: ['H'], canonical: '', noindex: false, words: 400, hash: `h${path}`, ...over,
});

test('site analysis finds duplicates, orphans, errors, thin pages and sitemap problems', () => {
  const crawl = {
    origin: 'https://e.com',
    robots: { found: true, blocksAll: false },
    sitemap: { found: true, urls: ['x'] },
    pages: [
      page('/', { depth: 0 }),
      page('/a', { title: 'Same', description: 'Same desc' }),
      page('/b', { title: 'Same', description: 'Same desc', hash: 'dup' }),
      page('/c', { hash: 'dup' }),
      page('/thin', { words: 20 }),
      page('/orphan', { inlinks: 0, depth: 1, discoveredBy: 'sitemap' }),
      page('/gone', { status: 404, verdict: 'error', inlinks: 3 }),
      page('/noidx', { noindex: true }),
    ],
  };
  const r = analyzeCrawl(crawl);
  const ids = r.issues.map((i) => i.id);
  for (const id of ['site-broken-pages', 'site-duplicate-titles', 'site-duplicate-descriptions', 'site-duplicate-content', 'site-thin-content', 'site-orphan-pages', 'site-noindex', 'site-sitemap-problems']) {
    assert.ok(ids.includes(id), id);
  }
  assert.equal(r.issues[0].severity, 'critical');
  assert.ok(r.score < 100 && r.score >= 0);
  assert.equal(r.counts.crawled, 8);
  assert.equal(r.counts.orphans, 1);
});

test('a clean small site scores 100; blanket robots disallow is critical', () => {
  const clean = { origin: 'https://e.com', robots: { found: true }, sitemap: { found: true, urls: [] }, pages: [page('/', { depth: 0 }), page('/a')] };
  assert.equal(analyzeCrawl(clean).score, 100);
  const blocked = { ...clean, robots: { found: true, blocksAll: true } };
  assert.ok(analyzeCrawl(blocked).issues.some((i) => i.id === 'site-robots-blocks-all' && i.severity === 'critical'));
});

test('orphans are not reported from a partial crawl (would be false positives)', () => {
  const partial = { origin: 'https://e.com', truncated: true, robots: { found: true }, sitemap: { found: true, urls: [] },
    pages: [page('/', { depth: 0 }), page('/lonely', { inlinks: 0, depth: 1, discoveredBy: 'sitemap' })] };
  const r = analyzeCrawl(partial);
  assert.ok(!r.issues.some((i) => i.id === 'site-orphan-pages'));
  assert.equal(r.counts.orphansEvaluated, false);
  const complete = analyzeCrawl({ ...partial, truncated: false });
  assert.ok(complete.issues.some((i) => i.id === 'site-orphan-pages'));
});
