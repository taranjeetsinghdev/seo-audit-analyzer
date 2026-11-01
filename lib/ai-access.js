import { parseRobots } from './robots.js';
import { fetchText } from './html-fetcher.js';
import { normalizeUserUrl } from './url-validation.js';

/**
 * "AI & crawler access" audit, all live and free: which AI/search crawlers robots.txt lets in,
 * whether /llms.txt exists.
 */
export const BOTS = [
  ['GPTBot', 'OpenAI', 'Trains ChatGPT models'],
  ['OAI-SearchBot', 'OpenAI', 'ChatGPT search results'],
  ['ChatGPT-User', 'OpenAI', 'Fetches pages when a user asks'],
  ['ClaudeBot', 'Anthropic', 'Trains Claude models'],
  ['Claude-SearchBot', 'Anthropic', 'Claude search results'],
  ['PerplexityBot', 'Perplexity', 'Perplexity answers'],
  ['Google-Extended', 'Google', 'Gemini training opt-out token'],
  ['Applebot-Extended', 'Apple', 'Apple AI training opt-out token'],
  ['CCBot', 'Common Crawl', 'Open dataset used by many AI labs'],
  ['Googlebot', 'Google', 'Google Search'],
  ['Bingbot', 'Microsoft', 'Bing Search'],
];

/** Pure: verdict for each bot from robots.txt text (null text = no file). */
export function botAccess(text) {
  if (text == null) return BOTS.map(([name, owner, purpose]) => ({ name, owner, purpose, status: 'allowed', note: 'No robots.txt, so everything is allowed.' }));
  const robots = parseRobots(text);
  return BOTS.map(([name, owner, purpose]) => {
    const specific = robots.hasRules && new RegExp(`user-agent:\\s*${name}\\b`, 'i').test(text);
    if (robots.blocksAll(name)) return { name, owner, purpose, status: 'blocked', note: specific ? 'Blocked by its own rule (Disallow: /).' : 'Blocked by the wildcard (*) rule.' };
    if (!robots.isAllowed('/', name)) return { name, owner, purpose, status: 'blocked', note: 'The homepage is disallowed.' };
    return { name, owner, purpose, status: 'allowed', note: specific ? 'Has its own rule that permits the site.' : 'No rule blocks it.' };
  });
}

export function inspectLlms(text) {
  const t = String(text || '');
  const links = (t.match(/\]\(https?:\/\/[^)]+\)/g) || []).length;
  const h1 = /^#\s+\S/m.test(t);
  return { h1, links, bytes: t.length, wellFormed: h1 && links > 0 };
}

async function getText(origin, p) {
  try {
    const r = await fetchText(new URL(p, origin));
    return r.statusCode === 200 ? r.html : null;
  } catch {
    return null;
  }
}

export async function auditAiAccess(input) {
  const url = normalizeUserUrl(input);
  const origin = url.origin;
  const [robotsTxt, llms, llmsFull] = await Promise.all([getText(origin, '/robots.txt'), getText(origin, '/llms.txt'), getText(origin, '/llms-full.txt')]);
  const bots = botAccess(robotsTxt);
  return {
    host: url.hostname, checkedAt: new Date().toISOString(), hasRobots: robotsTxt != null, bots,
    llms: { present: llms != null, ...(llms != null ? inspectLlms(llms) : {}), full: llmsFull != null },
  };
}
