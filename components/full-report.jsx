import CheckList from './check-list';
import { IssueList, NotEvaluated } from './recommendations-panel';
import { performanceRows } from '@/lib/performance';
import { MODULES, moduleChecks, moduleStatus } from '@/lib/modules';
import { STATUS_STYLE } from './labels';

export default function FullReport({ report }) {
  return (
    <div>
      <p className="eyebrow">SEO Audit Analyzer · rubric {report.rubricVersion} · {new Date(report.generatedAt).toLocaleString()}</p>
      <h1 className="mt-1 break-all text-3xl">{report.url}</h1>
      <p className="mt-2 text-muted">
        HTTP {report.statusCode} · {report.coverage.evaluated} of {report.coverage.total} checks evaluated ·{' '}
        {report.scoring.pointsEarned}/{report.scoring.pointsPossible} applicable points
      </p>
      <p className="mt-4">
        <span className="font-bold text-6xl">{report.score ?? '–'}</span>
        <span className="ml-2 text-muted">/ 100 · Grade {report.grade} · {report.gradeLabel}</span>
      </p>

      {report.notices?.map((n, i) => (
        <p key={i} className="mt-4 rounded-xl border border-line bg-surface px-4 py-3">{n.message}</p>
      ))}

      {report.sections && (
        <>
          <h2 className="mt-10 border-t border-line pt-3 text-2xl">Score by section</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line">
            {report.sections.map((x) => (
              <div key={x.name} className="grid grid-cols-[1fr_auto_7rem] gap-3 py-2">
                <dt>{x.name}</dt>
                <dd className="font-mono">{x.score ?? 'n/a'} / 100</dd>
                <dd className="text-right text-muted">{x.earned}/{x.possible} pts</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <h2 className="mt-10 border-t border-line pt-3 text-2xl">Priority recommendations</h2>
      <div className="mt-3"><IssueList issues={report.issues} /></div>

      {MODULES.map((m, i) => {
        const st = STATUS_STYLE[moduleStatus(m, report.checks)];
        return (
          <section key={m.slug} className="mt-10">
            <h2 className="border-t border-line pt-3 text-2xl">
              {String(i + 1).padStart(2, '0')} · {m.label} <span className={`text-base ${st.text}`}>— {st.label}</span>
            </h2>
            <p className="mb-3 mt-0.5 text-muted">{m.summary}</p>
            <CheckList expanded checks={moduleChecks(m, report.checks)} />
          </section>
        );
      })}

      {(report.performance || []).map((p) => (
        <section key={p.strategy} className="mt-10">
          <h2 className="border-t border-line pt-3 text-2xl">Performance &amp; Core Web Vitals — {p.strategy}</h2>
          <p className="mb-3 mt-0.5 text-muted">
            {p.source}{p.lab.score !== null && ` · lab score ${p.lab.score}/100`}
          </p>
          <dl className="divide-y divide-line border-y border-line">
            {performanceRows(p).map((r, i) => (
              <div key={i} className="grid grid-cols-[8rem_1fr_6rem_8rem] gap-3 py-1.5 text-sm">
                <dt className="text-muted">{r[0]}</dt><dd>{r[1]}</dd><dd className="font-mono">{r[2]}</dd><dd className="text-muted">{r[3]}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <h2 className="mt-10 border-t border-line pt-3 text-2xl">Not evaluated</h2>
      <div className="mt-3"><NotEvaluated items={report.coverage.notEvaluated} /></div>
      <p className="mt-8 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">{report.disclaimer}</p>
    </div>
  );
}
