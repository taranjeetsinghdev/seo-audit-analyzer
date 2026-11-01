/**
 * Pure, browser-safe helpers for link health: classify a probe result, build the target list
 * from a report, summarise results, score them, and turn them into recommendations.
 */
import { issuePriority } from './scoring-engine.js';

export const LINK_LIMITS = { maxLinks: 160, maxImages: 40 };

const RESTRICTED = new Set([401, 403, 405, 406, 429, 451, 999]);

/** Classify one probe outcome into a verdict. */
export function classify({ status, error, redirects = [] }) {
  if (error) {
    if (error === 'timeout') return { verdict: 'timeout', reason: 'No response in time' };
    if (error === 'dns') return { verdict: 'broken', reason: 'Domain not found' };
    if (error === 'refused') return { verdict: 'broken', reason: 'Connection refused' };
    if (error === 'tls') return { verdict: 'broken', reason: 'Invalid or expired certificate' };
    if (error === 'redirect_loop') return { verdict: 'broken', reason: 'Too many redirects' };
    if (error === 'blocked_target') return { verdict: 'skipped', reason: 'Not a public http(s) address' };
    if (error === 'reset') return { verdict: 'blocked', reason: 'Connection closed — likely bot protection' };
    return { verdict: 'error', reason: 'Request failed' };
  }
  if (status >= 200 && status < 300) {
    return redirects.length ? { verdict: 'redirect', reason: `Redirects ${redirects.length}×` } : { verdict: 'ok', reason: 'OK' };
  }
  if (status >= 300 && status < 400) return { verdict: 'redirect', reason: 'Redirect without a destination' };
  if (RESTRICTED.has(status)) return { verdict: 'blocked', reason: `Restricted (HTTP ${status}) — may block automated checks` };
  if (status === 404 || status === 410) return { verdict: 'broken', reason: `Not found (HTTP ${status})` };
  if (status >= 400 && status < 500) return { verdict: 'broken', reason: `Client error (HTTP ${status})` };
  if (status >= 500) return { verdict: 'broken', reason: `Server error (HTTP ${status})` };
  return { verdict: 'error', reason: 'Unexpected response' };
}

const strip = (href) => {
  try {
    const u = new URL(href);
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
};

/** Unique, prioritised list of links and images to check from a report. */
export function collectTargets(report) {
  const seen = new Map();
  const add = (href, kind, internal, text) => {
    const clean = strip(href);
    if (!clean || !/^https?:/i.test(clean) || seen.has(clean)) return;
    seen.set(clean, { href: clean, kind, internal, text: (text || '').slice(0, 120) });
  };
  const links = report.links?.items || [];
  [...links.filter((l) => l.internal), ...links.filter((l) => !l.internal)].forEach((l) => add(l.href, 'link', l.internal, l.text));
  const linkTargets = [...seen.values()].slice(0, LINK_LIMITS.maxLinks);
  seen.clear();
  linkTargets.forEach((t) => seen.set(t.href, t));
  let host = '';
  try {
    host = new URL(report.url).hostname.replace(/^www\./, '');
  } catch {
    /* ignore */
  }
  for (const img of (report.images?.items || []).slice(0, LINK_LIMITS.maxImages)) {
    if (!img.src) continue;
    let internal = false;
    try {
      internal = new URL(img.src).hostname.replace(/^www\./, '') === host;
    } catch {
      /* ignore */
    }
    add(img.src, 'image', internal, img.alt || '');
  }
  return [...seen.values()];
}

export function summarize(results) {
  const s = { total: results.length, ok: 0, redirect: 0, broken: 0, blocked: 0, timeout: 0, error: 0, skipped: 0, brokenInternal: 0, brokenExternal: 0, brokenImages: 0, longRedirects: 0 };
  for (const r of results) {
    s[r.verdict] = (s[r.verdict] || 0) + 1;
    if (r.verdict === 'broken') {
      if (r.kind === 'image') s.brokenImages += 1;
      else if (r.internal) s.brokenInternal += 1;
      else s.brokenExternal += 1;
    }
    if ((r.redirects?.length || 0) >= 2) s.longRedirects += 1;
  }
  return s;
}

/** 0–100 link health score. Null when nothing was checked. */
export function linkScore(summary) {
  const checked = summary.total - (summary.skipped || 0);
  if (checked <= 0) return null;
  const penalty =
    12 * summary.brokenInternal + 5 * (summary.brokenExternal + summary.brokenImages) + summary.longRedirects + 0.5 * summary.timeout;
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

/** Recommendations in the same shape as the other findings. */
export function linkIssues(results) {
  const out = [];
  const by = (fn) => results.filter(fn);
  const list = (rows, n = 5) => rows.slice(0, n).map((r) => `${r.status ?? r.reason} — ${r.href}`).join('\n') + (rows.length > n ? `\n…and ${rows.length - n} more` : '');
  const mk = (id, title, severity, impact, confidence, message, rows, recommendation) =>
    out.push({
      id, title, category: 'links', severity, impact, confidence, message, evidence: list(rows), recommendation,
      priority: issuePriority(impact, confidence, severity, 0),
    });

  const brokenInternal = by((r) => r.verdict === 'broken' && r.kind === 'link' && r.internal);
  if (brokenInternal.length) {
    mk('links-broken-internal', `${brokenInternal.length} broken internal link${brokenInternal.length > 1 ? 's' : ''}`, 'critical', 'high', 'high',
      'Internal links point to pages that return an error. They waste crawl budget and frustrate visitors.', brokenInternal,
      'Fix or remove each link, or restore the missing page and redirect the old URL.');
  }
  const brokenExternal = by((r) => r.verdict === 'broken' && r.kind === 'link' && !r.internal);
  if (brokenExternal.length) {
    mk('links-broken-external', `${brokenExternal.length} broken external link${brokenExternal.length > 1 ? 's' : ''}`, 'warning', 'medium', 'high',
      'Outbound links lead to pages that no longer exist or cannot be reached.', brokenExternal,
      'Replace each link with a working source or remove it.');
  }
  const brokenImages = by((r) => r.verdict === 'broken' && r.kind === 'image');
  if (brokenImages.length) {
    mk('links-broken-images', `${brokenImages.length} broken image${brokenImages.length > 1 ? 's' : ''}`, 'warning', 'medium', 'high',
      'Images fail to load, which hurts user experience and image search.', brokenImages,
      'Fix the image URLs or re-upload the missing files.');
  }
  const chains = by((r) => r.verdict === 'redirect' && r.kind === 'link' && r.redirects?.length);
  if (chains.length) {
    mk('links-redirected', `${chains.length} link${chains.length > 1 ? 's' : ''} go through redirects`, 'warning', 'low', 'high',
      'Linking to a URL that redirects adds latency and dilutes crawl efficiency.',
      chains.map((r) => ({ ...r, status: `${r.redirects.length}× → ${r.finalUrl}` })),
      'Update each link to point directly to its final destination.');
  }
  const slow = by((r) => r.verdict === 'timeout');
  if (slow.length) {
    mk('links-timeout', `${slow.length} link${slow.length > 1 ? 's' : ''} did not respond`, 'warning', 'low', 'medium',
      'These targets timed out. They may be down, very slow, or blocking automated checks.', slow,
      'Open them manually to confirm they work; remove or replace any that stay down.');
  }
  return out;
}
