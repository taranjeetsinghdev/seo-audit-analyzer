import test from 'node:test';
import assert from 'node:assert/strict';
import { getGoogleApiKey } from '../lib/google-api-key.js';

test('prefers the Cloudflare secret when both environments provide a key', () => {
  assert.equal(
    getGoogleApiKey({ GOOGLE_API_KEY: 'worker-secret' }, { GOOGLE_API_KEY: 'local-secret' }),
    'worker-secret',
  );
});

test('falls back to the Node environment for local development', () => {
  assert.equal(getGoogleApiKey({}, { GOOGLE_API_KEY: 'local-secret' }), 'local-secret');
});

test('ignores blank values and trims configured keys', () => {
  assert.equal(getGoogleApiKey({ GOOGLE_API_KEY: '  ' }, { GOOGLE_API_KEY: ' local-secret ' }), 'local-secret');
  assert.equal(getGoogleApiKey({ GOOGLE_API_KEY: ' worker-secret ' }, {}), 'worker-secret');
  assert.equal(getGoogleApiKey({}, {}), '');
});
