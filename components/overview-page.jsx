'use client';

import Link from 'next/link';
import { useReport } from './report-context';
import SeoScoreCard from './seo-score-card';
import CountUp from './count-up';
import { IssueList } from './recommendations-panel';
import { MODULES, moduleStatus } from '@/lib/modules';
import { STATUS_STYLE } from './labels';
import { flagOf } from '@/lib/countries';

export default function OverviewPage() {
  const { report, exportReport, analyze, status } = useReport();
  if (!report) return null;
  const shown = exportReport || report;
  const c = report.scoring.counts;
  const host = new URL(report.url).hostname;

  const stats = [
    ['Passed', c.pass || 0, 'text-good', 'bg-good/10'],
    ['Warnings', c.warning || 0, 'text-warn', 'bg-warn/10'],
    ['Failed', c.fail || 0, 'text-bad', 'bg-bad/10'],
    ['Skipped', (c.not_applicable || 0) + (c.error || 0), 'text-muted', 'bg-panel-2'],
  ];

  return (
    <article className="audit-overview">
      <header className="overview-masthead rise">
        <div className="overview-masthead-top">
          <p className="overview-kicker"><span /> SITE AUDIT / OVERVIEW</p>
          <span className="overview-index">REPORT 01 — LIVE</span>
        </div>
        <div className="overview-masthead-main">
          <div className="min-w-0">
            <h1 className="overview-domain">{host}</h1>
            <a href={report.url} target="_blank" rel="noopener noreferrer" className="overview-url">{report.url} <span aria-hidden>↗</span></a>
          </div>
          <div className="overview-actions">
            <span className="overview-live"><i /> Audit complete</span>
            <button type="button" disabled={status === 'loading'} onClick={() => analyze(report.requestedUrl)} className="overview-rerun no-print">
              {status === 'loading' ? 'Re-running…' : 'Run again ↻'}
            </button>
          </div>
        </div>
        <div className="overview-meta">
          <span><b>HTTP</b> {report.statusCode}</span>
          <span><b>TRANSFER</b> {(report.fetch.bytes / 1024).toFixed(0)} KB</span>
          <span><b>FETCH</b> {report.fetch.ms} ms</span>
          <span><b>GENERATED</b> {new Date(report.generatedAt).toLocaleString()}</span>
          {report.country && <span><b>VIEWPOINT</b> {flagOf(report.country.code)} {report.country.name}</span>}
        </div>
      </header>

      {report.notices?.length > 0 && (
        <ul className="rise mt-5 space-y-2">
          {report.notices.map((n, i) => (
            <li key={i} className={`overview-notice rounded-xl border px-4 py-3 text-sm ${n.level === 'warning' ? 'border-warn/40 bg-warn/10' : 'border-accent/30 bg-accent/5'}`}>{n.message}</li>
          ))}
        </ul>
      )}

      {report.keywords?.primary && (
        <Link href="/report/keywords" className="card card-hover mt-5 block p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Keywords overview</p>
            <span className="text-xs font-medium text-accent">Open →</span>
          </div>
          <p className="mt-1 text-sm text-muted">Primary keyword: <b className="text-ink">{report.keywords.primary.term}</b></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {report.keywords.keywords.slice(0, 8).map((k) => (
              <span key={k.term} className="rounded-full bg-panel-2 px-2.5 py-0.5 text-xs">{k.term} <span className="text-muted">{k.count}</span></span>
            ))}
          </div>
        </Link>
      )}

      <div className="mt-6"><SeoScoreCard report={shown} /></div>

      {(() => {
        const total = stats.reduce((a, x) => a + x[1], 0) || 1;
        const SEG = ['bg-good', 'bg-warn', 'bg-bad', 'bg-line'];
        return (
          <div className="card rise check-results mt-4 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Check results</span>
              <span className="text-muted">{total} checks</span>
            </div>
            <div className="mt-2.5 flex h-3 gap-0.5 overflow-hidden rounded-full bg-panel-2">
              {stats.map(([k, v], i) => v > 0 && (
                <div key={k} title={`${k}: ${v}`} className={`dist-seg ${SEG[i]}`} style={{ width: `${(v / total) * 100}%`, animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          </div>
        );
      })()}

      <dl className="audit-stat-grid mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([k, v, cls, bg], i) => (
          <div key={k} className={`card stat-tile p-4 ${cls}`} style={{ '--d': `${i * 80}ms` }}>
            <dt className="flex items-center gap-2 text-sm text-muted">
              <span className={`h-2 w-2 rounded-full ${bg.replace('/10', '')}`} /> {k}
            </dt>
            <dd className="mt-1 text-3xl font-bold"><CountUp value={v} duration={700} /></dd>
          </div>
        ))}
      </dl>

      <section className="overview-section mt-12">
        <div className="overview-section-heading">
          <div><p className="overview-kicker">01 / COVERAGE</p><h2 className="text-2xl">Audit modules</h2></div>
          <p className="text-sm text-muted">Open a module to inspect its findings and evidence.</p>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((m, i) => {
            const st = STATUS_STYLE[moduleStatus(m, report.checks)];
            return (
              <li key={m.slug} className="tile-anim" style={{ '--d': `${i * 35}ms` }}>
                <Link href={`/report/${m.slug}`} className={`card card-hover spot mod-card overview-module block h-full p-4 pl-5 ${st.text}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full bg-current/10 px-2 py-0.5 text-xs font-semibold ${st.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}
                    </span>
                  </div>
                  <div className="mt-2 font-semibold text-ink">{m.label}</div>
                  <div className="mt-0.5 line-clamp-2 text-sm text-muted">{m.summary}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="overview-section mt-12">
        <div className="flex items-baseline justify-between">
          <div><p className="overview-kicker">02 / PRIORITIES</p><h2 className="text-2xl">Next best actions</h2></div>
          <Link href="/report/recommendations" className="text-sm font-medium text-accent hover:underline">All {shown.issues.length} →</Link>
        </div>
        <div className="mt-4"><IssueList issues={shown.issues.slice(0, 4)} /></div>
      </section>

      <details className="card group mt-10 px-5 py-4 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
          How is this score calculated?
          <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-panel-2 text-lg leading-none text-muted transition group-open:rotate-45">+</span>
        </summary>
        <div className="mt-3 space-y-2 text-muted">
          <p>
            <b className="text-ink">Page health score</b> = points earned ÷ applicable points × 100 across weighted checks
            (title, description, H1, canonical, robots, Open Graph, viewport, image alt text, structured data, HTTPS, language) plus the JavaScript-rendering checks — metadata and content available without JavaScript, consistent canonical/robots, links, render health. If live rendering wasn&apos;t available those checks are left out, not guessed.
            Pass earns full weight, warning half, fail zero; checks that don&apos;t apply are left out.
          </p>
          <p>
            <b className="text-ink">Performance</b> is the average Lighthouse lab score for mobile and desktop and adds
            25 points when tested. The HTML-only score is always shown alongside it.
          </p>
          <p>{report.disclaimer}</p>
        </div>
      </details>
    </article>
  );
}
