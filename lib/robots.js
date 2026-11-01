/** Minimal robots.txt parser: rules for our user-agent (falling back to *) plus Sitemap lines. */
export function parseRobots(text = '') {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let lastWasAgent = false;

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (field === 'sitemap') sitemaps.push(value);
    else if ((field === 'disallow' || field === 'allow') && current) current.rules.push({ allow: field === 'allow', path: value });
  }

  const pick = (agent) => groups.find((g) => g.agents.some((a) => a !== '*' && agent.toLowerCase().includes(a))) || groups.find((g) => g.agents.includes('*')) || null;

  /** Longest matching rule wins; allow wins ties. Supports * and $ wildcards. */
  const isAllowed = (path, agent = 'SEOAuditAnalyzerBot') => {
    const group = pick(agent);
    if (!group) return true;
    let best = null;
    for (const r of group.rules) {
      if (!r.path) continue; // empty Disallow = allow all
      const re = new RegExp(`^${r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')}`);
      if (re.test(path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
    }
    return !best || best.allow;
  };

  const blocksAll = (agent = 'SEOAuditAnalyzerBot') => {
    const group = pick(agent);
    return !!group && group.rules.some((r) => !r.allow && r.path === '/') && !group.rules.some((r) => r.allow && r.path === '/');
  };

  return { sitemaps, isAllowed, blocksAll, hasRules: groups.length > 0 };
}

/** Extract <loc> URLs from a sitemap or sitemap index. */
export function parseSitemap(xml = '') {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const locs = [...String(xml).matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
  return { isIndex, urls: locs };
}
