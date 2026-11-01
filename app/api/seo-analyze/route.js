import { NextResponse } from 'next/server';
import { normalizeUserUrl, UrlValidationError } from '@/lib/url-validation';
import { FetchError } from '@/lib/html-fetcher';
import { analyzeUrl } from '@/lib/analyze';
import { findCountry } from '@/lib/countries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // browser fallback can take a while on protected sites

const RATE_LIMIT = { windowMs: 60_000, max: 12 };

// Per-instance, in-memory. Replace with a shared store (Redis, etc.) when running multiple instances.
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_LIMIT.max;
}

function describeError(err) {
  if (err instanceof UrlValidationError) return { status: 400, code: err.code, message: err.message };
  if (err instanceof FetchError) {
    const status = ['timeout', 'no_response'].includes(err.code) ? 504 : err.code === 'non_html' ? 422 : 502;
    return { status, code: err.code, message: err.message };
  }
  console.error('[seo-analyze] unexpected error', err);
  return { status: 500, code: 'internal_error', message: 'Something went wrong while analysing that page.' };
}

const errorResponse = ({ status, code, message }) =>
  NextResponse.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * POST /api/seo-analyze            → JSON report
 * POST /api/seo-analyze?stream=1   → NDJSON: {type:'progress'|'result'|'error', ...}
 * Every request fetches the page live; nothing is cached.
 */
export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (rateLimited(ip)) {
    return errorResponse({ status: 429, code: 'rate_limited', message: 'Too many requests. Please wait a minute and try again.' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse({ status: 400, code: 'bad_request', message: 'Request body must be JSON like {"url": "https://example.com"}.' });
  }

  let url;
  try {
    url = normalizeUserUrl(body?.url);
  } catch (err) {
    return errorResponse(describeError(err));
  }

  if (new URL(request.url).searchParams.get('stream') !== '1') {
    try {
      const report = await analyzeUrl(url, undefined, { render: body?.render !== false, country: findCountry(body?.country) });
      return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
      return errorResponse(describeError(err));
    }
  }

  const encoder = new TextEncoder();
  const started = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event) => controller.enqueue(encoder.encode(`${JSON.stringify({ ...event, t: Date.now() - started })}\n`));
      try {
        send({ type: 'progress', stage: 'validate', message: `Validated ${url.hostname}` });
        const report = await analyzeUrl(url, (e) => send({ type: 'progress', ...e }), { render: body?.render !== false, country: findCountry(body?.country) });
          send({ type: 'result', report });
      } catch (err) {
        const { code, message } = describeError(err);
        send({ type: 'error', code, message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
