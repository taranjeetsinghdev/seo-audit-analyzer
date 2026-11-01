/** Pure, browser-safe: turn crawl data into site-wide findings, counts and a health score. */
import { issuePriority } from './scoring-engine.js';

const short = (u, n = 70) => (u.length > n ? `${u.slice(0, n - 1)}…` : u);
const list = (items, fmt, n = 6) => items.slice(0, n).map(fmt).join('\n') + (items.length > n ? `\n…and ${items.length - n} more` : '');

function groupBy(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return [...m.entries()].filter(([, v]) => v.length > 1);
}

export function analyzeCrawl(crawl) {
  const issues = [];
  const add = (id, title, severity, impact, confidence, message, pages, evidence, recommendation, penalty) =>
    issues.push({
      id, title, category: 'site', severity, impact, confidence, message, evidence, recommendation,
      affected: pages.length, penalty, pages: pages.slice(0, 50).map((p) => p.url || p),
      priority: issuePriority(impact, confidence, severity, 0) + Math.min(pages.length, 20) / 100,
    });

  const pages = crawl.pages || [];
  const ok = pages.filter((p) => p.verdict === 'ok' && p.status < 400);
  const htmlOk = ok.filter((p) => !p.noindex);

  const broken = pages.filter((p) => p.verdict === 'error' || p.verdict === 'unreachable');
  if (broken.length) {
    add('site-broken-pages', `${broken.length} page${broken.length > 1 ? 's' : ''} return errors`, 'critical', 'high', 'high',
      'Crawled pages respond with an error status or could not be reached.', broken,
      list(broken, (p) => `${p.status ?? 'no response'} — ${short(p.url)}${p.inlinks ? ` (linked from ${p.inlinks} page${p.inlinks > 1 ? 's' : ''})` : ''}`),
      'Fix or redirect each URL, and update links that point to it.', Math.min(30, broken.length * 8));
  }

  const dupTitles = groupBy(ok, (p) => p.title?.toLowerCase());
  if (dupTitles.length) {
    const affected = dupTitles.flatMap(([, v]) => v);
    add('site-duplicate-titles', `${affected.length} pages share duplicate titles`, 'warning', 'medium', 'high',
      'Several pages use the same title, which makes them hard to tell apart in search results.', affected,
      list(dupTitles, ([t, v]) => `"${short(t, 50)}" × ${v.length}`), 'Give each page a unique, descriptive title.', Math.min(15, dupTitles.length * 4));
  }
  const missingTitle = ok.filter((p) => !p.title);
  if (missingTitle.length) {
    add('site-missing-titles', `${missingTitle.length} page${missingTitle.length > 1 ? 's' : ''} without a title`, 'critical', 'high', 'high',
      'Pages have no <title> element.', missingTitle, list(missingTitle, (p) => short(p.url)), 'Add a unique title to every page.', Math.min(20, missingTitle.length * 6));
  }

  const dupDesc = groupBy(ok, (p) => p.description?.toLowerCase());
  if (dupDesc.length) {
    const affected = dupDesc.flatMap(([, v]) => v);
    add('site-duplicate-descriptions', `${affected.length} pages share duplicate meta descriptions`, 'warning', 'low', 'high',
      'Duplicate descriptions waste snippet space and can reduce click-through.', affected,
      list(dupDesc, ([t, v]) => `"${short(t, 50)}" × ${v.length}`), 'Write a unique description for each page.', Math.min(10, dupDesc.length * 3));
  }
  const noDesc = ok.filter((p) => !p.description);
  if (noDesc.length) {
    add('site-missing-descriptions', `${noDesc.length} page${noDesc.length > 1 ? 's' : ''} without a meta description`, 'warning', 'low', 'high',
      'Search engines will generate a snippet themselves, which may not match your intent.', noDesc, list(noDesc, (p) => short(p.url)),
      'Add a concise, unique description to each page.', Math.min(10, noDesc.length * 2));
  }

  const noH1 = ok.filter((p) => !p.h1?.length);
  if (noH1.length) {
    add('site-missing-h1', `${noH1.length} page${noH1.length > 1 ? 's' : ''} without an H1`, 'warning', 'medium', 'medium',
      'Pages lack a main heading.', noH1, list(noH1, (p) => short(p.url)), 'Add one clear H1 to each page.', Math.min(10, noH1.length * 2));
  }
  const multiH1 = ok.filter((p) => p.h1?.length > 1);
  if (multiH1.length) {
    add('site-multiple-h1', `${multiH1.length} page${multiH1.length > 1 ? 's' : ''} with multiple H1s`, 'warning', 'low', 'medium',
      'Several H1 elements dilute the page topic.', multiH1, list(multiH1, (p) => `${p.h1.length} H1s — ${short(p.url)}`),
      'Use a single H1 and H2/H3 for sections.', Math.min(6, multiH1.length));
  }

  const thin = htmlOk.filter((p) => p.words < 150);
  if (thin.length) {
    add('site-thin-content', `${thin.length} thin page${thin.length > 1 ? 's' : ''} (<150 words)`, 'warning', 'medium', 'medium',
      'Pages with very little text may not satisfy search intent.', thin, list(thin, (p) => `${p.words} words — ${short(p.url)}`),
      'Add useful content, or consolidate or noindex pages with no standalone value.', Math.min(12, thin.length * 2));
  }

  const dupContent = groupBy(htmlOk.filter((p) => p.hash), (p) => p.hash);
  if (dupContent.length) {
    const affected = dupContent.flatMap(([, v]) => v);
    add('site-duplicate-content', `${affected.length} pages have near-identical content`, 'warning', 'high', 'medium',
      'Pages share the same body text, so search engines must choose one.', affected,
      list(dupContent, ([, v]) => v.map((p) => short(p.url, 40)).join('  =  ')), 'Consolidate duplicates with a canonical or 301 redirect, or differentiate the content.', Math.min(18, dupContent.length * 6));
  }

  const redirected = pages.filter((p) => p.redirects > 0 && p.finalUrl && p.finalUrl !== p.url && p.verdict === 'ok');
  if (redirected.length) {
    add('site-redirected-urls', `${redirected.length} internal URL${redirected.length > 1 ? 's' : ''} redirect`, 'warning', 'low', 'high',
      'Internal links lead through redirects, adding latency and wasting crawl budget.', redirected,
      list(redirected, (p) => `${short(p.url, 45)} → ${short(p.finalUrl, 45)}`), 'Link directly to the final URLs.', Math.min(8, redirected.length));
  }

  const nonSelf = ok.filter((p) => p.canonical && p.canonical.replace(/\/$/, '') !== (p.finalUrl || p.url).replace(/\/$/, ''));
  if (nonSelf.length) {
    add('site-canonical-elsewhere', `${nonSelf.length} page${nonSelf.length > 1 ? 's' : ''} canonicalise to another URL`, 'warning', 'medium', 'medium',
      'These pages tell search engines that a different URL is the preferred version.', nonSelf,
      list(nonSelf, (p) => `${short(p.url, 40)} → ${short(p.canonical, 40)}`), 'Confirm this is intended; otherwise point the canonical to itself.', Math.min(8, nonSelf.length * 2));
  }

  const noindex = ok.filter((p) => p.noindex);
  if (noindex.length) {
    add('site-noindex', `${noindex.length} page${noindex.length > 1 ? 's' : ''} marked noindex`, 'warning', 'medium', 'high',
      'These pages are excluded from search results.', noindex, list(noindex, (p) => short(p.url)), 'Check each one is meant to be excluded.', 0);
  }

  // Orphans can only be judged when every page was crawled; with a partial crawl a page we did
  // not fetch may well link to the "orphan", so reporting it would be a false positive.
  const orphans = crawl.truncated ? [] : pages.filter((p) => p.inSitemap && p.depth !== 0 && p.inlinks === 0 && p.verdict === 'ok');
  if (orphans.length) {
    add('site-orphan-pages', `${orphans.length} orphan page${orphans.length > 1 ? 's' : ''}`, 'warning', 'medium', 'medium',
      'These URLs are in the sitemap but no crawled page links to them, so visitors and crawlers struggle to find them.', orphans,
      list(orphans, (p) => short(p.url)), 'Add internal links from relevant pages.', Math.min(12, orphans.length * 3));
  }

  const deep = pages.filter((p) => p.discoveredBy === 'links' && p.depth > 3 && p.verdict === 'ok');
  if (deep.length) {
    add('site-deep-pages', `${deep.length} page${deep.length > 1 ? 's' : ''} more than 3 clicks deep`, 'warning', 'low', 'medium',
      'Pages buried deep in the structure are crawled less often and get less internal authority.', deep,
      list(deep, (p) => `depth ${p.depth} — ${short(p.url)}`), 'Link to important pages from higher-level pages.', Math.min(6, deep.length));
  }

  const blockedRobots = pages.filter((p) => p.verdict === 'blocked_by_robots');
  if (blockedRobots.length) {
    add('site-robots-blocked', `${blockedRobots.length} URL${blockedRobots.length > 1 ? 's' : ''} blocked by robots.txt`, 'warning', 'medium', 'high',
      'Linked or listed URLs are disallowed in robots.txt and were not crawled.', blockedRobots, list(blockedRobots, (p) => short(p.url)),
      'Make sure important pages are not disallowed.', Math.min(8, blockedRobots.length * 2));
  }

  // ---- site files ----
  if (!crawl.robots?.found) {
    add('site-no-robots', 'No robots.txt found', 'warning', 'low', 'high', 'The site does not publish a robots.txt file.', [crawl.origin],
      `${crawl.origin}/robots.txt`, 'Add a robots.txt that allows crawling and references your sitemap.', 0);
  } else if (crawl.robots.blocksAll) {
    add('site-robots-blocks-all', 'robots.txt blocks all crawlers', 'critical', 'high', 'high', 'A "Disallow: /" rule blocks the entire site.', [crawl.origin],
      `${crawl.origin}/robots.txt`, 'Remove the blanket disallow unless the site should not be indexed.', 0);
  }
  if (!crawl.sitemap?.found) {
    add('site-no-sitemap', 'No XML sitemap found', 'warning', 'medium', 'medium', 'No sitemap was found at the usual location or in robots.txt.', [crawl.origin],
      `${crawl.origin}/sitemap.xml`, 'Publish an XML sitemap and reference it in robots.txt.', 0);
  } else {
    const bad = pages.filter((p) => p.inSitemap && (p.verdict === 'error' || p.verdict === 'unreachable' || p.noindex || (p.redirects > 0 && p.finalUrl !== p.url)));
    if (bad.length) {
      add('site-sitemap-problems', `${bad.length} sitemap URL${bad.length > 1 ? 's' : ''} are errors, redirects or noindex`, 'warning', 'medium', 'high',
        'A sitemap should only list canonical, indexable pages that return 200.', bad,
        list(bad, (p) => `${p.status ?? p.verdict}${p.noindex ? ' noindex' : ''} — ${short(p.url)}`), 'Remove or fix these URLs in the sitemap.', 0);
    }
  }

  issues.sort((a, b) => b.priority - a.priority);

  const counts = {
    crawled: pages.length,
    ok: ok.length,
    errors: broken.length,
    redirects: redirected.length,
    noindex: noindex.length,
    orphans: orphans.length,
    orphansEvaluated: !crawl.truncated,
    duplicateTitles: dupTitles.reduce((a, [, v]) => a + v.length, 0),
    duplicateDescriptions: dupDesc.reduce((a, [, v]) => a + v.length, 0),
    thin: thin.length,
    inSitemap: crawl.sitemap?.urls?.length || 0,
  };
  const penalty = issues.reduce((a, i) => a + i.penalty, 0);
  const score = pages.length ? Math.max(0, Math.min(100, Math.round(100 - penalty))) : null;
  return { issues, counts, score };
}
