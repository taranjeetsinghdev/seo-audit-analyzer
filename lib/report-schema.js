export const RUBRIC_VERSION = '2026.3';

export const STATUS = {
  PASS: 'pass',
  WARNING: 'warning',
  FAIL: 'fail',
  NOT_APPLICABLE: 'not_applicable',
  NOT_EVALUATED: 'not_evaluated',
  ERROR: 'error',
};

export const CATEGORIES = {
  technical: { label: 'Technical SEO', description: 'Crawlability, indexing signals and page setup' },
  onpage: { label: 'On-page SEO', description: 'Titles, descriptions, headings and content structure' },
  social: { label: 'Social & structured data', description: 'Open Graph, Twitter Cards and JSON-LD' },
  accessibility: { label: 'Media & accessibility', description: 'Images and alternative text' },
};

/** Heuristic ranges — search snippets vary, these are guidance, not rules. */
export const LIMITS = {
  title: { min: 30, max: 60 },
  description: { min: 70, max: 160 },
  thinContentWords: 300,
};

export const GRADES = [
  { min: 90, grade: 'A', label: 'Excellent' },
  { min: 80, grade: 'B', label: 'Good' },
  { min: 70, grade: 'C', label: 'Fair' },
  { min: 55, grade: 'D', label: 'Needs work' },
  { min: 0, grade: 'F', label: 'Poor' },
];

/** Checks the first-pass analyser cannot honestly evaluate yet. */
export const NOT_EVALUATED = [
  { id: 'performance', title: 'Performance & Core Web Vitals', reason: 'Run the on-demand test on the Performance page (Google PageSpeed Insights + Chrome UX Report) to include it.' },
  { id: 'js-rendering', title: 'JavaScript-rendered content', reason: 'Only the server HTML response is inspected; a browser renderer is planned.' },
  { id: 'broken-links', title: 'Broken link detection', reason: 'Runs automatically after the audit; results appear on the Broken links page.' },
  { id: 'indexing', title: 'Actual Google indexing & rankings', reason: 'Needs Google Search Console data, which Google only releases to a property\'s verified owner.' },
  { id: 'backlinks', title: 'Backlinks & competitor metrics', reason: 'Requires a specialist backlink data provider; not available from a single page fetch.' },
  { id: 'sitewide', title: 'Site-wide issues', reason: 'Run the site crawl on the Site-wide issues page to find duplicates, orphans and sitemap problems.' },
];
