import { MODULES, moduleChecks, moduleStatus } from './modules.js';
import { performanceRows } from './performance.js';

const LINK_LABEL = { ok: 'OK', redirect: 'Redirect', broken: 'Broken', blocked: 'Restricted', timeout: 'Timeout', error: 'Error', skipped: 'Skipped' };

/**
 * Report exporters. All pure functions of the report object, so the same code
 * runs in the browser (downloads) and on the server (PDF generation).
 */

export const EXPORT_SCHEMA = { name: 'seo-audit-analyzer.report', version: '1.0' };

const CREDIT = { pass: 1, warning: 0.5, fail: 0 };
const LABEL = { pass: 'Pass', warning: 'Warning', fail: 'Fail', not_applicable: 'N/A', not_evaluated: 'Not evaluated', error: 'Error' };

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const round1 = (n) => Math.round(n * 10) / 10;
const earnedOf = (c) => (c.weight && c.status in CREDIT ? round1(c.weight * CREDIT[c.status]) : 0);
const possibleOf = (c) => (c.weight && c.status in CREDIT ? c.weight : 0);

function hostOf(report) {
  try {
    return new URL(report.url).hostname.replace(/[^a-z0-9.-]+/gi, '-');
  } catch {
    return 'report';
  }
}

/** seo-report-example.com-2026-10-14 */
export function filenameBase(report) {
  const day = String(report.generatedAt || new Date().toISOString()).slice(0, 10);
  return `seo-report-${hostOf(report)}-${day}`;
}

// ---------- JSON ----------
export function toJson(report) {
  return JSON.stringify(
    { schema: EXPORT_SCHEMA.name, schemaVersion: EXPORT_SCHEMA.version, exportedAt: new Date().toISOString(), report },
    null,
    2,
  );
}

