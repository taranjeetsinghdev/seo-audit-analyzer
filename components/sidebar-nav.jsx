'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { STATUS_STYLE } from './labels';

const ICONS = {
  Overview: 'M3 12l9-8 9 8M5 10v10h14V10',
  'Keywords overview': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  'On-page': 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5',
  Indexing: 'M4 6h16M4 12h10M4 18h6M18 14l3 3-3 3',
  Social: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  Content: 'M4 5h16M4 10h16M4 15h10M4 20h7',
  Accessibility: 'M12 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM5 9l7 1.5L19 9M12 10.5V15l-3 5M12 15l3 5',
  Rendering: 'M8 6l-5 6 5 6M16 6l5 6-5 6',
  Technical: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6 8.5 4 8l-1 3 2 1v1l-2 1 1 3 2-.5 1.5 1.5-.5 2 3 1 1-2h2l1 2 3-1-.5-2L18 16l2 .5 1-3-2-1z',
  'Site & market': 'M3 20h18M6 20V10M12 20V4M18 20v-7',
  Report: 'M7 3h8l4 4v14H7zM15 3v4h4M10 13h6M10 17h6',
};
const HINTS = { Overview: 'Score, stats & top fixes', 'Keywords overview': 'Terms, density & ideas' };
const ORDER = ['fail', 'error', 'warning', 'pass'];
const worst = (items) => ORDER.find((s) => items.some((i) => i.status === s));

function Icon({ d, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Item({ it, active, onPick }) {
  return (
    <Link href={it.href} aria-current={active ? 'page' : undefined} onClick={onPick}
      className={`snav-item group ${active ? 'is-active' : ''}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${it.status ? STATUS_STYLE[it.status]?.dot : active ? 'bg-accent' : 'bg-line group-hover:bg-muted'}`} />
      <span className="min-w-0 flex-1 truncate">{it.label}</span>
      {it.badge ? <span className="rounded-full bg-accent/15 px-1.5 text-[11px] font-semibold text-accent">{it.badge}</span> : null}
    </Link>
  );
}

/** Accordion sidebar: top-level shortcuts plus collapsible groups with status summaries and a filter. */
export default function SidebarNav({ items, pathname, groups }) {
  const top = items.filter((i) => !i.section);
  const activeGroup = items.find((i) => i.href === pathname)?.section;
  const [open, setOpen] = useState(() => new Set(activeGroup ? [activeGroup] : [groups[0]]));
  const [q, setQ] = useState('');

  // Accordion: only the group holding the current page stays open as the user navigates.
  useEffect(() => {
    if (activeGroup) setOpen(new Set([activeGroup]));
  }, [activeGroup]);

  const query = q.trim().toLowerCase();
  const view = useMemo(
    () => groups.map((g) => ({ name: g, items: items.filter((i) => i.section === g && (!query || i.label.toLowerCase().includes(query))), all: items.filter((i) => i.section === g) })).filter((g) => g.items.length),
    [items, groups, query],
  );
  const toggle = (g) => setOpen((p) => (p.has(g) ? new Set() : new Set([g])));

  return (
    <nav aria-label="Report modules" className="snav card sticky top-24 flex max-h-[calc(100dvh-7.5rem)] flex-col overflow-hidden p-0">
      <div className="border-b border-line p-2.5">
        <label className="snav-search flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-sm text-muted">
          <Icon d={ICONS['Keywords overview']} className="h-3.5 w-3.5 shrink-0" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to module…" aria-label="Filter modules"
            className="bare-input min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted" />
        </label>
        <div className="mt-2.5 grid gap-2">
          {top.map((i) => {
            const on = pathname === i.href;
            return (
              <Link key={i.href} href={i.href} aria-current={on ? 'page' : undefined} className={`snav-tile ${on ? 'is-active' : ''}`}>
                <span className="snav-tile-ico"><Icon d={ICONS[i.label]} className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-tight">{i.label}</span>
                  <span className="block truncate text-[11px] leading-tight opacity-70">{HINTS[i.label]}</span>
                </span>
                <svg viewBox="0 0 24 24" className="snav-tile-arrow h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="snav-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {view.map((g) => {
          const isOpen = !!query || open.has(g.name);
          const w = worst(g.all);
          const issues = g.all.filter((i) => i.status === 'fail' || i.status === 'warning' || i.status === 'error').length;
          return (
            <div key={g.name} className="snav-group">
              <button type="button" onClick={() => toggle(g.name)} aria-expanded={isOpen} className={`snav-head ${isOpen ? 'is-open' : ''}`}>
                <span className="snav-ico"><Icon d={ICONS[g.name]} /></span>
                <span className="min-w-0 flex-1 truncate text-left">{g.name}</span>
                {w && issues > 0 && <span className={`rounded-full bg-current/10 px-1.5 text-[11px] font-bold ${STATUS_STYLE[w].text}`}>{issues}</span>}
                {w && issues === 0 && <span className="h-1.5 w-1.5 rounded-full bg-good" title="All passing" />}
                <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
              </button>
              <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="snav-children">
                    {g.items.map((it) => <Item key={it.href} it={it} active={pathname === it.href} onPick={() => setOpen(new Set([g.name]))} />)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {view.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">No module matches “{q}”.</p>}
      </div>
    </nav>
  );
}
