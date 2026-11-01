/**
 * Keyword profile of a page, computed from its (rendered) text: what the page is actually about,
 * where each term appears, and how often. Real data from the page itself.
 * Search volumes and rankings are NOT included: they need paid data or the owner's Search Console.
 */

const STOP = new Set(`a about above after again against all also am an and any are aren't as at be because been before being below
between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further
get got had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd
i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other
ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their
theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very
was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with
won't would wouldn't you you'd you'll you're you've your yours yourself yourselves will just now new one two use used using may
can make made many much like need want know see says say per via etc yes click read more home menu login sign search contact
privacy policy terms cookies cookie accept skip content navigation us every each across around always never really also even still just ever many most both either neither something nothing anyone count counts matters matter let lets get gets got give gives take takes come comes go goes`.split(/\s+/));

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

export function tokenize(text = '') {
  return (String(text).toLowerCase().match(WORD) || []).map((w) => w.replace(/^['’-]+|['’-]+$/g, '')).filter(Boolean);
}

const isStop = (w) => STOP.has(w);
const isNoise = (w) => w.length < 3 || /^\d+$/.test(w) || isStop(w);

function has(haystack, term) {
  return (` ${haystack.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `).includes(` ${term} `);
}

/** Candidate terms (1–3 words) with counts. */
function countTerms(words) {
  const uni = new Map();
  const phr = new Map();
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (!isNoise(w)) uni.set(w, (uni.get(w) || 0) + 1);
    for (let n = 2; n <= 3 && i + n <= words.length; n += 1) {
      const first = words[i];
      const last = words[i + n - 1];
      if (isNoise(first) || isNoise(last) || isStop(first) || isStop(last)) continue;
      const slice = words.slice(i, i + n);
      if (slice.some((x) => /^\d+$/.test(x))) continue;
      if (new Set(slice).size < slice.length) continue; // "widget widget" is repetition, not a phrase
      const t = slice.join(' ');
      phr.set(t, (phr.get(t) || 0) + 1);
    }
  }
  return { uni, phr };
}

export function analyzeKeywords({ text = '', title = '', description = '', h1 = [], h2 = [], h3 = [], url = '', alts = [], limit = 20 } = {}) {
  const words = tokenize(text);
  const totalWords = words.length;
  const { uni, phr } = countTerms(words);

  let path = '';
  try {
    path = decodeURIComponent(new URL(url).pathname).replace(/[-_/.]+/g, ' ');
  } catch {
    path = '';
  }
  const placements = {
    title,
    h1: h1.join(' '),
    description,
    url: path,
    headings: [...h2, ...h3].join(' '),
    alt: alts.join(' '),
  };
  const early = words.slice(0, 100).join(' ');

  const describe = (term, count) => {
    const where = {
      inTitle: has(placements.title, term),
      inH1: has(placements.h1, term),
      inDescription: has(placements.description, term),
      inUrl: has(placements.url, term),
      inHeadings: has(placements.headings, term),
      inAlt: has(placements.alt, term),
      inFirst100: has(early, term),
    };
    const spots = ['inTitle', 'inH1', 'inDescription', 'inUrl'].filter((k) => where[k]).length;
    const wordsInTerm = term.split(' ').length;
    return {
      term,
      words: wordsInTerm,
      count,
      density: totalWords ? Math.round(((count * wordsInTerm) / totalWords) * 1000) / 10 : 0,
      ...where,
      // frequency lifted by prominent placement
      score: count * (1 + 0.6 * where.inTitle + 0.5 * where.inH1 + 0.3 * where.inUrl + 0.3 * where.inDescription + 0.2 * where.inFirst100) * (wordsInTerm > 1 ? 1.4 : 1),
    };
  };

  // Drop a phrase when a longer phrase that contains it occurs nearly as often ("trail running" inside
  // "trail running shoes"): the longer one is the real term.
  const entries = [...phr.entries()].filter(([, c]) => c >= 2);
  const kept = entries.filter(([t, c]) => !entries.some(([q, qc]) => q !== t && q.length > t.length && ` ${q} `.includes(` ${t} `) && qc >= c * 0.8));

  const keywords = [...uni.entries()].filter(([, c]) => c >= 2).map(([t, c]) => describe(t, c)).sort((a, b) => b.score - a.score).slice(0, limit);
  const phrases = kept.map(([t, c]) => describe(t, c)).sort((a, b) => b.score - a.score).slice(0, 12);

  // Primary keyword: strongest candidate overall; a phrase wins ties because it is more specific.
  const pool = [...phrases, ...keywords].sort((a, b) => b.score - a.score);
  const primary = pool[0] || null;

  const checks = primary
    ? [
        ['In the title', primary.inTitle],
        ['In the H1', primary.inH1],
        ['In the meta description', primary.inDescription],
        ['In the URL', primary.inUrl],
        ['In the first 100 words', primary.inFirst100],
        ['In a subheading (H2/H3)', primary.inHeadings],
        ['In image alt text', primary.inAlt],
      ].map(([label, ok]) => ({ label, ok }))
    : [];

  const stuffed = keywords.filter((k) => k.density > 3).map((k) => k.term);
  return { totalWords, uniqueTerms: uni.size, keywords, phrases, primary, checks, stuffed };
}

