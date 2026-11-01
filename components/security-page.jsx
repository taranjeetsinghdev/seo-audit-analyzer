'use client';

import { useReport } from './report-context';
import { PageHead } from './module-page';
import CountUp from './count-up';

const ST = {
  pass: { label: 'Pass', text: 'text-good', dot: 'bg-good' },
  warn: { label: 'Warning', text: 'text-warn', dot: 'bg-warn' },
  fail: { label: 'Fail', text: 'text-bad', dot: 'bg-bad' },
  na: { label: 'N/A', text: 'text-muted', dot: 'bg-line' },
};
const GROUPS = [
  ['HTTPS & certificate', 'Encrypted connection and certificate health.'],
  ['Headers', 'Browser-side protections sent with every response.'],
];
const gradeTone = (g) => (g === 'A' || g === 'B' ? 'text-good' : g === 'C' || g === 'D' ? 'text-warn' : 'text-bad');
export default function SecurityPage() {
  const { report, security, runSecurity } = useReport();
  if (!report) return null;
  const { status, data, error } = security;
  const counts = data ? data.items.reduce((a, i) => ({ ...a, [i.status]: (a[i.status] || 0) + 1 }), {}) : {};

  return (
    <article>
      <PageHead eyebrow="Site & market" title="Security & infrastructure">
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Live checks of the domain&apos;s response headers, HTTPS and TLS certificate. Read straight from the domain: no estimates.
        </p>
      </PageHead>

      {status === 'idle' && (
        <div className="card mt-6 flex flex-wrap items-center gap-3 p-6">
          <span className="text-muted">The security audit hasn&apos;t run for this report yet.</span>
          <button type="button" className="btn btn-primary px-4 py-2" onClick={() => runSecurity(report.url)}>Run security audit</button>
        </div>
      )}

      {status === 'loading' && (
        <div role="status" aria-busy="true" className="mt-6 space-y-4">
          <span className="sr-only">Running security audit…</span>
          <div className="card flex items-center gap-6 p-6"><div className="skeleton h-28 w-28 rounded-full" /><div className="flex-1 space-y-3"><div className="skeleton h-5 w-48 rounded" /><div className="skeleton h-3 w-full rounded" /><div className="skeleton h-3 w-2/3 rounded" /></div></div>
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="card space-y-3 p-5"><div className="skeleton h-4 w-40 rounded" /><div className="skeleton h-3 w-full rounded" /><div className="skeleton h-3 w-4/5 rounded" /></div>)}
        </div>
      )}

      {status === 'error' && (
        <p role="alert" className="mt-6 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm">
          {error} <button type="button" className="ml-2 underline" onClick={() => runSecurity(report.url)}>Try again</button>
        </p>
      )}

      {status === 'done' && data && (
        <>
          <section className="rise card mt-6 flex flex-wrap items-center gap-6 p-6">
            <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-4 border-line bg-panel-2">
              <div className="text-center">
                <div className={`text-4xl font-semibold ${gradeTone(data.grade)}`}>{data.grade}</div>
                <div className="text-xs text-muted tabular-nums"><CountUp value={data.score ?? 0} />/100</div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">{data.host}</p>
              <p className="mt-0.5 text-sm text-muted">Checked {new Date(data.checkedAt).toLocaleString()}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                {['pass', 'warn', 'fail', 'na'].filter((k) => counts[k]).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-2.5 py-1">
                    <span className={`h-2 w-2 rounded-full ${ST[k].dot}`} />{counts[k]} {ST[k].label.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
            <button type="button" className="btn btn-ghost no-print px-3 py-1.5 text-xs" onClick={() => runSecurity(report.url)}>↻ Re-run</button>
          </section>

          {GROUPS.map(([group, note]) => {
            const rows = data.items.filter((i) => i.group === group);
            if (!rows.length) return null;
            return (
              <section key={group} className="mt-8">
                <h2 className="text-xl">{group}</h2>
                <p className="mt-0.5 text-sm text-muted">{note}</p>
                <ul className="card mt-3 divide-y divide-line overflow-hidden">
                  {rows.map((i) => (
                    <li key={i.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ST[i.status].dot}`} />
                        <span className="font-medium">{i.title}</span>
                        <span className={`ml-auto text-xs font-semibold ${ST[i.status].text}`}>{ST[i.status].label}</span>
                      </div>
                      <p className="mt-1 break-words pl-5 font-mono text-[13px] text-muted">{i.detail}</p>
                      {i.fix && i.status !== 'pass' && <p className="mt-1.5 pl-5 text-sm">↳ {i.fix}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <p className="mt-6 text-xs text-muted">Sources: the domain&apos;s own HTTP response and TLS handshake. This grade is a security-hygiene score and does not change the SEO score.</p>
        </>
      )}
    </article>
  );
}
