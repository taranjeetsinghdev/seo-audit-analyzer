import test from 'node:test';
import assert from 'node:assert/strict';
import { botAccess, inspectLlms } from '../lib/ai-access.js';

test('botAccess reads specific and wildcard rules', () => {
  const r = botAccess('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\n');
  const by = Object.fromEntries(r.map((b) => [b.name, b.status]));
  assert.equal(by.GPTBot, 'blocked');
  assert.equal(by.ClaudeBot, 'allowed');
  assert.equal(botAccess('User-agent: *\nDisallow: /\n').every((b) => b.status === 'blocked'), true);
  assert.equal(botAccess(null).every((b) => b.status === 'allowed'), true);
});

test('inspectLlms needs a title and links', () => {
  assert.equal(inspectLlms('# Site\n> x\n- [A](https://a.com/x)').wellFormed, true);
  assert.equal(inspectLlms('hello').wellFormed, false);
});