/** Seeds for autocomplete ideas: the primary keyword plus the next strongest distinct terms. */
export function ideaSeeds(profile, max = 3) {
  const out = [];
  const add = (t) => {
    if (t && !out.some((o) => o === t || o.includes(t) || t.includes(o))) out.push(t);
  };
  add(profile.primary?.term);
  for (const p of profile.phrases) add(p.term);
  for (const k of profile.keywords) add(k.term);
  return out.slice(0, max);
}

// Marketing filler that is never what a business actually sells.
const FILLER = new Set(`moment today best quality great easy welcome shop buy store online home page official site website free new special offer offers sale
service services product products company business solutions team people world life time day way need want help find get make more top trusted
leading premium professional affordable amazing perfect favourite favorite everything everyone anything customers customer experience
australia australian american british indian canadian`.split(/\s+/));

const CAP = (w) => w.charAt(0).toUpperCase() + w.slice(1);

/**
 * The "platform" a page belongs to: its brand name and its core topic. Used to keep keyword ideas
 * about this site rather than about whatever words happen to repeat in its text.
 */
export function platformDefaults({ url = '', title = '', h1 = [], ogSiteName = '', keywords = null } = {}) {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* leave empty */
  }
  // The registrable name (mozilla in developer.mozilla.org, bbc in news.bbc.co.uk), not a subdomain.
  const labels = host.split('.');
  const SECOND = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu', 'or', 'ne']);
  const label = (labels.length >= 3 && labels.at(-1).length === 2 && SECOND.has(labels.at(-2)) ? labels.at(-3) : labels.at(-2)) || labels[0] || '';
  const parts = String(title).split(/\s[|\-–—·:]\s/).map((x) => x.trim()).filter(Boolean);
  const squash = (x) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const short = (p) => p.split(/\s+/).length <= 4;
  // Titles usually read "Page | Brand": prefer a segment that contains the domain name, else the short last segment.
  const fromTitle =
    parts.find((p) => label && squash(p).includes(squash(label)) && short(p)) ||
    (parts.length >= 2 && short(parts.at(-1)) ? parts.at(-1) : '');
  const brand = (ogSiteName || fromTitle || (label ? CAP(label) : '')).slice(0, 60);

  // Topic: the strongest term that is placed in the title or H1 and is not just the brand itself.
  const brandTokens = new Set(tokenize(brand));
  const notBrand = (t) => tokenize(t.term).some((w) => !brandTokens.has(w));
  const meaningful = (k) => tokenize(k.term).some((w) => !FILLER.has(w)) && !(k.words === 1 && FILLER.has(k.term));
  const pool = [...(keywords?.phrases || []), ...(keywords?.keywords || [])].filter((k) => (k.inTitle || k.inH1) && k.count >= 3 && notBrand(k) && meaningful(k));
  let topic = pool.sort((a, b) => b.score - a.score)[0]?.term || '';
  if (!topic && keywords?.primary && notBrand(keywords.primary) && meaningful(keywords.primary)) topic = keywords.primary.term;
  if (!topic) {
    const heading = (h1[0] || parts.find((p) => p !== fromTitle) || '').trim();
    topic = tokenize(heading).filter((w) => !isNoise(w) && !brandTokens.has(w) && !FILLER.has(w)).slice(0, 3).join(' ');
  }
  const topicText = topic.split(' ').slice(0, 3).join(' ');
  // Words that characterise this site's business: used to rule out other meanings of the topic.
  const own = new Set([...tokenize(topicText), ...brandTokens]);
  const context = [...new Set([...(keywords?.phrases || []).slice(0, 6).flatMap((p) => tokenize(p.term)), ...(keywords?.keywords || []).slice(0, 14).map((k) => k.term)])]
    .filter((w) => !own.has(w) && !isNoise(w))
    .slice(0, 16);
  return { brand, topic: topicText, domain: host, context, phrases: (keywords?.phrases || []).slice(0, 4).map((p) => p.term) };
}
