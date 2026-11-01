/**
 * Performance & Core Web Vitals via Google's free APIs:
 *  - PageSpeed Insights v5 (Lighthouse lab data + CrUX field data)
 *  - Chrome UX Report API (field-only fallback)
 * Lab and field values are kept separate on purpose: they measure different things.
 */

export class PerformanceError extends Error {
  constructor(message, code = 'performance_failed') {
    super(message);
    this.name = 'PerformanceError';
    this.code = code;
  }
}

const PSI_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CRUX_URL = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

// [good ≤, poor >] — Core Web Vitals and related thresholds (ms, except CLS).
export const THRESHOLDS = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [0.1, 0.25],
  fcp: [1800, 3000],
  ttfb: [800, 1800],
  tbt: [200, 600],
  si: [3400, 5800],
};

export function rate(metric, value) {
  const t = THRESHOLDS[metric];
  if (!t || value === null || value === undefined || Number.isNaN(value)) return null;
  return value <= t[0] ? 'good' : value > t[1] ? 'poor' : 'needs-improvement';
}

const num = (v) => (v === undefined || v === null ? null : Number(v));
const stripMarkdown = (s = '') => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '');

const LAB_AUDITS = {
  lcp: 'largest-contentful-paint',
  cls: 'cumulative-layout-shift',
  tbt: 'total-blocking-time',
  fcp: 'first-contentful-paint',
  si: 'speed-index',
};

const PSI_FIELD_KEYS = {
  lcp: 'LARGEST_CONTENTFUL_PAINT_MS',
  inp: 'INTERACTION_TO_NEXT_PAINT',
  cls: 'CUMULATIVE_LAYOUT_SHIFT_SCORE',
  fcp: 'FIRST_CONTENTFUL_PAINT_MS',
  ttfb: 'EXPERIMENTAL_TIME_TO_FIRST_BYTE',
};

function normalizePsiField(experience) {
  const metrics = experience?.metrics;
  if (!metrics || !Object.keys(metrics).length) return null;
  const out = {};
  for (const [name, key] of Object.entries(PSI_FIELD_KEYS)) {
    const m = metrics[key];
    if (!m || m.percentile === undefined) continue;
    // PSI reports CLS multiplied by 100.
    const p75 = name === 'cls' ? m.percentile / 100 : m.percentile;
    out[name] = {
      p75,
      rating: rate(name, p75),
      distribution: (m.distributions || []).map((d) => Math.round((d.proportion || 0) * 100)),
    };
  }
  return Object.keys(out).length ? out : null;
}

/** Turn a raw PageSpeed Insights response into the report shape. Pure; unit tested. */
export function normalizePsi(json, { url, strategy }) {
  const lh = json.lighthouseResult;
  if (!lh) throw new PerformanceError('PageSpeed Insights returned no Lighthouse result.');
  const audits = lh.audits || {};

  const metrics = {};
  for (const [name, id] of Object.entries(LAB_AUDITS)) {
    const a = audits[id];
    if (!a) continue;
    const value = num(a.numericValue);
    metrics[name] = { value, display: a.displayValue || '', rating: rate(name, value) };
  }

  const opportunities = Object.values(audits)
    .filter((a) => a.details?.type === 'opportunity' && (a.details.overallSavingsMs || 0) > 0)
    .sort((a, b) => b.details.overallSavingsMs - a.details.overallSavingsMs)
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      title: a.title,
      description: stripMarkdown(a.description).split('. ')[0],
      savingsMs: Math.round(a.details.overallSavingsMs),
      savingsBytes: a.details.overallSavingsBytes ? Math.round(a.details.overallSavingsBytes) : null,
    }));

  const urlLevel = json.loadingExperience && !json.loadingExperience.origin_fallback
    ? normalizePsiField(json.loadingExperience) : null;
  const originLevel = normalizePsiField(json.originLoadingExperience) || normalizePsiField(json.loadingExperience);
  const fieldMetrics = urlLevel || originLevel;

  return {
    url,
    finalUrl: lh.finalDisplayedUrl || lh.finalUrl || url,
    strategy,
    source: 'PageSpeed Insights (Lighthouse)',
    lighthouseVersion: lh.lighthouseVersion || '',
    fetchedAt: lh.fetchTime || new Date().toISOString(),
    lab: {
      score: lh.categories?.performance?.score != null ? Math.round(lh.categories.performance.score * 100) : null,
      metrics,
    },
    field: fieldMetrics
      ? { available: true, scope: urlLevel ? 'url' : 'origin', source: 'Chrome UX Report', metrics: fieldMetrics }
      : { available: false, scope: null, source: 'Chrome UX Report', metrics: {} },
    opportunities,
    warnings: (lh.runWarnings || []).map(stripMarkdown),
  };
}

