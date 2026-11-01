import { fetchHtml } from './html-fetcher.js';
import { compareSignals } from './render-diff.js';
import { analyzeKeywords } from './keywords.js';
import { acceptLanguageFor, countryInfo, findCountry } from './countries.js';
import { computeCountryFit, inferCountry, detectCity } from './country-fit.js';
import { extractSeoSignals } from './seo-extractor.js';
import { calculateScore, buildIssues, calculateSectionScores } from './scoring-engine.js';
import { RUBRIC_VERSION, STATUS, NOT_EVALUATED } from './report-schema.js';
import { RULES } from './seo-rules.js';

/** Run all rules against extracted signals. Rule exceptions become `error` checks, never crashes. */
export function evaluateRules(ctx) {
  return RULES.map((rule) => {
    const base = {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      weight: rule.weight,
      impact: rule.impact,
      confidence: rule.confidence,
      why: rule.why,
    };
    try {
      return { ...base, ...rule.run(ctx) };
    } catch (err) {
      return { ...base, status: STATUS.ERROR, evidence: '', message: `Rule failed: ${err.message}` };
    }
  });
}

/** Build a full report from an already-fetched page. Pure; used by tests. */
export function buildReport(page, onProgress = () => {}) {
  onProgress({ stage: 'parse', message: `Parsing ${Math.round((page.bytes ?? page.html.length) / 1024)} KB of HTML` });
  const signals = extractSeoSignals(page.html, page.finalUrl);

  // Live-render info: compare the raw server HTML against the rendered DOM that was analysed.
  let render = { used: false, reason: page.renderReason || 'Live rendering was not used.', diff: null };
  if (page.method === 'rendered' || page.method === 'browser') {
    const info = page.renderInfo || { consoleErrors: [], failedRequests: [], httpErrors: [] };
    let diff = null;
    if (page.rawHtml) {
      try {
        diff = compareSignals(extractSeoSignals(page.rawHtml, page.rawFinalUrl || page.finalUrl), signals);
      } catch {
        diff = null;
      }
    }
    render = { used: true, ms: page.fetchMs, method: page.method, diff, health: info, rawAvailable: !!page.rawHtml };
  }

  // Keyword profile from the analysed text; the raw text itself is not kept in the report.
  const keywords = analyzeKeywords({
    text: signals.content.text,
    title: signals.metadata.title,
    description: signals.metadata.description,
    h1: signals.headings.h1,
    h2: signals.headings.h2,
    h3: signals.headings.h3,
    url: page.finalUrl,
    alts: signals.images.items.map((i) => i.alt).filter(Boolean),
  });
  const fitCountry = page.country ? findCountry(page.country.code) : null;
  let countryFit = null;
  if (fitCountry) {
    let hostname = '';
    try {
      hostname = new URL(page.finalUrl).hostname;
    } catch {
      /* leave empty */
    }
    countryFit = computeCountryFit(fitCountry, {
      hostname, lang: signals.metadata.lang, hreflang: signals.metadata.hreflang, text: signals.content.text, structuredData: signals.structuredData.items,
    });
  }
  // Where does the site say it operates? Used to localise keyword ideas (e.g. "lighting perth").
  let hostForInference = '';
  try {
    hostForInference = new URL(page.finalUrl).hostname;
  } catch {
    /* leave empty */
  }
  const inferred = inferCountry({
    hostname: hostForInference, lang: signals.metadata.lang, hreflang: signals.metadata.hreflang, text: signals.content.text, structuredData: signals.structuredData.items,
  });
  const locCode = fitCountry?.code || inferred?.code || null;
  const location = locCode
    ? { code: locCode, country: findCountry(locCode)?.name, city: detectCity(locCode, { text: signals.content.text, structuredData: signals.structuredData.items, headline: `${signals.metadata.title} ${signals.metadata.description} ${signals.headings.h1.join(' ')}` }), inferred: !fitCountry }
    : null;
  delete signals.content.text;

  // A canonical can also be declared in an HTTP Link header.
  const linkHeader = String(page.headers?.link || '');
  const headerCanonical = /<([^>]+)>\s*;[^,]*rel="?canonical"?/i.exec(linkHeader)?.[1];
  if (!signals.metadata.canonical && headerCanonical) {
    try {
      signals.metadata.canonical = new URL(headerCanonical, page.finalUrl).href;
      signals.metadata.canonicalCount = 1;
      signals.metadata.canonicalSource = 'http-header';
    } catch {
      /* ignore malformed header */
    }
  }
  onProgress({ stage: 'checks', message: `Running ${RULES.length} checks` });
  const checks = evaluateRules({
    ...signals,
    render,
    country: page.country || null,
    finalUrl: page.finalUrl,
    statusCode: page.statusCode,
    headers: page.headers,
    bytes: page.bytes ?? page.html.length,
  });
  onProgress({ stage: 'score', message: 'Calculating score' });
  const scoring = calculateScore(checks);
  const notices = buildNotices(page, signals);
  const evaluated = checks.filter((c) => c.status !== STATUS.NOT_APPLICABLE && c.status !== STATUS.NOT_EVALUATED && c.status !== STATUS.ERROR);

  return {
    url: page.finalUrl,
    requestedUrl: page.requestedUrl || page.finalUrl,
    statusCode: page.statusCode,
    redirects: page.redirects || [],
    score: scoring.score,
    grade: scoring.grade,
    gradeLabel: scoring.gradeLabel,
    scoring,
    sections: calculateSectionScores(checks),
    metadata: signals.metadata,
    headings: signals.headings,
    images: signals.images,
    links: signals.links,
    structuredData: signals.structuredData,
    a11y: signals.a11y,
    content: signals.content,
    keywords,
    country: page.country || null,
    countryFit,
    inferredCountry: inferred,
    location,
    notices,
    checks,
    issues: buildIssues(checks),
    coverage: {
      evaluated: evaluated.length,
      total: checks.length,
      skipped: checks.filter((c) => c.status === STATUS.NOT_APPLICABLE).map((c) => c.id),
      errored: checks.filter((c) => c.status === STATUS.ERROR).map((c) => c.id),
      notEvaluated: render.used ? NOT_EVALUATED.filter((n) => n.id !== 'js-rendering') : NOT_EVALUATED,
    },
    fetch: { bytes: page.bytes, ms: page.fetchMs, method: page.method || 'http' },
    render: {
      used: render.used,
      reason: render.reason || '',
      ms: render.ms || 0,
      method: render.method || 'http',
      rawAvailable: !!render.rawAvailable,
      diff: render.diff,
      consoleErrors: render.health?.consoleErrors || [],
      failedRequests: render.health?.failedRequests || [],
      httpErrors: render.health?.httpErrors || [],
    },
    response: {
      contentType: String(page.headers?.['content-type'] || ''),
      contentEncoding: String(page.headers?.['content-encoding'] || ''),
      server: String(page.headers?.server || ''),
      xRobotsTag: String(page.headers?.['x-robots-tag'] || ''),
      cacheControl: String(page.headers?.['cache-control'] || ''),
      lastModified: String(page.headers?.['last-modified'] || ''),
    },
    generatedAt: page.fetchedAt || new Date().toISOString(),
    rubricVersion: RUBRIC_VERSION,
    disclaimer:
      'Score = weighted checks (rubric ' + RUBRIC_VERSION + ') over the HTML the server returned, plus Lighthouse performance when tested. It reflects on-page and technical health — it does not predict Google rankings.',
  };
}

