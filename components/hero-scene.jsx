'use client';

import { useEffect, useRef, useState } from 'react';

// A looping, clearly-labelled sample "live audit" built from graphs:
// a running-score line chart, a section radar, and Core Web Vitals gauges.
const TARGETS = [
  { label: 'HTTPS', long: 'HTTPS', status: 'pass', section: 'Technical', pts: 5 },
  { label: 'title', long: '<title>', status: 'pass', section: 'On-page', pts: 10 },
  { label: 'h1', long: '<h1>', status: 'pass', section: 'On-page', pts: 10 },
  { label: 'desc', long: 'meta description', status: 'pass', section: 'On-page', pts: 10 },
  { label: 'alt', long: 'image alt text', status: 'fail', section: 'Content', pts: 10 },
  { label: 'canon.', long: 'canonical', status: 'pass', section: 'Indexing', pts: 10 },
  { label: 'og', long: 'og:image', status: 'warning', section: 'Social', pts: 5 },
  { label: 'schema', long: 'JSON-LD', status: 'pass', section: 'Content', pts: 10 },
];
const SECTIONS = ['On-page', 'Indexing', 'Social', 'Content', 'Technical'];
const CREDIT = { pass: 1, warning: 0.5, fail: 0 };
const COLOR = { pass: 'text-good', warning: 'text-warn', fail: 'text-bad' };
const FILL = { pass: 'bg-good', warning: 'bg-warn', fail: 'bg-bad' };
const STEPS = ['Fetch', 'Inspect', 'Score', 'Fix'];
const N = TARGETS.length;
const SCORE_TICK = N + 1;
const LAST_TICK = SCORE_TICK + 7;

// running score after each inspected check
const RUNNING = TARGETS.map((_, i) => {
  const part = TARGETS.slice(0, i + 1);
  const p = part.reduce((a, t) => a + t.pts, 0);
  const e = part.reduce((a, t) => a + t.pts * CREDIT[t.status], 0);
  return Math.round((e / p) * 100);
});

// line chart geometry
const CW = 600;
const CH = 250;
const X0 = 56;
const X1 = 568;
const Y0 = 206; // value 0
const Y100 = 22; // value 100
const px = (i) => X0 + (i * (X1 - X0)) / (N - 1);
const py = (v) => Y0 - (v / 100) * (Y0 - Y100);

// radar geometry
const RC = 100;
const RR = 66;
const axis = (k, r) => {
  const a = (-90 + k * 72) * (Math.PI / 180);
  return [RC + r * Math.cos(a), RC + r * Math.sin(a)];
};

const GAUGES = [
  { name: 'LCP', value: '2.1 s', frac: 0.52 },
  { name: 'INP', value: '120 ms', frac: 0.24 },
  { name: 'CLS', value: '0.05', frac: 0.2 },
];
const ARC = Math.PI * 40;

function useTweened(target) {
  const [cur, setCur] = useState(target);
  const curRef = useRef(target);
  useEffect(() => {
    const from = curRef.current;
    const start = performance.now();
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - start) / 650);
      const e = 1 - (1 - t) ** 3;
      const next = target.map((v, i) => from[i] + (v - from[i]) * e);
      curRef.current = next;
      setCur(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.join(',')]);
  return cur;
}

