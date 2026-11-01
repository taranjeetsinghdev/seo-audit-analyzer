'use client';

import { useEffect, useMemo, useState } from 'react';
import { useReport } from './report-context';
import { PageHead } from './module-page';
import CountUp from './count-up';
import CountrySelect from './country-select';
import { findCountry, flagOf } from '@/lib/countries';
import { COUNTRY_FILTER } from '@/lib/features';

const fmt = (n) => Number(n).toLocaleString();
const SHOWN = 6; // months of history displayed
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthShort = (key) => MONTHS[Number(key.slice(5, 7)) - 1];
const monthLong = (key) => `${monthShort(key)} ${key.slice(0, 4)}`;
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n));

/** Smooth path through points (Catmull-Rom → cubic Bézier). */
function smooth(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function TrendChart({ months, animateKey }) {
  const [hover, setHover] = useState(null);
  const W = 800;
  const H = 320;
  const P = { l: 70, r: 22, t: 28, b: 42 };
  const n = months.length;
  const ranked = months.filter((m) => m.ranked);
  const lo = ranked.length ? Math.min(...ranked.map((m) => m.rank)) : 1;
  const hi = ranked.length ? Math.max(...ranked.map((m) => m.rank)) : 1;
  const pad = Math.max(1, (hi - lo) * 0.28);
  const min = Math.max(1, lo - pad);
  const max = hi + pad;
  const x = (i) => P.l + (i * (W - P.l - P.r)) / Math.max(n - 1, 1);
  const y = (r) => P.t + ((r - min) / Math.max(max - min, 1)) * (H - P.t - P.b);
  const floor = H - P.b;

  // consecutive ranked months form one smooth segment; gaps break the line
  const segs = [];
  let cur = [];
  months.forEach((m, i) => {
    if (m.ranked) cur.push([x(i), y(m.rank), i]);
    else if (cur.length) { segs.push(cur); cur = []; }
  });
  if (cur.length) segs.push(cur);

  const best = ranked.length ? ranked.reduce((a, b) => (b.rank < a.rank ? b : a)) : null;
  const worst = ranked.length ? ranked.reduce((a, b) => (b.rank > a.rank ? b : a)) : null;
  const ticks = [0, 0.33, 0.66, 1].map((f) => Math.round(min + (max - min) * f));

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round((px - P.l) / ((W - P.l - P.r) / Math.max(n - 1, 1))))));
  };
  const h = hover !== null ? months[hover] : null;
  const hx = hover !== null ? x(hover) : 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none select-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`Popularity rank for each of the last ${SHOWN} months`}>
        <defs>
          <linearGradient id="tr-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tr-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>

        {ranked.length > 0 && ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="2 6" />
            <text x={P.l - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">#{compact(t)}</text>
          </g>
        ))}
        {ranked.length > 0 && (
          <>
            <text x={P.l - 10} y={P.t - 12} textAnchor="end" fontSize="9.5" fill="var(--good)" fontWeight="700">MORE POPULAR ↑</text>
            <text x={P.l - 10} y={floor + 14} textAnchor="end" fontSize="9.5" fill="var(--muted)">LESS ↓</text>
          </>
        )}

        {months.map((m, i) => (
          <text key={m.key} x={x(i)} y={H - 14} textAnchor="middle" fontSize="11" fontWeight={hover === i ? 700 : 400} fill={hover === i ? 'var(--ink)' : 'var(--muted)'}>
            {monthShort(m.key)}
          </text>
        ))}
        {months.map((m, i) => (i === 0 || m.key.endsWith('-01')) && (
          <text key={`y${m.key}`} x={x(i)} y={H - 1} textAnchor="middle" fontSize="9" fill="var(--muted)">{m.key.slice(0, 4)}</text>
        ))}

        {/* area + line per segment */}
        {segs.map((seg, k) => {
          const d = smooth(seg.map((p) => [p[0], p[1]]));
          const area = `${d} L${seg[seg.length - 1][0].toFixed(1)},${floor} L${seg[0][0].toFixed(1)},${floor} Z`;
          return (
            <g key={`${animateKey}-${k}`}>
              <path d={area} fill="url(#tr-fill)" style={{ animation: 'fade 0.9s ease-out both' }} />
              <path d={d} fill="none" stroke="url(#tr-line)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"
                pathLength="1" strokeDasharray="1" style={{ animation: 'draw 1.1s cubic-bezier(0.2,0.7,0.2,1) both' }} />
            </g>
          );
        })}

        {/* months with no rank: hollow marker on the floor */}
        {months.map((m, i) => (!m.ranked ? (
          <g key={`n${m.key}`}>
            <circle cx={x(i)} cy={floor - 8} r="5" fill="var(--surface)" stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="2 2" />
          </g>
        ) : null))}

        {/* points */}
        {months.map((m, i) => (m.ranked ? (
          <circle key={m.key} cx={x(i)} cy={y(m.rank)} r={hover === i ? 7 : 4.6} fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.6" style={{ transition: 'r 0.15s' }} />
        ) : null))}

        {/* best / worst callouts */}
        {best && worst && best.key !== worst.key && [[best, 'Best', 'var(--good)', -14], [worst, 'Lowest', 'var(--bad)', 22]].map(([m, label, color, dy]) => {
          const i = months.findIndex((q) => q.key === m.key);
          return (
            <g key={label}>
              <text x={x(i)} y={y(m.rank) + dy} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={color}>{label} · #{compact(m.rank)}</text>
            </g>
          );
        })}

        {hover !== null && <line x1={hx} x2={hx} y1={P.t} y2={floor} stroke="var(--accent)" strokeOpacity="0.4" strokeWidth="1.5" />}
      </svg>

      {h && (
        <div className="pointer-events-none absolute top-2 z-10 min-w-[9.5rem] rounded-xl border border-line bg-surface/95 px-3.5 py-2.5 text-xs shadow-[var(--shadow-lg)] backdrop-blur"
          style={{ left: `${Math.min(74, Math.max(1, (hx / W) * 100 - 9))}%` }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{monthLong(h.key)}</p>
          {h.ranked ? (
            <p className="mt-0.5 text-lg font-bold tabular-nums">#{fmt(h.rank)}</p>
          ) : (
            <p className="mt-0.5 font-semibold text-muted">{h.error || h.unavailable ? 'Data unavailable' : 'Not ranked'}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Where a rank sits on a log scale from #1 to #6M. */
function RankMeter({ rank }) {
  const pos = Math.min(1, Math.max(0, Math.log10(Math.max(rank, 1)) / Math.log10(6_000_000)));
  const marks = [['#1', 0], ['#100', Math.log10(100)], ['#10K', Math.log10(1e4)], ['#1M', Math.log10(1e6)]].map(([l, v]) => [l, v / Math.log10(6_000_000)]);
  return (
    <div className="mt-4" aria-hidden>
      <div className="relative h-2.5 rounded-full bg-gradient-to-r from-good via-warn to-bad opacity-80">
        <span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-ink shadow-md transition-[left] duration-1000"
          style={{ left: `${pos * 100}%` }} />
      </div>
      <div className="relative mt-1.5 h-4 text-[10px] text-muted">
        {marks.map(([l, p]) => <span key={l} className="absolute -translate-x-1/2" style={{ left: `${p * 100}%` }}>{l}</span>)}
        <span className="absolute right-0">#6M</span>
      </div>
    </div>
  );
}

function Trend({ dir, size = 'text-base' }) {
  if (dir === 'up') return <span className={`font-bold text-good ${size}`}>▲</span>;
  if (dir === 'down') return <span className={`font-bold text-bad ${size}`}>▼</span>;
  return <span className={`font-bold text-muted ${size}`}>■</span>;
}

/** How strongly the site is tied to the selected country, from signals in the page (keyless, live). */
function LocalFitCard({ fit, country }) {
  if (!country) {
    return (
      <section className="card mt-3 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted"><b className="text-ink">Worldwide view.</b> Pick a country to see how strongly this site is tied to it.</p>
        <CountrySelect align="right" />
      </section>
    );
  }
  const c = findCountry(country.code);
  const tone = !fit ? 'text-muted' : fit.score >= 65 ? 'text-good' : fit.score >= 35 ? 'text-warn' : 'text-bad';
  const ICON = { match: ['✓', 'bg-good/15 text-good'], partial: ['~', 'bg-warn/15 text-warn'], neutral: ['–', 'bg-panel-2 text-muted'], none: ['×', 'bg-bad/10 text-bad'] };
  return (
    <section className="rise card mt-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-panel-2/60 px-5 py-3">
        <h2 className="text-base">Local fit in {flagOf(country.code)} {c?.name || country.name}</h2>
        <CountrySelect align="right" />
      </div>
      <div className="p-5">
        {!fit ? (
          <p className="text-sm text-muted">Re-run the analysis to evaluate this country.</p>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="text-center sm:text-left">
                <p className="text-xs uppercase tracking-wider text-muted">Local fit</p>
                <p className={`text-5xl font-extrabold leading-none tabular-nums ${tone}`}><CountUp value={fit.score} duration={900} /><span className="text-xl font-semibold text-muted"> / 100</span></p>
                <p className={`mt-1 text-sm font-semibold ${tone}`}>{fit.verdict}</p>
              </div>
              <p className="text-sm text-muted">
                {fit.matched} of {fit.signals.length} signals tie this site to {c?.name}
                {fit.conflicts ? `, and ${fit.conflicts} point to another country` : ''}. Built only from the page itself — language, domain, currency,
                phone numbers, structured data and regional links.
              </p>
            </div>
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {fit.signals.map((sg) => (
                <li key={sg.id} className="flex items-start gap-3 py-2 text-sm">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${ICON[sg.status][1]}`}>{ICON[sg.status][0]}</span>
                  <span className="font-medium">{sg.label}</span>
                  <span className="ml-auto max-w-[55%] text-right text-xs text-muted">{sg.evidence}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted">
              This measures how well the site targets {c?.name}, not how many people there visit it. No free source publishes visitor or rank data per country.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export default function TrafficPage() {
  const { report, popularity, runPopularity, popHistory, runPopHistory } = useReport();
  const { status, data, error } = popularity;
  const [showTable, setShowTable] = useState(false);

  // Load whatever hasn't been requested yet for this report (also covers restored sessions).
  useEffect(() => {
    if (report && status === 'idle') runPopularity(report.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.url, status]);
  useEffect(() => {
    if (report && popHistory.status === 'idle') runPopHistory(report.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.url, popHistory.status]);

  const months = useMemo(() => popHistory.months.slice(-SHOWN), [popHistory.months]);
  const running = popHistory.status === 'running';

  const stats = useMemo(() => {
    const ranked = months.filter((m) => m.ranked);
    if (!ranked.length) return null;
    const first = ranked[0];
    const last = ranked[ranked.length - 1];
    const ranks = ranked.map((m) => m.rank);
    const mean = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    const spread = (Math.max(...ranks) - Math.min(...ranks)) / mean;
    const change = first.rank - last.rank;
    let jump = null;
    for (let i = 1; i < ranked.length; i += 1) {
      const d = ranked[i - 1].rank - ranked[i].rank;
      if (!jump || Math.abs(d) > Math.abs(jump.d)) jump = { d, key: ranked[i].key };
    }
    return {
      first, last, change,
      pct: first.rank ? Math.round((change / first.rank) * 100) : 0,
      dir: Math.abs(change) / first.rank < 0.03 ? 'stable' : change > 0 ? 'up' : 'down',
      best: ranked.reduce((a, b) => (b.rank < a.rank ? b : a)),
      worst: ranked.reduce((a, b) => (b.rank > a.rank ? b : a)),
      volatility: spread < 0.08 ? 'Steady' : spread < 0.3 ? 'Moderate' : 'Volatile',
      jump, count: ranked.length,
    };
  }, [months]);

  if (!report) return null;
  const loading = status === 'loading';
  const found = status === 'done' && data?.found;
  const currentRank = found ? data.latest : stats?.last.rank;

  return (
    <article>
      <PageHead eyebrow="Site & market · Live, free" title="Traffic overview">
        <p className="mt-2 max-w-2xl text-muted">
          How popular this site is on the web and which way it&apos;s heading, from the Tranco popularity ranking, which combines several public traffic and link signals.
        </p>
      </PageHead>

      {status === 'idle' && (
        <div className="card mt-6 flex flex-wrap items-center gap-3 p-6">
          <span className="text-muted">Traffic data hasn&apos;t been loaded for this report yet.</span>
          <button type="button" className="btn btn-primary px-4 py-2" onClick={() => runPopularity(report.url)}>Load traffic overview</button>
        </div>
      )}

      {loading && (
        <div className="card mt-6 overflow-hidden p-6">
          <div className="skeleton h-5 w-40 rounded" />
          <div className="skeleton mt-4 h-12 w-64 rounded" />
          <div className="skeleton mt-4 h-3 w-full rounded" />
        </div>
      )}

      {status === 'error' && (
        <p role="alert" className="mt-6 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm">
          <b className="text-bad">Couldn&apos;t load traffic data.</b> {error}
          <button type="button" className="ml-3 font-medium text-accent hover:underline" onClick={() => runPopularity(report.url)}>Retry</button>
        </p>
      )}

      {/* ---- hero ---- */}
      {found && (
        <section className="rise card mt-6 overflow-hidden">
          <div className="relative p-6 sm:p-8">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
            <div className="relative grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {data.tier.label}
                </span>
                <p className="mt-3 text-xs uppercase tracking-wider text-muted">Worldwide popularity rank</p>
                <p className="mt-1 text-6xl font-extrabold leading-none tracking-tight tabular-nums sm:text-7xl">
                  <span className="gradient-text">#<CountUp value={data.latest} duration={1100} /></span>
                </p>
                <p className="mt-3 text-sm text-muted">{data.domain} · worldwide · latest list {data.to}</p>
              </div>
              <div>
                <p className="text-sm text-muted">{data.tier.note}</p>
                <RankMeter rank={data.latest} />
                <p className="mt-1 text-[11px] text-muted">Position on the web, from #1 (most visited) to #6M</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {COUNTRY_FILTER && status === 'done' && <LocalFitCard fit={report.countryFit} country={report.country} />}

      {status === 'done' && data && !data.found && (
        <div className="card rise mt-6 p-6">
          <h2 className="text-xl">Not found in the global ranking</h2>
          <p className="mt-2 max-w-2xl text-muted">
            <b>{data.checked.join(', ')}</b> {data.checked.length > 1 ? 'were' : 'was'} not found in the ranking. That&apos;s normal for most business,
            regional and new sites and says nothing about quality. It means the site is too small to be measured by public popularity lists.
          </p>
        </div>
      )}

      {/* ---- 12-month trend ---- */}
      {(found || months.length > 0) && (
        <>
          {stats && (
            <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { k: `${SHOWN}-month change`, v: stats.dir === 'stable' ? 'Stable' : `${fmt(Math.abs(stats.change))} places`, sub: stats.dir === 'up' ? `moved up (${Math.abs(stats.pct)}%)` : stats.dir === 'down' ? `moved down (${Math.abs(stats.pct)}%)` : 'no meaningful shift', dir: stats.dir },
                { k: 'Best month', v: `#${fmt(stats.best.rank)}`, sub: monthLong(stats.best.key), dir: 'up' },
                { k: 'Lowest month', v: `#${fmt(stats.worst.rank)}`, sub: monthLong(stats.worst.key), dir: 'down' },
                { k: 'Stability', v: stats.volatility, sub: `${stats.count} of ${months.length} months ranked`, dir: null },
              ].map((t) => (
                <div key={t.k} className="card card-hover p-4">
                  <dt className="text-xs text-muted">{t.k}</dt>
                  <dd className="mt-1 flex items-baseline gap-2 text-2xl font-bold tabular-nums">
                    {t.dir && <Trend dir={t.dir} size="text-sm" />}{t.v}
                  </dd>
                  <dd className="text-[11px] text-muted">{t.sub}</dd>
                </div>
              ))}
            </dl>
          )}

          <section className="card mt-3 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl">Worldwide popularity trend — last {SHOWN} months</h2>
                <p className="text-xs text-muted">One point per month. Higher on the chart means more popular.</p>
              </div>
              {running && (
                <span className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  Reading monthly rankings… {Math.min(popHistory.done, SHOWN)}/{SHOWN}
                </span>
              )}
              {!running && popHistory.status !== 'idle' && (
                <button type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={() => runPopHistory(report.url)}>↻ Reload</button>
              )}
            </div>

            {popHistory.status === 'error' && (
              <p className="mt-3 text-sm text-bad">{popHistory.error} <button type="button" className="font-medium text-accent hover:underline" onClick={() => runPopHistory(report.url)}>Retry</button></p>
            )}

            <div className="mt-4">
              {months.length === 0 && running ? (
                <div className="skeleton h-72 w-full rounded-xl" />
              ) : months.length > 0 ? (
                <TrendChart months={months} animateKey={running ? 'live' : 'final'} />
              ) : null}
            </div>

            {!running && months.length > 0 && !stats && (
              <p className="mt-3 rounded-lg bg-panel-2 px-3 py-2 text-sm text-muted">
                This site wasn&apos;t found in the ranking in any of the last {SHOWN} months, so there&apos;s no trend to plot.
              </p>
            )}

            {stats && !running && (
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  stats.dir === 'up' ? ['good', `Rising: up ${fmt(Math.abs(stats.change))} places over the period`]
                    : stats.dir === 'down' ? ['bad', `Falling: down ${fmt(Math.abs(stats.change))} places over the period`]
                    : ['muted', 'Holding steady over the period'],
                  stats.jump && Math.abs(stats.jump.d) > 0 ? [stats.jump.d > 0 ? 'good' : 'bad', `Biggest move: ${stats.jump.d > 0 ? '▲' : '▼'} ${fmt(Math.abs(stats.jump.d))} places in ${monthLong(stats.jump.key)}`] : null,
                  months.some((m) => !m.ranked) ? ['muted', `${months.filter((m) => !m.ranked).length} month(s) not ranked`] : null,
                ].filter(Boolean).map(([tone, text]) => (
                  <span key={text} className={`rounded-full border px-3 py-1 text-xs font-medium ${tone === 'good' ? 'border-good/30 bg-good/10 text-good' : tone === 'bad' ? 'border-bad/30 bg-bad/10 text-bad' : 'border-line bg-panel-2 text-muted'}`}>{text}</span>
                ))}
              </div>
            )}

            {months.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <button type="button" className="text-sm font-medium text-accent hover:underline" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
                  {showTable ? 'Hide' : 'Show'} monthly data
                </button>
                {showTable && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs uppercase tracking-wider text-muted"><th className="pb-2">Month</th><th className="pb-2 text-right">Global rank</th><th className="pb-2 text-right">vs previous</th></tr></thead>
                      <tbody className="divide-y divide-line">
                        {[...months].reverse().map((m, i, arr) => {
                          const prev = arr[i + 1];
                          const delta = m.ranked && prev?.ranked ? prev.rank - m.rank : null;
                          return (
                            <tr key={m.key}>
                              <td className="py-1.5">{monthLong(m.key)}</td>
                              <td className="py-1.5 text-right font-mono">{m.ranked ? `#${fmt(m.rank)}` : <span className="text-muted">{m.error || m.unavailable ? '—' : 'not ranked'}</span>}</td>
                              <td className={`py-1.5 text-right font-mono text-xs ${delta > 0 ? 'text-good' : delta < 0 ? 'text-bad' : 'text-muted'}`}>
                                {delta === null ? '' : delta === 0 ? '—' : `${delta > 0 ? '▲' : '▼'} ${fmt(Math.abs(delta))}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>

          <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-muted">
            {report.country && <><b className="text-ink">Note:</b> the rank and trend are worldwide: no free source publishes a per-country rank. The &quot;Local fit&quot; card above shows how strongly the site is tied to {report.country.name}. </>}
            <b className="text-ink">About this data:</b> a popularity rank from Tranco, built from several public traffic and link lists — smaller means more
            popular. It&apos;s a measure of relative size and direction, not a visitor count. {currentRank && data?.domain !== data?.requested && data?.requested && (
              <>Matched the parent domain <b>{data.domain}</b> because <b>{data.requested}</b> isn&apos;t ranked on its own.</>
            )}
          </p>
        </>
      )}
    </article>
  );
}
