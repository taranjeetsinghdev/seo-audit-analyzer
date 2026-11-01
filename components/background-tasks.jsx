'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useReport } from './report-context';

/** Small floating pill showing the checks that keep running after the main audit is shown. */
export default function BackgroundTasks() {
  const { report, status, perf, linkCheck, siteCrawl, popularity, popHistory, security } = useReport();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const tasks = [
    { key: 'perf', label: 'Performance test (mobile + desktop)', state: perf.status === 'loading' ? 'run' : perf.status === 'done' ? 'done' : perf.status === 'error' ? 'fail' : 'wait' },
    { key: 'links', label: 'Broken-link check', state: linkCheck.status === 'running' ? 'run' : linkCheck.status === 'done' ? 'done' : linkCheck.status === 'error' ? 'fail' : 'wait',
      detail: linkCheck.status === 'running' && linkCheck.total ? `${linkCheck.done}/${linkCheck.total}` : '' },
    { key: 'traffic', label: 'Traffic & popularity history', state: popularity.status === 'loading' || popHistory.status === 'running' ? 'run' : popularity.status === 'done' ? 'done' : popularity.status === 'error' ? 'fail' : 'wait',
      detail: popHistory.status === 'running' ? `${Math.min(popHistory.done, 6)}/6` : '' },
    { key: 'security', label: 'Security & infrastructure audit', state: security.status === 'loading' ? 'run' : security.status === 'done' ? 'done' : security.status === 'error' ? 'fail' : 'wait' },
    { key: 'crawl', label: 'Whole-site audit (all pages, sitemap & robots)', state: siteCrawl.status === 'running' ? 'run' : siteCrawl.status === 'done' ? 'done' : siteCrawl.status === 'error' ? 'fail' : 'wait', detail: siteCrawl.status === 'running' && siteCrawl.done ? `${siteCrawl.done}/${siteCrawl.max}` : '' },
  ];
  const running = tasks.filter((t) => t.state === 'run');
  const finished = tasks.every((t) => t.state === 'done' || t.state === 'fail');

  useEffect(() => {
    if (running.length) { setAllDone(false); return undefined; }
    if (report && finished) {
      setAllDone(true);
      const t = setTimeout(() => setAllDone(false), 4000);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running.length, finished, report?.generatedAt]);

  if (!report || status === 'loading' || !pathname?.startsWith('/report') || (!running.length && !allDone)) return null;

  return (
    <div className="no-print fixed bottom-4 right-4 z-40 w-72 max-w-[calc(100vw-2rem)]" style={{ animation: 'card-in 0.3s ease-out both' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-2.5 text-left text-sm shadow-[var(--shadow-lg)] backdrop-blur">
        {running.length ? (
          <span className="relative grid h-5 w-5 place-items-center"><span className="absolute inset-0 animate-ping rounded-full bg-accent/40" /><span className="h-2.5 w-2.5 rounded-full bg-accent" /></span>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-good" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-10" /></svg>
        )}
        <span className="flex-1 font-medium">{running.length ? `Running in background · ${running.length}` : 'Background checks complete'}</span>
        <svg viewBox="0 0 24 24" className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 15l6-6 6 6" /></svg>
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 rounded-2xl border border-line bg-surface/95 p-3 text-sm shadow-[var(--shadow-lg)] backdrop-blur">
          {tasks.map((t) => (
            <li key={t.key} className="flex items-center gap-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${t.state === 'run' ? 'animate-pulse bg-accent' : t.state === 'done' ? 'bg-good' : t.state === 'fail' ? 'bg-bad' : 'bg-line'}`} />
              <span className={t.state === 'wait' ? 'text-muted' : ''}>{t.label}</span>
              {t.detail && <span className="ml-auto font-mono text-xs text-muted">{t.detail}</span>}
              {!t.detail && t.state === 'fail' && <span className="ml-auto text-xs text-bad">failed</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
