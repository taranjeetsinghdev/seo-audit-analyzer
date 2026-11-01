import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePsi, normalizeCrux, rate, runPerformanceAudit, performanceRows, PerformanceError } from '../lib/performance.js';
import { toMarkdown, toHtml, toCsv } from '../lib/report-export.js';
import { buildReport } from '../lib/analyze.js';

const PSI = {
  lighthouseResult: {
    lighthouseVersion: '12.0.0',
    fetchTime: '2026-10-14T00:00:00.000Z',
    finalDisplayedUrl: 'https://example.com/',
    categories: { performance: { score: 0.87 } },
    audits: {
      'largest-contentful-paint': { numericValue: 3100, displayValue: '3.1 s' },
      'cumulative-layout-shift': { numericValue: 0.02, displayValue: '0.02' },
      'total-blocking-time': { numericValue: 650, displayValue: '650 ms' },
      'first-contentful-paint': { numericValue: 1200, displayValue: '1.2 s' },
      'speed-index': { numericValue: 2000, displayValue: '2.0 s' },
      'render-blocking-resources': { id: 'render-blocking-resources', title: 'Eliminate render-blocking resources',
        description: 'Resources are blocking. [Learn how](https://x.dev). More text.', details: { type: 'opportunity', overallSavingsMs: 480 } },
      'unused-css-rules': { id: 'unused-css-rules', title: 'Reduce unused CSS', description: 'Reduce it.', details: { type: 'opportunity', overallSavingsMs: 0 } },
    },
    runWarnings: [],
  },
  loadingExperience: {
    origin_fallback: true,
    metrics: { CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5, distributions: [{ proportion: 0.9 }, { proportion: 0.06 }, { proportion: 0.04 }] } },
  },
  originLoadingExperience: {
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2100, distributions: [{ proportion: 0.8 }, { proportion: 0.1 }, { proportion: 0.1 }] },
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5, distributions: [{ proportion: 0.9 }, { proportion: 0.06 }, { proportion: 0.04 }] },
    },
  },
};

test('rating thresholds follow Core Web Vitals', () => {
  assert.equal(rate('lcp', 2500), 'good');
  assert.equal(rate('lcp', 3000), 'needs-improvement');
  assert.equal(rate('lcp', 4001), 'poor');
  assert.equal(rate('cls', 0.1), 'good');
  assert.equal(rate('inp', 600), 'poor');
});

test('normalizePsi maps lab metrics, opportunities and origin-level field data', () => {
  const r = normalizePsi(PSI, { url: 'https://example.com', strategy: 'mobile' });
  assert.equal(r.lab.score, 87);
  assert.equal(r.lab.metrics.lcp.rating, 'needs-improvement');
  assert.equal(r.lab.metrics.tbt.rating, 'poor');
  assert.equal(r.opportunities.length, 1);
  assert.ok(!r.opportunities[0].description.includes('http'));
  assert.equal(r.field.scope, 'origin');
  assert.equal(r.field.metrics.cls.p75, 0.05); // PSI sends CLS ×100
  assert.equal(r.field.metrics.lcp.rating, 'good');
});

test('normalizeCrux parses string percentiles', () => {
  const m = normalizeCrux({ record: { metrics: { cumulative_layout_shift: { percentiles: { p75: '0.31' }, histogram: [{ density: 0.5 }, { density: 0.2 }, { density: 0.3 }] } } } });
  assert.equal(m.cls.p75, 0.31);
  assert.equal(m.cls.rating, 'poor');
});

test('missing key is a clear configuration error', async () => {
  await assert.rejects(runPerformanceAudit('https://example.com', 'mobile', {}), (e) => e instanceof PerformanceError && e.code === 'not_configured');
});

test('falls back to field data when the lab run fails', async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    if (String(url).includes('pagespeedonline')) return { ok: false, status: 500, json: async () => ({ error: { message: 'Lighthouse error' } }) };
    return { ok: true, status: 200, json: async () => ({ record: { metrics: { largest_contentful_paint: { percentiles: { p75: 1800 }, histogram: [] } } } }) };
  };
  const r = await runPerformanceAudit('https://example.com/', 'mobile', { apiKey: 'k', fetchImpl });
  assert.equal(r.lab.score, null);
  assert.equal(r.field.metrics.lcp.rating, 'good');
  assert.match(r.warnings[0], /Lab test unavailable/);
  assert.equal(calls, 2);
});

test('exports include performance when present', () => {
  const perf = normalizePsi(PSI, { url: 'https://example.com', strategy: 'mobile' });
  const report = { ...buildReport({ html: '<html lang="en"><title>T</title></html>', finalUrl: 'https://example.com/', statusCode: 200, headers: {} }), performance: [perf] };
  assert.ok(performanceRows(perf).length >= 5);
  assert.match(toMarkdown(report), /Performance & Core Web Vitals/);
  assert.match(toHtml(report), /Performance &amp; Core Web Vitals/);
  assert.match(toCsv(report), /Largest Contentful Paint \(Lab, mobile\)/);
});

import { performanceIssues } from '../lib/performance-issues.js';

test('performance findings merge devices and rank with a consistent shape', () => {
  const base = normalizePsi(PSI, { url: 'https://example.com', strategy: 'mobile' });
  const desktop = { ...base, strategy: 'desktop', opportunities: [{ ...base.opportunities[0], savingsMs: 1500 }] };
  const issues = performanceIssues([base, desktop]);
  const opp = issues.find((i) => i.id === 'perf-opp-render-blocking-resources');
  assert.ok(opp && opp.severity === 'critical');
  assert.match(opp.evidence, /Mobile 0\.5 s/);
  assert.match(opp.evidence, /Desktop 1\.5 s/);
  assert.ok(issues.some((i) => i.id === 'perf-lab-tbt' && i.severity === 'critical'));
  assert.ok(issues.every((i) => i.category === 'performance' && typeof i.priority === 'number' && i.recommendation));
  assert.equal(new Set(issues.map((i) => i.id)).size, issues.length);
});

test('a clean performance result produces no findings', () => {
  const good = { strategy: 'mobile', lab: { score: 98, metrics: { lcp: { value: 900, rating: 'good' } } }, field: { metrics: {} }, opportunities: [] };
  assert.deepEqual(performanceIssues([good]), []);
});
