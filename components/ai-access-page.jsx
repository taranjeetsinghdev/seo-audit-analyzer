'use client';

import { useCallback, useEffect, useState } from 'react';
import { useReport } from './report-context';
import { PageHead } from './module-page';

const STATE = {
  allowed: { label: 'Allowed', text: 'text-good', dot: 'bg-good' },
  blocked: { label: 'Blocked', text: 'text-bad', dot: 'bg-bad' },
};

export default function AiAccessPage() {
  const { report } = useReport();
  const [s, setS] = useState({ status: 'idle', data: null, error: '' });

  const run = useCallback(async (url) => {
    setS({ status: 'loading', data: null, error: '' });
    try {
      const res = await fetch('/api/ai-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || 'Check unavailable.');
      setS({ status: 'done', data: j, error: '' });
    } catch (err) {
      setS({ status: 'error', data: null, error: err.message || 'Network error.' });
    }
  }, []);

  useEffect(() => {
    if (report) run(report.url);
  }, [report?.url, report?.generatedAt, run]);

  if (!report) return null;
  const { status, data, error } = s;
  const blocked = data ? data.bots.filter((b) => b.status === 'blocked').length : 0;

  return (
    <article>
      <PageHead eyebrow="Site & market" title="AI & crawler access">
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Live check of which AI and search crawlers your robots.txt lets in, whether you publish an <span className="font-mono text-xs">llms.txt</span> guide for AI
          assistants.
        </p>
      </PageHead>

      {status === 'loading' && (
        <div role="status" aria-busy="true" className="mt-6 space-y-3">
          <span className="sr-only">Checking…</span>
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="card space-y-3 p-5"><div className="skeleton h-4 w-40 rounded" /><div className="skeleton h-3 w-full rounded" /></div>)}
        </div>
      )}
      {status === 'error' && (
        <p role="alert" className="mt-6 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm">{error} <button type="button" className="ml-2 underline" onClick={() => run(report.url)}>Try again</button></p>
      )}

      {status === 'done' && data && (
        <>
          <section className="rise card mt-6 flex flex-wrap items-center gap-6 p-6">
            <div>
              <p className="text-lg font-semibold">{data.host}</p>
              <p className="mt-0.5 text-sm text-muted">{data.hasRobots ? 'robots.txt found' : 'No robots.txt — every crawler is allowed'} · checked {new Date(data.checkedAt).toLocaleTimeString()}</p>
            </div>
            <div className="ml-auto flex gap-3 text-center">
              <div className="card stat-tile px-5 py-3 text-good"><div className="text-3xl font-bold">{data.bots.length - blocked}</div><div className="text-xs text-muted">allowed</div></div>
              <div className="card stat-tile px-5 py-3 text-bad"><div className="text-3xl font-bold">{blocked}</div><div className="text-xs text-muted">blocked</div></div>
            </div>
            <button type="button" className="btn btn-ghost no-print px-3 py-1.5 text-xs" onClick={() => run(report.url)}>↻ Re-run</button>
          </section>

          <section className="mt-8">
            <h2 className="text-xl">Crawler access</h2>
            <p className="mt-0.5 text-sm text-muted">Blocking AI crawlers is a choice, not an error. This shows what your robots.txt currently does.</p>
            <ul className="card mt-3 divide-y divide-line overflow-hidden">
              {data.bots.map((b) => {
                const st = STATE[b.status];
                return (
                  <li key={b.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} />
                    <span className="font-mono text-sm font-medium">{b.name}</span>
                    <span className="text-xs text-muted">{b.owner} · {b.purpose}</span>
                    <span className={`ml-auto text-xs font-semibold ${st.text}`}>{st.label}</span>
                    <p className="w-full pl-5 text-xs text-muted">{b.note}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl">llms.txt</h2>
            <div className="card mt-3 p-4 text-sm">
              {data.llms.present ? (
                <>
                  <p className={data.llms.wellFormed ? 'font-semibold text-good' : 'font-semibold text-warn'}>
                    {data.llms.wellFormed ? '✓ /llms.txt found and well formed' : '/llms.txt found but incomplete'}
                  </p>
                  <p className="mt-1 text-muted">{data.llms.h1 ? 'Has a title heading' : 'Missing a "# Title" heading'} · {data.llms.links} link{data.llms.links === 1 ? '' : 's'} · {data.llms.bytes.toLocaleString()} characters{data.llms.full ? ' · /llms-full.txt also present' : ''}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-muted">No /llms.txt found</p>
                  <p className="mt-1 text-muted">An optional Markdown file that gives AI assistants a short, curated map of your site: a title, a summary and links to key pages. It is a proposed convention and is not required for ranking.</p>
                </>
              )}
            </div>
          </section>

          <p className="mt-6 text-xs text-muted">Sources: the site&apos;s own robots.txt and llms.txt. Nothing here changes the SEO score.</p>
        </>
      )}
    </article>
  );
}
