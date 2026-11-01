import * as cheerio from 'cheerio';

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

function absolute(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function metaContent($, selector) {
  const els = $(selector);
  return { value: clean(els.first().attr('content')), count: els.length };
}

const syllables = (word) => {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const n = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, n ? n.length : 1);
};
const STOP_WORDS = new Set('the a an and or but of to in on for with at by from as is are was were be been it its this that these those you your we our they their not no can will'.split(' '));

/** Readability (Flesch reading ease, English) and keyword density from the visible text. */
function textStats(text, lang) {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.split(' ').length >= 3);
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
  const english = !lang || /^en/i.test(lang);
  let flesch = null;
  if (english && words.length >= 100 && sentences.length >= 3) {
    const syl = words.reduce((a, w) => a + syllables(w), 0);
    flesch = Math.round(206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syl / words.length));
    flesch = Math.max(0, Math.min(100, flesch));
  }
  const counts = new Map();
  for (const w of words.map((x) => x.toLowerCase())) if (w.length > 3 && !STOP_WORDS.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    sentences: sentences.length,
    avgSentenceWords: sentences.length ? Math.round((words.length / sentences.length) * 10) / 10 : 0,
    flesch,
    readingMinutes: Math.max(1, Math.round(words.length / 220)),
    topTerm: top && words.length >= 150 ? { term: top[0], count: top[1], pct: Math.round((top[1] / words.length) * 1000) / 10 } : null,
  };
}

/** Accessibility signals that can be judged from the markup alone. */
function a11ySignals($) {
  const named = (el) => {
    const $e = $(el);
    return !!(clean($e.text()) || $e.attr('aria-label') || $e.attr('aria-labelledby') || $e.attr('title') || clean($e.find('img[alt]').first().attr('alt')) || clean($e.find('svg title').first().text()));
  };
  const fields = $('input, select, textarea').filter((_, el) => !['hidden', 'submit', 'button', 'image', 'reset'].includes(($(el).attr('type') || '').toLowerCase()));
  const unlabelled = fields.filter((_, el) => {
    const $e = $(el);
    if ($e.attr('aria-label') || $e.attr('aria-labelledby') || $e.attr('title')) return false;
    const id = $e.attr('id');
    if (id && $(`label[for="${id.replace(/"/g, '')}"]`).length) return false;
    return !$e.closest('label').length;
  }).length;
  const buttons = $('button, [role="button"], input[type="submit"], input[type="button"]');
  const unnamedButtons = buttons.filter((_, el) => (el.tagName === 'input' ? !$(el).attr('value') && !named(el) : !named(el))).length;
  const links = $('a[href]');
  const unnamedLinks = links.filter((_, el) => !named(el)).length;
  const ids = {};
  $('[id]').each((_, el) => { const id = $(el).attr('id'); if (id) ids[id] = (ids[id] || 0) + 1; });
  return {
    fields: fields.length, unlabelledFields: unlabelled,
    buttons: buttons.length, unnamedButtons, links: links.length, unnamedLinks,
    hasMain: $('main, [role="main"]').length > 0, hasNav: $('nav, [role="navigation"]').length > 0,
    duplicateIds: Object.values(ids).filter((n) => n > 1).length,
    iframesNoTitle: $('iframe').filter((_, el) => !$(el).attr('title') && !$(el).attr('aria-label')).length,
    iframes: $('iframe').length,
  };
}

