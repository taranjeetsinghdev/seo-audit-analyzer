import test from 'node:test';
import assert from 'node:assert/strict';
import { monthTargets, findRankInList, fetchMonthlyHistory, planScan } from '../lib/popularity-history.js';

const csvResponse = (text, chunk = 40) => {
  const bytes = new TextEncoder().encode(text);
  let pos = 0;
  return new Response(new ReadableStream({
    pull(c) {
      if (pos >= bytes.length) return c.close();
      c.enqueue(bytes.slice(pos, pos + chunk));
      pos += chunk;
    },
  }));
};

test('monthTargets covers 12 months ending now, oldest first', () => {
  const t = monthTargets(new Date('2026-10-15T08:00:00Z'), 12);
  assert.equal(t.length, 12);
  assert.equal(t[0].key, '2025-11');
  assert.equal(t[11].key, '2026-10');
  assert.equal(t[0].date, '2025-11-15');
  // the current month always samples the most recent list that can exist (yesterday)
  assert.equal(t[11].date, '2026-10-14');
  assert.equal(monthTargets(new Date('2026-10-05T08:00:00Z'), 1)[0].date, '2026-10-04');
});

test('stream search finds a domain across chunk boundaries and prefers the most specific candidate', async () => {
  const csv = '1,google.com\n2,facebook.com\n3,sub.example.org\n4,example.org\n';
  const r = await findRankInList(csvResponse(csv, 7), ['sub.example.org', 'example.org']);
  assert.deepEqual([r.rank, r.domain], [3, 'sub.example.org']);
  const parent = await findRankInList(csvResponse('1,a.com\n9,example.org\n', 5), ['sub.example.org', 'example.org']);
  assert.equal(parent.rank, 9);
  assert.equal(await findRankInList(csvResponse('1,a.com\n2,b.com\n'), ['zzz.io']), null);
});

test('monthly history streams months, handles unranked months and caches', async () => {
  let downloads = 0;
  const fetchImpl = async (url) => {
    if (url.includes('/api/lists/date/')) {
      const month = Number(url.split('/').pop().slice(5, 7));
      return { ok: true, status: 200, json: async () => ({ available: true, failed: false, list_id: `L${url.split('/').pop()}` , month }) };
    }
    downloads += 1;
    const date = url.split('/download/')[1].split('/')[0].slice(1);
    const ranked = Number(date.slice(5, 7)) % 2 === 0; // ranked only in even months
    return csvResponse(ranked ? `1,a.com\n${1000 + Number(date.slice(5, 7))},history-test.com\n` : '1,a.com\n2,b.com\n');
  };
  const seen = [];
  const h = await fetchMonthlyHistory('history-test.com', { fetchImpl, now: new Date('2026-10-15T00:00:00Z'), count: 4, retryMs: 1, onMonth: (m) => seen.push(m.key) });
  assert.equal(h.months.length, 4);
  assert.equal(seen.length, 4);
  assert.deepEqual(h.months.map((m) => m.key), ['2026-07', '2026-08', '2026-09', '2026-10']);
  assert.deepEqual(h.months.map((m) => m.ranked), [false, true, false, true]);
  assert.equal(h.months[1].rank, 1008);
  assert.equal(h.rankedMonths, 2);
  assert.equal(h.complete, true);
  const again = await fetchMonthlyHistory('history-test.com', { fetchImpl, now: new Date('2026-10-15T00:00:00Z'), count: 4, retryMs: 1 });
  assert.equal(again.cached, true);
  assert.equal(downloads, 4);
});

test('falls back to an earlier day when the newest list is not published yet', async () => {
  const asked = [];
  const fetchImpl = async (url) => {
    if (url.includes('/api/lists/date/')) {
      const date = url.split('/').pop();
      asked.push(date);
      const ok = date <= '2027-03-12';
      return { ok: true, status: 200, json: async () => (ok ? { available: true, failed: false, list_id: `ID${date}` } : { available: false }) };
    }
    return csvResponse('1,a.com\n77,fallback-history.net\n');
  };
  const h = await fetchMonthlyHistory('fallback-history.net', { fetchImpl, now: new Date('2027-03-15T00:00:00Z'), count: 1, retryMs: 1 });
  assert.equal(h.months[0].ranked, true);
  assert.equal(h.months[0].rank, 77);
  assert.ok(asked.includes('2027-03-13') && asked.includes('2027-03-12'));
  assert.equal(h.complete, true);
});

test('rank cut-off stops the scan, and planScan picks the right archive', async () => {
  const csv = '1,a.com\n2,b.com\n3,c.com\n4,target.org\n';
  assert.equal(await findRankInList(csvResponse(csv, 6), ['target.org'], { maxRank: 3 }), null); // stops before rank 4
  assert.equal((await findRankInList(csvResponse(csv, 6), ['target.org'], { maxRank: 10 })).rank, 4);
  assert.deepEqual(planScan(null), { listSize: '1000000', maxRank: 1_000_000 });
  assert.deepEqual(planScan(120_000), { listSize: '1000000', maxRank: 1_000_000 });
  const far = planScan(1_520_426);
  assert.equal(far.listSize, 'full');
  assert.equal(far.maxRank, 3_801_065);
  assert.equal(planScan(4_200_000).maxRank, 6_000_000);
});

test('history defaults to the last 6 months', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('/api/lists/date/')) return { ok: true, status: 200, json: async () => ({ available: true, failed: false, list_id: `D${url.split('/').pop()}` }) };
    return csvResponse('1,a.com\n55,default-six.dev\n');
  };
  const h = await fetchMonthlyHistory('default-six.dev', { fetchImpl, now: new Date('2027-06-15T00:00:00Z'), retryMs: 1 });
  assert.equal(h.months.length, 6);
  assert.deepEqual([h.months[0].key, h.months[5].key], ['2027-01', '2027-06']);
});
