/**
 * "Local fit": how strongly a page is tied to one country, judged only from signals in the page and its
 * domain. Free, keyless and computed live. It is NOT a traffic or ranking number: it answers
 * "does this site look built for people in <country>?".
 */

import { COUNTRIES } from './countries.js';
import { CITIES } from './cities.js';

const GENERIC_TLDS = new Set(['com', 'org', 'net', 'io', 'co', 'app', 'dev', 'ai', 'info', 'biz', 'xyz', 'online', 'site', 'shop', 'store', 'tech', 'cloud', 'agency', 'blog', 'edu', 'gov']);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countMatches = (text, re) => (text.match(re) || []).length;

/** The suffix labels of a hostname, e.g. "shop.example.co.in" → ["in", "co"]. */
function tldLabels(host) {
  const parts = String(host || '').toLowerCase().replace(/\.$/, '').split('.');
  return [parts.at(-1), parts.at(-2)].filter(Boolean);
}

function jsonLdFacts(items = []) {
  const facts = { addressCountries: [], areaServed: [], currencies: [], phones: [] };
  const walk = (n, depth = 0) => {
    if (!n || typeof n !== 'object' || depth > 6) return;
    if (Array.isArray(n)) return n.forEach((x) => walk(x, depth + 1));
    if (n.addressCountry) facts.addressCountries.push(typeof n.addressCountry === 'object' ? n.addressCountry.name : String(n.addressCountry));
    if (n.areaServed) [].concat(n.areaServed).forEach((a) => facts.areaServed.push(typeof a === 'object' ? a.name : String(a)));
    if (n.priceCurrency) facts.currencies.push(String(n.priceCurrency).toUpperCase());
    if (n.telephone) facts.phones.push(String(n.telephone));
    Object.values(n).forEach((v) => walk(v, depth + 1));
  };
  items.forEach((i) => walk(i.data));
  return facts;
}

/**
 * @param country   entry from lib/countries.js
 * @param input     { hostname, lang, hreflang:[{lang}], text, structuredData:[{data}] }
 */
export function computeCountryFit(country, { hostname = '', lang = '', hreflang = [], text = '', structuredData = [] } = {}) {
  const code = country.code.toLowerCase();
  const signals = [];
  const add = (id, label, weight, status, evidence) => signals.push({ id, label, weight, status, evidence });

  // 1. Domain
  const labels = tldLabels(hostname);
  const ownTld = labels.find((l) => country.tlds.includes(l));
  if (ownTld) add('domain', 'Country domain', 20, 'match', `.${ownTld} is ${country.name}'s country-code domain`);
  else if (labels[0] && !GENERIC_TLDS.has(labels[0]) && labels[0].length === 2) add('domain', 'Country domain', 20, 'none', `.${labels[0]} belongs to another country`);
  else add('domain', 'Country domain', 20, 'neutral', `.${labels[0] || '?'} is generic: no country signal`);

  // 2. Page language
  const pageLang = String(lang || '').toLowerCase();
  if (!pageLang) add('language', 'Page language', 20, 'neutral', 'No lang attribute on <html>');
  else if (pageLang === country.locale.toLowerCase() || pageLang.endsWith(`-${code}`)) add('language', 'Page language', 20, 'match', `lang="${lang}" targets ${country.name}`);
  else if (pageLang === country.language && country.language !== 'en') add('language', 'Page language', 20, 'match', `lang="${lang}" is ${country.name}'s national language`);
  else if (pageLang.split('-')[0] === country.language) add('language', 'Page language', 20, 'partial', `lang="${lang}" matches the language (${country.language}) but not the country`);
  else add('language', 'Page language', 20, 'none', `lang="${lang}", not ${country.language}`);

  // 3. hreflang
  const tags = hreflang.map((h) => String(h.lang || '').toLowerCase());
  if (!tags.length) add('hreflang', 'Regional alternates (hreflang)', 20, 'neutral', 'No hreflang annotations (not needed for a single-region site)');
  else if (tags.some((t) => t.endsWith(`-${code}`))) add('hreflang', 'Regional alternates (hreflang)', 20, 'match', `Declares a ${country.name} version`);
  else if (tags.some((t) => t === country.language || t === 'x-default')) add('hreflang', 'Regional alternates (hreflang)', 20, 'partial', 'Has a language-level or default alternate, not a country one');
  else add('hreflang', 'Regional alternates (hreflang)', 20, 'none', `Alternates exist (${tags.slice(0, 4).join(', ')}) but none for ${country.name}`);

  // 4. Currency
  const facts = jsonLdFacts(structuredData);
  const codeRe = new RegExp(`(?<![A-Za-z])${country.currency}(?![A-Za-z])`, 'g');
  const symRe = country.symbols.length ? new RegExp(country.symbols.map(esc).join('|'), 'g') : null;
  const curHits = countMatches(text, codeRe) + (symRe ? countMatches(text, symRe) : 0) + facts.currencies.filter((c) => c === country.currency).length;
  if (curHits) add('currency', 'Local currency', 15, 'match', `${country.currency}${country.symbols[0] ? ` / ${country.symbols[0]}` : ''} appears ${curHits}×`);
  else if (facts.currencies.length) add('currency', 'Local currency', 15, 'none', `Prices are in ${[...new Set(facts.currencies)].join(', ')}`);
  else add('currency', 'Local currency', 15, 'neutral', `No ${country.currency} prices found`);

  // 5. Phone
  const dialRe = new RegExp(`(?:\\+|00)\\s?\\(?${country.dial}\\)?[\\s\\-.(]?\\d`, 'g');
  const phoneHits = countMatches(text, dialRe) + facts.phones.filter((p) => new RegExp(`^(?:\\+|00)\\s?${country.dial}`).test(p.replace(/\s/g, ''))).length;
  if (phoneHits) add('phone', 'Local phone number', 10, 'match', `A +${country.dial} number is listed`);
  else add('phone', 'Local phone number', 10, 'neutral', `No +${country.dial} number found`);

  // 6. Structured data: address / area served
  const places = [...facts.addressCountries, ...facts.areaServed].map((s) => String(s).toLowerCase());
  if (places.some((p) => p === code || p === country.name.toLowerCase() || p.includes(country.name.toLowerCase()))) {
    add('schema', 'Structured address / area served', 10, 'match', `JSON-LD names ${country.name}`);
  } else if (places.length) add('schema', 'Structured address / area served', 10, 'none', `JSON-LD points to ${[...new Set(places)].slice(0, 3).join(', ')}`);
  else add('schema', 'Structured address / area served', 10, 'neutral', 'No address or areaServed in JSON-LD');

  // 7. Mentions of the country in the text
  const mentions = countMatches(text, new RegExp(`(?<![A-Za-z])${esc(country.name)}(?![A-Za-z])`, 'gi'));
  add('mentions', `Mentions of ${country.name}`, 5, mentions >= 2 ? 'match' : mentions ? 'partial' : 'neutral', mentions ? `Named ${mentions}× in the page text` : `${country.name} is not mentioned`);

  const credit = { match: 1, partial: 0.5, neutral: 0, none: 0 };
  const total = signals.reduce((a, s) => a + s.weight, 0);
  const earned = signals.reduce((a, s) => a + s.weight * credit[s.status], 0);
  const score = Math.round((earned / total) * 100);
  const strong = signals.filter((s) => s.status === 'match').length;
  const conflicts = signals.filter((s) => s.status === 'none').length;

  return {
    country: { code: country.code, name: country.name },
    score,
    verdict: score >= 65 ? 'Strong local ties' : score >= 35 ? 'Some local ties' : 'Few local ties',
    matched: strong,
    conflicts,
    signals,
  };
}

