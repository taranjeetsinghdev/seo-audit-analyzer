import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, analyzeKeywords, ideaSeeds } from '../lib/keywords.js';
import { parseSuggestions, fetchIdeas } from '../lib/keyword-ideas.js';
import { buildReport } from '../lib/analyze.js';

const TEXT = `Trail running shoes are built for rough terrain. The best trail running shoes grip mud and rock.
Our trail running shoes use a durable outsole. Road shoes are different from trail running shoes.
Choose lightweight trail running shoes for long races. Waterproof options keep feet dry.`;

test('tokenizer lowercases, keeps accents and drops punctuation', () => {
  assert.deepEqual(tokenize("Café's Trail-Running, 5K!"), ["café's", 'trail-running', '5k']);
});

test('keyword profile: top terms, phrases, placement and density', () => {
  const p = analyzeKeywords({
    text: TEXT, title: 'Trail Running Shoes | Acme', description: 'Lightweight trail running shoes', h1: ['Trail running shoes'],
    h2: ['Waterproof options'], url: 'https://acme.com/trail-running-shoes', alts: ['trail running shoes on rock'],
  });
  assert.ok(p.totalWords > 30);
  assert.equal(p.primary.term, 'trail running shoes');
  assert.equal(p.primary.inTitle, true);
  assert.equal(p.primary.inH1, true);
  assert.equal(p.primary.inUrl, true);
  assert.equal(p.primary.inAlt, true);
  assert.equal(p.primary.inFirst100, true);
  assert.ok(p.keywords.some((k) => k.term === 'trail' && k.count >= 5));
  assert.ok(!p.keywords.some((k) => ['the', 'are', 'for'].includes(k.term))); // stopwords removed
  assert.ok(p.phrases.some((k) => k.term === 'trail running shoes'));
  assert.ok(!p.phrases.some((k) => k.term === 'trail running')); // absorbed by the longer phrase
  assert.ok(p.checks.every((c) => typeof c.ok === 'boolean'));
  assert.equal(p.checks.find((c) => c.label === 'In the meta description').ok, true);
});

test('a keyword missing from title and H1 is reported as such; stuffing is flagged', () => {
  const stuffed = `${'widget '.repeat(30)} and some other filler words here to pad the sentence out a little more`;
  const p = analyzeKeywords({ text: stuffed, title: 'Home', h1: ['Welcome'], url: 'https://x.com/' });
  assert.equal(p.primary.term, 'widget');
  assert.equal(p.primary.inTitle, false);
  assert.ok(p.stuffed.includes('widget'));
  assert.equal(analyzeKeywords({ text: '' }).primary, null);
});

test('idea seeds are distinct and capped', () => {
  const p = analyzeKeywords({ text: TEXT, title: 'Trail Running Shoes', url: 'https://acme.com/' });
  const seeds = ideaSeeds(p, 3);
  assert.equal(seeds.length <= 3, true);
  assert.equal(new Set(seeds).size, seeds.length);
  assert.equal(seeds[0], p.primary.term);
});

test('report includes a keyword profile and does not keep the raw page text', () => {
  const r = buildReport({
    html: `<html lang="en"><head><title>Trail Running Shoes</title></head><body><h1>Trail running shoes</h1><p>${TEXT}</p></body></html>`,
    finalUrl: 'https://acme.com/trail-running-shoes', statusCode: 200, headers: {},
  });
  assert.equal(r.keywords.primary.term, 'trail running shoes');
  assert.equal(r.content.text, undefined);
});

test('autocomplete parsing (Google and DuckDuckGo shapes), fallback and caching', async () => {
  assert.deepEqual(parseSuggestions(['seed', ['seed', 'seed one', 'Seed Two', 'seed one']], 'seed'), ['seed one', 'seed two']);
  assert.deepEqual(parseSuggestions([{ phrase: 'a b' }], 'x'), []); // wrong shape is ignored
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    if (String(url).includes('suggestqueries')) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ['q', ['q one', 'q two']] };
  };
  const a = await fetchIdeas(['idea-seed-test'], { fetchImpl });
  assert.equal(a[0].source, 'DuckDuckGo autocomplete');
  assert.deepEqual(a[0].ideas, ['q one', 'q two']);
  const before = calls;
  const b = await fetchIdeas(['idea-seed-test'], { fetchImpl });
  assert.equal(b[0].cached, true);
  assert.equal(calls, before);
});

test('adjacent block elements do not glue words together', () => {
  const r = buildReport({
    html: '<html lang="en"><head><title>T</title></head><body><h1>Alpha beta</h1><p>gamma delta</p><div>epsilon</div><ul><li>zeta</li><li>eta</li></ul></body></html>',
    finalUrl: 'https://e.com/', statusCode: 200, headers: {},
  });
  assert.equal(r.content.wordCount, 7);
});

