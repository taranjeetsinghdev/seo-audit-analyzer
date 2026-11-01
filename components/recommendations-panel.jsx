'use client';

import Link from 'next/link';
import { useReport } from './report-context';
import { PageHead } from './module-page';
import { CATEGORY_LABELS } from './labels';
import { MODULES } from '@/lib/modules';

const moduleFor = (issue) =>
  issue.category === 'performance'
    ? { slug: 'performance', label: 'Performance' }
    : issue.category === 'security'
      ? { slug: 'security', label: 'Security & infrastructure' }
      : issue.category === 'sitemap'
        ? { slug: 'sitemap', label: 'Sitemap & robots' }
        : MODULES.find((m) => m.checks.includes(issue.id));

export function IssueList({ issues }) {
  if (!issues.length) {
    return <p className="card p-6 text-center font-medium text-good">No failed or warning findings in the evaluated checks.</p>;
  }
  return (
    <ol className="space-y-3">
      {issues.map((i, n) => {
        const mod = moduleFor(i);
        const critical = i.severity === 'critical';
        return (
          <li key={i.id} className="card print-block flex gap-4 p-4 sm:p-5">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${critical ? 'bg-bad/10 text-bad' : 'bg-warn/10 text-warn'}`}>
              {n + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">
                {i.title}{' '}
                <span className={`ml-1 rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wider ${critical ? 'bg-bad/10 text-bad' : 'bg-warn/10 text-warn'}`}>{i.severity}</span>
              </h3>
              <p className="mt-0.5 text-muted">{i.message}</p>
              {i.evidence && <p className="evidence mt-2">{i.evidence}</p>}
              {i.recommendation && (
                <p className="mt-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
                  <span className="font-semibold text-accent">Do this: </span>{i.recommendation}
                </p>
              )}
              <p className="mt-2 text-xs text-muted">
                {CATEGORY_LABELS[i.category]} · impact {i.impact} · confidence {i.confidence}
                {mod && (
                  <>
                    {' · '}
                    <Link href={`/report/${mod.slug}`} className="no-print font-medium text-accent hover:underline">Open {mod.label} →</Link>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function NotEvaluated({ items }) {
  return (
    <ul className="card divide-y divide-line">
      {items.map((n) => (
        <li key={n.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[16rem_1fr] sm:gap-6">
          <span className="font-medium">{n.title}</span>
          <span className="text-sm text-muted">{n.reason}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RecommendationsPage() {
  const { exportReport: report, report: base, perf, runPerformance } = useReport();
  if (!report) return null;
  const perfRun = !!report.includesPerformance || (perf.results && Object.values(perf.results).some(Boolean));
  return (
    <article>
      <PageHead eyebrow="Report" title="Recommendations">
        <p className="mt-2 max-w-2xl text-muted">
          HTML findings and performance findings together, ordered by impact × confidence. Fix from the top.
        </p>
      </PageHead>
      {!perfRun && (
        <div className="no-print mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
          <span>Performance recommendations appear here once the performance test has run.</span>
          <button type="button" disabled={perf.status === 'loading'} onClick={() => runPerformance(base.url)}
            className="btn btn-primary px-3 py-1.5 text-xs">
            {perf.status === 'loading' ? 'Testing…' : 'Run performance test'}
          </button>
        </div>
      )}
      <div className="rise mt-6"><IssueList issues={report.issues} /></div>
    </article>
  );
}
