'use client';

import { useMemo, useState } from 'react';
import { useReport } from './report-context';
import { PageHead } from './module-page';
import CountUp from './count-up';

const tone = (s) => (s == null ? 'text-muted' : s >= 80 ? 'text-good' : s >= 60 ? 'text-warn' : 'text-bad');

const VERDICT = {
  ok: ['OK', 'text-good', 'bg-good'],
  error: ['Error', 'text-bad', 'bg-bad'],
  unreachable: ['Unreachable', 'text-bad', 'bg-bad'],
  blocked_by_robots: ['Blocked by robots.txt', 'text-warn', 'bg-warn'],
  non_html: ['Not HTML', 'text-muted', 'bg-muted'],
};

export default function SiteCrawlPage() {
  const { report, exportReport, siteCrawl, runSiteCrawl } = useReport();
  const [maxPages, setMaxPages] = useState(50);
  const audit = exportReport?.siteAudit;
  const [open, setOpen] = useState(() => new Set());
  const [filter, setFilter] = useState('all');
  const running = siteCrawl.status === 'running';
  const result = siteCrawl.result;
  const analysis = result?.analysis;
  const pages = result ? result.crawl.pages : siteCrawl.pages;
  const shown = useMemo(
    () => pages.filter((p) => (filter === 'all' ? true : filter === 'problems' ? p.verdict !== 'ok' || (p.status ?? 0) >= 400 : p.verdict === 'ok')),
    [pages, filter],
  );
  if (!report) return null;
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const c = analysis?.counts;
  const pct = siteCrawl.max ? Math.round((siteCrawl.done / siteCrawl.max) * 100) : 0;

  return (
    <article>
      <PageHead eyebrow="Site & market · Live crawl" title="Site-wide issues">
        <p className="mt-2 max-w-2xl text-muted">
          Every analysis also crawls the site from this page — politely, respecting robots.txt — and audits each page it finds, so the score reflects the whole site, not one URL. It also reveals duplicate titles, orphaned pages and sitemap problems.
        </p>
      </PageHead>

      <div className="card rise mt-5 p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-end gap-1">
            <CountUp value={analysis?.score ?? null} className={`text-5xl font-bold leading-none ${analysis ? (analysis.score >= 80 ? 'text-good' : analysis.score >= 60 ? 'text-warn' : 'text-bad') : 'text-muted'}`} />
            <span className="pb-1 text-lg text-muted">/ 100</span>
          </div>
          <div className="min-w-[12rem] flex-1">
            <div className="h-2.5 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-300" style={{ width: `${analysis ? 100 : running ? Math.max(4, pct) : 0}%` }} />
            </div>
            <p className="mt-1.5 text-sm text-muted">
              {siteCrawl.status === 'idle' && 'Not crawled yet. It starts automatically after each analysis, or choose how many pages and start.'}
              {running && (siteCrawl.message || 'Crawling…')}
              {siteCrawl.status === 'done' && `Crawled ${c.crawled} page${c.crawled === 1 ? '' : 's'} in ${((result.crawl.ms || 0) / 1000).toFixed(1)} s${result.crawl.truncated ? ' — more pages exist beyond the limit' : ''}.`}
              {siteCrawl.status === 'error' && <span className="text-bad">{siteCrawl.error}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <label className="sr-only" htmlFor="maxpages">Pages to crawl</label>
            <select id="maxpages" value={maxPages} disabled={running} onChange={(e) => setMaxPages(Number(e.target.value))}
              className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm">
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n} pages</option>)}
            </select>
            <button type="button" disabled={running} onClick={() => runSiteCrawl(report.url, maxPages)} className="btn btn-primary px-4 py-2">
              {running ? 'Crawling…' : siteCrawl.status === 'idle' ? 'Start crawl' : '↻ Crawl again'}
            </button>
          </div>
        </div>

        {c && (
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Pages crawled', c.crawled, ''],
              ['Errors', c.errors, c.errors ? 'text-bad' : 'text-good'],
              ['Duplicate titles', c.duplicateTitles, c.duplicateTitles ? 'text-warn' : 'text-good'],
              ['Orphan pages', c.orphansEvaluated === false ? 'n/a' : c.orphans, c.orphans ? 'text-warn' : 'text-good'],
              ['Thin pages', c.thin, c.thin ? 'text-warn' : 'text-good'],
              ['Redirected URLs', c.redirects, c.redirects ? 'text-warn' : 'text-good'],
              ['Noindex pages', c.noindex, ''],
              ['In sitemap', c.inSitemap, ''],
            ].map(([k, v, cls]) => (
              <div key={k} className="rounded-xl bg-panel-2 px-4 py-3"><dt className="text-xs text-muted">{k}</dt><dd className={`text-2xl font-bold tabular-nums ${cls}`}>{v}</dd></div>
            ))}
          </dl>
        )}
      </div>

      {audit && (
        <section className="mt-6">
          <h2 className="text-xl">Whole-site score</h2>
          <p className="mt-0.5 text-sm text-muted">Every crawled page is audited with the same checks, then averaged: {audit.pages} page{audit.pages === 1 ? '' : 's'} scored. The overall score on the Overview uses this average.</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="card p-5">
              <div className="flex items-baseline justify-between"><span className="eyebrow">Average by section</span><b className={`text-2xl tabular-nums ${tone(audit.score)}`}>{audit.score}<span className="text-sm font-normal text-muted"> / 100</span></b></div>
              <ul className="mt-3 space-y-2.5">
                {audit.sections.map((s) => (
                  <li key={s.name}>
                    <div className="mb-1 flex items-baseline justify-between text-sm"><span className="font-medium">{s.name}</span><span className="tabular-nums text-muted"><b className={tone(s.score)}>{s.score ?? 'n/a'}</b>{s.score != null && ` · ${s.pages} page${s.pages === 1 ? '' : 's'}`}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-panel-2"><div className={`h-full rounded-full ${s.score == null ? 'bg-line' : s.score >= 80 ? 'bg-good' : s.score >= 60 ? 'bg-warn' : 'bg-bad'}`} style={{ width: `${s.score ?? 0}%`, animation: 'bar 0.8s ease-out both' }} /></div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <div className="card p-5">
                <span className="eyebrow">Most common problems</span>
                {audit.problems.length === 0 ? <p className="mt-2 text-sm text-good">No failed or warning checks on any page.</p> : (
                  <ul className="mt-2 divide-y divide-line text-sm">
                    {audit.problems.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-1.5"><span className="min-w-0 truncate">{p.title}</span><span className="shrink-0 font-mono text-xs text-muted">{p.affected}/{audit.pages} pages</span></li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card p-5">
                <span className="eyebrow">Lowest-scoring pages</span>
                <ul className="mt-2 divide-y divide-line text-sm">
                  {audit.lowest.map((p) => (
                    <li key={p.url} className="flex items-center justify-between gap-3 py-1.5"><span className="min-w-0 truncate font-mono text-xs">{p.url.replace(/^https?:\/\/(www\.)?/, '')}</span><b className={`shrink-0 tabular-nums ${tone(p.score)}`}>{p.score}</b></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {result && (
        <section className="mt-6">
          <h2 className="text-xl">Findings</h2>
          {analysis.issues.length === 0 ? (
            <p className="card mt-3 p-5 font-medium text-good">No site-wide issues found in the crawled pages.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {analysis.issues.map((i) => {
                const isOpen = open.has(i.id);
                const crit = i.severity === 'critical';
                return (
                  <li key={i.id} className="card overflow-hidden">
                    <button type="button" onClick={() => toggle(i.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      <span className={`grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-sm font-bold ${crit ? 'bg-bad/10 text-bad' : 'bg-warn/10 text-warn'}`}>{i.affected}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{i.title}</span>
                        <span className="block truncate text-sm text-muted">{i.message}</span>
                      </span>
                      <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:block ${crit ? 'bg-bad/10 text-bad' : 'bg-warn/10 text-warn'}`}>{i.severity}</span>
                      <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {isOpen && (
                      <div className="space-y-3 border-t border-line px-4 py-3">
                        <pre className="evidence whitespace-pre-wrap">{i.evidence}</pre>
                        <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm"><b className="text-accent">Fix: </b>{i.recommendation}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {pages.length > 0 && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl">Pages {running && <span className="text-sm font-normal text-muted">(live)</span>}</h2>
            <div className="flex gap-1.5">
              {[['all', 'All'], ['problems', 'Problems'], ['ok', 'OK']].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
                  className={`rounded-full px-3 py-1 text-sm ${filter === k ? 'bg-accent text-on-accent' : 'bg-panel-2 text-muted'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Score</th><th className="px-4 py-2.5">URL & title</th><th className="px-4 py-2.5 text-right">Depth</th><th className="px-4 py-2.5 text-right">Words</th><th className="px-4 py-2.5 text-right">Inlinks</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {shown.map((p) => {
                  const v = VERDICT[p.verdict] || VERDICT.error;
                  return (
                    <tr key={p.url} className="align-top">
                      <td className="whitespace-nowrap px-4 py-2.5"><span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${v[1]}`}><span className={`h-2 w-2 rounded-full ${v[2]}`} />{p.status ? `${p.status} · ` : ''}{v[0]}</span></td>
                      <td className={`px-4 py-2.5 text-right font-mono text-xs font-semibold ${tone(p.audit?.score ?? p.score)}`}>{p.audit?.score ?? p.score ?? '—'}</td>
                      <td className="max-w-[26rem] px-4 py-2.5"><span className="block break-all font-mono text-xs">{p.url}</span>{p.title && <span className="block truncate text-xs text-muted">{p.title}</span>}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{p.depth ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{p.words ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{p.inlinks ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Scores each page from its HTML (no JavaScript rendering; the page you entered also includes the rendering checks), stays on this site, honours robots.txt, and waits between requests. Limited to {maxPages} pages per run.{result && result.crawl.truncated ? ' Orphan-page detection needs a complete crawl, so it is skipped when the site is larger than the limit.' : ''}
          </p>
        </section>
      )}
    </article>
  );
}
