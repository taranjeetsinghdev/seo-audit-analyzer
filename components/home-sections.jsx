'use client';

import { useEffect, useRef, useState } from 'react';
import CountUp from './count-up';

/** Renders children once scrolled into view (so counters animate when seen). */
function InView({ children, className }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={className}>{seen ? children : <span className="opacity-0">0</span>}</div>;
}

const STATS = [
  [23, '', 'report pages', 'One page per module, plus performance, links, traffic and security.'],
  [100, '', 'point rubric', 'Published weights. Pass earns full weight, warning half, fail zero.'],
  [5, '', 'download formats', 'PDF, HTML, Markdown, CSV and JSON.'],
  [0, '', 'keys or sign-ups', 'Everything runs on free, public data. No account needed.'],
];

export function StatsStrip() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {STATS.map(([n, suffix, label, hint], i) => (
        <div key={label} data-reveal style={{ '--d': `${i * 70}ms` }} className="card card-hover spot p-5">
          <InView className="text-4xl font-semibold text-accent"><CountUp value={n} duration={1100} />{suffix}</InView>
          <div className="mt-1 font-medium">{label}</div>
          <p className="mt-1 text-sm text-muted">{hint}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- module explorer ---------- */

export function ModuleExplorer({ modules }) {
  const sections = ['All', ...Array.from(new Set(modules.map((m) => m.section)))];
  const [section, setSection] = useState('All');
  const [active, setActive] = useState(null);
  const shown = modules.filter((m) => section === 'All' || m.section === section);

  return (
    <div>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter modules">
        {sections.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={section === s} onClick={() => { setSection(s); setActive(null); }}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${section === s ? 'border-accent bg-accent text-on-accent shadow-[var(--shadow-sm)]' : 'border-line bg-surface text-muted hover:border-accent/50 hover:text-ink'}`}>
            {s}
            <span className="ml-1.5 font-mono text-[11px] opacity-70">{s === 'All' ? modules.length : modules.filter((m) => m.section === s).length}</span>
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((m, i) => (
          <button key={m.slug} type="button" onClick={() => setActive(active === m.slug ? null : m.slug)} aria-expanded={active === m.slug}
            style={{ animation: `rise 0.35s ease-out ${i * 30}ms both` }}
            className={`card card-hover spot p-5 text-left ${active === m.slug ? '!border-accent shadow-[var(--shadow)]' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-panel-2 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{m.section}</span>
              <span className={`grid h-6 w-6 place-items-center rounded-full bg-panel-2 text-lg leading-none text-muted transition ${active === m.slug ? 'rotate-45 bg-accent text-on-accent' : ''}`}>+</span>
            </div>
            <h3 className="mt-3 font-semibold">{m.label}</h3>
            <p className="mt-1 text-sm text-muted">{m.summary}</p>
            {active === m.slug && m.checks?.length > 0 && (
              <p className="rise mt-3 border-t border-line pt-3 font-mono text-xs text-muted">Checks: {m.checks.join(' · ')}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- score explorer ---------- */

const PARTS = [
  { key: 'html', label: 'HTML checks', points: 102, color: 'bg-accent', text: 'text-accent', body: 'Titles, descriptions, headings, content quality, accessibility, canonical, URLs, links, images, social cards, structured data and technical signals, read from the HTML. Each check is graded strictly: thin content, generic link text or missing image sizes all lose points.' },
  { key: 'js', label: 'JavaScript rendering', points: 20, color: 'bg-accent-2', text: 'text-accent-2', body: 'Compares the server HTML with the live, rendered page: is metadata, content and are links present without JavaScript?' },
  { key: 'perf', label: 'Performance', points: 25, color: 'bg-good', text: 'text-good', body: 'Lighthouse lab score and Core Web Vitals, averaged across mobile and desktop. Added once the test finishes.' },
  { key: 'links', label: 'Link health', points: 10, color: 'bg-warn', text: 'text-warn', body: 'Share of checked links that respond correctly. Broken links reduce it.' },
  { key: 'site', label: 'Site health', points: 10, color: 'bg-bad', text: 'text-bad', body: 'Site-wide issues found by the crawl: duplicate titles, missing descriptions and thin pages.' },
  { key: 'security', label: 'Security', points: 8, color: 'bg-accent/60', text: 'text-accent', body: 'Security headers and the TLS certificate, read live from the domain.' },
  { key: 'sitemap', label: 'Sitemap & robots', points: 6, color: 'bg-good/60', text: 'text-good', body: 'robots.txt and the XML sitemap, checked against the pages the crawl found.' },
];

export function ScoreExplorer() {
  const [on, setOn] = useState({ html: true, js: true, perf: true, links: true, site: true, security: true, sitemap: true });
  const [focus, setFocus] = useState('html');
  const total = PARTS.filter((p) => on[p.key]).reduce((a, p) => a + p.points, 0);
  const f = PARTS.find((p) => p.key === focus);
  const optional = PARTS.slice(2);

  return (
    <div className="card p-6 sm:p-8" data-reveal>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl">How the score works</h2>
          <p className="mt-1 max-w-xl text-muted">Pass earns full weight, warning half, fail zero. Checks that don&apos;t apply are left out, and every report says how many ran. Toggle the optional modules to see how the weighting changes.</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-semibold tabular-nums text-accent">{total}</div>
          <div className="text-xs text-muted">weighted points in play</div>
        </div>
      </div>

      <div className="mt-6 flex h-4 overflow-hidden rounded-full bg-panel-2" role="img" aria-label="Score weighting">
        {PARTS.filter((p) => on[p.key]).map((p) => (
          <button key={p.key} type="button" onMouseEnter={() => setFocus(p.key)} onFocus={() => setFocus(p.key)} onClick={() => setFocus(p.key)}
            aria-label={`${p.label}: ${p.points} points`}
            className={`${p.color} h-full transition-all duration-500 ${focus === p.key ? 'brightness-110' : 'opacity-70 hover:opacity-100'}`} style={{ width: `${(p.points / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {PARTS.filter((p) => on[p.key]).map((p) => (
          <button key={p.key} type="button" onClick={() => setFocus(p.key)} className={`inline-flex items-center gap-2 ${focus === p.key ? 'font-semibold' : 'text-muted'}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${p.color}`} />{p.label} <span className="font-mono text-xs">{p.points}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-[1.2fr_1fr]">
        <div key={focus} className="rise">
          <p className={`font-semibold ${f.text}`}>{f.label} · {f.points} points</p>
          <p className="mt-1 text-muted">{f.body}</p>
        </div>
        <div>
          <p className="eyebrow">Optional modules</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {optional.map((p) => (
              <button key={p.key} type="button" role="switch" aria-checked={on[p.key]} onClick={() => { setOn((s) => ({ ...s, [p.key]: !s[p.key] })); setFocus(p.key); }}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${on[p.key] ? 'border-accent/50 bg-accent/10 font-medium' : 'border-line text-muted'}`}>
                <span className={`h-2 w-2 rounded-full ${on[p.key] ? p.color : 'bg-line'}`} />{p.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">It is an audit score from a published rubric, not a Google ranking score.</p>
        </div>
      </div>
    </div>
  );
}
