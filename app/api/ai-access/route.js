import { NextResponse } from 'next/server';
import { auditAiAccess } from '@/lib/ai-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 40;

const hits = new Map();
const limited = (ip) => {
  const now = Date.now();
  const r = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  r.push(now);
  hits.set(ip, r);
  if (hits.size > 2000) hits.clear();
  return r.length > 8;
};
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

/** POST { url } → AI-crawler access and llms.txt (live, free). */
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
    return json(await auditAiAccess(String(body?.url || '')));
  } catch (err) {
    const status = (err.code || '').startsWith('blocked_') || err.code === 'invalid_url' || err.code === 'dns_failure' ? 400 : 502;
    return json({ error: { code: err.code || 'upstream', message: err.message || 'Could not run the check.' } }, status);
  }
}
