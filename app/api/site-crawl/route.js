import { NextResponse } from 'next/server';
import { normalizeUserUrl, UrlValidationError, resolvePublicAddresses } from '@/lib/url-validation';
import { crawlSite } from '@/lib/site-crawler';
import { analyzeCrawl } from '@/lib/site-analysis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 150;

const hits = new Map();
const active = new Set();
function limited(ip) {
  const now = Date.now();
  const r = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  r.push(now);
  hits.set(ip, r);
  if (hits.size > 2000) hits.clear();
  return r.length > 15;
}
const fail = (status, code, message) => NextResponse.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * POST { url, maxPages } → NDJSON: {type:'progress'|'page'|'result'|'error'}
 * One crawl per client at a time; at most 100 pages; polite concurrency; respects robots.txt.
 */
export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (active.has(ip)) return fail(429, 'busy', 'A crawl is already running. Wait for it to finish.');
  if (limited(ip)) return fail(429, 'rate_limited', 'Too many site crawls. Please wait a few minutes.');

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'bad_request', 'Body must be JSON.');
  }
  let url;
  try {
    url = normalizeUserUrl(body?.url);
    await resolvePublicAddresses(url.hostname);
  } catch (err) {
    return fail(400, err instanceof UrlValidationError ? err.code : 'invalid_url', err.message || 'Invalid URL.');
  }
  const maxPages = Math.min(100, Math.max(5, Number(body?.maxPages) || 50));

  const enc = new TextEncoder();
  let cancelled = false;
  active.add(ip);
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o) => {
        if (!cancelled) controller.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
      };
      try {
        const crawl = await crawlSite(url, {
          maxPages,
          isCancelled: () => cancelled,
          onProgress: (e) => send({ type: 'progress', ...e }),
          onPage: (p, n) => send({ type: 'page', done: n, max: maxPages, page: { url: p.url, status: p.status, verdict: p.verdict, depth: p.depth, ms: p.ms, title: p.title, words: p.words, score: p.audit?.score ?? null } }),
        });
        send({ type: 'result', crawl, analysis: analyzeCrawl(crawl) });
      } catch (err) {
        send({ type: 'error', message: err.message?.slice(0, 200) || 'The crawl failed.' });
      } finally {
        active.delete(ip);
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
      active.delete(ip);
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
}
