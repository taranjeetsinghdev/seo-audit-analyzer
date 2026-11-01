/**
 * Live keyword ideas from public search autocomplete (Google first, DuckDuckGo as fallback).
 * Free and unofficial: it shows what people actually type, but no volumes. Cached for 24 h.
 */

const cache = new Map();
const TTL = 24 * 60 * 60 * 1000;
let last = 0;
let chain = Promise.resolve();

function paced(fn, gap = 700) {
  const run = chain.then(async () => {
    const wait = Math.max(0, last + gap - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

export function parseSuggestions(json, seed) {
  const list = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  return [...new Set(list.map((s) => String(s?.phrase ?? s).trim().toLowerCase()).filter((s) => s && s !== seed.toLowerCase()))].slice(0, 12);
}

async function fromGoogle(seed, fetchImpl, lang, country) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${encodeURIComponent(lang)}${country ? `&gl=${encodeURIComponent(country.toLowerCase())}` : ''}&q=${encodeURIComponent(seed)}`;
  const res = await paced(() => fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseSuggestions(await res.json(), seed);
}

async function fromDuckDuckGo(seed, fetchImpl) {
  const res = await paced(() => fetchImpl(`https://duckduckgo.com/ac/?type=list&q=${encodeURIComponent(seed)}`, { signal: AbortSignal.timeout(8000) }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseSuggestions(await res.json(), seed);
}

export async function fetchIdeas(seeds, { fetchImpl = fetch, lang = 'en', country = '' } = {}) {
  const out = [];
  for (const raw of seeds.slice(0, 3)) {
    const seed = String(raw).trim().toLowerCase().slice(0, 80);
    if (!seed) continue;
    const key = `${lang}:${country}:${seed}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) {
      out.push({ seed, ideas: hit.ideas, source: hit.source, cached: true });
      continue;
    }
    let ideas = [];
    let source = country ? `Google autocomplete (${country.toUpperCase()})` : 'Google autocomplete';
    try {
      ideas = await fromGoogle(seed, fetchImpl, lang, country);
    } catch {
      try {
        ideas = await fromDuckDuckGo(seed, fetchImpl);
        source = 'DuckDuckGo autocomplete';
      } catch {
        out.push({ seed, ideas: [], source: null, error: 'Suggestions are unavailable right now.' });
        continue;
      }
    }
    cache.set(key, { at: Date.now(), ideas, source });
    out.push({ seed, ideas, source, cached: false });
  }
  return out;
}

// ---------------- platform-focused ideas ----------------
const STOP_TOKENS = new Set(['the', 'and', 'for', 'with', 'from', 'your', 'best', 'how', 'what', 'free', 'online', 'new', 'com', 'www']);
// Words that make a brand sound like a company but don't identify it ("X Technologies", "X Pty Ltd").
const GENERIC_BRAND = new Set(['technologies', 'technology', 'tech', 'solutions', 'services', 'group', 'company', 'co', 'ltd', 'pty', 'inc', 'llc', 'corp', 'systems', 'digital', 'studio', 'labs', 'global', 'international', 'store', 'shop', 'official']);

/** Crude stemmer so "runner", "running", "shoe" and "shoes" count as the same word. */
const stem = (w) => {
  let x = w.toLowerCase();
  if (x.length > 4 && x.endsWith('ies')) x = `${x.slice(0, -3)}y`;
  else if (/(ss|x|z|ch|sh)es$/.test(x)) x = x.slice(0, -2);
  else if (x.length > 3 && x.endsWith('s') && !x.endsWith('ss')) x = x.slice(0, -1);
  for (const suf of ['ing', 'er', 'ed']) {
    if (x.length > suf.length + 2 && x.endsWith(suf)) { x = x.slice(0, -suf.length); break; }
  }
  return x.replace(/(.)\1$/, '$1');
};
const wordsOf = (t) => (String(t || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length >= 3 && !STOP_TOKENS.has(w));

/** Edit distance, capped: enough to spot "greenhse" -> "greenhouse". */
function editDistance(a, b, cap = 3) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** The brand's distinctive words (generic company words removed). */
export const brandCore = (brand) => {
  const all = wordsOf(brand);
  const core = all.filter((w) => !GENERIC_BRAND.has(w));
  return core.length ? core : all;
};

/**
 * The searches that matter for one platform: its brand, its topic (localised to where it operates),
 * and comparisons. `location` is { city, country } and is added to topic searches so a Perth lighting
 * store sees "lighting stores perth", not worldwide noise.
 */
export function buildQueries({ brand = '', topic = '', location = null, phrases = [] }) {
  const b = brand.trim();
  const t = topic.trim();
  const place = (location?.city || '').trim();
  const out = [];
  const topicInBrand = t && wordsOf(t).every((w) => wordsOf(b).includes(w));
  if (b) out.push({ id: 'brand', label: `Searches for ${b}`, q: b, need: 'brand' });
  if (b && place) out.push({ id: 'brand-place', label: `${b} in ${place}`, q: `${b} ${place}`, need: 'brand' });
  if (t) {
    if (place) out.push({ id: 'topic-place', label: `${t} in ${place}`, q: `${t} ${place}`, need: 'topic' });
    out.push({ id: 'topic', label: `${t} searches`, q: t, need: 'topic' });
    // A more specific product/service phrase from the page that includes the topic, when there is one.
    const extras = phrases.filter((p) => p.toLowerCase() !== t.toLowerCase() && wordsOf(t).every((w) => wordsOf(p).map(stem).includes(stem(w)))).slice(0, 2);
    extras.forEach((extra, i) => out.push({ id: `phrase${i}`, label: extra.charAt(0).toUpperCase() + extra.slice(1), q: place ? `${extra} ${place}` : extra, need: 'topic' }));
    out.push({ id: 'best', label: place ? `Best ${t} in ${place}` : `Best ${t}`, q: place ? `best ${t} ${place}` : `best ${t}`, need: 'topic' });
  }
  if (b && !topicInBrand) out.push({ id: 'brand-topic', label: `${b} + ${t || 'products'}`, q: `${b} ${t}`.trim(), need: 'brand' });
  if (b) out.push({ id: 'alt', label: `${b} alternatives & comparisons`, q: `${b} vs`, need: 'brand' });
  return out;
}

/**
 * Keep a suggestion only if it is about THIS platform:
 *  - brand searches must contain the brand's distinctive words exactly (autocomplete often "corrects"
 *    an unfamiliar brand into a different company);
 *  - topic searches must contain every topic word AND, when the page gives context, at least one word
 *    typical of this business or its location (this rules out other meanings, e.g. "lighting" vs "Lightning").
 */
const OTHER_PLACES = ['scotland', 'england', 'wales', 'ireland', 'canada', 'usa', 'america', 'india', 'australia', 'zealand', 'africa', 'uk', 'germany', 'france', 'nigeria', 'kenya', 'dubai', 'singapore', 'pakistan', 'philippines'];
/** A suggestion that names a different country than the platform's ("lighting perth scotland"). */
function mentionsOtherCountry(words, location) {
  if (!location?.country) return false;
  const own = new Set(wordsOf(location.country));
  const ownAliases = { australia: ['au', 'aus', 'wa', 'nsw', 'qld', 'vic'], 'united': ['usa', 'america', 'uk'] };
  void ownAliases;
  return words.some((w) => OTHER_PLACES.includes(w) && !own.has(w));
}

export function isRelevant(suggestion, kind, { brand = '', topic = '', context = [], location = null }) {
  const words = wordsOf(suggestion);
  if (mentionsOtherCountry(words, location)) return false;
  const have = new Set(words.map(stem));
  const present = (w) => have.has(stem(w)) || [...have].some((x) => x.length >= 4 && stem(w).length >= 4 && (x.startsWith(stem(w)) || stem(w).startsWith(x)));

  if (kind === 'brand') {
    const core = brandCore(brand);
    // exact words only: "greenhse" must not match "greenhouse"
    return core.length > 0 && core.every((w) => words.includes(w));
  }

  const tt = wordsOf(topic);
  const need = Math.max(1, tt.length >= 5 ? tt.length - 1 : tt.length);
  if (!(tt.length > 0 && tt.filter(present).length >= need)) return false;

  // Autocomplete "corrects" unfamiliar brands into real words ("greenhse" -> "greenhouse"): drop those.
  const core = brandCore(brand);
  if (words.some((w) => core.some((c) => c.length >= 5 && w !== c && w.length >= 5 && editDistance(w, c, 2) <= 2 && w[0] === c[0]))) return false;

  const topicStems = new Set(tt.map(stem));
  const ctx = context.map((c) => stem(c)).filter((c) => c.length >= 3 && !topicStems.has(c));
  const place = wordsOf(`${location?.city || ''} ${location?.country || ''}`).map(stem);
  const brandHit = brandCore(brand).some((w) => words.includes(w));
  if (!ctx.length && !place.length) return true;
  return brandHit || place.some((p) => have.has(p)) || ctx.some((c) => have.has(c) || [...have].some((x) => x.length >= 4 && c.length >= 4 && (x.startsWith(c) || c.startsWith(x))));
}

export async function fetchPlatformIdeas({ brand, topic, context = [], phrases = [], location = null, lang = 'en', country = '' }, { fetchImpl = fetch } = {}) {
  const queries = buildQueries({ brand, topic, location, phrases });
  const seen = new Set();
  const groups = [];
  for (const q of queries) {
    const [res] = await fetchIdeas([q.q], { fetchImpl, lang, country });
    const ideas = (res?.ideas || [])
      .filter((i) => isRelevant(i, q.need, { brand, topic, context, location }))
      .filter((i) => i !== q.q.toLowerCase() && !seen.has(i));
    ideas.forEach((i) => seen.add(i));
    if (ideas.length) groups.push({ id: q.id, label: q.label, query: q.q, ideas: ideas.slice(0, 10), source: res.source });
    else if (res?.error) groups.push({ id: q.id, label: q.label, query: q.q, ideas: [], error: res.error });
  }
  return { brand, topic, location, groups, kept: groups.reduce((a, g) => a + g.ideas.length, 0) };
}
