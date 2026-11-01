import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import { fetchHtml, fetchText, FetchError } from './html-fetcher.js';
import { parseRobots, parseSitemap } from './robots.js';
import { assertAllowedUrl } from './url-validation.js';
import { auditHtml } from './page-audit.js';

/**
 * Bounded, polite site crawl for site-wide findings. HTML only (no rendering), same-site only,
 * respects robots.txt, small concurrency with a delay, and a hard page and time budget.
 * Every request goes through the safe fetcher (public addresses only).
 */

const norm = (u) => {
  try {
    const x = new URL(u);
    x.hash = '';
    if (x.pathname.length > 1) x.pathname = x.pathname.replace(/\/+$/, '') || '/';
    return x.href;
  } catch {
    return null;
  }
};
const sameSite = (a, b) => a.replace(/^www\./, '') === b.replace(/^www\./, '');
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

function summarizePage(html, url) {
  const $ = cheerio.load(html);
  const links = [];
  $('a[href]').each((_, el) => {
    const raw = ($(el).attr('href') || '').trim();
    if (!raw || raw.startsWith('#') || /^(javascript|mailto|tel|sms|data):/i.test(raw)) return;
    try {
      const u = new URL(raw, url);
      if (/^https?:$/.test(u.protocol)) links.push(u.href);
    } catch {
      /* ignore */
    }
  });
  const canonical = $('link[rel~="canonical"]').first().attr('href');
  const robots = [$('meta[name="robots" i]').attr('content'), $('meta[name="googlebot" i]').attr('content')].filter(Boolean).join(', ');
  $('script, style, noscript, template, svg').remove();
  const text = clean($('body').text());
  return {
    title: clean($('title').first().text()),
    description: clean($('meta[name="description" i]').attr('content')),
    h1: $('h1').map((_, e) => clean($(e).text())).get().filter(Boolean),
    canonical: canonical ? (() => { try { return new URL(canonical, url).href; } catch { return ''; } })() : '',
    noindex: /noindex/i.test(robots),
    words: text ? text.split(' ').length : 0,
    hash: text.length > 200 ? crypto.createHash('sha1').update(text.slice(0, 4000)).digest('hex') : null,
    links,
  };
}

