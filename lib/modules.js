/**
 * Report modules — one page each. `checks` lists the rule ids shown on that page.
 * Order and grouping follow the product scope table in the project report.
 */
export const SECTIONS = ['On-page', 'Indexing', 'Social', 'Content', 'Accessibility', 'Rendering', 'Technical'];

export const MODULES = [
  { slug: 'title', label: 'Title tag', section: 'On-page', checks: ['title-exists', 'title-length', 'title-single', 'title-h1-alignment'],
    summary: 'The title is the main headline for the page in search results and browser tabs.' },
  { slug: 'description', label: 'Meta description', section: 'On-page', checks: ['description-exists', 'description-length', 'description-quality'],
    summary: 'The description is frequently used as the snippet beneath a search result.' },
  { slug: 'canonical', label: 'Canonical URL', section: 'Indexing', checks: ['canonical', 'robots'],
    summary: 'The canonical link names the preferred URL; robots directives control whether the page is indexed.' },
  { slug: 'open-graph', label: 'Open Graph', section: 'Social', checks: ['open-graph'],
    summary: 'Open Graph tags decide how the page looks when shared on social and messaging apps.' },
  { slug: 'twitter-cards', label: 'Twitter / X Cards', section: 'Social', checks: ['twitter-card'],
    summary: 'Twitter Card tags control the preview shown on X.' },
  { slug: 'images', label: 'Images', section: 'Content', checks: ['image-alt', 'image-dimensions'],
    summary: 'Image sources and alternative text found in the HTML.' },
  { slug: 'links', label: 'Links', section: 'Content', checks: ['internal-links', 'anchor-text'],
    summary: 'Internal and external links discovered on the page.' },
  { slug: 'structured-data', label: 'Structured data', section: 'Content', checks: ['structured-data', 'schema-validation'],
    summary: 'JSON-LD blocks discovered and parsed from the page.' },
  { slug: 'content-quality', label: 'Content quality', section: 'Content', checks: ['h1', 'heading-structure', 'readability', 'keyword-stuffing', 'content-length'],
    summary: 'Heading structure, reading ease, sentence length and keyword density of the visible text.' },
  { slug: 'accessibility', label: 'Accessibility', section: 'Accessibility', checks: ['a11y-forms', 'a11y-names', 'a11y-landmarks', 'a11y-markup'],
    summary: 'Labels, names, landmarks and markup that screen readers and other assistive tools depend on.' },
  { slug: 'rendering', label: 'JavaScript rendering', section: 'Rendering',
    checks: ['js-metadata', 'js-conflict', 'js-content', 'js-links', 'render-health'],
    summary: 'Compares the raw server HTML with the live, JavaScript-rendered page.' },
  { slug: 'technical', label: 'Technical signals', section: 'Technical', checks: ['http-status', 'https', 'viewport', 'html-lang', 'charset', 'url-quality', 'mixed-content', 'compression', 'country-targeting'],
    summary: 'HTTP response, HTTPS, viewport and language declarations.' },
];

export const EXTRA_PAGES = [
  { slug: 'performance', label: 'Performance' },
  { slug: 'broken-links', label: 'Broken links' },
  { slug: 'social-profiles', label: 'Social profiles' },
  { slug: 'sitemap', label: 'Sitemap & robots' },
  { slug: 'ai-access', label: 'AI & crawler access' },
  { slug: 'site-crawl', label: 'Site-wide issues' },
  { slug: 'keywords', label: 'Keywords overview' },
  { slug: 'security', label: 'Security & infrastructure' },
  { slug: 'traffic', label: 'Traffic overview' },
  { slug: 'recommendations', label: 'Recommendations' },
  { slug: 'export', label: 'Download report' },
];

export const ALL_SLUGS = [...MODULES.map((m) => m.slug), ...EXTRA_PAGES.map((p) => p.slug)];

const ORDER = ['fail', 'error', 'warning', 'pass', 'not_applicable', 'not_evaluated'];

/** Worst status among a module's checks. */
export function moduleStatus(mod, checks) {
  const found = mod.checks.map((id) => checks.find((c) => c.id === id)?.status).filter(Boolean);
  return ORDER.find((s) => found.includes(s)) || 'not_evaluated';
}

export function moduleChecks(mod, checks) {
  // The country-targeting check only exists when a country is selected; hide it while it is not applicable.
  return mod.checks
    .map((id) => checks.find((c) => c.id === id))
    .filter(Boolean)
    .filter((c) => !(c.id === 'country-targeting' && c.status === 'not_applicable'));
}
