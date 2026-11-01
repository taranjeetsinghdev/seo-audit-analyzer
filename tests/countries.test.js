import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, findCountry, flagOf, acceptLanguageFor, countryInfo } from '../lib/countries.js';
import { buildReport } from '../lib/analyze.js';
import { fetchIdeas } from '../lib/keyword-ideas.js';
import { MODULES } from '../lib/modules.js';
import { RULES } from '../lib/seo-rules.js';

const page = (html, country, extra = {}) => ({ html, finalUrl: 'https://example.com/', statusCode: 200, headers: {}, country: countryInfo(country), ...extra });
const rule = (r, id) => r.checks.find((c) => c.id === id);

test('country list is complete, unique, sorted and well-formed', () => {
  assert.ok(COUNTRIES.length >= 55);
  assert.equal(new Set(COUNTRIES.map((c) => c.code)).size, COUNTRIES.length);
  assert.deepEqual(COUNTRIES.map((c) => c.name), [...COUNTRIES.map((c) => c.name)].sort((a, b) => a.localeCompare(b)));
  for (const c of COUNTRIES) {
    assert.match(c.locale, /^[a-z]{2}-[A-Z]{2}$/);
    assert.ok(c.timezone.includes('/') && Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180, c.code);
  }
});

test('lookup, flags and Accept-Language', () => {
  assert.equal(findCountry('in').name, 'India');
  assert.equal(findCountry('ZZ'), null);
  assert.equal(findCountry(''), null);
  assert.equal(flagOf('IN'), '🇮🇳');
  assert.equal(flagOf('de'), '🌐'); // codes must be upper-case; anything else falls back to the globe
  assert.equal(flagOf(''), '🌐');
  assert.equal(acceptLanguageFor(null), 'en');
  assert.equal(acceptLanguageFor(findCountry('IN')), 'en-IN,en;q=0.9');
  assert.equal(acceptLanguageFor(findCountry('DE')), 'de-DE,de;q=0.9,en;q=0.5');
});

test('every rule still belongs to exactly one module (country rule included)', () => {
  const owned = MODULES.flatMap((m) => m.checks);
  for (const r of RULES) assert.equal(owned.filter((id) => id === r.id).length, 1, r.id);
});

test('worldwide: targeting check is not applicable and the report has no country', () => {
  const r = buildReport(page('<html lang="en"><head><title>T</title></head></html>', null));
  assert.equal(rule(r, 'country-targeting').status, 'not_applicable');
  assert.equal(r.country, null);
  assert.ok(!r.notices.some((n) => /Analysed as a visitor/.test(n.message)));
});

test('country view: notice, metadata and targeting verdicts', () => {
  const de = findCountry('DE');
  const ok = buildReport(page('<html lang="de"><head><title>T</title></head></html>', de));
  assert.equal(rule(ok, 'country-targeting').status, 'pass'); // page language matches
  assert.equal(ok.country.name, 'Germany');
  assert.ok(ok.notices.some((n) => /Analysed as a visitor from Germany/.test(n.message)));

  const wrongLang = buildReport(page('<html lang="en"><head><title>T</title></head></html>', de));
  assert.equal(rule(wrongLang, 'country-targeting').status, 'warning');
  assert.match(rule(wrongLang, 'country-targeting').recommendation, /hreflang/);

  const exact = buildReport(page('<html lang="en"><head><title>T</title><link rel="alternate" hreflang="de-DE" href="/de/"></head></html>', de));
  assert.equal(rule(exact, 'country-targeting').status, 'pass');

  const missing = buildReport(page('<html lang="en"><head><title>T</title><link rel="alternate" hreflang="fr-FR" href="/fr/"><link rel="alternate" hreflang="en-GB" href="/gb/"></head></html>', de));
  assert.equal(rule(missing, 'country-targeting').status, 'warning');

  const langLevel = buildReport(page('<html lang="en"><head><title>T</title><link rel="alternate" hreflang="de" href="/de/"></head></html>', de));
  assert.equal(rule(langLevel, 'country-targeting').status, 'pass');
});

test('the targeting check is advisory and never changes the score', () => {
  const html = '<html lang="en"><head><title>A reasonably descriptive page title here</title></head><body><h1>x</h1></body></html>';
  assert.equal(buildReport(page(html, null)).score, buildReport(page(html, findCountry('JP'))).score);
});

test('keyword ideas are requested for the chosen country', async () => {
  const urls = [];
  const fetchImpl = async (u) => { urls.push(String(u)); return { ok: true, status: 200, json: async () => ['q', ['q one']] }; };
  await fetchIdeas(['country-seed-a'], { fetchImpl, lang: 'hi', country: 'IN' });
  assert.match(urls[0], /hl=hi/);
  assert.match(urls[0], /gl=in/);
  const worldwide = [];
  await fetchIdeas(['country-seed-b'], { fetchImpl: async (u) => { worldwide.push(String(u)); return { ok: true, status: 200, json: async () => ['q', ['x']] }; } });
  assert.ok(!/gl=/.test(worldwide[0]));
});