export async function crawlSite(startUrl, { maxPages = 50, concurrency = 5, delayMs = 100, budgetMs = 100_000, onProgress, onPage, isCancelled = () => false } = {}) {
  const started = Date.now();
  const origin = new URL(startUrl.href).origin;
  const host = new URL(origin).hostname;
  const out = { origin, startUrl: startUrl.href, pages: [], robots: { found: false, blocksAll: false, sitemaps: [] }, sitemap: { found: false, urls: [], errors: [] }, truncated: false };

  // robots.txt
  onProgress?.({ stage: 'robots', message: 'Reading robots.txt' });
  let robots = parseRobots('');
  try {
    const r = await fetchText(new URL('/robots.txt', origin));
    if (r.statusCode === 200 && !/<html/i.test(r.html.slice(0, 200))) {
      robots = parseRobots(r.html);
      out.robots = { found: true, blocksAll: robots.blocksAll(), sitemaps: robots.sitemaps, hasRules: robots.hasRules };
    }
  } catch {
    /* treated as missing */
  }

  // sitemap(s)
  onProgress?.({ stage: 'sitemap', message: 'Looking for a sitemap' });
  const sitemapSeeds = robots.sitemaps.length ? robots.sitemaps.slice(0, 3) : [new URL('/sitemap.xml', origin).href];
  const sitemapUrls = new Set();
  const visitSitemap = async (href, depth = 0) => {
    if (depth > 1 || sitemapUrls.size >= 500) return;
    try {
      assertAllowedUrl(new URL(href));
      const r = await fetchText(new URL(href));
      if (r.statusCode !== 200) return;
      const { isIndex, urls } = parseSitemap(r.html);
      if (!urls.length) return;
      out.sitemap.found = true;
      if (isIndex) {
        for (const child of urls.slice(0, 3)) await visitSitemap(child, depth + 1);
      } else {
        urls.forEach((u) => sameSite(new URL(u).hostname, host) && sitemapUrls.add(norm(u)));
      }
    } catch (err) {
      if (!(err instanceof FetchError) && err?.name !== 'UrlValidationError') out.sitemap.errors.push(String(err.message || err));
    }
  };
  for (const s of sitemapSeeds) await visitSitemap(s);
  out.sitemap.urls = [...sitemapUrls].filter(Boolean).slice(0, 500);
  onProgress?.({ stage: 'sitemap', message: out.sitemap.found ? `Sitemap lists ${out.sitemap.urls.length} URLs` : 'No sitemap found' });

  // BFS crawl
  const startNorm = norm(startUrl.href);
  const known = new Map(); // url -> { depth, fromSitemap }
  const queue = [];
  const enqueue = (u, depth, fromSitemap = false) => {
    if (!u || known.has(u)) return;
    if (/^\/api\//i.test(new URL(u).pathname)) return; // application endpoints, not content pages
    known.set(u, { depth, fromSitemap });
    queue.push(u);
  };
  enqueue(startNorm, 0);
  const inlinks = new Map();
  const linkedFromPages = new Map();

  let active = 0;
  await new Promise((resolve) => {
    const pump = () => {
      const over = out.pages.length + active >= maxPages || Date.now() - started > budgetMs || isCancelled();
      if (over && active === 0) return resolve();
      while (active < concurrency && queue.length && out.pages.length + active < maxPages && Date.now() - started <= budgetMs && !isCancelled()) {
        // Prefer link-discovered pages over sitemap-only ones, shallow first.
        queue.sort((a, b) => (known.get(a).fromSitemap - known.get(b).fromSitemap) || (known.get(a).depth - known.get(b).depth));
        const url = queue.shift();
        active += 1;
        crawlOne(url).finally(() => {
          active -= 1;
          setTimeout(pump, delayMs);
        });
      }
      if (active === 0 && (queue.length === 0 || over)) resolve();
    };

    const crawlOne = async (url) => {
      const meta = known.get(url);
      const path = new URL(url).pathname + new URL(url).search;
      const base = { url, depth: meta.depth, inSitemap: sitemapUrls.has(url), discoveredBy: meta.fromSitemap ? 'sitemap' : 'links' };
      if (!robots.isAllowed(path)) {
        const rec = { ...base, status: null, verdict: 'blocked_by_robots', ms: 0 };
        out.pages.push(rec);
        onPage?.(rec, out.pages.length);
        return;
      }
      const t0 = Date.now();
      try {
        const r = await fetchHtml(new URL(url), { maxBytes: 1.5 * 1024 * 1024, headerTimeoutMs: 8000, timeoutMs: 20_000, maxRedirects: 4 });
        const info = summarizePage(r.html, r.finalUrl);
        const rec = {
          ...base, finalUrl: norm(r.finalUrl), status: r.statusCode, ms: Date.now() - t0, redirects: r.redirects.length,
          title: info.title, description: info.description, h1: info.h1, canonical: info.canonical, noindex: info.noindex,
          words: info.words, hash: info.hash, verdict: r.statusCode >= 400 ? 'error' : 'ok',
        };
        if (r.statusCode < 400) {
          try {
            rec.audit = auditHtml({ html: r.html, finalUrl: r.finalUrl, statusCode: r.statusCode, headers: r.headers });
          } catch {
            /* a page that cannot be scored is still crawled */
          }
          for (const l of info.links) {
            const n = norm(l);
            if (!n || !sameSite(new URL(n).hostname, host)) continue;
            inlinks.set(n, (inlinks.get(n) || 0) + 1);
            if (!linkedFromPages.has(n)) linkedFromPages.set(n, new Set());
            linkedFromPages.get(n).add(url);
            enqueue(n, meta.depth + 1);
          }
          rec.internalLinks = [...new Set(info.links.map(norm).filter((n) => n && sameSite(new URL(n).hostname, host)))].length;
        }
        out.pages.push(rec);
        onPage?.(rec, out.pages.length);
      } catch (err) {
        const rec = { ...base, status: null, ms: Date.now() - t0, verdict: err instanceof FetchError && err.code === 'non_html' ? 'non_html' : 'unreachable', error: err.message?.slice(0, 160) };
        out.pages.push(rec);
        onPage?.(rec, out.pages.length);
      }
    };

    // Seed sitemap URLs after the start page so link discovery gets priority.
    sitemapUrls.forEach((u) => enqueue(u, 1, true));
    pump();
  });

  for (const p of out.pages) {
    p.inlinks = inlinks.get(p.url) || 0;
    p.linkedFrom = [...(linkedFromPages.get(p.url) || [])].slice(0, 3);
  }
  out.truncated = queue.length > 0 || (known.size > out.pages.length);
  out.discovered = known.size;
  out.ms = Date.now() - started;
  return out;
}