const CRUX_METRICS = {
  largest_contentful_paint: 'lcp',
  interaction_to_next_paint: 'inp',
  cumulative_layout_shift: 'cls',
  first_contentful_paint: 'fcp',
  experimental_time_to_first_byte: 'ttfb',
};

export function normalizeCrux(json) {
  const record = json?.record?.metrics;
  if (!record) return null;
  const out = {};
  for (const [key, name] of Object.entries(CRUX_METRICS)) {
    const m = record[key];
    const p75 = num(m?.percentiles?.p75);
    if (p75 === null) continue;
    out[name] = {
      p75,
      rating: rate(name, p75),
      distribution: (m.histogram || []).map((h) => Math.round((h.density || 0) * 100)),
    };
  }
  return Object.keys(out).length ? out : null;
}

async function timedFetch(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function queryCrux({ url, strategy, apiKey, fetchImpl }) {
  const formFactor = strategy === 'desktop' ? 'DESKTOP' : 'PHONE';
  const origin = new URL(url).origin;
  for (const [scope, body] of [['url', { url }], ['origin', { origin }]]) {
    const res = await timedFetch(
      fetchImpl,
      `${CRUX_URL}?key=${encodeURIComponent(apiKey)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, formFactor }) },
      15_000,
    );
    if (res.status === 404) continue; // no data at this scope
    if (!res.ok) return null;
    const metrics = normalizeCrux(await res.json());
    if (metrics) return { available: true, scope, source: 'Chrome UX Report', metrics };
  }
  return null;
}

/**
 * Run the audit. Tries PageSpeed Insights first; if the lab run fails, falls back to
 * field data only (CrUX) so the user still gets something real.
 */
export async function runPerformanceAudit(url, strategy, { apiKey, fetchImpl = fetch, timeoutMs = 70_000 } = {}) {
  if (!apiKey) throw new PerformanceError('GOOGLE_API_KEY is not configured on the server.', 'not_configured');
  const params = new URLSearchParams({ url, strategy, category: 'performance', key: apiKey });

  let failure = '';
  try {
    const res = await timedFetch(fetchImpl, `${PSI_URL}?${params}`, {}, timeoutMs);
    const json = await res.json().catch(() => ({}));
    if (res.ok) return normalizePsi(json, { url, strategy });
    if (res.status === 429) throw new PerformanceError('Google\'s free quota is temporarily exhausted. Try again in a minute.', 'quota');
    failure = json?.error?.message || `PageSpeed Insights returned HTTP ${res.status}.`;
  } catch (err) {
    if (err instanceof PerformanceError) throw err;
    failure = err.name === 'AbortError' ? 'The lab test timed out.' : `Lab test failed: ${err.message}`;
  }

  const field = await queryCrux({ url, strategy, apiKey, fetchImpl }).catch(() => null);
  if (field) {
    return {
      url, finalUrl: url, strategy, source: 'Chrome UX Report (field data only)', lighthouseVersion: '',
      fetchedAt: new Date().toISOString(),
      lab: { score: null, metrics: {} },
      field,
      opportunities: [],
      warnings: [`Lab test unavailable: ${failure}`],
    };
  }
  throw new PerformanceError(failure || 'Performance data could not be retrieved.', 'unavailable');
}

/** Flat rows used by the Markdown / HTML / CSV exports. */
export function performanceRows(perf) {
  const rows = [];
  const labels = { lcp: 'Largest Contentful Paint', inp: 'Interaction to Next Paint', cls: 'Cumulative Layout Shift', fcp: 'First Contentful Paint', ttfb: 'Time to First Byte', tbt: 'Total Blocking Time', si: 'Speed Index' };
  const fmt = (name, v) => (name === 'cls' ? String(Math.round(v * 1000) / 1000) : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
  for (const [name, m] of Object.entries(perf.lab.metrics)) {
    rows.push(['Lab', labels[name], m.value === null ? '—' : fmt(name, m.value), m.rating || '']);
  }
  for (const [name, m] of Object.entries(perf.field.metrics || {})) {
    rows.push([`Field (${perf.field.scope})`, labels[name], fmt(name, m.p75), m.rating || '']);
  }
  return rows;
}
