'use client';

import { useMemo, useState } from 'react';
import { useReport } from './report-context';
import { PageHead } from './module-page';
import CountUp from './count-up';

const VERDICT = {
  broken: { label: 'Broken', text: 'text-bad', bg: 'bg-bad' },
  redirect: { label: 'Redirect', text: 'text-warn', bg: 'bg-warn' },
  blocked: { label: 'Restricted', text: 'text-muted', bg: 'bg-muted' },
  timeout: { label: 'Timeout', text: 'text-warn', bg: 'bg-warn' },
  error: { label: 'Error', text: 'text-bad', bg: 'bg-bad' },
  skipped: { label: 'Skipped', text: 'text-muted', bg: 'bg-line' },
  ok: { label: 'OK', text: 'text-good', bg: 'bg-good' },
};

const FILTERS = [
  ['issues', 'Needs attention'],
  ['broken', 'Broken'],
  ['redirect', 'Redirects'],
  ['blocked', 'Restricted'],
  ['ok', 'OK'],
  ['all', 'All'],
];

export default function BrokenLinksPage() {
  const { report, linkCheck, runLinkCheck } = useReport();
  const [filter, setFilter] = useState('issues');
  const [query, setQuery] = useState('');
  const { status, total, done, results, summary, score } = linkCheck;

  const rows = useMemo(() => {
    const issue = new Set(['broken', 'timeout', 'error', 'redirect']);
    return results
      .filter((r) => (filter === 'all' ? true : filter === 'issues' ? issue.has(r.verdict) : filter === 'broken' ? ['broken', 'timeout', 'error'].includes(r.verdict) : r.verdict === filter))
      .filter((r) => !query || `${r.href} ${r.text}`.toLowerCase().includes(query.toLowerCase()));
  }, [results, filter, query]);

  if (!report) return null;
  const running = status === 'running';
  const pct = total ? Math.round((done / total) * 100) : 0;
  const s = summary || {};
  const brokenAll = (s.broken || 0) + (s.timeout || 0) + (s.error || 0);

  const tiles = [
    ['Broken', brokenAll, 'text-bad'],
    ['Redirects', s.redirect || 0, 'text-warn'],
    ['Restricted', s.blocked || 0, 'text-muted'],
    ['Working', s.ok || 0, 'text-good'],
  ];

  return (
    <article>
      <PageHead eyebrow="Content · Live link check" title="Broken links">
        <p className="mt-2 max-w-2xl text-muted">
          Every link and image found on the page is requested live and checked for errors, redirects and unreachable
          targets. Results stream in as each one finishes.
        </p>
      </PageHead>

      <div className="card rise mt-5 p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-end gap-1">
            <CountUp value={score} className={`text-5xl font-bold leading-none ${score === null ? 'text-muted' : score >= 80 ? 'text-good' : score >= 60 ? 'text-warn' : 'text-bad'}`} />
            <span className="pb-1 text-lg text-muted">/ 100</span>
          </div>
          <div className="min-w-[12rem] flex-1">
            <div className="h-2.5 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-300" style={{ width: `${status === 'idle' ? 0 : pct}%` }} />
            </div>
            <p className="mt-1.5 text-sm text-muted">
              {status === 'idle' && 'Not started.'}
              {running && `Checking ${done} of ${total} links…`}
              {status === 'done' && (total ? `Checked ${total} link${total === 1 ? '' : 's'} and images.` : 'No links to check.')}
              {status === 'error' && <span className="text-bad">{linkCheck.error}</span>}
            </p>
          </div>
          <button type="button" disabled={running} onClick={() => runLinkCheck(report)} className="btn btn-primary no-print px-4 py-2">
            {running ? 'Checking…' : status === 'idle' ? 'Check links' : '↻ Re-check'}
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map(([label, value, cls]) => (
            <div key={label} className="rounded-xl bg-panel-2 px-4 py-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {results.length > 0 && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter links">
              {FILTERS.map(([k, label]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
                  className={`rounded-full px-3 py-1 text-sm transition ${filter === k ? 'bg-accent text-on-accent' : 'bg-panel-2 text-muted hover:text-ink'}`}>
                  {label}
                </button>
              ))}
            </div>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search URL or anchor text…" aria-label="Search links"
              className="min-w-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent" />
          </div>

          <div className="card mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">URL</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const v = VERDICT[r.verdict] || VERDICT.error;
                  return (
                    <tr key={r.href} className="align-top">
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${v.text}`}>
                          <span className={`h-2 w-2 rounded-full ${v.bg}`} />
                          {r.status ? `${r.status} · ` : ''}{v.label}
                        </span>
                        <span className="block text-[11px] text-muted">{r.reason}</span>
                      </td>
                      <td className="max-w-[26rem] px-4 py-2.5">
                        <a href={r.href} target="_blank" rel="noopener noreferrer" className="block break-all font-mono text-xs hover:text-accent">{r.href}</a>
                        {r.text && <span className="block truncate text-xs text-muted">“{r.text}”</span>}
                        {r.redirects?.length > 0 && <span className="block break-all font-mono text-[11px] text-warn">→ {r.finalUrl}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">{r.kind === 'image' ? 'Image' : r.internal ? 'Internal' : 'External'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs text-muted">{r.ms} ms</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">
                    {filter === 'issues' && status === 'done' ? 'No broken links or redirects found.' : 'Nothing matches this filter yet.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            “Restricted” means the site refused our automated check (for example 403 or 429) — it may still work in a browser,
            so it isn&apos;t counted as broken. Up to 160 links and 40 images are checked per run.
          </p>
        </section>
      )}
    </article>
  );
}
