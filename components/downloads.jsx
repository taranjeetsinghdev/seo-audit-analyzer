'use client';

import { filenameBase, toCsv, toHtml, toIssuesCsv, toJson, toLinksCsv, toCrawlCsv, toMarkdown, toScoresCsv } from '@/lib/report-export';
import { toast } from '@/lib/toast';

function saveBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast(`Downloaded ${name}`);
}

const saveText = (name, text, type) => saveBlob(name, new Blob([text], { type: `${type};charset=utf-8` }));

/** Real PDF generated on the server; falls back to the browser print dialog if unavailable. */
async function downloadPdf(report, base) {
  toast('Generating PDF…');
  try {
    const res = await fetch('/api/report/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message || 'PDF generation failed.');
    saveBlob(`${base}.pdf`, await res.blob());
  } catch (err) {
    toast(`${err.message} Opening the print dialog instead.`);
    setTimeout(() => window.print(), 600);
  }
}

export function getDownloads(report) {
  const base = filenameBase(report);
  return [
    { key: 'pdf', ext: 'PDF', label: 'PDF report', hint: 'Paginated A4 document, ready to send or print', run: () => downloadPdf(report, base) },
    { key: 'html', ext: 'HTML', label: 'HTML report', hint: 'Self-contained page; opens in any browser, works offline', run: () => saveText(`${base}.html`, toHtml(report), 'text/html') },
    { key: 'json', ext: 'JSON', label: 'JSON data', hint: 'Complete structured report with a schema version', run: () => saveText(`${base}.json`, toJson(report), 'application/json') },
    { key: 'csv', ext: 'CSV', label: 'CSV — all checks', hint: 'One row per check; opens cleanly in Excel and Sheets', run: () => saveText(`${base}-checks.csv`, toCsv(report), 'text/csv') },
    { key: 'csv-issues', ext: 'CSV', label: 'CSV — recommendations', hint: 'Prioritised fixes, highest priority first', run: () => saveText(`${base}-recommendations.csv`, toIssuesCsv(report), 'text/csv') },
    { key: 'csv-scores', ext: 'CSV', label: 'CSV — scores', hint: 'Overall, section and performance scores', run: () => saveText(`${base}-scores.csv`, toScoresCsv(report), 'text/csv') },
    ...(report.linkCheck?.results?.length
      ? [{ key: 'csv-links', ext: 'CSV', label: 'CSV — link check', hint: 'Every link and image with its live status', run: () => saveText(`${base}-links.csv`, toLinksCsv(report), 'text/csv') }]
      : []),
    ...(report.siteCrawl?.pages?.length
      ? [{ key: 'csv-crawl', ext: 'CSV', label: 'CSV — site crawl', hint: 'Every crawled page with status and depth', run: () => saveText(`${base}-site-crawl.csv`, toCrawlCsv(report), 'text/csv') }]
      : []),
    { key: 'md', ext: 'MD', label: 'Markdown', hint: 'Paste into docs, tickets or a repository', run: () => saveText(`${base}.md`, toMarkdown(report), 'text/markdown') },
    { key: 'print', ext: 'PRINT', label: 'Print this page', hint: 'Print the on-screen preview with your browser', run: () => window.print() },
  ];
}

/** Compact dropdown used in the report header. */
export function DownloadMenu({ report }) {
  return (
    <details className="relative">
      <summary className="btn btn-primary list-none px-3.5 py-2 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>
        <span className="hidden sm:inline">Download report</span>
      </summary>
      <ul className="card absolute right-0 z-40 mt-2 w-80 p-1.5 shadow-[var(--shadow-lg)]">
        {getDownloads(report).map((d) => (
          <li key={d.key}>
            <button type="button" onClick={(e) => { d.run(); e.currentTarget.closest('details').open = false; }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-panel-2">
              <span className="grid h-8 w-11 shrink-0 place-items-center rounded-md bg-accent/10 font-mono text-[10px] font-bold text-accent">{d.ext}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{d.label}</span>
                <span className="block truncate text-xs text-muted">{d.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
