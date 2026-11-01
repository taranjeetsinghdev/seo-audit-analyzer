import test from 'node:test';
import assert from 'node:assert/strict';
import { apexOf, headerItems, scoreItems, certItems, emailItems, detectCdn } from '../lib/security.js';
import { securityIssues } from '../lib/security-issues.js';

test('apexOf handles common and second-level TLDs', () => {
  assert.equal(apexOf('www.example.com'), 'example.com');
  assert.equal(apexOf('a.b.example.co.uk'), 'example.co.uk');
  assert.equal(apexOf('example.com'), 'example.com');
});

test('headerItems: missing headers fail, a hardened set passes', () => {
  const bad = headerItems({});
  assert.equal(bad.find((i) => i.id === 'hsts').status, 'fail');
  assert.equal(scoreItems(bad).grade, 'F');
  const good = headerItems({
    'strict-transport-security': 'max-age=31536000; includeSubDomains', 'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'permissions-policy': 'camera=()', server: 'nginx',
  });
  assert.ok(good.every((i) => i.status === 'pass'));
  assert.equal(scoreItems(good).score, 100);
});

test('headerItems: weak HSTS, unsafe CSP and version disclosure warn', () => {
  const r = headerItems({ 'strict-transport-security': 'max-age=100', 'content-security-policy': "script-src 'unsafe-inline'", 'x-powered-by': 'PHP/8.1' });
  assert.equal(r.find((i) => i.id === 'hsts').status, 'warn');
  assert.equal(r.find((i) => i.id === 'csp').status, 'warn');
  assert.equal(r.find((i) => i.id === 'disclosure').status, 'warn');
});

test('certItems rates expiry and protocol', () => {
  const base = { authorized: true, issuer: 'X', protocol: 'TLSv1.3', validTo: '2030-01-01T00:00:00Z' };
  assert.equal(certItems({ ...base, daysLeft: 200 }).every((i) => i.status === 'pass'), true);
  assert.equal(certItems({ ...base, daysLeft: 10 }).find((i) => i.id === 'cert-expiry').status, 'fail');
  assert.equal(certItems({ ...base, daysLeft: 20 }).find((i) => i.id === 'cert-expiry').status, 'warn');
  assert.equal(certItems({ ...base, daysLeft: 200, protocol: 'TLSv1.1' }).find((i) => i.id === 'tls-version').status, 'fail');
  assert.equal(certItems(null)[0].status, 'fail');
});

test('emailItems: SPF/DMARC only required when the domain has MX records', () => {
  const noMail = emailItems({ mx: [], spf: '', dmarc: '', caa: [] });
  assert.equal(noMail.find((i) => i.id === 'spf').status, 'na');
  const mail = emailItems({ mx: [{ exchange: 'm.x' }], spf: '', dmarc: 'v=DMARC1; p=none', caa: ['letsencrypt.org'] });
  assert.equal(mail.find((i) => i.id === 'spf').status, 'fail');
  assert.equal(mail.find((i) => i.id === 'dmarc').status, 'warn');
  assert.equal(mail.find((i) => i.id === 'caa').status, 'pass');
});

test('securityIssues lists only failures and warnings; CDN detection', () => {
  const issues = securityIssues({ items: headerItems({}) });
  assert.ok(issues.length >= 5 && issues.every((i) => i.category === 'security' && i.recommendation));
  assert.equal(detectCdn({ 'cf-ray': 'abc' }), 'Cloudflare');
  assert.equal(detectCdn({}), '');
});