/** Pull every SEO signal we score on out of an HTML string. */
export function extractSeoSignals(html, pageUrl) {
  const $ = cheerio.load(html);
  const pageHost = new URL(pageUrl).hostname.replace(/^www\./, '');

  // Prefer the document <title>; never an SVG <title> inside the body.
  const headTitle = $('head > title');
  const titleEls = headTitle.length ? headTitle : $('html > title');
  const description = metaContent($, 'meta[name="description" i]');
  const robots = metaContent($, 'meta[name="robots" i]');
  const googlebot = metaContent($, 'meta[name="googlebot" i]');
  const canonicalEls = $('link[rel~="canonical" i]');
  const viewport = metaContent($, 'meta[name="viewport" i]');

  const og = {};
  $('meta[property^="og:" i]').each((_, el) => {
    const key = ($(el).attr('property') || '').toLowerCase().slice(3);
    if (key && !(key in og)) {
      const value = clean($(el).attr('content'));
      og[key] = ['image', 'url'].includes(key) && value ? absolute(value, pageUrl) || value : value;
    }
  });
  const twitter = {};
  $('meta[name^="twitter:" i]').each((_, el) => {
    const key = ($(el).attr('name') || '').toLowerCase().slice(8);
    if (key && !(key in twitter)) {
      const value = clean($(el).attr('content'));
      twitter[key] = key === 'image' && value ? absolute(value, pageUrl) || value : value;
    }
  });

  const headings = { h1: [], h2: [], h3: [] };
  for (const level of ['h1', 'h2', 'h3']) {
    $(level).each((_, el) => headings[level].push(clean($(el).text())));
  }

  const images = $('img')
    .map((_, el) => {
      const $el = $(el);
      const alt = $el.attr('alt');
      const src = $el.attr('src') || $el.attr('data-src') || '';
      const role = ($el.attr('role') || '').toLowerCase();
      const tinyDim = (v) => v !== undefined && Number(v) <= 1;
      // Presentational or 1x1 tracking images do not need descriptive alt text.
      const decorative =
        role === 'presentation' || role === 'none' || $el.attr('aria-hidden') === 'true' ||
        (tinyDim($el.attr('width')) && tinyDim($el.attr('height')));
      return {
        src: src ? absolute(src, pageUrl) || src : '',
        alt: alt === undefined ? null : clean(alt),
        hasAlt: alt !== undefined,
        decorative,
        emptyAlt: alt !== undefined && clean(alt) === '',
        width: $el.attr('width') || null,
        height: $el.attr('height') || null,
        lazy: $el.attr('loading') === 'lazy',
      };
    })
    .get();

  const linkItems = [];
  $('a[href]').each((_, el) => {
    const raw = ($(el).attr('href') || '').trim();
    if (!raw || raw.startsWith('#') || /^(javascript|mailto|tel|sms|data):/i.test(raw)) return;
    const href = absolute(raw, pageUrl);
    if (!href || !/^https?:/.test(href)) return;
    const host = new URL(href).hostname.replace(/^www\./, '');
    const rel = ($(el).attr('rel') || '').toLowerCase();
    linkItems.push({
      href,
      text: clean($(el).text()) || clean($(el).find('img').attr('alt')) || '',
      internal: host === pageHost,
      nofollow: /\bnofollow\b/.test(rel),
    });
  });

  const structured = { items: [], errors: [] };
  $('script[type="application/ld+json" i]').each((i, el) => {
    const text = $(el).contents().text().trim();
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      const nodes = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
      for (const node of nodes) {
        const type = node?.['@type'];
        structured.items.push({
          type: Array.isArray(type) ? type.join(', ') : type || 'Unknown',
          data: node,
        });
      }
    } catch (err) {
      structured.errors.push({ index: i, message: err.message, snippet: text.slice(0, 120) });
    }
  });

  const $body = cheerio.load(html);
  $body('script, style, noscript, template, svg').remove();
  // Block-level elements must not glue neighbouring words together in the extracted text.
  $body('p, div, section, article, header, footer, nav, main, aside, blockquote, li, ul, ol, tr, td, th, h1, h2, h3, h4, h5, h6, br, dt, dd, figure, figcaption, form, label, button, a').after(' ');
  const bodyText = clean($body('body').text());
  const wordCount = bodyText ? bodyText.split(' ').length : 0;

  // http:// subresources on an https page ("mixed content").
  const mixedContent = pageUrl.startsWith('https:')
    ? $('img[src], script[src], iframe[src], source[src], video[src], audio[src], link[rel~="stylesheet" i][href]').filter((_, el) => /^http:\/\//i.test($(el).attr('src') || $(el).attr('href') || '')).length
    : 0;

  const hreflang = $('link[rel="alternate" i][hreflang]')
    .map((_, el) => ({ lang: $(el).attr('hreflang'), href: absolute($(el).attr('href') || '', pageUrl) }))
    .get();

  const canonicalHref = $(canonicalEls.first()).attr('href');

  return {
    metadata: {
      title: clean(titleEls.first().text()),
      titleCount: titleEls.length,
      description: description.value,
      descriptionCount: description.count,
      canonical: canonicalHref ? absolute(canonicalHref, pageUrl) : '',
      canonicalCount: canonicalEls.length,
      robots: robots.value,
      googlebot: googlebot.value,
      lang: clean($('html').attr('lang')),
      viewport: viewport.value,
      charset: clean($('meta[charset]').attr('charset')),
      favicon: absolute($('link[rel~="icon" i]').first().attr('href') || '/favicon.ico', pageUrl),
      og,
      twitter,
      hreflang,
    },
    headings,
    images: {
      total: images.length,
      missingAlt: images.filter((i) => !i.hasAlt && !i.decorative).length,
      emptyAlt: images.filter((i) => i.emptyAlt).length,
      items: images.slice(0, 200),
    },
    links: {
      total: linkItems.length,
      internal: linkItems.filter((l) => l.internal).length,
      external: linkItems.filter((l) => !l.internal).length,
      nofollow: linkItems.filter((l) => l.nofollow).length,
      items: linkItems.slice(0, 300),
    },
    structuredData: structured,
    a11y: a11ySignals($),
    content: {
      text: bodyText.slice(0, 60000),
      wordCount,
      scriptCount: $('script[src]').length,
      mixedContent,
      stats: textStats(bodyText, clean($('html').attr('lang'))),
      appRoot: $('#root, #__next, #app, #___gatsby, [data-reactroot], app-root').length > 0,
    },
  };
}
