import { candidateDomains } from './popularity.js';

/**
 * Monthly popularity history (default: the last 6 months) from Tranco's archived monthly lists (free, no key).
 * For each month we resolve that month's list id, then stream its CSV (rank,domain) and stop as soon
 * as the domain is found. Results are cached, and months stream out as they complete.
 */

const API = 'https://tranco-list.eu/api/lists/date';
const listCache = new Map(); // date -> { id } | { id: null }
const historyCache = new Map(); // domain -> { at, value }

const TTL = 24 * 60 * 60 * 1000;

// Worker isolates are ephemeral, so these caches are intentionally memory-only.
const monthCache = new Map(); // `${domain}|${monthKey}` -> { rank, ranked, domain, listId }

const pad = (n) => String(n).padStart(2, '0');

/** The sampling date for each of the last `count` months (oldest first). */
export function monthTargets(now = new Date(), count = 12) {
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15));
    // Past months: the 15th. The current month: the latest list that can exist (yesterday).
    const date = i === 0 ? new Date(now.getTime() - 86400_000) : d;
    out.push({ key: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`, date: date.toISOString().slice(0, 10) });
  }
  return out;
}

let lastApiCall = 0;
let apiChain = Promise.resolve();
function pacedApi(fn, gap = 1100) {
  const run = apiChain.then(async () => {
    const wait = Math.max(0, lastApiCall + gap - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastApiCall = Date.now();
    return fn();
  });
  apiChain = run.catch(() => {});
  return run;
}

async function listIdFor(date, fetchImpl, retryMs, fallbackDays = 4) {
  let lastError = null;
  for (let back = 0; back <= fallbackDays; back += 1) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - back);
    try {
      const id = await listIdForExact(d.toISOString().slice(0, 10), fetchImpl, retryMs);
      if (id) return id;
    } catch (err) {
      lastError = err; // throttled: try an earlier day rather than giving up
    }
  }
  if (lastError) throw lastError;
  return null;
}

async function listIdForExact(date, fetchImpl, retryMs) {
  if (listCache.has(date)) return listCache.get(date).id;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await pacedApi(() => fetchImpl(`${API}/${date}`, { headers: { Accept: 'application/json' } }));
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, retryMs * (attempt + 1)));
      continue;
    }
    if (!res.ok) break;
    const j = await res.json();
    const id = j?.available && !j?.failed ? j.list_id : null;
    listCache.set(date, { id });
    return id;
  }
  throw new Error('Could not resolve the monthly ranking list.');
}

/**
 * Stream "rank,domain" lines and return the rank of the first matching domain, or null.
 * Candidates are tried in priority order (most specific first) within the single pass.
 */
export async function findRankInList(response, domains, { maxRank = Infinity } = {}) {
  const want = new Map(domains.map((d, i) => [d.toLowerCase(), i]));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let best = null; // { priority, rank }
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        const comma = line.indexOf(',');
        if (comma < 1) continue;
        const rank = Number(line.slice(0, comma));
        if (rank > maxRank) return best; // sorted by rank: nothing further can match
        const pr = want.get(line.slice(comma + 1).toLowerCase());
        if (pr !== undefined && (!best || pr < best.priority)) {
          best = { priority: pr, rank, domain: line.slice(comma + 1) };
          if (pr === 0) return best; // most specific candidate: nothing better can follow
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return best;
}

/**
 * Choose which archive to read. The top-1M file is small; a site around or beyond rank 1M needs the
 * full list, scanned only as far as it could plausibly appear (rank order lets us stop early).
 */
export function planScan(latestRank) {
  if (!latestRank || latestRank <= 500_000) return { listSize: '1000000', maxRank: 1_000_000 };
  return { listSize: 'full', maxRank: Math.min(6_000_000, Math.max(1_500_000, Math.round(latestRank * 2.5))) };
}

export async function fetchMonthlyHistory(input, { onMonth, fetchImpl = fetch, now = new Date(), count = 6, concurrency = 6, quickMaxRank = Infinity, retryMs = 2500, timeoutMs = 120_000, listSize = '1000000', maxRank = Infinity } = {}) {
  const domains = candidateDomains(input);
  if (!domains.length) throw Object.assign(new Error('That does not look like a public domain name.'), { code: 'bad_domain' });

  const key = `${domains.at(-1)}:${count}`;
  const hit = historyCache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    hit.value.months.forEach((m) => onMonth?.(m));
    return { ...hit.value, cached: true };
  }

  const targets = monthTargets(now, count);
  const months = new Array(targets.length);
  let next = 0;

  const work = async (i) => {
    const t = targets[i];
    let result = { key: t.key, date: t.date, rank: null, ranked: false };
    const mkey = `${domains.at(-1)}|${t.key}`;
    const isPast = i < targets.length - 1;
    if (isPast && monthCache.has(mkey)) {
      months[i] = { key: t.key, date: t.date, ...monthCache.get(mkey) };
      onMonth?.(months[i]);
      return;
    }
    try {
      const id = await listIdFor(t.date, fetchImpl, retryMs);
      if (id) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          // Fast path: a site near its current rank is found within the first lines, so stop reading there.
          // A miss falls back to the full range, so "not ranked" is never reported from the short scan.
          const scan = async (limit) => {
            const res = await fetchImpl(`https://tranco-list.eu/download/${id}/${listSize}`, { signal: controller.signal });
            if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
            return findRankInList(res, domains, { maxRank: limit });
          };
          const quick = Math.min(quickMaxRank, maxRank);
          let found = await scan(quick);
          if (!found && quick < maxRank) found = await scan(maxRank);
          result = { key: t.key, date: t.date, rank: found ? found.rank : null, ranked: !!found, domain: found?.domain, listId: id };
        } finally {
          clearTimeout(timer);
        }
      } else {
        result.unavailable = true;
      }
    } catch (err) {
      result.error = String(err.message || err).slice(0, 120);
    }
    if (isPast && !result.error && !result.unavailable) {
      const { rank, ranked, domain, listId } = result;
      monthCache.set(mkey, { rank, ranked, domain, listId });
    }
    months[i] = result;
    onMonth?.(result);
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
      while (next < targets.length) {
        const i = next;
        next += 1;
        await work(i);
      }
    }),
  );

  const ranked = months.filter((m) => m.ranked);
  const value = {
    domain: domains.at(-1),
    requested: domains[0],
    source: 'Tranco monthly archives',
    listSize,
    scannedTo: Number.isFinite(maxRank) ? maxRank : null,
    months,
    rankedMonths: ranked.length,
    complete: months.every((m) => !m.error && !m.unavailable),
    fetchedAt: new Date().toISOString(),
  };
  if (value.complete) historyCache.set(key, { at: Date.now(), value });
  return { ...value, cached: false };
}
