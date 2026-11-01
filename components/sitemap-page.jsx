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
const tone = (s) => (s == null ? 'text-muted' : s >= 80 ? 'text-good' : s >= 60 ? 'text-warn' : 'text-bad');

export default function SitemapPage() {
  const { report, exportReport, siteCrawl, runSiteCrawl } = useReport();
  if (!report) return null;
  const audit = exportReport?.sitemap;
  const running = siteCrawl.status === 'running';

  return (
    <article>
      <PageHead eyebrow="Site & market" title="Sitemap & robots">
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Reads the site&apos;s robots.txt and XML sitemap live, then checks them against the pages the crawl found. This score counts towards the overall score.
        </p>
      </PageHead>

      {!audit && (
        <div role="status" className="card mt-6 p-6">
          {siteCrawl.status === 'error' ? (
            <p role="alert" className="text-bad">{siteCrawl.error} <button type="button" className="ml-2 underline" onClick={() => runSiteCrawl(report.url)}>Try again</button></p>
          ) : siteCrawl.status === 'idle' ? (
            <div className="flex flex-wrap items-center gap-3"><span className="text-muted">The site crawl hasn&apos;t run yet.</span><button type="button" className="btn btn-primary px-4 py-2" onClick={() => runSiteCrawl(report.url)}>Run site crawl</button></div>
          ) : (
            <div className="space-y-3"><span className="sr-only">Reading robots.txt and the sitemap…</span><div className="skeleton h-5 w-48 rounded" /><div className="skeleton h-3 w-full rounded" /><div className="skeleton h-3 w-2/3 rounded" /><p className="text-xs text-muted">{running ? siteCrawl.message || 'Crawling…' : ''}</p></div>
          )}
        </div>
      )}

      {audit && (
        <>
          <section className="card rise mt-6 flex flex-wrap items-center gap-6 p-6">
            <div className="flex items-end gap-1"><CountUp value={audit.score} className={`text-5xl font-bold leading-none ${tone(audit.score)}`} /><span className="pb-1 text-lg text-muted">/ 100</span></div>
            <div className="text-sm text-muted">
              <p>robots.txt: <b className="text-ink">{audit.robotsFound ? 'found' : 'missing'}</b> · Sitemap: <b className="text-ink">{audit.sitemapFound ? `${audit.urls}${audit.urls >= 500 ? '+' : ''} URLs` : 'missing'}</b></p>
            </div>
          </section>
          <ul className="card mt-6 divide-y divide-line overflow-hidden">
            {audit.items.map((i) => (
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
          <p className="mt-4 text-xs text-muted">Source: the site&apos;s own robots.txt and sitemap.xml, fetched live by the crawl. Coverage is judged only when the crawl reached every page of a small site.</p>
        </>
      )}
    </article>
  );
}
