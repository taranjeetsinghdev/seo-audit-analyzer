'use client';

import { useState } from 'react';
import { useReport } from './report-context';
import { PageHead } from './module-page';
import CountUp from './count-up';

const RATING = {
  good: { label: 'Good', text: 'text-good', bg: 'bg-good' },
  'needs-improvement': { label: 'Needs improvement', text: 'text-warn', bg: 'bg-warn' },
  poor: { label: 'Poor', text: 'text-bad', bg: 'bg-bad' },
};

const NAMES = {
  lcp: ['Largest Contentful Paint', 'How fast the main content appears.'],
  inp: ['Interaction to Next Paint', 'How quickly the page responds to input.'],
  cls: ['Cumulative Layout Shift', 'How much the layout jumps while loading.'],
  fcp: ['First Contentful Paint', 'When anything first appears.'],
  ttfb: ['Time to First Byte', 'How long the server takes to respond.'],
  tbt: ['Total Blocking Time', 'Lab stand-in for responsiveness (INP is field-only).'],
  si: ['Speed Index', 'How quickly the page visually fills in.'],
};

const fmt = (name, v) =>
  v === null || v === undefined ? '—' : name === 'cls' ? String(Math.round(v * 1000) / 1000) : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`;

function Badge({ rating }) {
  const r = RATING[rating];
  if (!r) return <span className="text-xs text-muted">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${r.text}`}>
      <span className={`h-2 w-2 rounded-full ${r.bg}`} />{r.label}
    </span>
  );
}

function Distribution({ parts }) {
  if (!parts?.length) return null;
  const colors = ['bg-good', 'bg-warn', 'bg-bad'];
  return (
    <div className="flex h-1.5 w-full overflow-hidden bg-panel-2" title={`Good ${parts[0]}% · Needs improvement ${parts[1]}% · Poor ${parts[2]}%`}>
      {parts.map((p, i) => <div key={i} className={colors[i]} style={{ width: `${p}%` }} />)}
    </div>
  );
}

const R = 54;
const CIRC = 2 * Math.PI * R;

