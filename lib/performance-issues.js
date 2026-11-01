import { issuePriority } from './scoring-engine.js';

const DEVICE = { mobile: 'Mobile', desktop: 'Desktop' };

const ADVICE = {
  lcp: 'Speed up the main content: optimise and preload the hero image, cut server response time and remove render-blocking CSS/JS.',
  inp: 'Reduce main-thread work: break up long JavaScript tasks, defer non-critical scripts and trim third-party code.',
  cls: 'Stop layout jumps: set width/height on images and embeds, reserve space for ads and late content, avoid inserting content above existing content.',
  tbt: 'Reduce JavaScript execution time: split bundles, defer non-critical scripts and remove unused code.',
  fcp: 'Get something on screen sooner: inline critical CSS, defer render-blocking resources and use a fast, cached server response.',
  ttfb: 'Speed up the server response: use caching or a CDN and reduce backend work before the first byte.',
  si: 'Improve how quickly content paints: prioritise above-the-fold resources and lazy-load the rest.',
};

const TITLES = {
  lcp: 'Largest Contentful Paint', inp: 'Interaction to Next Paint', cls: 'Cumulative Layout Shift',
  tbt: 'Total Blocking Time', fcp: 'First Contentful Paint', ttfb: 'Time to First Byte', si: 'Speed Index',
};

const fmt = (name, v) => (name === 'cls' ? String(Math.round(v * 1000) / 1000) : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
const sec = (ms) => `${(ms / 1000).toFixed(1)} s`;

function issue({ id, title, severity, impact, confidence, message, evidence, recommendation }) {
  return {
    id, title, category: 'performance', severity, impact, confidence, message, evidence, recommendation,
    priority: issuePriority(impact, confidence, severity, 0),
  };
}

/**
 * Turn normalized performance results (mobile/desktop) into findings that rank
 * alongside the HTML ones. One finding per problem, listing the devices affected.
 */
export function performanceIssues(results) {
  const out = [];
  const list = results.filter(Boolean);

  // 1. Poor / needs-improvement metrics, merged across devices.
  for (const kind of ['field', 'lab']) {
    const byMetric = new Map();
    for (const r of list) {
      const metrics = kind === 'field' ? r.field?.metrics || {} : r.lab?.metrics || {};
      for (const [name, m] of Object.entries(metrics)) {
        if (m.rating !== 'poor' && m.rating !== 'needs-improvement') continue;
        const value = kind === 'field' ? m.p75 : m.value;
        if (value == null) continue;
        if (!byMetric.has(name)) byMetric.set(name, []);
        byMetric.get(name).push({ device: DEVICE[r.strategy] || r.strategy, value, rating: m.rating });
      }
    }
    for (const [name, rows] of byMetric) {
      const poor = rows.some((x) => x.rating === 'poor');
      const core = ['lcp', 'inp', 'cls'].includes(name);
      out.push(issue({
        id: `perf-${kind}-${name}`,
        title: `${poor ? 'Poor' : 'Slow'} ${TITLES[name]} (${kind === 'field' ? 'real users' : 'lab'})`,
        severity: poor ? 'critical' : 'warning',
        impact: core ? 'high' : 'medium',
        confidence: kind === 'field' ? 'high' : 'medium',
        message: `${TITLES[name]} is ${poor ? 'poor' : 'above the "good" threshold'} ${kind === 'field' ? 'for real Chrome users' : 'in the Lighthouse lab test'}.`,
        evidence: rows.map((x) => `${x.device}: ${fmt(name, x.value)}`).join(' · '),
        recommendation: ADVICE[name],
      }));
    }
  }

  // 2. Lighthouse opportunities, merged by audit id across devices.
  const opps = new Map();
  for (const r of list) {
    for (const o of r.opportunities || []) {
      const cur = opps.get(o.id) || { ...o, devices: {} };
      cur.devices[DEVICE[r.strategy] || r.strategy] = o.savingsMs;
      cur.savingsMs = Math.max(cur.savingsMs, o.savingsMs);
      opps.set(o.id, cur);
    }
  }
  for (const o of opps.values()) {
    const big = o.savingsMs >= 1000;
    out.push(issue({
      id: `perf-opp-${o.id}`,
      title: o.title,
      severity: big ? 'critical' : 'warning',
      impact: big ? 'high' : o.savingsMs >= 300 ? 'medium' : 'low',
      confidence: 'medium',
      message: o.description || 'Lighthouse found a way to make this page load faster.',
      evidence: `Estimated saving: ${Object.entries(o.devices).map(([d, ms]) => `${d} ${sec(ms)}`).join(' · ')}`,
      recommendation: `${o.title}. ${o.description}`.replace(/\.\s*\./g, '.').trim(),
    }));
  }

  // 3. Overall lab score.
  const scores = list.filter((r) => typeof r.lab?.score === 'number');
  const worst = scores.length ? Math.min(...scores.map((r) => r.lab.score)) : null;
  if (worst !== null && worst < 90) {
    out.push(issue({
      id: 'perf-score',
      title: worst < 50 ? 'Low Lighthouse performance score' : 'Lighthouse performance score can improve',
      severity: worst < 50 ? 'critical' : 'warning',
      impact: 'high',
      confidence: 'medium',
      message: 'The Lighthouse lab score is below the 90 "good" band.',
      evidence: scores.map((r) => `${DEVICE[r.strategy]}: ${r.lab.score}/100`).join(' · '),
      recommendation: 'Work through the metric and opportunity findings below, starting with the largest estimated savings.',
    }));
  }

  return out;
}
