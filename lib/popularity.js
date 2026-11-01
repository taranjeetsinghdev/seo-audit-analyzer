/**
 * Free "traffic overview" for any public site, from the Tranco popularity ranking
 * (https://tranco-list.eu — no key, 30 days of daily ranks per domain).
 * This is a popularity RANK, not visitor counts: real visitor numbers for sites you do not
 * own are not available for free. We show the rank, its trend and a tier, clearly labelled.
 */

const API = 'https://tranco-list.eu/api/ranks/domain';
const cache = new Map();
const TTL = 6 * 60 * 60 * 1000;

// Second-level suffixes where the registrable domain has three labels (co.uk, com.au, …).
const SLD = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'or', 'ne', 'go', 'nic', 'res', 'gob', 'mil']);

/** hostname → itself first, then parent domains down to the registrable domain. */
export function candidateDomains(input) {
  let host;
  try {
    host = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return [];
  }
  const labels = host.split('.');
  if (labels.length < 2 || /^\d+(\.\d+){3}$/.test(host)) return [];
  const min = labels.length >= 3 && labels[labels.length - 1].length === 2 && SLD.has(labels[labels.length - 2]) ? 3 : 2;
  const out = [];
  for (let i = 0; i <= labels.length - min; i += 1) out.push(labels.slice(i).join('.'));
  return out;
}

const TIERS = [
  [100, 'Top 100', 'Among the most visited sites on the entire web.'],
  [1_000, 'Top 1,000', 'A very high-traffic, globally recognised site.'],
  [10_000, 'Top 10,000', 'A large, well-established site with substantial traffic.'],
  [100_000, 'Top 100,000', 'A popular site with a strong, steady audience.'],
  [1_000_000, 'Top 1 million', 'A recognised site in the top million globally.'],
];

export function tierFor(rank) {
  if (rank == null) return { label: 'Outside the top 1M', note: 'Not in the global top million. Typical for most business and niche sites; it says nothing about how good the site is.' };
  const t = TIERS.find(([max]) => rank <= max);
  return { label: t ? t[1] : 'Outside the top 1M', note: t ? t[2] : '' };
}

export function normalizeRanks(json, domain) {
  const rows = (json?.ranks || [])
    .filter((r) => r && typeof r.rank === 'number' && r.date)
    .map((r) => ({ date: r.date, rank: r.rank }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return { domain, found: false, series: [], tier: tierFor(null) };

  const first = rows[0];
  const latest = rows[rows.length - 1];
  const ranks = rows.map((r) => r.rank);
  const change = first.rank - latest.rank; // positive = moved up (better)
  const pct = first.rank ? Math.round((change / first.rank) * 100) : 0;
  const mean = ranks.reduce((a, b) => a + b, 0) / ranks.length;
  const spread = (Math.max(...ranks) - Math.min(...ranks)) / mean;
  return {
    domain,
    found: true,
    series: rows,
    latest: latest.rank,
    best: Math.min(...ranks),
    worst: Math.max(...ranks),
    change,
    changePct: pct,
    direction: Math.abs(pct) < 3 ? 'stable' : change > 0 ? 'up' : 'down',
    volatility: spread < 0.05 ? 'steady' : spread < 0.25 ? 'moderate' : 'volatile',
    tier: tierFor(latest.rank),
    from: first.date,
    to: latest.date,
  };
}

// Tranco asks clients to stay under ~1 request/second; keep one in flight, spaced.
let chain = Promise.resolve();
let lastCall = 0;
const gap = 1500;
function paced(fn) {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastCall + gap - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

async function fetchRanks(domain, fetchImpl, retryDelayMs = 2500) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await paced(() => fetchImpl(`${API}/${encodeURIComponent(domain)}`, { headers: { Accept: 'application/json' } }));
    lastStatus = res.status;
    if (res.ok) return res.json();
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1))); // back off, then try again
  }
  if (lastStatus === 429) throw Object.assign(new Error('The ranking service is busy right now. Please try again in a minute.'), { code: 'rate_limited' });
  throw Object.assign(new Error(`The ranking service returned HTTP ${lastStatus}.`), { code: 'upstream' });
}

export async function fetchPopularity(input, { fetchImpl = fetch, retryDelayMs } = {}) {
  const candidates = candidateDomains(input);
  if (!candidates.length) throw Object.assign(new Error('That does not look like a public domain name.'), { code: 'bad_domain' });

  const key = candidates.at(-1);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { ...hit.value, cached: true };

  let result = null;
  try {
    for (const domain of candidates) {
      result = normalizeRanks(await fetchRanks(domain, fetchImpl, retryDelayMs), domain);
      if (result.found) break;
    }
  } catch (err) {
    // Throttled or down: a slightly old answer is better than an error.
    if (hit) return { ...hit.value, cached: true, stale: true };
    throw err;
  }
  const value = { ...result, requested: candidates[0], checked: candidates, source: 'Tranco', fetchedAt: new Date().toISOString() };
  cache.set(key, { at: Date.now(), value });
  return { ...value, cached: false };
}
