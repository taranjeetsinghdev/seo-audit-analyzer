import { STATUS, LIMITS } from './report-schema.js';

const { PASS, WARNING, FAIL, NOT_APPLICABLE, NOT_EVALUATED } = STATUS;

const out = (status, evidence, message, recommendation) => ({ status, evidence, message, recommendation });
const noRender = (render) =>
  out(
    NOT_EVALUATED,
    '',
    render?.used
      ? 'The raw server HTML was blocked or unavailable, so there is nothing to compare the rendered page against.'
      : 'Live rendering was off or unavailable for this report, so raw and rendered HTML were not compared.',
  );
const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'our', 'you', 'are', 'from', 'that', 'this', 'how', 'what', 'best', 'new']);
const GENERIC_ANCHOR = /^(click here|here|read more|more|learn more|link|this|details|view|click|continue|go)$/i;
const SCHEMA_REQUIRED = {
  Organization: ['name', 'url'], LocalBusiness: ['name', 'address'], Person: ['name'], WebSite: ['name', 'url'],
  Article: ['headline', 'author', 'datePublished', 'image'], NewsArticle: ['headline', 'author', 'datePublished', 'image'], BlogPosting: ['headline', 'author', 'datePublished', 'image'],
  Product: ['name', 'image', 'offers'], FAQPage: ['mainEntity'], BreadcrumbList: ['itemListElement'], Event: ['name', 'startDate', 'location'],
  Recipe: ['name', 'image', 'recipeIngredient'], VideoObject: ['name', 'thumbnailUrl', 'uploadDate'], JobPosting: ['title', 'datePosted', 'hiringOrganization'],
};
const quote = (s) => (s ? `"${s.length > 140 ? s.slice(0, 140) + '…' : s}"` : '—');

/**
 * Each rule: weight contributes to the 100-point rubric (weight 0 = advisory).
 * impact: how much it matters if wrong. confidence: how sure we are the finding is a real problem.
 */
