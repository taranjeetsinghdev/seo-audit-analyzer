import { STATUS, GRADES } from './report-schema.js';
import { MODULES, SECTIONS } from './modules.js';

const CREDIT = { [STATUS.PASS]: 1, [STATUS.WARNING]: 0.5, [STATUS.FAIL]: 0 };
const SCORED = new Set(Object.keys(CREDIT));

function band(score) {
  return GRADES.find((g) => score >= g.min);
}

function tally(checks) {
  let earned = 0;
  let possible = 0;
  for (const c of checks) {
    if (c.weight === 0 || !SCORED.has(c.status)) continue;
    possible += c.weight;
    earned += c.weight * CREDIT[c.status];
  }
  return { earned, possible };
}

/** Score = earned ÷ applicable points × 100. N/A, not-evaluated and errored checks leave the denominator. */
export function calculateScore(checks) {
  const { earned, possible } = tally(checks);
  const score = possible === 0 ? null : Math.round((earned / possible) * 100);
  const { grade, label } = score === null ? { grade: '–', label: 'Not scored' } : band(score);

  const byCategory = {};
  for (const cat of new Set(checks.map((c) => c.category))) {
    const t = tally(checks.filter((c) => c.category === cat));
    byCategory[cat] = {
      score: t.possible ? Math.round((t.earned / t.possible) * 100) : null,
      earned: t.earned,
      possible: t.possible,
    };
  }

  return {
    score,
    grade,
    gradeLabel: label,
    pointsEarned: earned,
    pointsPossible: possible,
    byCategory,
    counts: checks.reduce((acc, c) => ({ ...acc, [c.status]: (acc[c.status] || 0) + 1 }), {}),
  };
}

const IMPACT = { high: 3, medium: 2, low: 1 };
const CONFIDENCE = { high: 3, medium: 2, low: 1 };

/** Shared by HTML and performance findings so they can be ranked together. */
export function issuePriority(impact, confidence, severity, weight = 0) {
  return IMPACT[impact] * CONFIDENCE[confidence] * (severity === 'critical' ? 2 : 1) + weight / 100;
}

/** Prioritise failed / warning findings by impact × confidence, then weight. */
export function buildIssues(checks) {
  return checks
    .filter((c) => c.status === STATUS.FAIL || c.status === STATUS.WARNING)
    .map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      severity: c.status === STATUS.FAIL ? 'critical' : 'warning',
      impact: c.impact,
      confidence: c.confidence,
      message: c.message,
      evidence: c.evidence,
      recommendation: c.recommendation,
      priority: issuePriority(c.impact, c.confidence, c.status === STATUS.FAIL ? 'critical' : 'warning', c.weight),
    }))
    .sort((a, b) => b.priority - a.priority);
}

/** Score (0–100) for any group of checks; null when nothing in it carries points. */
export function scoreChecks(checks) {
  const { earned, possible } = tally(checks);
  return { score: possible ? Math.round((earned / possible) * 100) : null, earned, possible };
}

/** Scores for the report sections: On-page, Indexing, Social, Content, Technical. */
export function calculateSectionScores(checks) {
  return SECTIONS.map((name) => {
    const mods = MODULES.filter((m) => m.section === name);
    const ids = new Set(mods.flatMap((m) => m.checks));
    return { name, slug: mods[0]?.slug, ...scoreChecks(checks.filter((c) => ids.has(c.id))) };
  });
}
