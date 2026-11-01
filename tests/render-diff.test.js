import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from '../lib/analyze.js';

const RAW = '<html lang="en"><head><title>Shell</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
const RENDERED = `<html lang="en"><head><title>Real Title For The Page Here Today</title>
<meta name="description" content="Injected by JavaScript after load, a useful description of the page."><link rel="canonical" href="https://example.com/real">
</head><body><div id="root"><h1>Welcome</h1><h2>Section</h2><p>${'content words '.repeat(120)}</p><a href="/a">A</a><a href="/b">B</a></div></body></html>`;

const page = (extra = {}) => ({
  html: RENDERED, rawHtml: RAW, finalUrl: 'https://example.com/', rawFinalUrl: 'https://example.com/',
  statusCode: 200, headers: {}, method: 'rendered', fetchMs: 3200,
  renderInfo: { consoleErrors: [], failedRequests: [], httpErrors: [] }, ...extra,
});
const check = (r, id) => r.checks.find((c) => c.id === id);

test('rendered page is analysed and compared against raw HTML', () => {
  const r = buildReport(page());
  assert.equal(r.metadata.title, 'Real Title For The Page Here Today'); // live DOM drives the report
  assert.equal(r.render.used, true);
  assert.equal(r.render.diff.items.find((i) => i.field === 'title').result, 'changed');
  assert.equal(r.render.diff.items.find((i) => i.field === 'description').result, 'added');
  assert.equal(r.render.diff.level, 'high');
  assert.equal(check(r, 'js-metadata').status, 'warning');
  assert.equal(check(r, 'js-content').status, 'warning');
  assert.equal(check(r, 'js-links').status, 'warning');
  assert.equal(check(r, 'render-health').status, 'pass');
  assert.ok(!r.coverage.notEvaluated.some((n) => n.id === 'js-rendering'));
});

test('canonical changed by JavaScript is a conflict', () => {
  const raw = RAW.replace('</head>', '<link rel="canonical" href="https://example.com/old"></head>');
  const r = buildReport(page({ rawHtml: raw }));
  assert.equal(check(r, 'js-conflict').status, 'fail');
});

test('identical raw and rendered HTML shows no JavaScript dependence', () => {
  const r = buildReport(page({ rawHtml: RENDERED }));
  assert.equal(r.render.diff.dependence, 0);
  assert.equal(check(r, 'js-content').status, 'pass');
  assert.equal(check(r, 'js-metadata').status, 'pass');
});

test('without rendering the JS checks are not evaluated (never faked)', () => {
  const r = buildReport({ html: RAW, finalUrl: 'https://example.com/', statusCode: 200, headers: {}, method: 'http' });
  assert.equal(r.render.used, false);
  for (const id of ['js-metadata', 'js-conflict', 'js-content', 'js-links', 'render-health']) {
    assert.equal(check(r, id).status, 'not_evaluated');
  }
  assert.ok(r.coverage.notEvaluated.some((n) => n.id === 'js-rendering'));
});

test('render errors surface as a render-health warning', () => {
  const r = buildReport(page({ renderInfo: { consoleErrors: [{ text: 'x is undefined' }], failedRequests: [], httpErrors: [{ url: 'https://example.com/a.js', status: 404 }] } }));
  assert.equal(check(r, 'render-health').status, 'warning');
});

test('JavaScript-rendering checks are part of the score when a live render exists', () => {
  const withRender = buildReport(page());
  const without = buildReport({ html: RENDERED, finalUrl: 'https://example.com/', statusCode: 200, headers: {}, method: 'http' });
  // 80 HTML points + 20 rendering points when rendered; only the 80 otherwise.
  assert.equal(withRender.scoring.pointsPossible - without.scoring.pointsPossible, 20);
  assert.ok(without.scoring.pointsPossible <= 102);
  const sec = withRender.sections.find((s) => s.name === 'Rendering');
  assert.equal(sec.possible, 20);
  assert.ok(sec.score !== null && sec.score < 100); // this fixture depends heavily on JavaScript
  assert.equal(without.sections.find((s) => s.name === 'Rendering').score, null);
});

test('a page that works without JavaScript earns the full rendering points', () => {
  const r = buildReport(page({ rawHtml: RENDERED }));
  assert.equal(r.sections.find((s) => s.name === 'Rendering').score, 100);
});
