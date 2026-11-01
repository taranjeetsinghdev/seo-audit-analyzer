'use client';

import Link from 'next/link';
import { useReport } from './report-context';
import CountUp from './count-up';
import { PERFORMANCE_WEIGHT, LINKS_WEIGHT, SITE_WEIGHT } from '@/lib/overall-score';

const EXTRA_SECTIONS = ['Performance', 'Link health', 'Site health', 'Security & infrastructure', 'Sitemap & robots'];
const R = 54;
const CIRC = 2 * Math.PI * R;
const tone = (s) => (s === null || s === undefined ? 'text-muted' : s >= 80 ? 'text-good' : s >= 60 ? 'text-warn' : 'text-bad');
const toneBg = (s) => (s === null || s === undefined ? 'bg-line' : s >= 80 ? 'bg-good' : s >= 60 ? 'bg-warn' : 'bg-bad');
// Lighthouse's own bands for performance scores.
const perfTone = (s) => (s >= 90 ? 'bg-good' : s >= 50 ? 'bg-warn' : 'bg-bad');

function Bar({ value, color, dashed = false }) {
  return (
    <div className={`h-2.5 overflow-hidden rounded-full bg-panel-2 ${dashed ? 'outline outline-1 outline-dashed outline-line' : ''}`}>
      <div className={`bar-fill h-full rounded-full ${color}`} style={{ width: `${value ?? 0}%`, animation: 'bar 0.9s cubic-bezier(0.2,0.7,0.2,1) both' }} />
    </div>
  );
}

