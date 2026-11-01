import { NextResponse } from 'next/server';
import { checkLinks } from '@/lib/link-checker';
import { summarize, linkScore, LINK_LIMITS } from '@/lib/link-verdict';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 2000) hits.clear();
  return recent.length > 6;
}

const fail = (status, code, message) =>
  NextResponse.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * POST { targets: [{ href, kind, internal, text }] } → NDJSON stream:
 *   {type:'start', total} · {type:'result', done, total, result} · {type:'done', summary, score}
 */
export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (limited(ip)) return fail(429, 'rate_limited', 'Too many link checks. Please wait a minute.');

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'bad_request', 'Body must be JSON: { "targets": [...] }.');
  }
  if (!Array.isArray(body?.targets)) return fail(400, 'bad_request', 'targets must be an array.');

  const seen = new Set();
  const targets = [];
  for (const t of body.targets) {
    if (typeof t?.href !== 'string' || t.href.length > 2048 || seen.has(t.href)) continue;
    seen.add(t.href);
    targets.push({
      href: t.href,
      kind: t.kind === 'image' ? 'image' : 'link',
      internal: !!t.internal,
      text: typeof t.text === 'string' ? t.text.slice(0, 120) : '',
    });
    if (targets.length >= LINK_LIMITS.maxLinks + LINK_LIMITS.maxImages) break;
  }
  if (!targets.length) return fail(400, 'no_targets', 'No links to check.');

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o) => {
        if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(o)}\n`));
      };
      send({ type: 'start', total: targets.length });
      try {
        const results = await checkLinks(targets, {
          isCancelled: () => cancelled,
          onResult: (result, done) => send({ type: 'result', done, total: targets.length, result }),
        });
        const summary = summarize(results);
        send({ type: 'done', summary, score: linkScore(summary) });
      } catch {
        send({ type: 'error', message: 'Link checking failed unexpectedly.' });
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