function ScoreRing({ score }) {
  const tone = score >= 90 ? 'text-good' : score >= 50 ? 'text-warn' : 'text-bad';
  return (
    <div className={`relative h-36 w-36 shrink-0 ${tone}`}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" role="img" aria-label={`Lab performance score ${score} out of 100`}>
        <circle cx="64" cy="64" r={R} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle cx="64" cy="64" r={R} fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - score / 100)} className="ring-anim" style={{ '--circ': CIRC }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div><CountUp value={score} className="block text-5xl font-bold leading-none" /><div className="mt-1 text-xs text-muted">lab score</div></div>
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const { report, perf, runPerformance } = useReport();
  const [strategy, setStrategy] = useState('mobile');
  if (!report) return null;

  const loading = perf.status === 'loading';
  const hasRun = perf.status === 'done' && perf.results;
  const data = perf.results?.[strategy];
  const run = () => runPerformance(report.url);

  return (
    <article>
      <PageHead eyebrow="Technical · Free via Google APIs" title="Performance & Core Web Vitals">
        <p className="mt-2 max-w-2xl text-muted">
          A Lighthouse lab test plus real-user field data. These are kept separate: lab shows what a
          controlled test measured now, field shows what real Chrome users experienced over 28 days.
        </p>
      </PageHead>

      <div className="rise mt-6 flex flex-wrap items-center gap-4 border-b border-line pb-6">
        <button type="button" onClick={run} disabled={loading}
          className="btn btn-primary px-5 py-2.5">
          {loading ? 'Running test…' : hasRun ? 'Re-run test' : 'Run performance test'}
        </button>
        <span className="text-sm text-muted">
          {loading
            ? 'Testing mobile and desktop together — usually 15–45 seconds.'
            : hasRun
              ? 'Mobile and desktop were tested together. Switch between them freely — no new test needed.'
              : `Runs once for mobile and desktop · ${report.url}`}
        </span>
      </div>

      {perf.status === 'error' && (
        <p role="alert" className="mt-6 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3">
          <b className="text-bad">Test failed.</b> {perf.error}
        </p>
      )}

      {perf.status === 'idle' && (
        <p className="mt-8 max-w-2xl text-muted">
          Run the test once. Nothing is sent until you click, and results are not part of the 100-point HTML score.
        </p>
      )}

      {hasRun && (
        <div className="rise">
          <div className="mt-6 grid grid-cols-2 gap-2 sm:max-w-md" role="tablist" aria-label="Device">
            {['mobile', 'desktop'].map((k) => {
              const r = perf.results[k];
              const sc = r?.lab?.score;
              return (
                <button key={k} type="button" role="tab" aria-selected={strategy === k} onClick={() => setStrategy(k)}
                  className={`rounded-xl border px-4 py-3 text-left transition active:scale-[0.98] ${strategy === k ? 'border-accent bg-accent/10 shadow-[0_0_0_3px_var(--glow-strong)]' : 'border-line bg-surface text-muted hover:border-accent/50 hover:text-ink'}`}>
                  <span className="block text-xs uppercase tracking-wider capitalize">{k}</span>
                  <span className="text-3xl font-bold">{sc ?? '—'}</span>
                  <span className="text-xs text-muted">{sc != null ? ' / 100' : r ? ' field only' : ' unavailable'}</span>
                </button>
              );
            })}
          </div>

          {!data && (
            <p className="mt-6 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3">
              <b className="text-bad">No {strategy} result.</b> {perf.errors?.[strategy] || 'This device could not be tested.'} Use “Re-run test” to try again.
            </p>
          )}

          {data && (
            <>
              {data.warnings?.length > 0 && (
                <ul className="mt-6 space-y-2">
                  {data.warnings.map((w, i) => <li key={i} className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">{w}</li>)}
                </ul>
              )}

              <p className="mt-6 text-xs text-muted">
                {data.strategy} · {data.source}{data.lighthouseVersion && ` · Lighthouse ${data.lighthouseVersion}`} ·{' '}
                {new Date(data.fetchedAt).toLocaleString()}{data.cached && ' · cached (≤1 hour)'}
              </p>

              <section className="mt-6">
                <h2 className="text-2xl">Lab test — {strategy}</h2>
                {data.lab.score === null ? (
                  <p className="mt-2 text-muted">The lab test was unavailable for this run.</p>
                ) : (
                  <div className="mt-4 grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
                    <ScoreRing score={data.lab.score} />
                    <dl className="divide-y divide-line border-y border-line">
                      {Object.entries(data.lab.metrics).map(([name, m]) => (
                        <div key={name} className="grid grid-cols-[1fr_auto_9rem] items-center gap-3 py-2.5">
                          <dt><span className="font-medium">{NAMES[name]?.[0] || name}</span><span className="block text-xs text-muted">{NAMES[name]?.[1]}</span></dt>
                          <dd className="font-mono text-sm">{m.display || fmt(name, m.value)}</dd>
                          <dd className="text-right"><Badge rating={m.rating} /></dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </section>

              <section className="mt-12">
                <h2 className="text-2xl">Field data — real users</h2>
                {data.field.available ? (
                  <>
                    <p className="mt-1 text-sm text-muted">
                      {data.field.scope === 'url' ? 'For this exact URL' : 'For the whole origin (not enough data for this URL alone)'} ·
                      75th percentile · {data.field.source}
                    </p>
                    <dl className="mt-3 divide-y divide-line border-y border-line">
                      {Object.entries(data.field.metrics).map(([name, m]) => (
                        <div key={name} className="py-3">
                          <div className="grid grid-cols-[1fr_auto_9rem] items-center gap-3">
                            <dt><span className="font-medium">{NAMES[name]?.[0] || name}</span></dt>
                            <dd className="font-mono text-sm">{fmt(name, m.p75)}</dd>
                            <dd className="text-right"><Badge rating={m.rating} /></dd>
                          </div>
                          <div className="mt-2"><Distribution parts={m.distribution} /></div>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-2 text-xs text-muted">Bars show the share of visits that were good, needs improvement and poor.</p>
                  </>
                ) : (
                  <p className="mt-2 max-w-2xl text-muted">
                    Not enough real-user data for this site. Chrome only publishes field data for pages and
                    origins with sufficient traffic, so low-traffic sites will normally show nothing here.
                  </p>
                )}
              </section>

              {data.opportunities.length > 0 && (
                <section className="mt-12">
                  <h2 className="text-2xl">Biggest opportunities</h2>
                  <ol className="mt-3 divide-y divide-line border-y border-line">
                    {data.opportunities.map((o, i) => (
                      <li key={o.id} className="grid gap-x-6 py-3 sm:grid-cols-[3rem_1fr_auto]">
                        <span className="font-bold text-2xl text-muted">{String(i + 1).padStart(2, '0')}</span>
                        <div><h3 className="font-semibold">{o.title}</h3><p className="text-sm text-muted">{o.description}</p></div>
                        <span className="font-mono text-sm text-accent">−{(o.savingsMs / 1000).toFixed(1)} s</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <p className="mt-10 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
                Lab results vary between runs and come from Google&apos;s servers, not your visitors&apos; devices.
                Treat them as diagnostics; field data reflects real experience.
              </p>
            </>
          )}
        </div>
      )}
    </article>
  );
}
