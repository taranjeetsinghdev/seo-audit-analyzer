'use client';

import AnalyzeForm from './analyze-form';
import CountrySelect from './country-select';
import { COUNTRY_FILTER } from '@/lib/features';
import { useReport } from './report-context';

export default function HomeHero() {
  const { status, error, report, progress } = useReport();

  return (
    <div className="flex flex-col items-center">
      <AnalyzeForm large />
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {COUNTRY_FILTER && (
          <div className="flex items-center gap-2 text-sm text-muted">
            View as a visitor from <CountrySelect align="left" />
          </div>
        )}
        <p className="text-sm text-muted">
          Audits analyze server-returned HTML. JavaScript-rendered content is unavailable in this Workers deployment.
        </p>
      </div>
      <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
        {/* Try */}
        {/* {SAMPLES.map((s) => (
          <button key={s} type="button"
            className="rounded-full border border-line bg-surface px-3 py-1 text-ink transition hover:border-accent hover:text-accent active:scale-95"
            onClick={() => { const running = analyze(s); router.push('/report'); running.catch(() => {}); }}>
            {s}
          </button>
        ))} */}
        {report && status !== 'loading' && (
          <a href="/report" className="ml-1 font-medium text-accent underline underline-offset-4">Open last report →</a>
        )}
      </p>

      {status === 'loading' && (() => {
        const lastCheck = [...progress].reverse().find((p) => p.stage === 'check');
        const shownScore = lastCheck?.score ?? null;
        const tone = shownScore === null ? 'text-muted' : shownScore >= 80 ? 'text-good' : shownScore >= 60 ? 'text-warn' : 'text-bad';
        return (
          <div className="rise card mt-6 w-full max-w-2xl overflow-hidden text-left" aria-live="polite">
            <div className="flex items-center gap-5 border-b border-line px-5 py-4">
              <div className={`text-5xl font-bold tabular-nums ${tone}`}>{shownScore ?? '—'}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Live score{lastCheck ? ' building…' : ' — fetching the page…'}</p>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel-2">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-200"
                    style={{ width: `${lastCheck ? (lastCheck.n / lastCheck.total) * 100 : 8}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted">{lastCheck ? `${lastCheck.n} of ${lastCheck.total} checks` : 'Waiting for the server response'}</p>
              </div>
            </div>
            <ol className="divide-y divide-line font-mono text-[13px]">
              {progress.slice(-6).map((p, i, arr) => (
                <li key={`${p.t}-${i}`} className="flex gap-3 px-5 py-1.5">
                  <span className="w-14 shrink-0 text-right text-muted">{p.t} ms</span>
                  <span className={i === arr.length - 1 ? 'text-ink' : 'text-muted'}>{p.message}</span>
                  {p.score != null && <span className="ml-auto tabular-nums text-muted">{p.score}</span>}
                </li>
              ))}
            </ol>
          </div>
        );
      })()}

      {status === 'error' && (
        <p role="alert" className="mt-6 w-full max-w-2xl rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-left">
          <b className="text-bad">Couldn&apos;t analyze that page.</b> {error}
        </p>
      )}
    </div>
  );
}
