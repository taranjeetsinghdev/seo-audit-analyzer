import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, buildIssues } from '../lib/scoring-engine.js';

const c = (id, status, weight, extra = {}) => ({ id, status, weight, category: 'onpage', title: id, impact: 'high', confidence: 'high', message: '', evidence: '', ...extra });

test('pass = full, warning = half, fail = zero', () => {
  const s = calculateScore([c('a', 'pass', 10), c('b', 'warning', 10), c('d', 'fail', 10)]);
  assert.equal(s.pointsEarned, 15);
  assert.equal(s.pointsPossible, 30);
  assert.equal(s.score, 50);
  assert.equal(s.grade, 'F');
});

test('excluded statuses and advisory weight 0 do not count', () => {
  const s = calculateScore([c('a', 'pass', 10), c('b', 'not_applicable', 10), c('d', 'error', 10), c('e', 'fail', 0)]);
  assert.equal(s.score, 100);
  assert.equal(s.pointsPossible, 10);
});

test('no scorable checks yields null score', () => {
  assert.equal(calculateScore([c('a', 'not_evaluated', 10)]).score, null);
});

test('issues sorted by priority with fails above warnings', () => {
  const issues = buildIssues([c('w', 'warning', 10), c('f', 'fail', 10), c('p', 'pass', 10)]);
  assert.deepEqual(issues.map((i) => i.id), ['f', 'w']);
});

import { buildReport } from '../lib/analyze.js';
import { calculateSectionScores, scoreChecks } from '../lib/scoring-engine.js';

test('section scores cover the rubric and sum to the overall points', () => {
  const html = '<!doctype html><html lang="en"><head><title>A reasonably descriptive page title here</title><meta name="description" content="' +
    'A helpful description of the page content. '.repeat(3).trim() + '"><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://example.com/"></head><body><h1>x</h1></body></html>';
  const r = buildReport({ html, finalUrl: 'https://example.com/', statusCode: 200, headers: {} });
  const names = r.sections.map((s) => s.name);
  assert.deepEqual(names, ['On-page', 'Indexing', 'Social', 'Content', 'Accessibility', 'Rendering', 'Technical']);
  const possible = r.sections.reduce((a, s) => a + s.possible, 0);
  assert.equal(possible, r.scoring.pointsPossible);
  assert.ok(calculateSectionScores(r.checks).every((s) => s.score === null || (s.score >= 0 && s.score <= 100)));
});

import { combineScores, performanceScore, PERFORMANCE_WEIGHT } from '../lib/overall-score.js';

test('overall score blends performance with the HTML rubric', () => {
  const report = { score: 80, scoring: { pointsEarned: 80, pointsPossible: 100 } };
  assert.equal(combineScores(report, null).overall, 80);
  const results = { mobile: { lab: { score: 40 } }, desktop: { lab: { score: 60 } } };
  assert.equal(performanceScore(results), 50);
  const c = combineScores(report, results);
  // (80 + 50 × 25/100) ÷ (100 + 25) = 73.9 → 74
  assert.equal(c.overall, 74);
  assert.equal(c.performance.possible, PERFORMANCE_WEIGHT);
  assert.equal(performanceScore({ mobile: { lab: { score: null } } }), null);
});

test('link health blends into the overall score alongside performance', () => {
  const report = { score: 80, scoring: { pointsEarned: 80, pointsPossible: 100 } };
  const links = { score: 50, summary: {} };
  const onlyLinks = combineScores(report, null, links);
  // (80 + 50 × 10/100) ÷ (100 + 10) = 77.27 → 77
  assert.equal(onlyLinks.overall, 77);
  const both = combineScores(report, { mobile: { lab: { score: 40 } }, desktop: { lab: { score: 60 } } }, links);
  // (80 + 12.5 + 5) ÷ (100 + 25 + 10) = 72.2 → 72
  assert.equal(both.overall, 72);
  assert.equal(combineScores(report, null, { score: null }).overall, 80);
});
