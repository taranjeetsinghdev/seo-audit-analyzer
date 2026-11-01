import { issuePriority } from './scoring-engine.js';

/** Pure, browser-safe: grade robots.txt and the XML sitemap from live crawl data. */

const item = (id, title, status, weight, detail, fix = '') => ({ id, title, status, weight, detail, fix });

export function auditSitemap(crawl) {
  if (!crawl) return null;
  const { robots, sitemap, pages = [], origin } = crawl;
  const items = [];

  items.push(robots.found
    ? item('robots-file', 'robots.txt exists', 'pass', 3, `${origin}/robots.txt`)
    : item('robots-file', 'robots.txt exists', 'warn', 3, 'No robots.txt was found.', 'Publish a robots.txt that allows crawling and lists your sitemap.'));

  if (robots.found) {
    items.push(robots.blocksAll
      ? item('robots-open', 'robots.txt allows crawling', 'fail', 6, 'A "Disallow: /" rule blocks every crawler.', 'Remove the blanket disallow unless the site should stay out of search.')
      : item('robots-open', 'robots.txt allows crawling', 'pass', 6, robots.hasRules ? 'Rules found, and they do not block the whole site.' : 'No blocking rules.'));
    items.push(robots.sitemaps?.length
      ? item('robots-sitemap', 'Sitemap is declared in robots.txt', 'pass', 2, robots.sitemaps.slice(0, 3).join(' · '))
      : item('robots-sitemap', 'Sitemap is declared in robots.txt', 'warn', 2, 'No "Sitemap:" line in robots.txt.', 'Add "Sitemap: https://your-site/sitemap.xml" to robots.txt.'));
  }

  items.push(sitemap.found
    ? item('sitemap-file', 'XML sitemap exists', 'pass', 6, `${sitemap.urls.length}${sitemap.urls.length >= 500 ? '+' : ''} URLs listed`)
    : item('sitemap-file', 'XML sitemap exists', 'fail', 6, 'No sitemap was found at the usual location or in robots.txt.', 'Publish an XML sitemap listing every indexable page.'));

  if (sitemap.found) {
    const listed = pages.filter((p) => p.inSitemap);
    const bad = listed.filter((p) => p.verdict === 'error' || p.verdict === 'unreachable' || p.noindex || ((p.redirects || 0) > 0 && p.finalUrl && p.finalUrl !== p.url));
    if (listed.length) {
      const share = bad.length / listed.length;
      items.push(bad.length === 0
        ? item('sitemap-health', 'Sitemap URLs are clean', 'pass', 5, `${listed.length} listed URLs checked: all return 200, are indexable and do not redirect.`)
        : item('sitemap-health', 'Sitemap URLs are clean', share > 0.2 ? 'fail' : 'warn', 5, `${bad.length} of ${listed.length} checked sitemap URLs are errors, redirects or noindex: ${bad.slice(0, 3).map((p) => p.url).join(', ')}`, 'A sitemap should list only canonical, indexable pages that return 200.'));
    } else {
      items.push(item('sitemap-health', 'Sitemap URLs are clean', 'na', 0, 'None of the sitemap URLs were reached by the crawl.'));
    }
    const complete = !crawl.truncated && sitemap.urls.length < 500;
    const found = pages.filter((p) => p.verdict === 'ok' && !p.noindex && p.discoveredBy === 'links');
    if (complete && found.length >= 5) {
      const missing = found.filter((p) => !p.inSitemap);
      const cover = 1 - missing.length / found.length;
      items.push(cover >= 0.8
        ? item('sitemap-coverage', 'Sitemap covers the site', 'pass', 4, `${Math.round(cover * 100)}% of the pages found by crawling are in the sitemap.`)
        : item('sitemap-coverage', 'Sitemap covers the site', cover < 0.5 ? 'fail' : 'warn', 4, `Only ${Math.round(cover * 100)}% of crawled pages are in the sitemap. Missing: ${missing.slice(0, 3).map((p) => p.url).join(', ')}`, 'Add every indexable page to the sitemap.'));
    } else {
      items.push(item('sitemap-coverage', 'Sitemap covers the site', 'na', 0, 'Needs a complete crawl of a small site to compare; the crawl hit its page limit or the sitemap is large.'));
    }
    if (sitemap.urls.length >= 50_000) items.push(item('sitemap-size', 'Sitemap size limit', 'warn', 1, 'A single sitemap may hold at most 50,000 URLs.', 'Split it into a sitemap index.'));
  }

  let got = 0;
  let max = 0;
  for (const i of items) {
    if (i.status === 'na' || !i.weight) continue;
    max += i.weight;
    got += i.weight * (i.status === 'pass' ? 1 : i.status === 'warn' ? 0.5 : 0);
  }
  const score = max ? Math.round((got / max) * 100) : null;
  return { score, items, urls: sitemap.urls.length, robotsFound: robots.found, sitemapFound: sitemap.found };
}

export function sitemapIssues(audit) {
  return (audit?.items || [])
    .filter((i) => i.status === 'fail' || i.status === 'warn')
    .map((i) => {
      const severity = i.status === 'fail' ? 'critical' : 'warning';
      const impact = i.weight >= 5 ? 'high' : i.weight >= 3 ? 'medium' : 'low';
      return { id: `map-${i.id}`, title: i.title, category: 'sitemap', severity, impact, confidence: 'high', message: `${i.title}: ${i.detail}`, evidence: i.detail, recommendation: i.fix, priority: issuePriority(impact, 'high', severity, 0) };
    });
}
