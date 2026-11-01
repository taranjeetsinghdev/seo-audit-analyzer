import { GRADES } from './report-schema.js';

/** Extra modules count for these many points on top of the 100-point HTML rubric. */
export const PERFORMANCE_WEIGHT = 25;
export const LINKS_WEIGHT = 10;
export const SITE_WEIGHT = 10;
export const SECURITY_WEIGHT = 8;
export const SITEMAP_WEIGHT = 6;

/** Average of the available Lighthouse lab scores (mobile + desktop). Null if none. */
export function performanceScore(results) {
  const scores = ['mobile', 'desktop']
    .map((k) => results?.[k]?.lab?.score)
    .filter((v) => typeof v === 'number');
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * Blend the HTML rubric with the optional performance and link-health modules.
 * overall = (HTML points + Σ module score × weight/100) ÷ (HTML possible + Σ weights) × 100
 * Modules that were not run are simply left out of both sides.
 */
export function combineScores(report, perfResults, linkResult, siteResult, siteAudit = null, securityResult = null, sitemapResult = null) {
  const html = report.scoring;
  const perf = performanceScore(perfResults);
  const link = linkResult && typeof linkResult.score === 'number' ? linkResult.score : null;

  // With a whole-site audit, the HTML part is the average of every crawled page, not just the page that was entered.
  let earned = siteAudit?.score != null ? (siteAudit.score / 100) * html.pointsPossible : html.pointsEarned;
  let possible = html.pointsPossible;
  let performance = null;
  let links = null;
  let site = null;

  if (perf !== null) {
    const e = (perf * PERFORMANCE_WEIGHT) / 100;
    earned += e;
    possible += PERFORMANCE_WEIGHT;
    performance = {
      name: 'Performance', slug: 'performance', score: perf, earned: Math.round(e * 10) / 10, possible: PERFORMANCE_WEIGHT,
      mobile: perfResults?.mobile?.lab?.score ?? null, desktop: perfResults?.desktop?.lab?.score ?? null,
    };
  }
  if (link !== null) {
    const e = (link * LINKS_WEIGHT) / 100;
    earned += e;
    possible += LINKS_WEIGHT;
    links = { name: 'Link health', slug: 'broken-links', score: link, earned: Math.round(e * 10) / 10, possible: LINKS_WEIGHT, summary: linkResult.summary };
  }

  const siteScore = siteResult && typeof siteResult.score === 'number' ? siteResult.score : null;
  if (siteScore !== null) {
    const e = (siteScore * SITE_WEIGHT) / 100;
    earned += e;
    possible += SITE_WEIGHT;
    site = { name: 'Site health', slug: 'site-crawl', score: siteScore, earned: Math.round(e * 10) / 10, possible: SITE_WEIGHT, counts: siteResult.counts };
  }

  let security = null;
  if (securityResult && typeof securityResult.score === 'number') {
    const e = (securityResult.score * SECURITY_WEIGHT) / 100;
    earned += e;
    possible += SECURITY_WEIGHT;
    security = { name: 'Security & infrastructure', slug: 'security', score: securityResult.score, earned: Math.round(e * 10) / 10, possible: SECURITY_WEIGHT, grade: securityResult.grade };
  }
  let sitemap = null;
  if (sitemapResult && typeof sitemapResult.score === 'number') {
    const e = (sitemapResult.score * SITEMAP_WEIGHT) / 100;
    earned += e;
    possible += SITEMAP_WEIGHT;
    sitemap = { name: 'Sitemap & robots', slug: 'sitemap', score: sitemapResult.score, earned: Math.round(e * 10) / 10, possible: SITEMAP_WEIGHT };
  }

  const overall = performance || links || site || security || sitemap || siteAudit?.score != null ? Math.round((earned / possible) * 100) : report.score;
  return { overall, htmlScore: siteAudit?.score ?? report.score, performance, links, site, security, sitemap, earned, possible };
}

export function gradeFor(score) {
  return GRADES.find((g) => score >= g.min) || GRADES[GRADES.length - 1];
}
