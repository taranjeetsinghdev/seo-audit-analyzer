import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from '../lib/analyze.js';

const page = (html, extra = {}) => ({ html, finalUrl: 'https://example.com/', statusCode: 200, headers: {}, ...extra });
const check = (report, id) => report.checks.find((c) => c.id === id);

const GOOD = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>A reasonably descriptive page title here</title>
<meta name="description" content="${'A helpful description of the page content. '.repeat(3).trim()}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://example.com/">
<meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:image" content="/i.png"><meta property="og:url" content="https://example.com/"><meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"X","url":"https://example.com/"}</script>
</head><body><main><h1>A descriptive page about the topic</h1><h2>Sub</h2><p>We build simple tools for small teams. Our tools help you plan work and track progress. Every feature is easy to learn and quick to use. You can start in minutes without any training. Customers tell us the clear design saves them hours each week. We answer every question within one working day. Pricing is fair and there are no hidden fees. You can cancel at any time. Our support team lives in your time zone and speaks your language. We publish updates every month so the product keeps getting better. Read the guides to see how other teams get started. Join thousands of happy users today. Tell us what you need and we will help you find the right plan. Security matters to us, so we protect your data with strong encryption. Backups run every night and restores take only a few minutes.</p><p>We build simple tools for small teams. Our tools help you plan work and track progress. Every feature is easy to learn and quick to use. You can start in minutes without any training. Customers tell us the clear design saves them hours each week. We answer every question within one working day. Pricing is fair and there are no hidden fees. You can cancel at any time. Our support team lives in your time zone and speaks your language. We publish updates every month so the product keeps getting better. Read the guides to see how other teams get started. Join thousands of happy users today. Tell us what you need and we will help you find the right plan. Security matters to us, so we protect your data with strong encryption. Backups run every night and restores take only a few minutes.</p><img src="/a.png" alt="a" width="10" height="10">
<a href="/about">About our team</a> <a href="/pricing">See pricing plans</a> <a href="/contact">Contact the sales team</a> <a href="/blog">Read the blog</a> <a href="/faq">Frequently asked questions</a></main></body></html>`;

test('well-formed page scores 100 across rubric', () => {
  const r = buildReport(page(GOOD));
  assert.equal(r.score, 100);
  assert.equal(r.grade, 'A');
  // 102 HTML points; compression, image-dimensions and form labels have nothing to judge here (no headers, 1 image, no form).
  assert.equal(r.scoring.pointsPossible, 102 - 2 - 2 - 3); // JS-rendering checks are not evaluated without a live render
});

test('an average page scores well below a strict, complete one', () => {
  const average = '<!doctype html><html lang="en"><head><title>Home</title><meta name="description" content="Welcome to our site, we are glad you are here and hope you enjoy it a lot."><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h1>Welcome</h1><p>We sell things.</p><img src="/a.png"><img src="/b.png"><img src="/c.png"><a href="/x">click here</a><a href="/y">read more</a><a href="/z">more</a><a href="/w">here</a><a href="/v">learn more</a></body></html>';
  const r = buildReport(page(average));
  assert.ok(r.score < 60, `score ${r.score}`);
  for (const id of ['content-length', 'anchor-text', 'image-dimensions', 'canonical', 'heading-structure']) assert.notEqual(check(r, id).status, 'pass', id);
});

test('strict checks: URL quality, mixed content, no-image pages and weak titles', () => {
  const r = buildReport(page('<html><head><title>Hi</title></head><body><script src="http://cdn.example.net/a.js"></script></body></html>', { finalUrl: 'https://example.com/Some_Page?a=1&b=2&c=3&d=4' }));
  assert.equal(check(r, 'url-quality').status, 'warning');
  assert.equal(check(r, 'mixed-content').status, 'warning');
  assert.equal(check(r, 'title-length').status, 'fail');
  assert.equal(check(r, 'image-alt').status, 'not_applicable'); // no images earn no free points
});

test('empty page fails core checks and never crashes', () => {
  const r = buildReport(page('<html></html>'));
  assert.equal(check(r, 'title-exists').status, 'fail');
  assert.equal(check(r, 'title-length').status, 'not_applicable');
  assert.ok(r.score < 50);
  assert.ok(r.issues.length > 0);
});

test('not-applicable checks leave the denominator', () => {
  const r = buildReport(page('<html lang="en"><head><title>x</title></head></html>'));
  assert.equal(check(r, 'description-length').status, 'not_applicable');
  // description-length 2, image-alt 4, title-h1 2, description-quality 1, compression 2, image-dimensions 2, anchor-text 2 do not apply
  assert.equal(r.scoring.pointsPossible, 102 - 33); // plus readability 4, keyword-stuffing 3, form labels 3, names 3, schema 5
});

test('multiple H1 warns, noindex fails, X-Robots-Tag honoured', () => {
  const r = buildReport(page('<html><body><h1>a</h1><h1>b</h1></body></html>', { headers: { 'x-robots-tag': 'noindex' } }));
  assert.equal(check(r, 'h1').status, 'warning');
  assert.equal(check(r, 'robots').status, 'fail');
});

test('missing alt and invalid JSON-LD are detected', () => {
  const r = buildReport(page('<html><body><img src="a.png"><img src="b.png" alt=""><script type="application/ld+json">{bad</script></body></html>'));
  assert.equal(r.images.missingAlt, 1);
  assert.equal(r.images.emptyAlt, 1);
  assert.equal(check(r, 'structured-data').status, 'fail');
});

test('http final URL fails https check', () => {
  const r = buildReport(page(GOOD, { finalUrl: 'http://example.com/' }));
  assert.equal(check(r, 'https').status, 'fail');
});

test('links are split internal/external', () => {
  const r = buildReport(page('<a href="/x">x</a><a href="https://www.example.com/y">y</a><a href="https://other.org">o</a><a href="mailto:a@b.c">m</a>'));
  assert.equal(r.links.internal, 2);
  assert.equal(r.links.external, 1);
});

test('SVG title in body is not mistaken for the page title', () => {
  const r = buildReport(page('<html><body><svg><title>Icon</title></svg></body></html>'));
  assert.equal(r.metadata.title, '');
  assert.equal(check(r, 'title-exists').status, 'fail');
});

test('og:image is resolved to an absolute URL', () => {
  const r = buildReport(page('<html><head><meta property="og:image" content="/img/card.png"></head></html>'));
  assert.equal(r.metadata.og.image, 'https://example.com/img/card.png');
});

test('presentational and tracking images are not counted as missing alt', () => {
  const r = buildReport(page('<img src="a.png" role="presentation"><img src="p.gif" width="1" height="1"><img src="c.png">'));
  assert.equal(r.images.total, 3);
  assert.equal(r.images.missingAlt, 1);
});

test('canonical from HTTP Link header is honoured', () => {
  const r = buildReport(page('<html></html>', { headers: { link: '<https://example.com/main>; rel="canonical"' } }));
  assert.equal(r.metadata.canonical, 'https://example.com/main');
});

test('notices flag error status and likely JS-rendered pages', () => {
  const err = buildReport(page('<html><body>Not found</body></html>', { statusCode: 404 }));
  assert.ok(err.notices.some((n) => /404/.test(n.message)));
  const spa = buildReport(page('<html><body><div id="root"></div><script src="/a.js"></script></body></html>'));
  assert.ok(spa.notices.some((n) => /JavaScript/.test(n.message)));
});

test('block / challenge pages produce a bot-protection notice', () => {
  const r = buildReport(page('<html><head><title>Access Denied</title></head><body>You don\'t have permission</body></html>', { statusCode: 403 }));
  assert.ok(r.notices.some((n) => /block automated requests/.test(n.message)));
});
