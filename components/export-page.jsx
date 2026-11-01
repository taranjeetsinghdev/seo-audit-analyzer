'use client';

import { useReport } from './report-context';
import { PageHead } from './module-page';
import { getDownloads } from './downloads';
import FullReport from './full-report';

export default function ExportPage() {
  const { exportReport: report } = useReport();
  if (!report) return null;

  return (
    <article>
      <div className="no-print">
        <PageHead eyebrow="Report" title="Download the full report">
          <p className="mt-2 max-w-2xl text-muted">
            Everything on every module page, in the format you need. The PDF and HTML contain the same content as the preview below.
          </p>
        </PageHead>
        <ul className="rise mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {getDownloads(report).map((d) => (
            <li key={d.key}>
              <button type="button" onClick={d.run} className="card card-hover spot group flex h-full w-full flex-col items-start p-5 text-left">
                <span className="grid h-10 min-w-12 place-items-center rounded-xl bg-accent/10 px-2 font-mono text-xs font-bold text-accent">{d.ext}</span>
                <span className="mt-3 font-semibold">{d.label}</span>
                <span className="mt-0.5 text-sm text-muted">{d.hint}</span>
                <span className="mt-3 text-sm font-medium text-accent group-hover:underline">Download →</span>
              </button>
            </li>
          ))}
        </ul>
        <h2 className="mt-12 text-xl">Preview</h2>
      </div>
      <div className="card mt-4 p-5 sm:p-8 print:border-0 print:p-0 print:shadow-none">
        <FullReport report={report} />
      </div>
    </article>
  );
}
