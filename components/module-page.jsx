'use client';

import Link from 'next/link';
import { useReport } from './report-context';
import CheckList from './check-list';
import CountUp from './count-up';
import { DETAILS } from './module-details';
import { MODULES, moduleChecks, moduleStatus } from '@/lib/modules';
import { STATUS_STYLE } from './labels';
import { scoreChecks } from '@/lib/scoring-engine';

export function PageHead({ eyebrow, title, children }) {
  return (
    <header className="rise">
      <p className="eyebrow text-accent">{eyebrow}</p>
      <h1 className="mt-1.5 text-3xl sm:text-4xl">{title}</h1>
      {children}
    </header>
  );
}

const tone = (s) => (s === null ? 'text-muted' : s >= 80 ? 'text-good' : s >= 60 ? 'text-warn' : 'text-bad');
const toneBg = (s) => (s === null ? 'bg-line' : s >= 80 ? 'bg-good' : s >= 60 ? 'bg-warn' : 'bg-bad');

export default function ModulePage({ slug }) {
  const { report } = useReport();
  const index = MODULES.findIndex((m) => m.slug === slug);
  const mod = MODULES[index];
  if (!report || !mod) return null;

  const status = moduleStatus(mod, report.checks);
  const st = STATUS_STYLE[status];
  const Detail = DETAILS[slug];
  const prev = MODULES[index - 1];
  const next = MODULES[index + 1];
  const ms = scoreChecks(moduleChecks(mod, report.checks));

  return (
    <article>
      <PageHead eyebrow={`Module ${String(index + 1).padStart(2, '0')} · ${mod.section}`} title={mod.label}>
        <p className="mt-2 max-w-2xl text-muted">{mod.summary}</p>
      </PageHead>

      <div className="card rise mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
        <div className="flex items-end gap-1">
          <CountUp value={ms.score} className={`text-5xl font-bold leading-none ${tone(ms.score)}`} />
          <span className="pb-1 text-lg text-muted">/ 100</span>
        </div>
        <div className="min-w-[10rem] flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-panel-2">
            <div className={`h-full rounded-full ${toneBg(ms.score)}`} style={{ width: `${ms.score ?? 0}%`, animation: 'bar 0.9s ease-out both' }} />
          </div>
          <p className="mt-1.5 text-sm text-muted">
            {ms.score === null ? 'Advisory module — no points attached' : `${ms.earned}/${ms.possible} points on this page`}
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full bg-current/10 px-3 py-1 text-sm font-semibold ${st.text}`}>
          <span className={`h-2 w-2 rounded-full ${st.dot}`} />
          {st.label}
        </span>
      </div>

      <div className="rise mt-6">
        <CheckList checks={moduleChecks(mod, report.checks)} />
      </div>

      {Detail && <Detail r={report} />}

      <nav aria-label="Module pagination" className="no-print mt-14 grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link href={`/report/${prev.slug}`} className="card card-hover p-4 text-sm">
            <span className="eyebrow">Previous</span><span className="mt-0.5 block font-semibold">← {prev.label}</span>
          </Link>
        ) : (
          <Link href="/report" className="card card-hover p-4 text-sm">
            <span className="eyebrow">Back to</span><span className="mt-0.5 block font-semibold">← Overview</span>
          </Link>
        )}
        {next ? (
          <Link href={`/report/${next.slug}`} className="card card-hover p-4 text-right text-sm">
            <span className="eyebrow">Next</span><span className="mt-0.5 block font-semibold">{next.label} →</span>
          </Link>
        ) : (
          <Link href="/report/performance" className="card card-hover p-4 text-right text-sm">
            <span className="eyebrow">Next</span><span className="mt-0.5 block font-semibold">Performance →</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
