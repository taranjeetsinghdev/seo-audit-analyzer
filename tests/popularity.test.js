import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateDomains, normalizeRanks, tierFor, fetchPopularity } from '../lib/popularity.js';

test('candidate domains walk from host down to the registrable domain', () => {
  assert.deepEqual(candidateDomains('https://seo.visionvivante.in/x'), ['seo.visionvivante.in', 'visionvivante.in']);
  assert.deepEqual(candidateDomains('www.example.com'), ['www.example.com', 'example.com']);
  assert.deepEqual(candidateDomains('shop.bbc.co.uk'), ['shop.bbc.co.uk', 'bbc.co.uk']);
  assert.deepEqual(candidateDomains('example.com'), ['example.com']);
  assert.deepEqual(candidateDomains('http://127.0.0.1'), []);
  assert.deepEqual(candidateDomains('localhost'), []);
});

test('rank history is sorted, summarised and tiered', () => {
  const r = normalizeRanks({ ranks: [
    { date: '2026-10-14', rank: 150 }, { date: '2026-10-01', rank: 200 }, { date: '2026-10-07', rank: 180 },
  ] }, 'e.com');
  assert.equal(r.found, true);
  assert.deepEqual(r.series.map((x) => x.date), ['2026-10-01', '2026-10-07', '2026-10-14']);
  assert.equal(r.latest, 150);
  assert.equal(r.change, 50); // moved up 50 places
  assert.equal(r.direction, 'up');
  assert.equal(r.tier.label, 'Top 1,000');
  assert.equal(normalizeRanks({ ranks: [] }, 'x.org').found, false);
  assert.match(tierFor(null).label, /Outside/);
  assert.equal(tierFor(2_000_000).label, 'Outside the top 1M');
});

test('falls back to the parent domain and caches the result', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const sub = url.endsWith('/sub.fallback-test.org');
    return { ok: true, status: 200, json: async () => ({ ranks: sub ? [] : [{ date: '2026-10-14', rank: 5000 }] }) };
  };
  const a = await fetchPopularity('https://sub.fallback-test.org/page', { fetchImpl });
  assert.equal(a.found, true);
  assert.equal(a.domain, 'fallback-test.org');
  assert.equal(calls.length, 2);
  const b = await fetchPopularity('sub.fallback-test.org', { fetchImpl });
  assert.equal(b.cached, true);
  assert.equal(calls.length, 2);
  await assert.rejects(
    fetchPopularity('rate-limited-test.net', { fetchImpl: async () => ({ ok: false, status: 429 }), retryDelayMs: 1 }),
    (e) => e.code === 'rate_limited',
  );
});

test('retries after a 429 and then succeeds', async () => {
  let n = 0;
  const fetchImpl = async () => {
    n += 1;
    return n < 3 ? { ok: false, status: 429 } : { ok: true, status: 200, json: async () => ({ ranks: [{ date: '2026-10-14', rank: 42 }] }) };
  };
  const r = await fetchPopularity('retry-test.io', { fetchImpl, retryDelayMs: 1 });
  assert.equal(r.found, true);
  assert.equal(r.latest, 42);
  assert.equal(n, 3);
});
