import { NextResponse } from 'next/server';
import { fetchMonthlyHistory, planScan } from '@/lib/popularity-history';
import { fetchPopularity } from '@/lib/popularity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const hits = new Map();
const inflight = new Map(); // domain -> { events, subscribers, finished }: identical lookups share one scan
const limited = (ip) => {
  const now = Date.now();
  const r = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  r.push(now);
  hits.set(ip, r);
  if (hits.size > 2000) hits.clear();
  return r.length > 20;
};
const fail = (status, code, message) => NextResponse.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

async function runScan(input, job) {
  const emit = (o) => { job.events.push(o); job.subscribers.forEach((fn) => fn(o)); };
  try {
    // Today's rank (cached from the traffic page) decides which archive to read and how far.
    let plan = planScan(null);
    let quickMaxRank = Infinity;
    try {
      const current = await fetchPopularity(input);
      if (current.found) {
        plan = planScan(current.latest);
        quickMaxRank = Math.max(20_000, current.latest * 8);
      }
    } catch {
      /* fall back to the small list */
    }
    const history = await fetchMonthlyHistory(input, { ...plan, quickMaxRank, onMonth: (month) => emit({ type: 'month', month }) });
    emit({ type: 'done', history });
  } catch (err) {
    emit({ type: 'error', message: err.message || 'History lookup failed.' });
  } finally {
    job.finished = true;
    setTimeout(() => inflight.delete(job.key), 1000);
  }
}

/** POST { url } → NDJSON: {type:'month', month} per month as it resolves, then {type:'done', history}. */
export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (limited(ip)) return fail(429, 'rate_limited', 'Too many history lookups. Please wait a few minutes.');
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'bad_request', 'Body must be JSON.');
  }
  const input = String(body?.url || '');
  const key = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
  if (!key) return fail(400, 'bad_request', 'Missing url.');

  let job = inflight.get(key);
  if (!job || job.finished) {
    job = { key, events: [], subscribers: new Set(), finished: false };
    inflight.set(key, job);
    runScan(input, job);
  }

  const enc = new TextEncoder();
  let unsubscribe = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (o) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
          if (o.type === 'done' || o.type === 'error') { closed = true; controller.close(); }
        } catch {
          closed = true;
        }
      };
      job.events.forEach(send); // replay what the shared scan already produced
      if (!closed) {
        job.subscribers.add(send);
        unsubscribe = () => job.subscribers.delete(send);
      }
    },
    cancel() {
      unsubscribe(); // the scan keeps going and its result is cached for the next request
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
}