export default function SeoScoreCard({ report }) {
  const { score, grade, gradeLabel, scoring, coverage } = report;
  const { perf, runPerformance, report: base, linkCheck, siteCrawl } = useReport();
  const crawling = siteCrawl.status === 'running';
  const sitePages = report.includesSiteAudit || 0;
  const linkSection = report.sections.find((x) => x.name === 'Link health');
  const siteSection = report.sections.find((x) => x.name === 'Site health');
  const hasPerf = !!report.includesPerformance;
  const perfSection = report.sections.find((s) => s.name === 'Performance');
  const loading = perf.status === 'loading';

  return (
    <section className="card rise p-6 sm:p-8">
      <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
        <div className="mx-auto text-center">
          <div className={`relative h-48 w-48 ${tone(score)}`}>
            <span aria-hidden className="absolute inset-3 rounded-full bg-current opacity-[0.07] blur-2xl" />
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" role="img" aria-label={`Overall score ${score ?? 'n/a'} out of 100`}>
              <circle cx="64" cy="64" r={R} fill="none" stroke="var(--line)" strokeWidth="9" />
              <circle cx="64" cy="64" r={R - 11} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 5" />
              <circle cx="64" cy="64" r={R} fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - (score ?? 0) / 100)} className="ring-anim score-ring" style={{ '--circ': CIRC }} />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div>
                <CountUp value={score} className="block text-6xl font-bold leading-none" />
                <div className="mt-1 text-xs text-muted">out of 100</div>
              </div>
            </div>
          </div>
          <p className="mt-3 inline-block rounded-full bg-panel-2 px-3 py-1 text-xs font-medium text-muted">
            {sitePages > 1 ? `Average of ${sitePages} pages` : hasPerf ? `Includes performance (${PERFORMANCE_WEIGHT} pts)` : 'This page only'}
          </p>
          {crawling && <p className="mt-1 animate-pulse text-xs text-accent">Auditing every page… {siteCrawl.done}/{siteCrawl.max} · score updates when done</p>}
          {sitePages > 1 && hasPerf && <p className="mt-1 text-xs text-muted">Includes performance ({PERFORMANCE_WEIGHT} pts)</p>}
          {hasPerf && <p className="mt-1 text-xs text-muted">HTML audit alone: <b className="text-ink">{report.htmlScore}</b></p>}
        </div>

        <div>
          <h2 className="text-2xl">Grade {grade} <span className="text-lg font-normal text-muted">· {gradeLabel}</span></h2>
          <p className="mt-1 text-sm text-muted">
            Rubric {report.rubricVersion} · {coverage.evaluated} of {coverage.total} checks evaluated ·{' '}
            {Math.round(scoring.pointsEarned * 10) / 10}/{scoring.pointsPossible} applicable points
          </p>

          <ul className="mt-5 space-y-1">
            {report.sections.filter((s) => !EXTRA_SECTIONS.includes(s.name)).map((sec) => (
              <li key={sec.name}>
                <Link href={`/report/${sec.slug}`} className="group -mx-3 block rounded-xl px-3 py-2 transition hover:bg-panel-2">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="font-medium transition group-hover:text-accent">{sec.name}</span>
                    <span className="tabular-nums text-sm text-muted">
                      <b className={`text-base ${tone(sec.score)}`}>{sec.score ?? 'n/a'}</b>{sec.score !== null && ' / 100'}
                      <span className="ml-2 hidden text-xs sm:inline">{sec.pages > 1 ? `avg of ${sec.pages} pages` : `${sec.earned}/${sec.possible} pts`}</span>
                    </span>
                  </div>
                  <Bar value={sec.score} color={toneBg(sec.score)} />
                </Link>
              </li>
            ))}

            <li className="mt-2 border-t border-line pt-3">
              {['Security & infrastructure', 'Sitemap & robots'].map((name) => {
                const x = report.sections.find((s) => s.name === name);
                if (!x) return null;
                return (
                  <Link key={name} href={`/report/${x.slug}`} className="group -mx-3 mb-3 block rounded-xl px-3 py-2 transition hover:bg-panel-2">
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="font-medium transition group-hover:text-accent">{name} <span className="text-xs font-normal text-muted">live check</span></span>
                      <span className="tabular-nums text-sm text-muted">
                        <b className={`text-base ${tone(x.score)}`}>{x.score}</b> / 100
                        <span className="ml-2 hidden text-xs sm:inline">{x.earned}/{x.possible} pts</span>
                      </span>
                    </div>
                    <Bar value={x.score} color={toneBg(x.score)} />
                  </Link>
                );
              })}
              {siteSection && (
                <Link href="/report/site-crawl" className="group -mx-3 mb-3 block rounded-xl px-3 py-2 transition hover:bg-panel-2">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="font-medium transition group-hover:text-accent">Site health <span className="text-xs font-normal text-muted">crawl</span></span>
                    <span className="tabular-nums text-sm text-muted">
                      <b className={`text-base ${tone(siteSection.score)}`}>{siteSection.score}</b> / 100
                      <span className="ml-2 hidden text-xs sm:inline">{siteSection.earned}/{siteSection.possible} pts</span>
                    </span>
                  </div>
                  <Bar value={siteSection.score} color={toneBg(siteSection.score)} />
                  <p className="mt-1.5 text-xs text-muted">{siteSection.counts?.crawled} pages crawled · {siteSection.counts?.errors} errors · {siteSection.counts?.duplicateTitles} duplicate titles</p>
                </Link>
              )}
              {linkSection ? (
                <Link href="/report/broken-links" className="group -mx-3 mb-3 block rounded-xl px-3 py-2 transition hover:bg-panel-2">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="font-medium transition group-hover:text-accent">Link health <span className="text-xs font-normal text-muted">live check</span></span>
                    <span className="tabular-nums text-sm text-muted">
                      <b className={`text-base ${tone(linkSection.score)}`}>{linkSection.score}</b> / 100
                      <span className="ml-2 hidden text-xs sm:inline">{linkSection.earned}/{linkSection.possible} pts</span>
                    </span>
                  </div>
                  <Bar value={linkSection.score} color={toneBg(linkSection.score)} />
                  <p className="mt-1.5 text-xs text-muted">
                    {linkSection.summary?.broken || 0} broken · {linkSection.summary?.redirect || 0} redirects · {linkSection.summary?.total || 0} checked
                  </p>
                </Link>
              ) : linkCheck.status === 'running' ? (
                <div className="mb-3 py-2">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="font-medium">Link health <span className="text-xs font-normal text-muted">live check</span></span>
                    <span className="flex items-center gap-2 text-sm text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" />Checking {linkCheck.done}/{linkCheck.total}…</span>
                  </div>
                  <Bar value={linkCheck.total ? (linkCheck.done / linkCheck.total) * 100 : 0} color="bg-gradient-to-r from-accent to-accent-2" />
                </div>
              ) : null}
              {hasPerf && perfSection ? (
                <Link href="/report/performance" className="group -mx-3 block rounded-xl px-3 py-2 transition hover:bg-panel-2">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="font-medium transition group-hover:text-accent">Performance <span className="text-xs font-normal text-muted">Lighthouse lab</span></span>
                    <span className="tabular-nums text-sm text-muted">
                      <b className="text-base text-ink">{perfSection.score}</b> / 100
                      <span className="ml-2 hidden text-xs sm:inline">{perfSection.earned}/{perfSection.possible} pts</span>
                    </span>
                  </div>
                  <Bar value={perfSection.score} color={perfTone(perfSection.score)} />
                  <p className="mt-1.5 text-xs text-muted">
                    Mobile <b className="text-ink">{perfSection.mobile ?? '—'}</b> · Desktop <b className="text-ink">{perfSection.desktop ?? '—'}</b> · averaged
                  </p>
                </Link>
              ) : loading ? (
                <div className="px-0 py-2">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="font-medium">Performance <span className="text-xs font-normal text-muted">Lighthouse lab</span></span>
                    <span className="flex items-center gap-2 text-sm text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" />Testing mobile &amp; desktop…</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-panel-2">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-accent to-accent-2" />
                  </div>
                  <p className="mt-2 text-xs text-muted">The overall score will update automatically when the test finishes (usually 15–45 s).</p>
                </div>
              ) : (
                <div className="px-0 py-2">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="font-medium">Performance <span className="text-xs font-normal text-muted">Lighthouse lab</span></span>
                    <span className="text-sm text-muted">{perf.status === 'error' ? 'Unavailable' : 'Not tested yet'}</span>
                  </div>
                  <Bar value={0} color="bg-line" dashed />
                  <p className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-muted">
                    {perf.status === 'error' ? perf.error : `Adds ${PERFORMANCE_WEIGHT} points to the overall score once tested.`}
                    <button type="button" onClick={() => runPerformance(base.url)} className="btn btn-primary no-print px-3 py-1.5 text-xs">
                      {perf.status === 'error' ? 'Retry' : 'Run test now'}
                    </button>
                  </p>
                </div>
              )}
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
