import { extractSeoSignals } from './seo-extractor.js';
import { evaluateRules } from './analyze.js';
import { calculateScore, calculateSectionScores } from './scoring-engine.js';

/**
 * Score one crawled page with the same rubric as the main audit, from its raw HTML (no JavaScript rendering).
 * Returns a compact record: overall score, a score per section and the id of every failed / warned check.
 */
export function auditHtml({ html, finalUrl, statusCode, headers }) {
  const signals = extractSeoSignals(html, finalUrl);
  delete signals.content.text;
  const checks = evaluateRules({
    ...signals,
    render: { used: false, reason: 'Crawled pages are scored from raw HTML.', diff: null },
    country: null,
    finalUrl,
    statusCode,
    headers: headers || {},
    bytes: Buffer.byteLength(html),
  });
  const scoring = calculateScore(checks);
  return {
    score: scoring.score,
    sections: calculateSectionScores(checks).map(({ name, slug, score, earned, possible }) => ({ name, slug, score, earned, possible })),
    fails: checks.filter((c) => c.status === 'fail').map((c) => c.id),
    warns: checks.filter((c) => c.status === 'warning').map((c) => c.id),
  };
}
