import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUserUrl, isPrivateIp, UrlValidationError } from '../lib/url-validation.js';

test('adds https and strips hash', () => {
  assert.equal(normalizeUserUrl('example.com/a#x').href, 'https://example.com/a');
});

test('rejects non-http schemes, credentials, odd ports, local names', () => {
  for (const bad of ['ftp://example.com', 'file:///etc/passwd', 'https://u:p@example.com', 'https://example.com:22', 'http://localhost', 'http://intranet', 'http://printer.local']) {
    assert.throws(() => normalizeUserUrl(bad), UrlValidationError, bad);
  }
});

test('blocks private and reserved IPv4', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '1.1.1.1']) assert.equal(isPrivateIp(ip), false, ip);
});

test('blocks private IPv6 including mapped / NAT64 / 6to4', () => {
  for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::a00:1', '2002:c0a8:101::1', 'ff02::1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  assert.equal(isPrivateIp('2606:4700:4700::1111'), false);
});

test('alternate IPv4 notations are normalised by URL and blocked', () => {
  for (const bad of ['http://2130706433', 'http://0x7f.1', 'http://127.1']) {
    assert.throws(() => normalizeUserUrl(bad), UrlValidationError, bad);
  }
});
