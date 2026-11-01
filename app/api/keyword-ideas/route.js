import { NextResponse } from 'next/server';
import { fetchPlatformIdeas } from '@/lib/keyword-ideas';
import { findCountry } from '@/lib/countries';

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
  return r.length > 8;
};

/** POST { brand, topic, country?, lang? } → { groups: [{ label, query, ideas, source }] } */
export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
  if (limited(ip)) return json({ error: { code: 'rate_limited', message: 'Too many requests. Please wait a minute.' } }, 429);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: { code: 'bad_request', message: 'Body must be JSON.' } }, 400);
  }
  const brand = String(body?.brand || '').trim().slice(0, 60);
  const topic = String(body?.topic || '').trim().slice(0, 60);
  if (!brand && !topic) return json({ error: { code: 'no_input', message: 'Provide the platform name or its topic.' } }, 400);
  const lang = /^[a-z]{2}(-[A-Z]{2})?$/.test(body?.lang || '') ? body.lang : 'en';
  const clean = (arr, n) => (Array.isArray(arr) ? arr : []).map((x) => String(x).toLowerCase().trim().slice(0, 40)).filter(Boolean).slice(0, n);
  // Where the platform operates: the visitor country if one is selected, otherwise the detected location.
  const loc = body?.location && typeof body.location === 'object' ? { city: String(body.location.city || '').trim().slice(0, 40), country: String(body.location.country || '').trim().slice(0, 40), code: body.location.code } : null;
  const country = findCountry(body?.country) || findCountry(loc?.code);
  return json(await fetchPlatformIdeas({
    brand, topic, context: clean(body?.context, 16), phrases: clean(body?.phrases, 4),
    location: loc && (loc.city || loc.country) ? loc : null,
    lang: country ? country.language : lang, country: country?.code || '',
  }));
}
