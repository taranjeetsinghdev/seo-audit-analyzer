'use client';

import { useState } from 'react';
import { CATEGORY_LABELS, STATUS_STYLE } from './labels';

const ICON = {
  pass: 'M5 12l5 5 9-10',
  warning: 'M12 8v5M12 17h.01',
  fail: 'M7 7l10 10M17 7L7 17',
  not_applicable: 'M7 12h10',
  not_evaluated: 'M7 12h10',
  error: 'M12 8v5M12 17h.01',
};

function Body({ c }) {
  return (
    <div className="grid gap-4 px-4 pb-4 pt-1 sm:grid-cols-2">
      <div>
        <p className="eyebrow">Evidence</p>
        <p className="evidence mt-1.5">{c.evidence || '—'}</p>
      </div>
      <div>
        <p className="eyebrow">Result</p>
        <p className="mt-1.5">{c.message}</p>
      </div>
      <div>
        <p className="eyebrow">Why it matters</p>
        <p className="mt-1.5 text-muted">{c.why}</p>
      </div>
      <div>
        <p className="eyebrow">Details</p>
        <p className="mt-1.5 text-muted">
          {CATEGORY_LABELS[c.category]} · impact {c.impact} · confidence {c.confidence}
        </p>
      </div>
      {c.recommendation && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 sm:col-span-2">
          <p className="eyebrow text-accent">Recommended fix</p>
          <p className="mt-1">{c.recommendation}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Evidence-first check list. Interactive accordion on screen (failing checks start open);
 * `expanded` renders everything open and static for the printable full report.
 */
export default function CheckList({ checks, expanded = false }) {
  const [open, setOpen] = useState(() => new Set(checks.filter((c) => c.status === 'fail' || c.status === 'warning').map((c) => c.id)));
  const allOpen = open.size === checks.length;

  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div>
      {!expanded && checks.length > 1 && (
        <div className="no-print mb-2 flex justify-end">
          <button type="button" className="text-sm font-medium text-accent hover:underline"
            onClick={() => setOpen(allOpen ? new Set() : new Set(checks.map((c) => c.id)))}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}
      <ul className="space-y-2.5">
        {checks.map((c) => {
          const st = STATUS_STYLE[c.status] || STATUS_STYLE.error;
          const isOpen = expanded || open.has(c.id);
          return (
            <li key={c.id} className={`card check-row print-block overflow-hidden transition-shadow hover:shadow-[var(--shadow)] ${st.text}`}>
              <button type="button" disabled={expanded} onClick={() => toggle(c.id)} aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3 pl-5 text-left text-ink disabled:cursor-default">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-current/10 ${st.text}`}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={ICON[c.status] || ICON.error} />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.title}</span>
                  <span className="block truncate text-sm text-muted">{c.evidence || c.message}</span>
                </span>
                <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:block ${st.text} bg-current/10`}>{st.label}</span>
                <span className="hidden w-16 text-right text-xs text-muted sm:block">{c.weight ? `${c.weight} pts` : 'advisory'}</span>
                {!expanded && (
                  <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                )}
              </button>
              <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden text-ink"><Body c={c} /></div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
