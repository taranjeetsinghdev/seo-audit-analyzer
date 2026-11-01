import { NextResponse } from 'next/server';
import { normalizeUserUrl, resolvePublicAddresses, UrlValidationError } from '@/lib/url-validation';
import { runPerformanceAudit, PerformanceError } from '@/lib/performance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

// Google's free PageSpeed quota is 30 requests/minute per project: stay well under it.
// One "both devices" run costs 2 units.
const PER_IP = { windowMs: 60_000, max: 6 };
const GLOBAL = { windowMs: 60_000, max: 24 };
const CACHE_TTL_MS = 60 * 60_000;
const CACHE_MAX = 200;
const STRATEGIES = ['mobile', 'desktop'];

const ipHits = new Map();
let globalHits = [];
const cache = new Map();

function limited(ip, units) {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < GLOBAL.windowMs);
  const mine = (ipHits.get(ip) || []).filter((t) => now - t < PER_IP.windowMs);
  if (globalHits.length + units > GLOBAL.max || mine.length + units > PER_IP.max) return true;
  for (let i = 0; i < units; i += 1) {
    globalHits.push(now);
    mine.push(now);
  }
  ipHits.set(ip, mine);
  if (ipHits.size > 5000) ipHits.clear();
  return false;
}

const fail = (status, code, message) =>
  NextResponse.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

const statusFor = (code) => (code === 'not_configured' ? 503 : code === 'quota' ? 429 : 502);

/**
 * POST { url } → runs mobile AND desktop once, so the UI can switch between them
 * without another test. Each device is cached separately for an hour.
 */
export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'bad_request', 'Request body must be JSON.');
  }

  let url;
  try {
    url = normalizeUserUrl(body?.url);
    await resolvePublicAddresses(url.hostname);
  } catch (err) {
    if (err instanceof UrlValidationError) return fail(400, err.code, err.message);
    return fail(400, 'invalid_url', 'That URL could not be validated.');
  }

  const results = {};
  const errors = {};
  const missing = [];
  for (const strategy of STRATEGIES) {
    const hit = cache.get(`${strategy}:${url.href}`);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) results[strategy] = { ...hit.result, cached: true };
    else missing.push(strategy);
  }

  if (missing.length) {
    if (limited(ip, missing.length)) return fail(429, 'rate_limited', 'Too many performance tests. Please wait a minute and try again.');

    const settled = await Promise.allSettled(
      missing.map((strategy) => runPerformanceAudit(url.href, strategy, { apiKey: process.env.GOOGLE_API_KEY })),
    );
    settled.forEach((out, i) => {
      const strategy = missing[i];
      if (out.status === 'fulfilled') {
        results[strategy] = { ...out.value, cached: false };
        cache.set(`${strategy}:${url.href}`, { at: Date.now(), result: out.value });
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
      } else {
        const err = out.reason;
        if (!(err instanceof PerformanceError)) console.error('[performance] unexpected error', err);
        errors[strategy] = { code: err instanceof PerformanceError ? err.code : 'internal_error', message: err instanceof PerformanceError ? err.message : 'Something went wrong while running the performance test.' };
      }
    });
  }

  if (!Object.keys(results).length) {
    const first = Object.values(errors)[0];
    return fail(statusFor(first?.code), first?.code || 'unavailable', first?.message || 'Performance data could not be retrieved.');
  }

  const errorMessages = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v.message]));
  return NextResponse.json({ url: url.href, results, errors: errorMessages }, { headers: { 'Cache-Control': 'no-store' } });
}
