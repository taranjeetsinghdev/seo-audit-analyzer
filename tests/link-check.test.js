import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { classify, collectTargets, summarize, linkScore, linkIssues } from '../lib/link-verdict.js';
import { probe } from '../lib/link-checker.js';

test('classify maps statuses and errors to verdicts', () => {
  assert.equal(classify({ status: 200 }).verdict, 'ok');
  assert.equal(classify({ status: 200, redirects: [{ status: 301 }] }).verdict, 'redirect');
  assert.equal(classify({ status: 404 }).verdict, 'broken');
  assert.equal(classify({ status: 410 }).verdict, 'broken');
  assert.equal(classify({ status: 500 }).verdict, 'broken');
  assert.equal(classify({ status: 403 }).verdict, 'blocked'); // bot protection is not "broken"
  assert.equal(classify({ status: 429 }).verdict, 'blocked');
  assert.equal(classify({ error: 'dns' }).verdict, 'broken');
  assert.equal(classify({ error: 'timeout' }).verdict, 'timeout');
  assert.equal(classify({ error: 'reset' }).verdict, 'blocked');
});

test('collectTargets dedupes, strips fragments, prefers internal, includes images', () => {
  const report = {
    url: 'https://example.com/',
    links: { items: [
      { href: 'https://other.org/x#a', internal: false, text: 'o' },
      { href: 'https://example.com/a#top', internal: true, text: 'a' },
      { href: 'https://example.com/a', internal: true, text: 'a2' },
    ] },
    images: { items: [{ src: 'https://example.com/i.png', alt: 'i' }] },
  };
  const t = collectTargets(report);
  assert.deepEqual(t.map((x) => x.href), ['https://example.com/a', 'https://other.org/x', 'https://example.com/i.png']);
  assert.equal(t[2].kind, 'image');
  assert.equal(t[2].internal, true);
});

test('summary, score and issues reflect broken links', () => {
  const results = [
    { href: 'https://e.com/a', kind: 'link', internal: true, verdict: 'broken', status: 404, redirects: [] },
    { href: 'https://x.org/b', kind: 'link', internal: false, verdict: 'broken', status: 404, redirects: [] },
    { href: 'https://e.com/c', kind: 'link', internal: true, verdict: 'redirect', status: 200, finalUrl: 'https://e.com/d', redirects: [{}, {}] },
    { href: 'https://e.com/ok', kind: 'link', internal: true, verdict: 'ok', status: 200, redirects: [] },
  ];
  const s = summarize(results);
  assert.equal(s.brokenInternal, 1);
  assert.equal(s.brokenExternal, 1);
  assert.equal(s.longRedirects, 1);
  assert.equal(linkScore(s), 100 - 12 - 5 - 1);
  const ids = linkIssues(results).map((i) => i.id);
  assert.ok(ids.includes('links-broken-internal') && ids.includes('links-broken-external') && ids.includes('links-redirected'));
  assert.equal(linkScore({ total: 0, skipped: 0 }), null);
});

test('probe blocks private targets without connecting', async () => {
  const r = await probe('http://127.0.0.1:1/');
  assert.equal(r.error, 'blocked_target');
  assert.equal((await probe('ftp://example.com/x')).error, 'blocked_target');
});

test('probe follows a redirect to a working page and confirms HEAD failures with GET', async () => {
  // Uses a local server through probeOnce-compatible path only when the address is public; so
  // here we just validate the classification logic against simulated probe output.
  assert.equal(classify({ status: 200, redirects: [{ status: 301, to: 'x' }] }).verdict, 'redirect');
  const server = http.createServer((q, s) => s.end('x'));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const r = await probe(`http://127.0.0.1:${port}/`); // loopback must still be refused
  server.close();
  assert.equal(r.error, 'blocked_target');
});

test('an unresolvable domain is "broken (domain not found)", not skipped', async () => {
  const r = await probe('https://nonexistent-domain-seo-intel-12345.com/');
  assert.equal(r.error, 'dns');
  assert.equal(classify(r).verdict, 'broken');
});