// ---------- CSV (RFC 4180, CRLF, UTF-8 BOM so Excel reads accents correctly) ----------
const BOM = '﻿';
const csvCell = (v) => {
  let s = String(v ?? '');
  // Neutralise spreadsheet formula injection from page-controlled text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows) => BOM + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

/** One row per check, grouped by module. */
export function toCsv(report) {
  const rows = [[
    'module', 'section', 'check', 'status', 'points_earned', 'points_possible', 'impact', 'confidence', 'evidence', 'why_it_matters', 'recommendation',
  ]];
  for (const mod of MODULES) {
    for (const c of moduleChecks(mod, report.checks)) {
      rows.push([mod.label, mod.section, c.title, LABEL[c.status] || c.status, earnedOf(c), possibleOf(c), c.impact, c.confidence, c.evidence, c.why, c.recommendation || '']);
    }
  }
  for (const perf of report.performance || []) {
    for (const [kind, metric, value, rating] of performanceRows(perf)) {
      rows.push(['Performance', 'Performance', `${metric} (${kind}, ${perf.strategy})`, rating || '', '', '', '', '', value, '', '']);
    }
  }
  return csv(rows);
}

/** Prioritised fixes, highest priority first. */
export function toIssuesCsv(report) {
  const rows = [['priority', 'severity', 'title', 'category', 'impact', 'confidence', 'finding', 'evidence', 'recommendation']];
  (report.issues || []).forEach((i, n) =>
    rows.push([n + 1, i.severity, i.title, i.category, i.impact, i.confidence, i.message, i.evidence, i.recommendation || '']),
  );
  return csv(rows);
}

/** Overall and per-section scores. */
export function toScoresCsv(report) {
  const rows = [['scope', 'name', 'score_out_of_100', 'points_earned', 'points_possible']];
  rows.push(['overall', report.url, report.score ?? '', round1(report.scoring.pointsEarned), report.scoring.pointsPossible]);
  for (const s of report.sections || []) rows.push(['section', s.name, s.score ?? '', round1(s.earned), s.possible]);
  for (const p of report.performance || []) {
    if (p.lab.score !== null) rows.push(['performance', `${p.strategy} (Lighthouse lab)`, p.lab.score, '', '']);
  }
  return csv(rows);
}

/** Every crawled page with the data used for site-wide findings. */
export function toCrawlCsv(report) {
  const rows = [['url', 'status', 'result', 'depth', 'inlinks', 'in_sitemap', 'words', 'title']];
  for (const p of report.siteCrawl?.pages || []) rows.push([p.url, p.status ?? '', p.verdict, p.depth ?? '', p.inlinks ?? '', p.inSitemap ? 'yes' : 'no', p.words ?? '', p.title || '']);
  return csv(rows);
}

/** Every checked link and image with its live status. */
export function toLinksCsv(report) {
  const rows = [['url', 'type', 'status_code', 'result', 'reason', 'final_url', 'redirects', 'response_ms', 'anchor_text']];
  for (const r of report.linkCheck?.results || []) {
    rows.push([r.href, r.kind === 'image' ? 'image' : r.internal ? 'internal' : 'external', r.status ?? '', LINK_LABEL[r.verdict] || r.verdict, r.reason, r.finalUrl, r.redirects?.length || 0, r.ms, r.text]);
  }
  return csv(rows);
}

// ---------- Markdown ----------
export function toMarkdown(report) {
  const L = [];
  const date = new Date(report.generatedAt).toUTCString();
  L.push(`# SEO audit report`, '', `**${report.url}**`, '');
  L.push('| | |', '|---|---|');
  L.push(`| Overall score | **${report.score ?? 'n/a'} / 100** (grade ${report.grade} — ${report.gradeLabel}) |`);
  if (report.includesPerformance) L.push(`| HTML audit alone | ${report.htmlScore} / 100 |`);
  L.push(`| Checks evaluated | ${report.coverage.evaluated} of ${report.coverage.total} |`);
  L.push(`| HTTP status | ${report.statusCode} |`);
  if (report.country) L.push(`| Viewpoint | ${report.country.name} (${report.country.locale}) |`);
  L.push(`| Generated | ${date} |`);
  L.push(`| Rubric | ${report.rubricVersion} |`, '');
  (report.notices || []).forEach((n) => L.push(`> **Note:** ${n.message}`, ''));

  if (report.sections?.length) {
    L.push('## Score by section', '', '| Section | Score | Points |', '|---|---|---|');
    report.sections.forEach((x) => L.push(`| ${x.name} | ${x.score ?? 'n/a'} | ${round1(x.earned)}/${x.possible} |`));
    L.push('');
  }

  L.push('## Priority recommendations', '');
  if (!report.issues.length) L.push('No failed or warning findings.', '');
  report.issues.forEach((i, n) => {
    L.push(`${n + 1}. **${i.title}** — ${i.severity} · impact ${i.impact} · confidence ${i.confidence}`);
    L.push(`   - ${i.message}`);
    if (i.evidence) L.push(`   - Evidence: \`${String(i.evidence).replace(/`/g, "'")}\``);
    if (i.recommendation) L.push(`   - Fix: ${i.recommendation}`);
  });
  L.push('');

  for (const p of report.performance || []) {
    L.push(`## Performance & Core Web Vitals — ${p.strategy}`, '', `_${p.source} · ${p.fetchedAt}_`, '');
    if (p.lab.score !== null) L.push(`Lab performance score: **${p.lab.score} / 100**`, '');
    L.push('| Type | Metric | Value | Rating |', '|---|---|---|---|');
    performanceRows(p).forEach((r) => L.push(`| ${r.join(' | ')} |`));
    L.push('');
    p.opportunities.forEach((o) => L.push(`- **${o.title}** — about ${(o.savingsMs / 1000).toFixed(1)} s potential saving`));
    if (p.opportunities.length) L.push('');
  }

  for (const mod of MODULES) {
    L.push(`## ${mod.label}`, '', `_${mod.summary}_`, '');
    L.push('| Check | Status | Points | Evidence |', '|---|---|---|---|');
    for (const c of moduleChecks(mod, report.checks)) {
      L.push(`| ${c.title} | ${LABEL[c.status] || c.status} | ${c.weight ? `${earnedOf(c)}/${possibleOf(c)}` : 'advisory'} | ${String(c.evidence || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
    }
    L.push('');
  }

  if (report.linkCheck?.results?.length) {
    const sm = report.linkCheck.summary || {};
    L.push('## Broken link check', '', `Checked ${sm.total} links and images: **${sm.broken || 0} broken**, ${sm.redirect || 0} redirects, ${sm.blocked || 0} restricted, ${sm.ok || 0} working.`, '');
    const bad = report.linkCheck.results.filter((r) => ['broken', 'timeout', 'error', 'redirect'].includes(r.verdict)).slice(0, 80);
    if (bad.length) {
      L.push('| Result | URL | Detail |', '|---|---|---|');
      bad.forEach((r) => L.push(`| ${LINK_LABEL[r.verdict]}${r.status ? ` (${r.status})` : ''} | ${r.href} | ${String(r.reason).replace(/\|/g, '\\|')}${r.redirects?.length ? ` → ${r.finalUrl}` : ''} |`));
      L.push('');
    }
  }
  if (report.siteCrawl) {
    const c = report.siteCrawl.counts;
    L.push('## Site-wide issues (crawl)', '', `Crawled **${c.crawled}** pages — ${c.errors} errors, ${c.duplicateTitles} duplicate titles, ${c.orphans} orphans, ${c.thin} thin pages. Site health: **${report.siteCrawl.score}/100**.`, '');
    (report.issues || []).filter((i) => i.category === 'site').slice(0, 15).forEach((i) => L.push(`- **${i.title}** — ${i.recommendation}`));
    L.push('');
  }
  if (report.siteAudit) {
    const a = report.siteAudit;
    L.push('## Whole-site score', '', `Average of **${a.pages}** audited pages: **${a.score}/100**.`, '', '| Section | Average | Pages |', '| --- | --- | --- |');
    a.sections.forEach((x) => L.push(`| ${x.name} | ${x.score ?? 'n/a'} | ${x.pages} |`));
    L.push('', '**Most common problems**', '');
    a.problems.forEach((p) => L.push(`- ${p.title} — ${p.affected}/${a.pages} pages`));
    if (report.siteCrawl?.pages?.some((p) => p.score != null)) {
      L.push('', '| Page | Score |', '| --- | --- |');
      report.siteCrawl.pages.filter((p) => p.score != null).sort((x, y) => x.score - y.score).slice(0, 100).forEach((p) => L.push(`| ${p.url} | ${p.score} |`));
    }
    L.push('');
  }
  if (report.security) {
    const s = report.security;
    L.push('## Security & infrastructure', '', `**${s.host}** — grade **${s.grade}** (${s.score}/100). Live checks of headers, HTTPS and TLS.`, '');
    L.push('| Check | Status | Detail |', '| --- | --- | --- |');
    s.items.forEach((i) => L.push(`| ${i.title} | ${i.status} | ${String(i.detail).replace(/\|/g, '\\|')} |`));
    L.push('');
  }
  if (report.popularity) {
    const p = report.popularity;
    L.push('## Traffic overview (popularity)', '', `**${p.domain}** — global rank **#${p.latest.toLocaleString()}** (${p.tier.label}), ${p.direction === 'stable' ? 'stable' : p.direction === 'up' ? `up ${Math.abs(p.change).toLocaleString()} places` : `down ${Math.abs(p.change).toLocaleString()} places`} over ${p.series.length} days (${p.from} → ${p.to}).`, '', '_Source: Tranco popularity ranking. This is a rank, not a visitor count._', '');
    if (p.monthly?.length) {
      L.push('| Month | Global rank |', '|---|---|');
      p.monthly.forEach((m) => L.push(`| ${m.key} | ${m.ranked ? `#${m.rank.toLocaleString()}` : 'not ranked'} |`));
      L.push('');
    }
  }
  if (report.keywords?.primary) {
    const k = report.keywords;
    L.push('## Keywords overview', '', `Primary keyword: **${k.primary.term}** (${k.primary.count}×, ${k.primary.density}% density). ${k.totalWords.toLocaleString()} words analysed.`, '');
    L.push('| Keyword | Count | Density | Title | H1 | Description | URL |', '|---|---|---|---|---|---|---|');
    [...k.phrases.slice(0, 6), ...k.keywords.slice(0, 10)].forEach((t) => L.push(`| ${t.term} | ${t.count} | ${t.density}% | ${t.inTitle ? 'yes' : '–'} | ${t.inH1 ? 'yes' : '–'} | ${t.inDescription ? 'yes' : '–'} | ${t.inUrl ? 'yes' : '–'} |`));
    L.push('', '_Search volumes and rankings are not included: they require paid data or the site owner\'s Search Console._', '');
  }
  L.push('## Not evaluated', '');
  report.coverage.notEvaluated.forEach((n) => L.push(`- **${n.title}** — ${n.reason}`));
  L.push('', `> ${report.disclaimer}`, '');
  return L.join('\n');
}

// ---------- HTML (also the source for the PDF) ----------
const STATUS_CLASS = { pass: 'pass', warning: 'warn', fail: 'fail', error: 'fail', not_applicable: 'mute', not_evaluated: 'mute' };
const scoreClass = (s) => (s === null || s === undefined ? 'mute' : s >= 80 ? 'pass' : s >= 60 ? 'warn' : 'fail');
const chip = (status) => `<span class="chip ${STATUS_CLASS[status] || 'mute'}">${esc(LABEL[status] || status)}</span>`;

const CSS = `
@page{size:A4;margin:16mm 14mm 18mm}
*{box-sizing:border-box}
body{font:13.5px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171a26;background:#fff;margin:0}
.wrap{max-width:900px;margin:0 auto;padding:28px 22px}
h1,h2,h3{line-height:1.2;margin:0}
h2{font-size:18px;margin:30px 0 10px;padding-top:12px;border-top:2px solid #171a26;break-after:avoid}
h3{font-size:14px;margin:18px 0 6px}
.eyebrow{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#667085;font-weight:700}
.brand{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #e3e6ef;padding-bottom:10px;margin-bottom:22px}
.brand b{font-size:15px}
.url{font-size:22px;font-weight:700;word-break:break-all;margin:4px 0 4px}
.meta{color:#667085;font-size:12px}
.hero{display:flex;gap:26px;align-items:center;margin:18px 0;padding:18px;border:1px solid #e3e6ef;border-radius:12px;background:#f8f9fc}
.big{font-size:60px;font-weight:800;line-height:1;letter-spacing:-.03em}
.big small{font-size:18px;color:#667085;font-weight:600}
.grade{font-size:15px;font-weight:700}
.pass{color:#0f7a4a}.warn{color:#a35a00}.fail{color:#c0263a}.mute{color:#667085}
.bar{height:8px;background:#e8eaf2;border-radius:99px;overflow:hidden;min-width:120px}
.bar i{display:block;height:100%;border-radius:99px}
.bar .pass{background:#17a468}.bar .warn{background:#e0951a}.bar .fail{background:#d83a4f}.bar .mute{background:#c4c9d6}
table{width:100%;border-collapse:collapse;font-size:12.5px;margin:6px 0 4px}
th{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#667085;text-align:left;border-bottom:1.5px solid #171a26;padding:6px 8px}
td{padding:7px 8px;border-bottom:1px solid #e8eaf2;vertical-align:top;word-break:break-word}
tr{break-inside:avoid}
code,.mono{font:11.5px ui-monospace,Menlo,Consolas,monospace}
.chip{display:inline-block;font-size:11px;font-weight:700;padding:1px 8px;border-radius:99px;background:currentColor;white-space:nowrap}
.chip{background:none;border:1.5px solid currentColor}
.note{border-left:4px solid #e0951a;background:#fff8ec;padding:8px 12px;margin:10px 0;border-radius:0 8px 8px 0}
.fix{margin-top:4px;color:#33406b}
.small{font-size:11.5px;color:#667085}
.issue{border:1px solid #e3e6ef;border-radius:10px;padding:10px 14px;margin:8px 0;break-inside:avoid}
.issue h3{margin:0 0 2px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.toc{columns:2;font-size:12.5px;margin:6px 0}
.toc li{margin:2px 0}
footer{margin-top:34px;padding-top:10px;border-top:1px solid #e3e6ef;color:#667085;font-size:11.5px}
@media print{.wrap{padding:0;max-width:none}.hero{background:#fff}}
`;

function sectionBars(report) {
  if (!report.sections?.length) return '';
  return `<table><thead><tr><th>Section</th><th style="width:38%">Score</th><th class="mono">Points</th></tr></thead><tbody>${report.sections
    .map(
      (s) => `<tr><td><b>${esc(s.name)}</b></td>
      <td><div style="display:flex;gap:10px;align-items:center"><div class="bar" style="flex:1"><i class="${scoreClass(s.score)}" style="width:${s.score ?? 0}%"></i></div><b class="${scoreClass(s.score)}">${esc(s.score ?? 'n/a')}</b></div></td>
      <td class="mono">${esc(round1(s.earned))}/${esc(s.possible)}</td></tr>`,
    )
    .join('')}</tbody></table>`;
}

function perfSection(report) {
  return (report.performance || [])
    .map((p) => {
      const rows = performanceRows(p)
        .map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td class="mono">${esc(r[2])}</td><td class="${r[3] === 'good' ? 'pass' : r[3] === 'poor' ? 'fail' : 'warn'}">${esc(r[3])}</td></tr>`)
        .join('');
      const opps = p.opportunities
        .map((o) => `<tr><td>${esc(o.title)}</td><td class="mono">−${(o.savingsMs / 1000).toFixed(1)} s</td></tr>`)
        .join('');
      return `<h2>Performance &amp; Core Web Vitals — ${esc(p.strategy)}</h2>
      <p class="meta">${esc(p.source)}${p.lab.score !== null ? ` · Lighthouse lab score <b>${esc(p.lab.score)}/100</b>` : ''} · ${esc(new Date(p.fetchedAt).toUTCString())}</p>
      <table><thead><tr><th>Type</th><th>Metric</th><th>Value</th><th>Rating</th></tr></thead><tbody>${rows}</tbody></table>
      ${opps ? `<h3>Biggest opportunities</h3><table><tbody>${opps}</tbody></table>` : ''}`;
    })
    .join('');
}

function renderingSection(report) {
  const d = report.render?.diff;
  if (!d) return '';
  const rows = d.items
    .map((i) => `<tr><td><b>${esc(i.label)}</b></td><td class="mono">${esc(i.raw) || '—'}</td><td class="mono">${esc(i.rendered) || '—'}</td><td class="${i.result === 'same' ? 'mute' : 'warn'}">${esc(i.result)}</td></tr>`)
    .join('');
  return `<h2>Raw HTML vs live rendered page</h2>
  <p class="meta"><b>${esc(d.dependence)}%</b> of visible words appear only after JavaScript runs (raw ${esc(d.wordsRaw)} → rendered ${esc(d.wordsRendered)}).</p>
  <table><thead><tr><th>Field</th><th>Raw HTML</th><th>Live rendered</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function pageData(report) {
  const m = report.metadata;
  const kv = (k, v) => `<tr><td style="width:28%"><b>${esc(k)}</b></td><td class="mono">${esc(v) || '—'}</td></tr>`;
  const og = Object.entries(m.og || {}).map(([k, v]) => kv(`og:${k}`, v)).join('');
  const tw = Object.entries(m.twitter || {}).map(([k, v]) => kv(`twitter:${k}`, v)).join('');
  const outline = ['h1', 'h2', 'h3']
    .flatMap((l) => (report.headings[l] || []).slice(0, 40).map((t) => `<tr><td class="mono" style="width:8%">${l.toUpperCase()}</td><td style="padding-left:${(Number(l[1]) - 1) * 14 + 8}px">${esc(t) || '<i class="mute">(empty)</i>'}</td></tr>`))
    .join('');
  const types = [...new Set((report.structuredData?.items || []).map((i) => i.type))].join(', ');
  return `<h2>Page data</h2>
  <table><tbody>
    ${kv('Title', m.title)}${kv('Description', m.description)}${kv('Canonical', m.canonical)}${kv('Robots', [m.robots, m.googlebot].filter(Boolean).join(', '))}
    ${kv('Language', m.lang)}${kv('Viewport', m.viewport)}${kv('Words', report.content?.wordCount)}
    ${kv('Images', `${report.images.total} (${report.images.missingAlt} missing alt)`)}
    ${kv('Links', `${report.links.total} (${report.links.internal} internal, ${report.links.external} external)`)}
    ${kv('Structured data', types || 'None')}${og}${tw}
  </tbody></table>
  <h3>Heading outline</h3><table><tbody>${outline || '<tr><td class="mute">No H1–H3 headings found.</td></tr>'}</tbody></table>`;
}

export function toHtml(report) {
  const generated = new Date(report.generatedAt).toUTCString();
  const issues = (report.issues || [])
    .map(
      (i, n) => `<div class="issue"><h3>${n + 1}. ${esc(i.title)} <span class="${i.severity === 'critical' ? 'fail' : 'warn'}" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em">${esc(i.severity)}</span></h3>
      <div class="small">${esc(i.category)} · impact ${esc(i.impact)} · confidence ${esc(i.confidence)}</div>
      <div>${esc(i.message)}</div>
      ${i.evidence ? `<div class="mono small">${esc(i.evidence)}</div>` : ''}
      ${i.recommendation ? `<div class="fix"><b>Fix:</b> ${esc(i.recommendation)}</div>` : ''}</div>`,
    )
    .join('');

  const modules = MODULES.map((mod, idx) => {
    const st = moduleStatus(mod, report.checks);
    const rows = moduleChecks(mod, report.checks)
      .map(
        (c) => `<tr><td><b>${esc(c.title)}</b><div class="small">${esc(c.why)}</div></td><td>${chip(c.status)}</td>
        <td class="mono">${c.weight ? `${esc(earnedOf(c))}/${esc(possibleOf(c))}` : 'advisory'}</td>
        <td><span class="mono">${esc(c.evidence) || '—'}</span>${c.recommendation ? `<div class="fix"><b>Fix:</b> ${esc(c.recommendation)}</div>` : ''}</td></tr>`,
      )
      .join('');
    return `<h2>${String(idx + 1).padStart(2, '0')} · ${esc(mod.label)} <span class="${STATUS_CLASS[st]}" style="font-size:13px">— ${esc(LABEL[st])}</span></h2>
      <p class="meta">${esc(mod.summary)}</p>
      <table><thead><tr><th style="width:34%">Check</th><th>Status</th><th>Points</th><th>Evidence &amp; fix</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');

  const notices = (report.notices || []).map((n) => `<div class="note">${esc(n.message)}</div>`).join('');
  const toc = MODULES.map((m) => `<li>${esc(m.label)}</li>`).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="SEO Audit Analyzer"><title>SEO report — ${esc(report.url)}</title><style>${CSS}</style></head><body><div class="wrap">
<div class="brand"><b>SEO Audit Analyzer</b><span class="meta">SEO audit report · rubric ${esc(report.rubricVersion)}</span></div>
<div class="eyebrow">Audited page</div>
<div class="url">${esc(report.url)}</div>
<div class="meta">${report.country ? `Viewpoint: ${esc(report.country.name)} (${esc(report.country.locale)}) · ` : ''}Generated ${esc(generated)} · HTTP ${esc(report.statusCode)} · ${esc(report.coverage.evaluated)} of ${esc(report.coverage.total)} checks evaluated</div>
${notices}
<div class="hero">
  <div class="big ${scoreClass(report.score)}">${esc(report.score ?? '–')}<small> / 100</small></div>
  <div><div class="grade">Grade ${esc(report.grade)} · ${esc(report.gradeLabel)}</div>
  <div class="meta">${esc(round1(report.scoring.pointsEarned))} of ${esc(report.scoring.pointsPossible)} applicable points${report.includesPerformance || report.includesLinks || report.includesSite ? ` · includes ${[report.includesPerformance && 'Lighthouse performance', report.includesLinks && 'link health', report.includesSite && 'site health'].filter(Boolean).join(', ')} · HTML audit alone ${esc(report.htmlScore)}/100` : ''}</div></div>
</div>
<h2 style="border-top:0;margin-top:20px">Score by section</h2>
${sectionBars(report)}
<h2>Priority recommendations</h2>
${issues || '<p class="pass">No failed or warning findings in the evaluated checks.</p>'}
${perfSection(report)}
${renderingSection(report)}
${modules}
${pageData(report)}
${report.linkCheck?.results?.length ? (() => {
  const sm = report.linkCheck.summary || {};
  const bad = report.linkCheck.results.filter((r) => ['broken', 'timeout', 'error', 'redirect'].includes(r.verdict)).slice(0, 80);
  return `<h2>Broken link check</h2><p class="meta">Checked <b>${esc(sm.total)}</b> links and images — <b class="fail">${esc(sm.broken || 0)} broken</b>, ${esc(sm.redirect || 0)} redirects, ${esc(sm.blocked || 0)} restricted, ${esc(sm.ok || 0)} working.</p>${
    bad.length ? `<table><thead><tr><th>Result</th><th>URL</th><th>Detail</th></tr></thead><tbody>${bad.map((r) => `<tr><td class="${r.verdict === 'redirect' ? 'warn' : 'fail'}">${esc(LINK_LABEL[r.verdict])}${r.status ? ` (${esc(r.status)})` : ''}</td><td class="mono">${esc(r.href)}</td><td>${esc(r.reason)}${r.redirects?.length ? ` → <span class="mono">${esc(r.finalUrl)}</span>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="pass">No broken links or redirects found.</p>'}`;
})() : ''}
${report.siteCrawl ? (() => {
  const c = report.siteCrawl.counts;
  const iss = (report.issues || []).filter((i) => i.category === 'site').slice(0, 15);
  return `<h2>Site-wide issues (crawl)</h2><p class="meta">Crawled <b>${esc(c.crawled)}</b> pages · site health <b>${esc(report.siteCrawl.score)}/100</b> · ${esc(c.errors)} errors · ${esc(c.duplicateTitles)} duplicate titles · ${esc(c.orphans)} orphans · ${esc(c.thin)} thin pages${report.siteCrawl.truncated ? ' · crawl limited by page budget' : ''}</p>${iss.length ? `<table><thead><tr><th>Finding</th><th>Fix</th></tr></thead><tbody>${iss.map((i) => `<tr><td><b>${esc(i.title)}</b><div class="small">${esc(i.message)}</div></td><td>${esc(i.recommendation)}</td></tr>`).join('')}</tbody></table>` : '<p class="pass">No site-wide issues found in the crawled pages.</p>'}`;
})() : ''}
${report.siteAudit ? `<h2>Whole-site score</h2><p>Average of <b>${esc(report.siteAudit.pages)}</b> audited pages: <b>${esc(report.siteAudit.score)}/100</b>.</p><table><thead><tr><th>Section</th><th>Average</th><th>Pages</th></tr></thead><tbody>${report.siteAudit.sections.map((x) => `<tr><td>${esc(x.name)}</td><td class="mono">${esc(x.score ?? 'n/a')}</td><td class="mono">${esc(x.pages)}</td></tr>`).join('')}</tbody></table>${report.siteCrawl?.pages?.some((p) => p.score != null) ? `<table><thead><tr><th>Page</th><th>Score</th></tr></thead><tbody>${report.siteCrawl.pages.filter((p) => p.score != null).sort((x, y) => x.score - y.score).slice(0, 100).map((p) => `<tr><td class="mono">${esc(p.url)}</td><td class="mono">${esc(p.score)}</td></tr>`).join('')}</tbody></table>` : ''}` : ''}
${report.security ? `<h2>Security &amp; infrastructure</h2><p><b>${esc(report.security.host)}</b> — grade <b>${esc(report.security.grade)}</b> (${esc(report.security.score)}/100).</p><table><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>${report.security.items.map((i) => `<tr><td>${esc(i.title)}</td><td>${esc(i.status)}</td><td class="mono">${esc(i.detail)}</td></tr>`).join('')}</tbody></table>` : ''}
${report.popularity ? `<h2>Traffic overview (popularity)</h2><p><b>${esc(report.popularity.domain)}</b> — global rank <b>#${esc(report.popularity.latest.toLocaleString())}</b> (${esc(report.popularity.tier.label)}). ${report.popularity.direction === 'stable' ? 'Stable' : report.popularity.direction === 'up' ? `Up ${esc(Math.abs(report.popularity.change).toLocaleString())} places` : `Down ${esc(Math.abs(report.popularity.change).toLocaleString())} places`} over ${esc(report.popularity.series.length)} days (${esc(report.popularity.from)} → ${esc(report.popularity.to)}).</p><p class="small">Source: Tranco popularity ranking. This is a rank, not a visitor count.</p>${report.popularity.monthly?.length ? `<table><thead><tr><th>Month</th><th>Global rank</th></tr></thead><tbody>${report.popularity.monthly.map((m) => `<tr><td>${esc(m.key)}</td><td class="mono">${m.ranked ? `#${esc(m.rank.toLocaleString())}` : 'not ranked'}</td></tr>`).join('')}</tbody></table>` : ''}` : ''}
${report.keywords?.primary ? (() => { const k = report.keywords; const yn = (v) => (v ? 'yes' : '–'); return `<h2>Keywords overview</h2><p>Primary keyword: <b>${esc(k.primary.term)}</b> (${esc(k.primary.count)}×, ${esc(k.primary.density)}% density) · ${esc(k.totalWords.toLocaleString())} words analysed.</p><table><thead><tr><th>Keyword</th><th>Count</th><th>Density</th><th>Title</th><th>H1</th><th>Description</th><th>URL</th></tr></thead><tbody>${[...k.phrases.slice(0, 6), ...k.keywords.slice(0, 10)].map((t) => `<tr><td><b>${esc(t.term)}</b></td><td>${esc(t.count)}</td><td>${esc(t.density)}%</td><td>${yn(t.inTitle)}</td><td>${yn(t.inH1)}</td><td>${yn(t.inDescription)}</td><td>${yn(t.inUrl)}</td></tr>`).join('')}</tbody></table><p class="small">Search volumes and rankings are not included: they require paid data or the site owner's Search Console.</p>`; })() : ''}
<h2>Not evaluated in this report</h2>
<table><tbody>${report.coverage.notEvaluated.map((n) => `<tr><td style="width:32%"><b>${esc(n.title)}</b></td><td>${esc(n.reason)}</td></tr>`).join('')}</tbody></table>
<h2>Method</h2>
<p class="small">Score = points earned ÷ applicable points × 100 across weighted checks (rubric ${esc(report.rubricVersion)}): pass earns full weight, warning half, fail zero; checks that do not apply or were not evaluated are excluded. Contents: <ul class="toc">${toc}</ul></p>
<footer><b>Disclaimer.</b> ${esc(report.disclaimer)}<br>Generated by SEO Audit Analyzer on ${esc(generated)}.</footer>
</div></body></html>`;
}