import { platformDefaults } from '../lib/keywords.js';
import { buildQueries, isRelevant, fetchPlatformIdeas } from '../lib/keyword-ideas.js';

test('platform defaults: brand from the title, topic from strongly placed terms (not the brand)', () => {
  const profile = analyzeKeywords({
    text: 'Acme trail running shoes are made for rocky trails. Our trail running shoes grip mud. Trail running shoes for every runner at Acme.',
    title: 'Trail Running Shoes | Acme', description: 'Acme makes trail running shoes', h1: ['Trail running shoes'], url: 'https://acme.com/',
  });
  const d = platformDefaults({ url: 'https://acme.com/', title: 'Trail Running Shoes | Acme', h1: ['Trail running shoes'], keywords: profile });
  assert.equal(d.brand, 'Acme');
  assert.equal(d.topic, 'trail running shoes');
  assert.equal(d.domain, 'acme.com');
  // og:site_name wins for the brand; with no keywords the H1 supplies the topic
  const og = platformDefaults({ url: 'https://acme.com/', title: 'Home', h1: ['Waterproof hiking boots'], ogSiteName: 'Acme Outdoors', keywords: null });
  assert.equal(og.brand, 'Acme Outdoors');
  assert.equal(og.topic, 'waterproof hiking boots');
});

test('queries cover brand, brand+topic, topic, best and comparisons', () => {
  const q = buildQueries({ brand: 'Acme', topic: 'trail running shoes' });
  assert.deepEqual(q.map((x) => x.q), ['Acme', 'trail running shoes', 'best trail running shoes', 'Acme trail running shoes', 'Acme vs']);
  assert.deepEqual(buildQueries({ brand: 'Trail Shoes Co', topic: 'trail shoes' }).map((x) => x.id), ['brand', 'topic', 'best', 'alt']); // topic already in brand
  assert.deepEqual(buildQueries({ brand: '', topic: '' }), []);
});

test('relevance: brand queries must name the brand, topic queries must be about the topic', () => {
  const ctx = { brand: 'Acme', topic: 'trail running shoes' };
  assert.equal(isRelevant('acme login', 'brand', ctx), true);
  assert.equal(isRelevant('acme alternatives', 'brand', ctx), true);
  assert.equal(isRelevant('acme tires near me', 'brand', ctx), true);
  assert.equal(isRelevant('pizza recipes', 'brand', ctx), false);
  assert.equal(isRelevant('trail running shoes for women', 'topic', ctx), true);
  assert.equal(isRelevant('best trail runner shoe 2026', 'topic', ctx), true); // stems: runner~running, shoe~shoes
  assert.equal(isRelevant('running machine price', 'topic', ctx), false);
  assert.equal(isRelevant('football scores', 'topic', ctx), false);
});

test('platform ideas drop unrelated suggestions, de-duplicate and group', async () => {
  const answers = {
    acme: ['acme login', 'acme corporation cartoon', 'acme pizza menu', 'acme pricing'],
    'acme trail running shoes': ['acme trail running shoes review', 'acme trail running shoes sale'],
    'trail running shoes': ['trail running shoes for men', 'trail running shoes review', 'trail running machines'],
    'best trail running shoes': ['best trail running shoes 2026', 'trail running shoes for men'], // duplicate of an earlier idea
    'acme vs': ['acme vs wile e coyote', 'acme vs rival shoes'],
  };
  const fetchImpl = async (url) => {
    const q = decodeURIComponent(new URL(url).searchParams.get('q'));
    return { ok: true, status: 200, json: async () => [q, answers[q] || []] };
  };
  const out = await fetchPlatformIdeas({ brand: 'Acme', topic: 'trail running shoes', lang: 'en', country: '' }, { fetchImpl });
  const all = out.groups.flatMap((g) => g.ideas);
  assert.ok(all.includes('acme login') && all.includes('trail running shoes for men'));
  assert.ok(!all.includes('trail running machines')); // topic words not all present -> filtered
  assert.equal(all.filter((i) => i === 'trail running shoes for men').length, 1); // de-duplicated across groups
  assert.deepEqual(out.groups.map((g) => g.id), ['brand', 'topic', 'best', 'brand-topic', 'alt']);
  assert.equal(out.kept, all.length);
});

