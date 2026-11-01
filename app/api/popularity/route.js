import { NextResponse } from 'next/server';
import { fetchPopularity } from '@/lib/popularity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const hits = new Map();
const limited = (ip) => {
  const now = Date.now();
  const r = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  r.push(now);
  hits.set(ip, r);
  if (hits.size > 2000) hits.clear();
  return r.length > 10;
};
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

/** POST { url } → popularity rank history (free, via Tranco). */
export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (limited(ip)) return json({ error: { code: 'rate_limited', message: 'Too many requests. Please wait a minute.' } }, 429);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: { code: 'bad_request', message: 'Body must be JSON.' } }, 400);
  }
  try {
    return json(await fetchPopularity(String(body?.url || '')));
  } catch (err) {
    const status = err.code === 'bad_domain' ? 400 : err.code === 'rate_limited' ? 429 : 502;
    return json({ error: { code: err.code || 'upstream', message: err.message || 'Could not load popularity data.' } }, status);
  }
}
