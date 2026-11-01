import { NextResponse } from 'next/server';
import { probe } from '@/lib/link-checker';
import { classify } from '@/lib/link-verdict';
import { platformOf } from '@/lib/social';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_URLS = 40;
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 2000) hits.clear();
  return recent.length > 8;
}
const fail = (status, code, message) => NextResponse.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

// Social sites answer unknown/anonymous visitors with a login page; that proves nothing either way.
const LOGIN_WALL = /\/(login|accounts\/login|i\/flow\/login|authwall|checkpoint|uas\/login|signup)\b/i;

async function checkOne(url) {
  const r = await probe(url, { timeoutMs: 9000 });
  let { verdict, reason } = classify(r);
  if (verdict === 'ok' || verdict === 'redirect') {
    if (LOGIN_WALL.test(r.finalUrl || '')) {
      verdict = 'blocked';
      reason = 'Redirected to a login wall — could not verify the profile exists';
    } else if (verdict === 'redirect') {
      reason = `Reachable (redirects to ${r.finalUrl})`;
      verdict = 'ok';
    } else {
      reason = 'Reachable';
    }
  }
  return { url, status: r.status, verdict, reason, finalUrl: r.finalUrl, ms: r.ms };
}

/** POST { urls: [...] } → { results: [{ url, status, verdict, reason, finalUrl, ms }] } */
export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (limited(ip)) return fail(429, 'rate_limited', 'Too many checks. Please wait a minute.');
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'bad_request', 'Body must be JSON: { "urls": [...] }.');
  }
  if (!Array.isArray(body?.urls)) return fail(400, 'bad_request', 'urls must be an array.');
  // Only ever probe recognised social-network URLs; this is not a general-purpose fetcher.
  const urls = [...new Set(body.urls.filter((u) => typeof u === 'string' && u.length < 2048 && platformOf(u)))].slice(0, MAX_URLS);
  if (!urls.length) return fail(400, 'no_urls', 'No social profile URLs to check.');

  const results = new Array(urls.length);
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const n = i++;
      results[n] = await checkOne(urls[n]);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
}