/** Caveats that change how much the results should be trusted. */
function buildNotices(page, signals) {
  const notices = [];
  if (page.country) {
    notices.push({
      level: 'info',
      message: `Analysed as a visitor from ${page.country.name}: its language (${page.country.locale}), time zone and location were applied. The request still comes from this server's own IP address, so sites that choose content purely by IP can show their default version.`,
    });
  }
  if (page.statusCode >= 400) {
    notices.push({ level: 'warning', message: `The server responded with HTTP ${page.statusCode}. These results describe that response, not the intended page.` });
  }
  if (page.method === 'browser') {
    notices.push({
      level: 'info',
      message: 'This site blocks plain HTTP requests, so the page was loaded in a real browser. The analysis uses the fully rendered page, including JavaScript-generated content.',
    });
  } else if (page.method === 'rendered') {
    notices.push({
      level: 'info',
      message: 'Analysed from the live page after JavaScript ran, not just the server HTML.',
    });
  } else if (page.renderReason) {
    notices.push({ level: 'info', message: `Live rendering was not used: ${page.renderReason} Results reflect the server HTML only.` });
  }
  const title = signals.metadata.title || '';
  if ([401, 403, 429].includes(page.statusCode) || /access denied|attention required|just a moment|captcha|are you a robot|security check/i.test(title)) {
    notices.push({
      level: 'warning',
      message: 'This site appears to block automated requests, so the content analysed may be a block or challenge page rather than the real page.',
    });
  }
  const from = page.requestedUrl ? new URL(page.requestedUrl).hostname : null;
  const to = new URL(page.finalUrl).hostname;
  if (from && from.replace(/^www\./, '') !== to.replace(/^www\./, '')) {
    notices.push({ level: 'info', message: `The request redirected from ${from} to ${to}; the report describes ${to}.` });
  }
  const { wordCount, scriptCount, appRoot } = signals.content;
  if ((!page.method || page.method === 'http') && wordCount < 80 && (appRoot || scriptCount >= 3)) {
    notices.push({
      level: 'warning',
      message: 'This page appears to render its content with JavaScript. Only the server HTML was analyzed, so headings, text, links and some metadata may be incomplete.',
    });
  }
  return notices;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch the server-returned HTML. Workers do not run a local browser, so JavaScript-rendered
 * content is reported as unavailable rather than invoking a Node-only browser package.
 */
async function loadPage(url, onProgress, { render = true, country = null } = {}) {
  const page = await fetchHtml(url, {
    onProgress,
    acceptLanguage: acceptLanguageFor(country),
  });
  const renderReason = render
    ? 'JavaScript rendering is unavailable in this Cloudflare Workers deployment.'
    : 'Live rendering was turned off for this analysis.';
  return { ...page, renderReason };
}

export async function analyzeUrl(url, onProgress, options = {}) {
  const page = await loadPage(url, onProgress, options);
  const report = buildReport({ ...page, requestedUrl: url.href, country: countryInfo(options.country) }, onProgress || (() => {}));

  // Stream each real check result with the running score, lightly paced so a live
  // client can show the score building rather than receiving it in one burst.
  if (onProgress) {
    const so_far = [];
    for (const [i, c] of report.checks.entries()) {
      so_far.push(c);
      onProgress({
        stage: 'check',
        message: `${c.title} — ${c.status.replace('_', ' ')}`,
        status: c.status,
        n: i + 1,
        total: report.checks.length,
        score: calculateScore(so_far).score,
      });
      await sleep(38);
    }
  }
  return report;
}
