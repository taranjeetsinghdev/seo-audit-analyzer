import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCountryFit } from '../lib/country-fit.js';
import { findCountry } from '../lib/countries.js';
import { buildReport } from '../lib/analyze.js';

const IN = findCountry('IN');
const DE = findCountry('DE');
const sig = (fit, id) => fit.signals.find((s) => s.id === id);

test('an Indian site scores strongly for India and weakly for Germany', () => {
  const input = {
    hostname: 'shop.example.co.in', lang: 'en-IN', hreflang: [{ lang: 'en-IN' }, { lang: 'x-default' }],
    text: 'Free delivery across India. Price ₹1,499 (INR 1499). Call +91 98765 43210 today. Made in India.',
    structuredData: [{ data: { '@type': 'LocalBusiness', address: { addressCountry: 'IN' }, telephone: '+91 98765 43210' } }],
  };
  const a = computeCountryFit(IN, input);
  assert.ok(a.score >= 85, `score ${a.score}`);
  assert.equal(a.verdict, 'Strong local ties');
  for (const id of ['domain', 'language', 'hreflang', 'currency', 'phone', 'schema', 'mentions']) assert.equal(sig(a, id).status, 'match', id);
  const b = computeCountryFit(DE, input);
  assert.ok(b.score < 35);
  assert.equal(b.verdict, 'Few local ties');
  assert.equal(sig(b, 'domain').status, 'none'); // .in is another country's domain
});

test('generic .com with no local signals is neutral, not penalised as foreign', () => {
  const fit = computeCountryFit(IN, { hostname: 'example.com', lang: 'en', text: 'A generic page about shoes.', hreflang: [], structuredData: [] });
  assert.equal(sig(fit, 'domain').status, 'neutral');
  assert.equal(sig(fit, 'language').status, 'partial'); // English, but not the country-specific locale
  assert.equal(sig(fit, 'hreflang').status, 'neutral');
  assert.equal(fit.conflicts, 0);
});

test('conflicting signals are flagged', () => {
  const fit = computeCountryFit(DE, {
    hostname: 'example.fr', lang: 'fr', hreflang: [{ lang: 'fr-FR' }, { lang: 'en-GB' }],
    text: 'Prix 20 USD', structuredData: [{ data: { offers: { priceCurrency: 'USD' }, address: { addressCountry: 'FR' } } }],
  });
  assert.equal(sig(fit, 'domain').status, 'none');
  assert.equal(sig(fit, 'language').status, 'none');
  assert.equal(sig(fit, 'hreflang').status, 'none');
  assert.equal(sig(fit, 'currency').status, 'none');
  assert.equal(sig(fit, 'schema').status, 'none');
  assert.equal(fit.verdict, 'Few local ties');
});

test('currency symbols, calling codes and ccTLD variants are recognised', () => {
  const uk = computeCountryFit(findCountry('GB'), { hostname: 'bbc.co.uk', lang: 'en-GB', text: 'Only £25. Call +44 20 7946 0958', hreflang: [], structuredData: [] });
  assert.equal(sig(uk, 'domain').status, 'match');
  assert.equal(sig(uk, 'currency').status, 'match');
  assert.equal(sig(uk, 'phone').status, 'match');
  assert.equal(sig(uk, 'language').status, 'match');
  // "Indiana" and "ruin" must not count as mentions of India / ruin-like currency codes
  const noise = computeCountryFit(IN, { hostname: 'x.com', lang: 'en', text: 'Indiana is a state. ININ', hreflang: [], structuredData: [] });
  assert.equal(sig(noise, 'mentions').status, 'neutral');
  assert.equal(sig(noise, 'currency').status, 'neutral');
});