export default function HeroScene() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTick(SCORE_TICK + 1);
      return undefined;
    }
    const timer = setInterval(() => {
      if (document.hidden) return;
      setTick((t) => (t >= LAST_TICK ? 0 : t + 1));
    }, 800);
    return () => clearInterval(timer);
  }, []);

  const scanned = Math.min(Math.max(tick - 1, 0), N);
  const active = tick >= 1 && tick <= N ? tick - 1 : -1;
  const phase = tick === 0 ? 0 : tick <= N ? 1 : tick === SCORE_TICK ? 2 : 3;
  const done = TARGETS.slice(0, scanned);
  const possible = done.reduce((a, t) => a + t.pts, 0);
  const earned = done.reduce((a, t) => a + t.pts * CREDIT[t.status], 0);
  const score = possible ? Math.round((earned / possible) * 100) : 0;
  const tone = score >= 80 ? 'text-good' : score >= 60 ? 'text-warn' : 'text-bad';

  const radarTarget = SECTIONS.map((name) => {
    const items = done.filter((t) => t.section === name);
    const p = items.reduce((a, t) => a + t.pts, 0);
    const e = items.reduce((a, t) => a + t.pts * CREDIT[t.status], 0);
    return p ? (e / p) * 100 : 0;
  });
  const radar = useTweened(radarTarget);
  const radarPts = radar.map((v, k) => axis(k, (v / 100) * RR).join(',')).join(' ');

  const narration = [
    'Fetching the page and reading its HTML…',
    active >= 0 ? `Inspecting ${TARGETS[active].long}` : 'Inspecting elements…',
    'Scoring against the 100-point rubric…',
    'Core Web Vitals measured · fixes ranked by impact',
  ][phase];

  const cursor = active >= 0 ? { x: px(active), y: py(RUNNING[active]) } : null;

  return (
    <figure aria-label="Animated example of an audit" className="hero-frame hero-in mx-auto mt-14 w-full max-w-5xl text-left">
      <div className="hero-frame-inner card relative overflow-hidden shadow-[var(--shadow-lg)]">
      <div className="scan-beam" aria-hidden />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-panel-2/60 px-4 py-3">
        <ol className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                i === phase ? 'bg-accent text-on-accent' : i < phase ? 'bg-good/15 text-good' : 'bg-surface text-muted'
              }`}>
                <span className="font-mono">{i + 1}</span>{s}
              </span>
              {i < STEPS.length - 1 && <span className="h-px w-3 bg-line" />}
            </li>
          ))}
        </ol>
        <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{narration}</p>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Sample · acme.com</span>
      </div>

      <div className="grid md:grid-cols-[1.5fr_1fr]">
        {/* running-score line chart + vitals */}
        <div className="border-b border-line p-5 md:border-b-0 md:border-r">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">Score as each check is inspected</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className={`text-4xl font-bold tabular-nums ${tone}`}>{score}</span>
                <span className="text-sm text-muted">/ 100 · {scanned} of {N} checks</span>
              </p>
            </div>
            <div className="hidden gap-3 text-[11px] text-muted sm:flex">
              {[['Pass', 'bg-good'], ['Warning', 'bg-warn'], ['Fail', 'bg-bad']].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${c}`} />{l}</span>
              ))}
            </div>
          </div>

          <svg viewBox={`0 0 ${CW} ${CH}`} className="mt-2 h-auto w-full" role="img" aria-label="Running audit score as checks are inspected">
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={v}>
                <line x1={X0 - 8} x2={X1 + 12} y1={py(v)} y2={py(v)} stroke="var(--line)" strokeDasharray={v === 0 ? '0' : '3 5'} />
                <text x={X0 - 14} y={py(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="var(--font-jb), monospace">{v}</text>
              </g>
            ))}
            {TARGETS.map((t, i) => (
              <text key={t.label} x={px(i)} y={CH - 14} textAnchor="middle" fontSize="10" fontFamily="var(--font-jb), monospace"
                fill={i === active ? 'var(--accent)' : 'var(--muted)'} fontWeight={i === active ? 700 : 400}>{t.label}</text>
            ))}

            {/* area + line segments, revealed one by one */}
            {TARGETS.slice(1).map((_, k) => {
              const i = k + 1;
              const on = i < scanned;
              const a = `${px(i - 1)},${py(RUNNING[i - 1])}`;
              const b = `${px(i)},${py(RUNNING[i])}`;
              return (
                <g key={i}>
                  <polygon points={`${px(i - 1)},${Y0} ${a} ${b} ${px(i)},${Y0}`} fill="var(--accent)"
                    style={{ opacity: on ? 0.1 : 0, transition: 'opacity 0.5s ease' }} />
                  <line x1={px(i - 1)} y1={py(RUNNING[i - 1])} x2={px(i)} y2={py(RUNNING[i])} stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
                    pathLength="1" strokeDasharray="1" style={{ strokeDashoffset: on ? 0 : 1, transition: 'stroke-dashoffset 0.5s ease' }} />
                </g>
              );
            })}
            {TARGETS.map((t, i) => (
              <circle key={t.label} cx={px(i)} cy={py(RUNNING[i])} r={i < scanned ? 6 : 0} className={COLOR[t.status]} fill="currentColor"
                stroke="var(--surface)" strokeWidth="2.5" style={{ transition: 'r 0.3s cubic-bezier(0.3,1.6,0.5,1)' }} />
            ))}

            {/* moving "inspecting" marker */}
            {cursor && (
              <g style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)`, transition: 'transform 0.5s cubic-bezier(0.3,0.9,0.4,1)' }}>
                <circle r="12" fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.5" />
                <g transform="translate(0,-26)">
                  <rect x="-44" y="-12" width="88" height="22" rx="8" fill="var(--primary)" />
                  <text textAnchor="middle" y="3" fontSize="10.5" fill="var(--on-primary)" fontFamily="var(--font-jb), monospace">{TARGETS[active].long.length > 14 ? TARGETS[active].label : TARGETS[active].long}</text>
                </g>
              </g>
            )}
          </svg>

          {/* Core Web Vitals gauges, filled in the last phase */}
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
            {GAUGES.map((g) => (
              <div key={g.name} className="text-center">
                <svg viewBox="0 0 100 58" className="mx-auto w-24" aria-hidden>
                  <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="var(--line)" strokeWidth="9" strokeLinecap="round" />
                  <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="var(--good)" strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={ARC} strokeDashoffset={phase === 3 ? ARC * (1 - g.frac) : ARC}
                    style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.2,0.7,0.2,1)' }} />
                </svg>
                <p className="-mt-1 text-xs font-semibold">{g.name} <span className={`font-mono ${phase === 3 ? 'text-good' : 'text-muted'}`}>{phase === 3 ? g.value : '—'}</span></p>
                <p className="text-[10px] text-muted">{phase === 3 ? 'Good' : 'waiting'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* section radar + top fix */}
        <div className="flex flex-col p-5">
          <p className="eyebrow">Score by section</p>
          <svg viewBox="0 0 200 200" className="mx-auto mt-1 w-full max-w-[17rem]" role="img" aria-label="Section scores radar chart">
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <polygon key={f} points={SECTIONS.map((_, k) => axis(k, RR * f).join(',')).join(' ')} fill="none" stroke="var(--line)" />
            ))}
            {SECTIONS.map((_, k) => <line key={k} x1={RC} y1={RC} x2={axis(k, RR)[0]} y2={axis(k, RR)[1]} stroke="var(--line)" />)}
            <polygon points={radarPts} fill="var(--accent)" fillOpacity="0.2" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
            {radar.map((v, k) => {
              const [x, y] = axis(k, (v / 100) * RR);
              return <circle key={k} cx={x} cy={y} r="3.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />;
            })}
            {SECTIONS.map((name, k) => {
              const [x, y] = axis(k, RR + 17);
              return <text key={name} x={x} y={y + 3} textAnchor="middle" fontSize="9.5" fill="var(--muted)" fontWeight="600">{name}</text>;
            })}
          </svg>

          <ul className="mt-3 space-y-1.5 text-xs">
            {done.slice(-3).map((t) => (
              <li key={t.label} className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${FILL[t.status]}`} />
                <span className="font-mono">{t.long}</span>
                <span className={`ml-auto font-semibold ${COLOR[t.status]}`}>{t.status === 'pass' ? 'Pass' : t.status === 'warning' ? 'Warning' : 'Fail'}</span>
              </li>
            ))}
            {done.length === 0 && <li className="text-muted">Waiting for the first check…</li>}
          </ul>

          <div className={`mt-auto rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm transition-all duration-500 ${phase === 3 ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
            <p className="eyebrow text-accent">Top fix</p>
            <p className="mt-0.5 font-medium">Add alt text to 3 images</p>
            <p className="text-xs text-muted">Content · impact medium · +5 points</p>
          </div>
        </div>
      </div>

      <figcaption className="border-t border-line px-4 py-2 text-[11px] text-muted">
        Illustrative sample. Your report uses live data from the URL you enter.
      </figcaption>
      </div>
    </figure>
  );
}