const STRONG = new Set(['domain', 'currency', 'phone', 'schema', 'hreflang']);

/**
 * Which country does this site seem to serve? Scores every country against the page's signals and
 * answers only when one clearly leads (and has at least one hard signal, not just language).
 */
export function inferCountry(input) {
  const scored = COUNTRIES.map((c) => ({ c, fit: computeCountryFit(c, input) })).sort((a, b) => b.fit.score - a.fit.score);
  const [top, second] = scored;
  if (!top) return null;
  const hard = top.fit.signals.some((s) => STRONG.has(s.id) && s.status === 'match') || top.fit.signals.find((s) => s.id === 'mentions')?.status === 'match';
  if (top.fit.score >= 20 && top.fit.score - (second?.fit.score ?? 0) >= 8 && hard) {
    return { code: top.c.code, name: top.c.name, score: top.fit.score, language: top.c.language };
  }
  return null;
}

/**
 * The city a business presents itself in. Priority: a city named in the title / description / H1
 * (how customers see it, e.g. "Perth"), then the structured-data locality, then the most-mentioned city.
 */
export function detectCity(countryCode, { text = '', structuredData = [], headline = '' } = {}) {
  const cities = CITIES[countryCode];
  if (!cities) return null;
  const mentions = (hay, city) => (hay.match(new RegExp(`(?<![A-Za-z])${esc(city)}(?![A-Za-z])`, 'g')) || []).length;

  const inHeadline = cities.map((c) => ({ c, n: mentions(headline, c) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0];
  if (inHeadline) return inHeadline.c;

  const places = [];
  const walk = (n, d = 0) => {
    if (!n || typeof n !== 'object' || d > 6) return;
    if (Array.isArray(n)) return n.forEach((x) => walk(x, d + 1));
    if (n.addressLocality) places.push(String(n.addressLocality));
    Object.values(n).forEach((v) => walk(v, d + 1));
  };
  structuredData.forEach((i) => walk(i.data));
  for (const p of places) {
    const hit = cities.find((c) => c.toLowerCase() === p.toLowerCase());
    if (hit) return hit;
  }
  let best = null;
  for (const city of cities) {
    const n = mentions(text, city);
    if (n >= 2 && (!best || n > best.n)) best = { city, n };
  }
  if (best) return best.city;
  return places[0] || null; // a real locality from structured data, even if not a major city
}
