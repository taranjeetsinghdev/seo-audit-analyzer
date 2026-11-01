'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReport } from './report-context';

export default function AnalyzeForm({ large = false, initial = '' }) {
  const [url, setUrl] = useState(initial);
  const { analyze, status } = useReport();
  const router = useRouter();
  const inputRef = useRef(null);
  const loading = status === 'loading';

  // "/" focuses the URL box from anywhere (unless already typing).
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const [choosing, setChoosing] = useState(null); // bare domain awaiting an http / https choice

  const submit = (value) => {
    const v = value.trim();
    if (!v || loading) return;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return run(v);
    setChoosing(v); // no protocol typed: ask which one to analyse
  };

  const pick = (scheme) => {
    const v = `${scheme}://${choosing}`;
    setChoosing(null);
    setUrl(v);
    run(v);
  };

  const run = async (target) => {
    if (!target.trim() || loading) return;
    const running = analyze(target.trim()); // marks the run as started right away, so the next page opens on the new URL
    router.push('/report'); // the report page shows skeletons while the analysis runs
    await running;
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(url); }}
      aria-busy={loading}
      className={`relative flex w-full items-center gap-2 border border-line bg-surface transition focus-within:border-accent focus-within:shadow-[0_0_0_4px_var(--glow-strong)] ${
        large ? 'max-w-2xl rounded-2xl p-2 shadow-[var(--shadow-lg)]' : 'rounded-xl p-1'
      }`}
    >
      <svg viewBox="0 0 24 24" className={`ml-2 shrink-0 text-muted ${large ? 'h-5 w-5' : 'h-4 w-4'}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
      </svg>
      <label htmlFor={large ? 'url-hero' : 'url-bar'} className="sr-only">Page URL</label>
      <input
        ref={inputRef}
        id={large ? 'url-hero' : 'url-bar'}
        type="text"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        placeholder="Enter a page URL, e.g. example.com"
        value={url}
        onChange={(e) => { setUrl(e.target.value); setChoosing(null); }}
        className={`bare-input min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-muted/70 ${large ? 'px-1 py-2.5 text-base sm:text-lg' : 'px-1 py-1.5 text-sm'}`}
      />
      <kbd className="hidden sm:block" aria-hidden>/</kbd>
      <button type="submit" disabled={loading || !url.trim()} className={`btn btn-primary shrink-0 ${large ? 'px-6 py-3 text-base' : 'px-3.5 py-1.5'}`}>
        {loading ? 'Analyzing…' : 'Analyze'}
      </button>
      {choosing && (
        <div role="dialog" aria-label="Choose protocol" className={`absolute left-0 right-0 z-40 rounded-2xl border border-line bg-surface p-3 text-left shadow-[var(--shadow-lg)] ${large ? 'top-full mt-2' : 'top-full mt-1.5'}`} style={{ animation: 'card-in 0.2s ease-out both' }}>
          <p className="px-1 pb-2 text-sm text-muted">Which version of <b className="break-all text-ink">{choosing}</b> should be analysed?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[['https', 'Secure (recommended)', 'Encrypted, what visitors and search engines normally use.'], ['http', 'Not secure', 'Plain HTTP. Choose this to test a site without a certificate.']].map(([scheme, tag, hint]) => (
              <button key={scheme} type="button" autoFocus={scheme === 'https'} onClick={() => pick(scheme)}
                className="rounded-xl border border-line bg-panel-2/50 p-3 text-left transition hover:border-accent hover:bg-accent/5 focus-visible:border-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="break-all font-mono text-sm font-semibold">{scheme}://{choosing}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${scheme === 'https' ? 'bg-good/15 text-good' : 'bg-warn/15 text-warn'}`}>{tag}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{hint}</p>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setChoosing(null)} className="mt-2 px-1 text-xs text-muted underline">Cancel</button>
        </div>
      )}
    </form>
  );
}