test('report carries local fit only when a country is selected; the score is unaffected', () => {
  const html = '<html lang="en-IN"><head><title>A reasonably descriptive page title here</title></head><body><h1>Shoes</h1><p>Prices from ₹999. Call +91 99999 99999. Delivered across India.</p></body></html>';
  const base = { html, finalUrl: 'https://shoes.example.in/', statusCode: 200, headers: {} };
  const world = buildReport({ ...base, country: null });
  const india = buildReport({ ...base, country: { code: 'IN', name: 'India', locale: 'en-IN', language: 'en' } });
  assert.equal(world.countryFit, null);
  assert.equal(india.countryFit.country.code, 'IN');
  assert.ok(india.countryFit.score >= 65); // optional hreflang / structured data would raise it further
  assert.equal(india.countryFit.verdict, 'Strong local ties');
  assert.equal(world.score, india.score);
  assert.equal(india.content.text, undefined);
});

test('a plain national-language tag matches; English alone does not pin a country', () => {
  const de = computeCountryFit(DE, { hostname: 'bahn.de', lang: 'de', hreflang: [], text: '', structuredData: [] });
  assert.equal(sig(de, 'language').status, 'match');
  const en = computeCountryFit(findCountry('GB'), { hostname: 'x.com', lang: 'en', hreflang: [], text: '', structuredData: [] });
  assert.equal(sig(en, 'language').status, 'partial');
  const wrong = computeCountryFit(DE, { hostname: 'x.com', lang: 'fr', hreflang: [], text: '', structuredData: [] });
  assert.equal(sig(wrong, 'language').status, 'none');
});

import { inferCountry, detectCity } from '../lib/country-fit.js';

test('infers the country a business serves, and the city it names most', () => {
  const text = 'Greenhse Technologies — lighting for every room. Visit our showroom in Perth, Western Australia. Call +61 8 9000 0000. Prices in AUD. Perth delivery in 24 hours. We ship across Australia.';
  const input = { hostname: 'greenhse.com', lang: 'en', hreflang: [], text, structuredData: [] };
  const c = inferCountry(input);
  assert.equal(c.code, 'AU');
  assert.equal(detectCity('AU', { text }), 'Perth');
  // a structured-data locality wins over text
  assert.equal(detectCity('AU', { text, structuredData: [{ data: { address: { addressLocality: 'Fremantle', addressCountry: 'AU' } } }] }), 'Fremantle');
});

test('does not guess when signals are weak or ambiguous', () => {
  assert.equal(inferCountry({ hostname: 'example.com', lang: 'en', hreflang: [], text: 'A generic page about lighting.', structuredData: [] }), null);
  assert.equal(detectCity('AU', { text: 'We mention Perth once.' }), null); // one passing mention is not a location
  assert.equal(detectCity('ZZ', { text: 'Perth Perth Perth' }), null);
});

test('reports carry the detected location for every analysis, even worldwide', () => {
  const html = '<html lang="en"><head><title>Lighting Perth | Greenhse</title></head><body><h1>Lighting</h1><p>Our Perth showroom. Visit Perth today. Call +61 8 9000 0000 or see Australia-wide delivery. Prices in AUD.</p></body></html>';
  const r = buildReport({ html, finalUrl: 'https://greenhse.com/', statusCode: 200, headers: {}, country: null });
  assert.equal(r.inferredCountry.code, 'AU');
  assert.equal(r.location.city, 'Perth');
  assert.equal(r.location.inferred, true);
  assert.equal(r.countryFit, null);
  assert.equal(r.content.text, undefined);
});

test('a city named in the title beats a suburb in the address', () => {
  const sd = [{ data: { address: { addressLocality: 'Ellenbrook', addressCountry: 'AU' } } }];
  const headline = 'Greenhse Technologies — Trusted LED Lighting & Smart Home, Perth';
  assert.equal(detectCity('AU', { text: '', structuredData: sd, headline }), 'Perth');
  assert.equal(detectCity('AU', { text: '', structuredData: sd, headline: 'Welcome' }), 'Ellenbrook'); // no city in the headline: use the structured locality
  assert.equal(detectCity('AU', { text: 'Visit Sydney. Sydney showroom.', structuredData: [], headline: '' }), 'Sydney');
});