test('brand detection uses the registrable name and the "Page | Brand" title convention', () => {
  const mdn = platformDefaults({ url: 'https://developer.mozilla.org/en-US/docs/Web/HTML', title: 'HTML: HyperText Markup Language | MDN', h1: ['HTML: HyperText Markup Language'] });
  assert.equal(mdn.brand, 'MDN');
  assert.equal(platformDefaults({ url: 'https://news.bbc.co.uk/x', title: 'Home', h1: [] }).brand, 'Bbc');
  assert.equal(platformDefaults({ url: 'https://www.flipkart.com/', title: 'Online Shopping Site for Mobiles | Flipkart.com', h1: [] }).brand, 'Flipkart.com');
  assert.equal(platformDefaults({ url: 'https://greenhse.com/', title: 'Buy greenhouses', h1: [] }).brand, 'Greenhse');
});

test('queries are localised to where the platform operates', () => {
  const q = buildQueries({ brand: 'Greenhse Technologies', topic: 'lighting', location: { city: 'Perth', country: 'Australia' }, phrases: ['led lighting', 'pendant lights'] });
  assert.deepEqual(q.map((x) => x.q), ['Greenhse Technologies', 'Greenhse Technologies Perth', 'lighting Perth', 'lighting', 'led lighting Perth', 'pendant lights Perth', 'best lighting Perth', 'Greenhse Technologies lighting', 'Greenhse Technologies vs']);
  // up to two product phrases from the page become their own searches
  const two = buildQueries({ brand: 'Greenhse', topic: 'lighting', location: { city: 'Perth' }, phrases: ['led lighting', 'smart lighting', 'strip lighting'] });
  assert.deepEqual(two.filter((x) => x.id.startsWith('phrase')).map((x) => x.q), ['led lighting Perth', 'smart lighting Perth']);
});

test('brands are matched exactly: "greenhse" never matches the unrelated "greenhouse technologies"', () => {
  const ctx = { brand: 'Greenhse Technologies', topic: 'lighting' };
  assert.equal(isRelevant('greenhse technologies photos', 'brand', ctx), true);
  assert.equal(isRelevant('greenhse lighting perth', 'brand', ctx), true);        // the generic word "technologies" is not required
  assert.equal(isRelevant('greenhouse technologies nelspruit', 'brand', ctx), false); // autocorrected to another company
  assert.equal(isRelevant('greenhouse technologies', 'brand', ctx), false);
  assert.equal(isRelevant('technologies photos', 'brand', ctx), false);          // a generic word alone does not identify the brand
  // the same applies to topic searches that carry an autocorrected brand
  assert.equal(isRelevant('greenhouse lighting ellenbrook', 'topic', { ...ctx, context: ['led'], location: { city: 'Ellenbrook' } }), false);
  assert.equal(isRelevant('led lighting ellenbrook', 'topic', { ...ctx, context: ['led'], location: { city: 'Ellenbrook' } }), true);
});

test('ambiguous topics need business context or a location (lighting is not Lightning)', () => {
  const ctx = {
    brand: 'Greenhse Technologies', topic: 'lighting', context: ['led', 'lights', 'pendant', 'downlights', 'outdoor', 'fixtures'], location: { city: 'Perth', country: 'Australia' },
  };
  for (const ok of ['led lighting perth', 'outdoor lighting ideas', 'pendant lighting for kitchen', 'lighting stores in perth', 'downlights vs led lighting']) assert.equal(isRelevant(ok, 'topic', ctx), true, ok);
  for (const bad of ['lighting earphone', 'lighting cable earphone', 'lighting keyboard', 'lighting arresters', 'lighting up the stars']) assert.equal(isRelevant(bad, 'topic', ctx), false, bad);
  // with no context at all the filter falls back to topic words only
  assert.equal(isRelevant('lighting earphone', 'topic', { brand: 'X', topic: 'lighting' }), true);
});

test('suggestions about a different country are dropped; marketing filler is never the topic', () => {
  const ctx = { brand: 'Greenhse', topic: 'lighting', context: ['led'], location: { city: 'Perth', country: 'Australia' } };
  assert.equal(isRelevant('led lighting perth scotland', 'topic', ctx), false);
  assert.equal(isRelevant('led lighting perth wa', 'topic', ctx), true);
  assert.equal(isRelevant('led lighting australia', 'topic', ctx), true); // own country is fine

  const profile = analyzeKeywords({
    text: `Make every moment count. ${'Hardware tools and timber for every project. '.repeat(6)} Every moment matters, a moment of quality. Moment moment.`,
    title: 'Hardware, Tools & Timber | Bunnings', description: 'Every moment counts with hardware', h1: ['Make every moment count'], url: 'https://bunnings.example/',
  });
  const d = platformDefaults({ url: 'https://bunnings.example/', title: 'Hardware, Tools & Timber | Bunnings', h1: ['Make every moment count'], keywords: profile });
  assert.equal(d.brand, 'Bunnings');
  assert.notEqual(d.topic, 'moment');
  assert.match(d.topic, /hardware|tools|timber/);
});