export const RULES = [
  {
    id: 'title-exists', category: 'onpage', title: 'Page title exists', weight: 6, impact: 'high', confidence: 'high',
    why: 'The title element is the primary label for a page in search results and browser tabs.',
    run: ({ metadata: m }) =>
      m.title
        ? out(PASS, quote(m.title), 'A title tag was found.')
        : out(FAIL, 'No <title> element found', 'The page has no title.', 'Add a unique, descriptive <title> to the document head.'),
  },
  {
    id: 'title-length', category: 'onpage', title: 'Title length', weight: 3, impact: 'medium', confidence: 'medium',
    why: 'Very short or long titles are often rewritten or truncated in search snippets (heuristic only).',
    run: ({ metadata: m }) => {
      if (!m.title) return out(NOT_APPLICABLE, 'No title to measure', 'Skipped because no title exists.');
      const n = m.title.length;
      const { min, max } = LIMITS.title;
      if (n >= min && n <= max) return out(PASS, `${n} characters`, `Within the ${min}–${max} character heuristic.`);
      if (n < 15 || n > 75) return out(FAIL, `${n} characters`, n < 15 ? 'Title is far too short to describe the page.' : 'Title is far too long and will be cut off in results.',
        `Aim for roughly ${min}–${max} characters, leading with the main topic.`);
      return out(WARNING, `${n} characters`, n < min ? 'Title is shorter than the heuristic range.' : 'Title may be truncated in results.',
        `Aim for roughly ${min}–${max} characters, leading with the main topic.`);
    },
  },
  {
    id: 'description-exists', category: 'onpage', title: 'Meta description exists', weight: 6, impact: 'medium', confidence: 'high',
    why: 'Descriptions are frequently used as the snippet text and influence click-through.',
    run: ({ metadata: m }) =>
      m.description
        ? out(PASS, quote(m.description), 'A meta description was found.')
        : out(FAIL, 'No meta description', 'The page has no meta description.', 'Add a concise <meta name="description"> summarising the page.'),
  },
  {
    id: 'description-length', category: 'onpage', title: 'Description length', weight: 2, impact: 'low', confidence: 'medium',
    why: 'Snippet length varies by device and query; the range is a heuristic.',
    run: ({ metadata: m }) => {
      if (!m.description) return out(NOT_APPLICABLE, 'No description to measure', 'Skipped because no description exists.');
      const n = m.description.length;
      const { min, max } = LIMITS.description;
      if (n >= min && n <= max) return out(PASS, `${n} characters`, `Within the ${min}–${max} character heuristic.`);
      if (n < 50 || n > 200) return out(FAIL, `${n} characters`, n < 50 ? 'Description is too short to be useful as a snippet.' : 'Description is far too long and will be cut off.',
        `Aim for roughly ${min}–${max} characters of useful, unique copy.`);
      return out(WARNING, `${n} characters`, n < min ? 'Description is short.' : 'Description may be truncated.',
        `Aim for roughly ${min}–${max} characters of useful, unique copy.`);
    },
  },
  {
    id: 'h1', category: 'onpage', title: 'Single H1 heading', weight: 6, impact: 'high', confidence: 'medium',
    why: 'A clear H1 states the page topic to users and crawlers. Multiple H1s are allowed by HTML5 but often signal weak structure.',
    run: ({ headings: h }) => {
      const nonEmpty = h.h1.filter(Boolean);
      if (nonEmpty.length === 1) return out(PASS, quote(nonEmpty[0]), 'Exactly one H1 found.');
      if (nonEmpty.length === 0) return out(FAIL, 'No H1 found', 'The page has no non-empty H1.', 'Add one H1 that describes the main topic of the page.');
      return out(WARNING, `${nonEmpty.length} H1 elements`, 'Multiple H1 headings found.', 'Consider keeping a single H1 and using H2/H3 for sub-sections.');
    },
  },
  {
    id: 'heading-structure', category: 'onpage', title: 'Heading structure', weight: 3, impact: 'low', confidence: 'medium',
    why: 'Sub-headings help users scan and give crawlers the outline of the content.',
    run: ({ headings: h }) => {
      const empty = [...h.h1, ...h.h2, ...h.h3].filter((t) => !t).length;
      if (!h.h1.length && !h.h2.length && !h.h3.length) return out(FAIL, 'No headings', 'The page has no H1–H3 headings.', 'Structure the content with an H1 and descriptive H2 sections.');
      const problems = [];
      if (!h.h2.length) problems.push('no H2 headings');
      if (h.h3.length && !h.h2.length) problems.push('H3 used without any H2 (skipped level)');
      if (empty) problems.push(`${empty} empty heading${empty > 1 ? 's' : ''}`);
      return problems.length
        ? out(WARNING, problems.join('; '), 'The heading outline has structural problems.', 'Use H2 for sections and H3 beneath them, in order, and remove empty headings.')
        : out(PASS, `${h.h2.length} H2, ${h.h3.length} H3`, 'Sub-headings are present and in order.');
    },
  },
  {
    id: 'canonical', category: 'technical', title: 'Canonical URL', weight: 5, impact: 'high', confidence: 'medium',
    why: 'A canonical link tells search engines which URL is the preferred version of the page.',
    run: ({ metadata: m, finalUrl }) => {
      if (!m.canonical) return out(FAIL, 'No canonical link', 'No canonical declaration found.', 'Add <link rel="canonical"> pointing to the preferred URL.');
      if (m.canonicalCount > 1) return out(WARNING, `${m.canonicalCount} canonical tags`, 'Multiple canonical tags found; they may be ignored.', 'Keep exactly one canonical link element.');
      const same = (a, b) => a.replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase() === b.replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
      if (finalUrl && !same(m.canonical, finalUrl)) return out(WARNING, `${m.canonical} (page is ${finalUrl})`, 'The canonical points to a different URL than this page.', 'Point the canonical at this page itself unless it is a deliberate duplicate.');
      return out(PASS, m.canonical, 'Canonical declared and self-referencing.');
    },
  },
  {
    id: 'robots', category: 'technical', title: 'Indexable (no noindex)', weight: 3, impact: 'high', confidence: 'high',
    why: 'A noindex directive prevents the page from appearing in search results.',
    run: ({ metadata: m, headers }) => {
      const xrobots = String(headers?.['x-robots-tag'] || '');
      const all = [m.robots, m.googlebot, xrobots].filter(Boolean).join(', ');
      if (/noindex/i.test(all)) return out(FAIL, all, 'A noindex directive was found.', 'Remove noindex if this page should appear in search.');
      return out(PASS, all || 'No robots directives (default: index, follow)', 'No noindex found in meta tags or X-Robots-Tag.');
    },
  },
  {
    id: 'open-graph', category: 'social', title: 'Open Graph metadata', weight: 3, impact: 'low', confidence: 'high',
    why: 'Open Graph controls how links look when shared on social platforms and messaging apps.',
    run: ({ metadata: { og } }) => {
      const missing = ['title', 'description', 'image', 'url', 'type'].filter((k) => !og[k]);
      const core = ['title', 'description', 'image'].filter((k) => !og[k]).length;
      return missing.length === 0
        ? out(PASS, `og:title, og:description, og:image, og:url, og:type`, 'Open Graph tags present.')
        : out(core === 3 ? FAIL : WARNING, `Missing: ${missing.map((k) => 'og:' + k).join(', ')}`,
            'Open Graph metadata is incomplete.', 'Add og:title, og:description, og:image, og:url and og:type.');
    },
  },
  {
    id: 'viewport', category: 'technical', title: 'Viewport meta tag', weight: 2, impact: 'high', confidence: 'high',
    why: 'Without a viewport tag pages render as desktop-width on phones, hurting mobile usability.',
    run: ({ metadata: m }) => {
      if (!m.viewport) return out(FAIL, 'No viewport meta tag', 'Page is not declared mobile-friendly.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.');
      if (!/width\s*=\s*device-width/i.test(m.viewport)) return out(WARNING, m.viewport, 'The viewport does not use width=device-width.', 'Use content="width=device-width, initial-scale=1".');
      if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(m.viewport)) return out(WARNING, m.viewport, 'The viewport blocks pinch-zoom, which hurts accessibility.', 'Remove user-scalable=no and maximum-scale=1.');
      return out(PASS, m.viewport, 'Viewport tag present and mobile-friendly.');
    },
  },
  {
    id: 'image-alt', category: 'accessibility', title: 'Image alt attributes', weight: 4, impact: 'medium', confidence: 'high',
    why: 'Alt text supports accessibility and helps search engines understand images.',
    run: ({ images }) => {
      if (images.total === 0) return out(NOT_APPLICABLE, 'No images detected', 'No images to evaluate, so this earns no points either way.');
      if (images.missingAlt === 0) return out(PASS, `${images.total} images, all with alt`, 'All images have an alt attribute.');
      const ratio = images.missingAlt / images.total;
      return out(ratio > 0.25 ? FAIL : WARNING, `${images.missingAlt} of ${images.total} images missing alt`,
        'Some images have no alt attribute.', 'Add descriptive alt text (or alt="" for purely decorative images).');
    },
  },
  {
    id: 'structured-data', category: 'social', title: 'Structured data (JSON-LD)', weight: 6, impact: 'medium', confidence: 'low',
    why: 'Valid JSON-LD can make a page eligible for rich results. Not every page needs it, and valid JSON alone does not guarantee eligibility.',
    run: ({ structuredData: sd }) => {
      if (sd.items.length) {
        const types = [...new Set(sd.items.map((i) => i.type))].slice(0, 6).join(', ');
        return sd.errors.length
          ? out(WARNING, `${sd.items.length} parsed (${types}), ${sd.errors.length} invalid`, 'Some JSON-LD blocks failed to parse.', 'Fix the JSON syntax in the invalid blocks.')
          : out(PASS, `${sd.items.length} item(s): ${types}`, 'JSON-LD parsed successfully.');
      }
      if (sd.errors.length) return out(FAIL, `${sd.errors.length} invalid block(s)`, 'JSON-LD found but could not be parsed.', 'Fix the JSON syntax of your structured data.');
      return out(WARNING, 'No JSON-LD found', 'No structured data detected (may be optional for this page).', 'Consider adding schema.org markup relevant to the page type.');
    },
  },
  {
    id: 'twitter-card', category: 'social', title: 'Twitter / X Card', weight: 1, impact: 'low', confidence: 'medium',
    why: 'Twitter Card tags control the preview on X. Without them, platforms usually fall back to Open Graph tags.',
    run: ({ metadata: { twitter, og } }) => {
      if (!twitter.card) {
        return og.title
          ? out(WARNING, 'No twitter:card (Open Graph fallback available)', 'No Twitter Card type declared.', 'Add <meta name="twitter:card" content="summary_large_image">.')
          : out(FAIL, 'No twitter:card and no Open Graph fallback', 'No social card metadata found.', 'Add twitter:card, twitter:title, twitter:description and twitter:image.');
      }
      const missing = ['title', 'description', 'image'].filter((k) => !twitter[k] && !og[k]);
      return missing.length
        ? out(WARNING, `twitter:card=${twitter.card}; missing ${missing.join(', ')}`, 'Card declared but incomplete.', 'Provide the missing title, description and image values.')
        : out(PASS, `twitter:card=${twitter.card}`, 'Twitter Card is declared with title, description and image.');
    },
  },
  {
    id: 'https', category: 'technical', title: 'HTTPS', weight: 3, impact: 'high', confidence: 'high',
    why: 'HTTPS protects users and is a lightweight ranking signal.',
    run: ({ finalUrl }) =>
      finalUrl.startsWith('https://')
        ? out(PASS, finalUrl, 'Final URL uses HTTPS.')
        : out(FAIL, finalUrl, 'Final URL is not HTTPS.', 'Serve the site over HTTPS and redirect HTTP traffic.'),
  },
  {
    id: 'html-lang', category: 'technical', title: 'HTML language', weight: 2, impact: 'low', confidence: 'high',
    why: 'The lang attribute helps browsers, assistive tech and search engines pick the right language handling.',
    run: ({ metadata: m }) =>
      m.lang
        ? out(PASS, m.lang, 'lang attribute present.')
        : out(FAIL, 'No lang attribute on <html>', 'Language is not declared.', 'Add lang="en" (or the correct code) to the <html> element.'),
  },

  // ---- Stricter content, link, media and delivery checks ----
  {
    id: 'title-h1-alignment', category: 'onpage', title: 'Title and H1 agree', weight: 2, impact: 'medium', confidence: 'medium',
    why: 'When the title and H1 share no key words, the page topic is unclear to users and search engines.',
    run: ({ metadata: m, headings: h }) => {
      const h1 = h.h1.find(Boolean);
      if (!m.title || !h1) return out(NOT_APPLICABLE, 'Needs both a title and an H1', 'Skipped because the title or H1 is missing.');
      const words = (t) => new Set(String(t).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)?.filter((w) => !STOP.has(w)) || []);
      const a = words(m.title);
      const shared = [...words(h1)].filter((w) => a.has(w));
      return shared.length
        ? out(PASS, `Shared: ${shared.slice(0, 5).join(', ')}`, 'The title and H1 describe the same topic.')
        : out(WARNING, `Title ${quote(m.title)} · H1 ${quote(h1)}`, 'The title and H1 share no key words.', 'Make the H1 and title express the same main topic.');
    },
  },
  {
    id: 'description-quality', category: 'onpage', title: 'Description adds new information', weight: 1, impact: 'low', confidence: 'medium',
    why: 'A description that only repeats the title wastes the snippet.',
    run: ({ metadata: m }) => {
      if (!m.description || !m.title) return out(NOT_APPLICABLE, 'Needs a title and a description', 'Skipped because one of them is missing.');
      return m.description.toLowerCase() === m.title.toLowerCase()
        ? out(WARNING, quote(m.description), 'The description is identical to the title.', 'Write a description that summarises the page and gives a reason to click.')
        : out(PASS, `${m.description.length} characters`, 'The description is different from the title.');
    },
  },
  {
    id: 'url-quality', category: 'technical', title: 'Clean, readable URL', weight: 2, impact: 'low', confidence: 'medium',
    why: 'Short, lowercase, hyphenated URLs without many parameters are easier to share, crawl and understand.',
    run: ({ finalUrl }) => {
      let u;
      try {
        u = new URL(finalUrl);
      } catch {
        return out(NOT_APPLICABLE, finalUrl, 'The URL could not be parsed.');
      }
      const problems = [];
      if (u.href.length > 115) problems.push(`${u.href.length} characters long`);
      else if (u.href.length > 75) problems.push(`${u.href.length} characters (over 75)`);
      if (/[A-Z]/.test(u.pathname)) problems.push('uppercase letters in the path');
      if (u.pathname.includes('_')) problems.push('underscores instead of hyphens');
      if ([...u.searchParams.keys()].length > 3) problems.push('more than 3 query parameters');
      if (/(sessionid|phpsessid|sid)=/i.test(u.search)) problems.push('a session id in the URL');
      if (!problems.length) return out(PASS, finalUrl, 'The URL is short and clean.');
      return out(u.href.length > 115 ? FAIL : WARNING, problems.join('; '), 'The URL could be cleaner.', 'Use short, lowercase, hyphen-separated URLs and keep parameters to a minimum.');
    },
  },
  {
    id: 'mixed-content', category: 'technical', title: 'No insecure (HTTP) resources', weight: 2, impact: 'high', confidence: 'high',
    why: 'Loading images, scripts or styles over HTTP on an HTTPS page triggers browser warnings and blocked content.',
    run: ({ content, finalUrl }) => {
      if (!String(finalUrl).startsWith('https://')) return out(NOT_APPLICABLE, 'Page is not HTTPS', 'Only relevant for HTTPS pages.');
      const n = content.mixedContent || 0;
      return n
        ? out(n > 3 ? FAIL : WARNING, `${n} resource${n > 1 ? 's' : ''} loaded over http://`, 'The page loads insecure resources.', 'Change every http:// resource URL to https://.')
        : out(PASS, 'No http:// resources', 'All resources use HTTPS.');
    },
  },
  {
    id: 'charset', category: 'technical', title: 'Character encoding declared', weight: 1, impact: 'low', confidence: 'high',
    why: 'Declaring UTF-8 stops text from being misread, especially for non-English content.',
    run: ({ metadata: m, headers }) => {
      const ct = String(headers?.['content-type'] || '');
      const found = m.charset || /charset=/i.exec(ct)?.[0];
      return found ? out(PASS, m.charset || ct, 'A character encoding is declared.') : out(WARNING, 'No charset meta tag or header', 'The encoding is not declared.', 'Add <meta charset="utf-8"> as the first element in <head>.');
    },
  },
  {
    id: 'compression', category: 'technical', title: 'Response is compressed', weight: 2, impact: 'medium', confidence: 'medium',
    why: 'Gzip or Brotli compression makes pages download far faster, which helps speed and crawling.',
    run: ({ headers, bytes }) => {
      if (!headers || !Object.keys(headers).length) return out(NOT_APPLICABLE, 'Response headers unavailable', 'Skipped because headers were not available.');
      const enc = String(headers['content-encoding'] || '').toLowerCase();
      if (enc) return out(PASS, `content-encoding: ${enc}`, 'The response is compressed.');
      if ((bytes || 0) < 20_000) return out(PASS, `${Math.round((bytes || 0) / 1024)} KB, uncompressed`, 'The page is small, so compression matters little.');
      return out(WARNING, `${Math.round(bytes / 1024)} KB sent without compression`, 'The HTML is not compressed.', 'Enable gzip or Brotli on the server or CDN.');
    },
  },
  {
    id: 'image-dimensions', category: 'accessibility', title: 'Images declare width and height', weight: 2, impact: 'medium', confidence: 'medium',
    why: 'Without width and height the browser cannot reserve space, so the layout jumps while images load (Cumulative Layout Shift).',
    run: ({ images }) => {
      const real = images.items.filter((i) => !i.decorative);
      if (real.length < 3) return out(NOT_APPLICABLE, `${real.length} content image${real.length === 1 ? '' : 's'}`, 'Too few images to judge.');
      const missing = real.filter((i) => !i.width || !i.height).length;
      const ratio = missing / real.length;
      const ev = `${missing} of ${real.length} images lack width or height`;
      if (ratio <= 0.2) return out(PASS, ev, 'Images reserve their space.');
      return out(ratio > 0.6 ? FAIL : WARNING, ev, 'Many images do not declare their size.', 'Add width and height attributes (or CSS aspect-ratio) to every image.');
    },
  },
  {
    id: 'anchor-text', category: 'technical', title: 'Descriptive link text', weight: 2, impact: 'medium', confidence: 'medium',
    why: 'Links like "click here" or with no text tell search engines and screen-reader users nothing about the destination.',
    run: ({ links }) => {
      if (links.items.length < 5) return out(NOT_APPLICABLE, `${links.items.length} links`, 'Too few links to judge.');
      const bad = links.items.filter((l) => !l.text || GENERIC_ANCHOR.test(l.text.trim())).length;
      const ratio = bad / links.items.length;
      const ev = `${bad} of ${links.items.length} links have empty or generic text`;
      if (ratio <= 0.1) return out(PASS, ev, 'Link text is descriptive.');
      return out(ratio > 0.3 ? FAIL : WARNING, ev, 'Some links have empty or generic anchor text.', 'Describe the destination in the link text instead of "click here" or "read more".');
    },
  },

  // ---- Content quality ----
  {
    id: 'readability', category: 'onpage', title: 'Readable writing', weight: 4, impact: 'medium', confidence: 'medium',
    why: 'Text that is easy to read keeps visitors on the page. Flesch Reading Ease is an English-language measure: 60+ is plain English, below 30 is very hard.',
    run: ({ content }) => {
      const st = content.stats;
      if (st?.flesch == null) return out(NOT_APPLICABLE, 'Needs at least 100 words of English text', 'Readability could not be measured for this page.');
      const ev = `Reading ease ${st.flesch}/100 · ${st.avgSentenceWords} words per sentence · about ${st.readingMinutes} min read`;
      if (st.flesch >= 50) return out(PASS, ev, 'The text is easy to read.');
      return out(st.flesch < 30 ? FAIL : WARNING, ev, st.flesch < 30 ? 'The text is very hard to read.' : 'The text is fairly difficult to read.', 'Use shorter sentences and simpler words, and break up long paragraphs.');
    },
  },
  {
    id: 'keyword-stuffing', category: 'onpage', title: 'No keyword stuffing', weight: 3, impact: 'medium', confidence: 'medium',
    why: 'Repeating one word unnaturally is a spam signal. Natural writing rarely uses any single term for more than about 3% of the words.',
    run: ({ content }) => {
      const t = content.stats?.topTerm;
      if (!t) return out(NOT_APPLICABLE, 'Needs at least 150 words', 'Too little text to measure keyword density.');
      const ev = `"${t.term}" is ${t.pct}% of the words (${t.count} times)`;
      if (t.pct <= 3.5) return out(PASS, ev, 'No term is over-used.');
      return out(t.pct > 6 ? FAIL : WARNING, ev, 'One word makes up an unusually large share of the text.', 'Rewrite naturally, using synonyms and related terms instead of repeating one keyword.');
    },
  },

  // ---- Accessibility (markup checks) ----
  {
    id: 'a11y-forms', category: 'accessibility', title: 'Form fields have labels', weight: 3, impact: 'medium', confidence: 'high',
    why: 'Fields without a label are unusable with a screen reader. A placeholder is not a label.',
    run: ({ a11y }) => {
      if (!a11y || a11y.fields === 0) return out(NOT_APPLICABLE, 'No form fields', 'The page has no form fields to check.');
      const ev = `${a11y.unlabelledFields} of ${a11y.fields} fields have no label`;
      if (!a11y.unlabelledFields) return out(PASS, ev, 'Every field is labelled.');
      return out(a11y.unlabelledFields / a11y.fields > 0.5 ? FAIL : WARNING, ev, 'Some form fields have no accessible label.', 'Add a <label for="…"> (or aria-label) to every input, select and textarea.');
    },
  },
  {
    id: 'a11y-names', category: 'accessibility', title: 'Buttons and links have names', weight: 3, impact: 'medium', confidence: 'high',
    why: 'A button or link with no text, icon alt or aria-label is announced as just "button" or "link".',
    run: ({ a11y }) => {
      if (!a11y || a11y.buttons + a11y.links === 0) return out(NOT_APPLICABLE, 'No buttons or links', 'Nothing to check.');
      const bad = a11y.unnamedButtons + a11y.unnamedLinks;
      const ev = `${a11y.unnamedLinks} of ${a11y.links} links and ${a11y.unnamedButtons} of ${a11y.buttons} buttons have no name`;
      if (!bad) return out(PASS, ev, 'Every link and button has an accessible name.');
      return out(bad / (a11y.buttons + a11y.links) > 0.1 ? FAIL : WARNING, ev, 'Some links or buttons have no accessible name.', 'Give icon-only links and buttons visible text or an aria-label.');
    },
  },
  {
    id: 'a11y-landmarks', category: 'accessibility', title: 'Page landmarks', weight: 2, impact: 'low', confidence: 'high',
    why: 'A <main> region (and <nav> for navigation) lets screen-reader users jump straight to the content.',
    run: ({ a11y }) => {
      if (!a11y) return out(NOT_APPLICABLE, '', 'Not measured.');
      const ev = `main: ${a11y.hasMain ? 'yes' : 'no'} · nav: ${a11y.hasNav ? 'yes' : 'no'}`;
      if (a11y.hasMain) return out(PASS, ev, 'The page has a main landmark.');
      return out(WARNING, ev, 'No <main> landmark found.', 'Wrap the primary content in a <main> element.');
    },
  },
  {
    id: 'a11y-markup', category: 'accessibility', title: 'Valid, accessible markup', weight: 2, impact: 'low', confidence: 'high',
    why: 'Duplicate ids break label and ARIA references, and iframes without titles are announced with no context.',
    run: ({ a11y }) => {
      if (!a11y) return out(NOT_APPLICABLE, '', 'Not measured.');
      const problems = [];
      if (a11y.duplicateIds) problems.push(`${a11y.duplicateIds} duplicated id value${a11y.duplicateIds > 1 ? 's' : ''}`);
      if (a11y.iframesNoTitle) problems.push(`${a11y.iframesNoTitle} iframe${a11y.iframesNoTitle > 1 ? 's' : ''} without a title`);
      return problems.length
        ? out(WARNING, problems.join('; '), 'Markup problems affect assistive technology.', 'Make every id unique and add a title to each iframe.')
        : out(PASS, 'No duplicate ids; all iframes titled', 'No markup problems found.');
    },
  },

  // ---- Structured data validation ----
  {
    id: 'schema-validation', category: 'social', title: 'Structured data is complete', weight: 5, impact: 'medium', confidence: 'medium',
    why: 'Google needs specific properties before it will show rich results. Valid JSON that lacks them earns nothing.',
    run: ({ structuredData: sd }) => {
      if (!sd.items.length) return out(NOT_APPLICABLE, 'No JSON-LD', 'There is no structured data to validate.');
      const checked = [];
      const bad = [];
      for (const item of sd.items) {
        const types = String(item.type).split(',').map((t) => t.trim());
        const known = types.find((t) => SCHEMA_REQUIRED[t]);
        if (!known) continue;
        checked.push(known);
        const missing = SCHEMA_REQUIRED[known].filter((k) => { const v = item.data?.[k]; return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length); });
        if (missing.length) bad.push(`${known}: missing ${missing.join(', ')}`);
      }
      if (!checked.length) return out(NOT_APPLICABLE, `Types: ${[...new Set(sd.items.map((i) => i.type))].slice(0, 5).join(', ')}`, 'None of the types found have a validator here.');
      if (!bad.length) return out(PASS, `${checked.length} item(s) checked: ${[...new Set(checked)].join(', ')}`, 'All required properties are present.');
      return out(bad.length === checked.length ? FAIL : WARNING, bad.slice(0, 6).join(' · '), 'Some structured data is missing required properties.', 'Add the missing properties so the markup is eligible for rich results.');
    },
  },

  // ---- Advisory checks (weight 0: shown, but do not change the score) ----
  {
    id: 'http-status', category: 'technical', title: 'HTTP status', weight: 0, impact: 'high', confidence: 'high',
    why: 'Pages that return errors are not normally indexed.',
    run: ({ statusCode }) =>
      statusCode >= 200 && statusCode < 300
        ? out(PASS, `HTTP ${statusCode}`, 'Page responded successfully.')
        : out(FAIL, `HTTP ${statusCode}`, 'Page did not return a 2xx status.', 'Fix the server response so the page returns 200.'),
  },
  {
    id: 'title-single', category: 'onpage', title: 'Single title & description tag', weight: 0, impact: 'low', confidence: 'high',
    why: 'Duplicate tags create ambiguity about which one is used.',
    run: ({ metadata: m }) =>
      m.titleCount > 1 || m.descriptionCount > 1
        ? out(WARNING, `${m.titleCount} title, ${m.descriptionCount} description tags`, 'Duplicate tags found.', 'Keep a single title and meta description.')
        : out(PASS, `${m.titleCount} title, ${m.descriptionCount} description tag`, 'No duplicates.'),
  },
  {
    id: 'content-length', category: 'onpage', title: 'Content depth', weight: 8, impact: 'medium', confidence: 'low',
    why: 'Very thin pages may not satisfy search intent. Word count is only a rough proxy, and JS-rendered text is not counted.',
    run: ({ content }) => {
      const n = content.wordCount;
      if (n >= LIMITS.thinContentWords) return out(PASS, `${n} words`, 'Page has substantial text.');
      return out(n < 150 ? FAIL : WARNING, `${n} words`, n < 150 ? 'The page is very thin.' : 'The page has less text than the usual 300-word minimum.', 'Add helpful, original content that answers the visitor\'s question, or confirm the text is not injected by JavaScript.');
    },
  },
  {
    id: 'internal-links', category: 'technical', title: 'Internal links', weight: 3, impact: 'medium', confidence: 'medium',
    why: 'Internal links help crawlers discover pages and distribute authority.',
    run: ({ links }) => {
      const ev = `${links.internal} internal / ${links.external} external`;
      if (links.internal >= 3) return out(PASS, ev, 'Internal links found.');
      return out(links.internal === 0 ? FAIL : WARNING, ev, links.internal === 0 ? 'No internal links found.' : 'Very few internal links.', 'Link to at least a few related pages on your own site.');
    },
  },

  {
    id: 'country-targeting', category: 'technical', title: 'Country & language targeting', weight: 0, impact: 'medium', confidence: 'medium',
    why: 'Pages meant for a country should signal it with hreflang annotations and a matching page language, so search engines show the right version to local users.',
    run: ({ country, metadata: m }) => {
      if (!country) return out(NOT_APPLICABLE, 'Worldwide view', 'No country selected. Choose one to check how well the page targets it.');
      const code = country.code.toLowerCase();
      const lang = country.language;
      const tags = (m.hreflang || []).map((h) => String(h.lang || '').toLowerCase());
      const pageLang = String(m.lang || '').toLowerCase();
      const evidenceTags = tags.length ? `hreflang: ${tags.slice(0, 8).join(', ')}${tags.length > 8 ? '…' : ''}` : 'no hreflang annotations';
      if (tags.some((t) => t === `${lang}-${code}` || t.endsWith(`-${code}`))) {
        return out(PASS, evidenceTags, `The page declares a version for ${country.name}.`);
      }
      if (tags.length) {
        return tags.some((t) => t === lang || t.startsWith(`${lang}-`) || t === 'x-default')
          ? out(PASS, evidenceTags, `No ${country.name}-specific version, but a ${lang.toUpperCase()}-language or default alternate is declared.`)
          : out(WARNING, evidenceTags, `The page lists alternates but none for ${country.name} or its main language (${lang}).`,
              `Add an hreflang="${country.locale}" (or "${lang}") alternate for this page, plus x-default.`);
      }
      return pageLang.startsWith(lang)
        ? out(PASS, `html lang="${m.lang}"`, `The page language matches ${country.name}'s main language (${lang}). Hreflang isn't needed for a single-language site.`)
        : out(WARNING, `html lang="${m.lang || 'missing'}" · ${evidenceTags}`, `The page is not in ${country.name}'s main language (${lang}) and has no regional alternate.`,
            `Provide a ${lang.toUpperCase()} version and link it with hreflang, or confirm this page is intentionally not localised for ${country.name}.`);
    },
  },

  // ---- JavaScript rendering (scored when a live render was available; otherwise not evaluated) ----
  {
    id: 'js-metadata', category: 'technical', title: 'Metadata present without JavaScript', weight: 6, impact: 'high', confidence: 'high',
    why: 'Social scrapers and some crawlers do not run JavaScript. Titles, descriptions and canonicals injected client-side may not be seen by them.',
    run: ({ render }) => {
      const d = render?.diff;
      if (!d) return noRender(render);
      const meta = d.items.filter((i) => ['title', 'description', 'canonical', 'og-title', 'og-image'].includes(i.field) && i.result !== 'same');
      const added = meta.filter((i) => i.result === 'added' || i.result === 'changed');
      if (!added.length) return out(PASS, 'Title, description, canonical and Open Graph are identical in raw and rendered HTML.', 'Key metadata does not depend on JavaScript.');
      return out(
        WARNING,
        added.map((i) => `${i.label}: ${i.result === 'added' ? 'only after JavaScript' : 'differs after JavaScript'}`).join(' · '),
        'Some metadata is only present (or different) after JavaScript runs.',
        'Render critical metadata on the server (SSR/SSG) so every crawler and share preview sees it.',
      );
    },
  },
  {
    id: 'js-conflict', category: 'technical', title: 'Canonical & robots consistent after rendering', weight: 5, impact: 'high', confidence: 'high',
    why: 'If JavaScript changes the canonical or robots directives, crawlers can receive conflicting signals about indexing.',
    run: ({ render }) => {
      const d = render?.diff;
      if (!d) return noRender(render);
      const bad = d.items.filter((i) => ['canonical', 'robots'].includes(i.field) && i.raw && i.raw !== i.rendered);
      return bad.length
        ? out(FAIL, bad.map((i) => `${i.label}: "${i.raw}" → "${i.rendered || '(removed)'}"`).join(' · '), 'JavaScript changes indexing signals declared in the raw HTML.', 'Make the raw and rendered canonical and robots values identical.')
        : out(PASS, 'No conflicting canonical or robots directives.', 'Indexing signals are consistent.');
    },
  },
  {
    id: 'js-content', category: 'onpage', title: 'Content available without JavaScript', weight: 5, impact: 'high', confidence: 'medium',
    why: 'Google can render JavaScript, but rendering is queued and not every crawler does it. Content in the raw HTML is indexed fastest and most reliably.',
    run: ({ render }) => {
      const d = render?.diff;
      if (!d) return noRender(render);
      const evidence = `${d.dependence}% of visible words appear only after JavaScript runs (raw ${d.wordsRaw.toLocaleString()} → rendered ${d.wordsRendered.toLocaleString()}).`;
      if (d.level === 'low') return out(PASS, evidence, 'Most content is present in the server HTML.');
      return out(
        WARNING,
        evidence,
        d.level === 'high' ? 'The page depends heavily on client-side rendering.' : 'Some content depends on client-side rendering.',
        'Server-render or pre-render the main content (SSR/SSG) so it is in the initial HTML.',
      );
    },
  },
  {
    id: 'js-links', category: 'technical', title: 'Internal links available without JavaScript', weight: 2, impact: 'medium', confidence: 'medium',
    why: 'Crawlers discover pages by following links in the HTML. Links created only by JavaScript can be missed or found late.',
    run: ({ render }) => {
      const d = render?.diff;
      if (!d) return noRender(render);
      const { internalLinksRaw: a, internalLinksRendered: b } = d;
      const evidence = `${a} internal link(s) in raw HTML → ${b} after rendering`;
      if (b > 0 && a < b * 0.5) {
        return out(WARNING, evidence, 'Many internal links only exist after JavaScript runs.', 'Use real <a href> links in the server-rendered HTML for navigation.');
      }
      return out(PASS, evidence, 'Internal links are present in the server HTML.');
    },
  },
  {
    id: 'render-health', category: 'technical', title: 'Render health', weight: 2, impact: 'medium', confidence: 'medium',
    why: 'Script errors and failed requests during rendering can leave content missing for users and crawlers.',
    run: ({ render }) => {
      if (!render?.used) return noRender(render);
      const c = render.health.consoleErrors.length;
      const f = render.health.failedRequests.length + render.health.httpErrors.length;
      const evidence = `${c} console error(s), ${f} failed request(s), rendered in ${(render.ms / 1000).toFixed(1)} s`;
      return c || f
        ? out(WARNING, evidence, 'Errors or failed requests occurred while rendering.', 'Open the details on this page and fix broken scripts or missing resources.')
        : out(PASS, evidence, 'The page rendered without errors.');
    },
  },
];
