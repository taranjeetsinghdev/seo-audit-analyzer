'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReport } from './report-context';
import { COUNTRIES, findCountry, flagOf } from '@/lib/countries';
import { COUNTRY_FILTER } from '@/lib/features';

/** "View as a visitor from…" picker. Changing it re-runs the whole analysis from that country. */
export default function CountrySelect(props) {
  return COUNTRY_FILTER ? <CountrySelectInner {...props} /> : null;
}

function CountrySelectInner({ compact = false, align = 'right' }) {
  const { country, setCountry, status } = useReport();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef(null);
  const searchRef = useRef(null);
  const current = findCountry(country);
  const busy = status === 'loading';

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase() === needle) : COUNTRIES;
  }, [q]);

  const choose = (code) => {
    setOpen(false);
    setQ('');
    setCountry(code);
  };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} disabled={busy}
        title={current ? `Analysing as a visitor from ${current.name}` : 'Analysing worldwide'}
        className={`flex items-center gap-2 rounded-xl border border-line bg-surface text-sm font-medium transition hover:border-accent disabled:opacity-60 ${compact ? 'px-2.5 py-2' : 'px-3 py-2'}`}>
        <span className="text-base leading-none" aria-hidden>{current ? flagOf(current.code) : '🌐'}</span>
        <span className={compact ? 'hidden lg:inline' : ''}>{current ? current.name : 'Worldwide'}</span>
        <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div className={`card absolute z-50 mt-2 w-72 overflow-hidden shadow-[var(--shadow-lg)] ${align === 'left' ? 'left-0' : 'right-0'}`} style={{ animation: 'card-in 0.15s ease-out both' }}>
          <div className="border-b border-line p-2">
            <label htmlFor="country-search" className="sr-only">Search countries</label>
            <input ref={searchRef} id="country-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search country…" autoComplete="off"
              className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent" />
          </div>
          <ul role="listbox" aria-label="Country" className="max-h-72 overflow-y-auto p-1.5">
            {!q && (
              <li>
                <button type="button" role="option" aria-selected={!current} onClick={() => choose('')}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-panel-2 ${!current ? 'bg-accent/10 font-semibold text-accent' : ''}`}>
                  <span className="text-base">🌐</span> Worldwide <span className="ml-auto text-[11px] text-muted">default</span>
                </button>
              </li>
            )}
            {list.map((c) => (
              <li key={c.code}>
                <button type="button" role="option" aria-selected={current?.code === c.code} onClick={() => choose(c.code)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-panel-2 ${current?.code === c.code ? 'bg-accent/10 font-semibold text-accent' : ''}`}>
                  <span className="text-base leading-none">{flagOf(c.code)}</span>
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto font-mono text-[11px] text-muted">{c.locale}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">No country matches “{q}”.</li>}
          </ul>
          <p className="border-t border-line px-3 py-2 text-[11px] leading-snug text-muted">
            Applies that country&apos;s language, time zone and location. Re-runs the analysis.
          </p>
        </div>
      )}
    </div>
  );
}
