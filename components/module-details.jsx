'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useReport } from './report-context';
import { LIMITS } from '@/lib/report-schema';

function Table({ rows }) {
  return (
    <dl className="divide-y divide-line border-y border-line">
      {rows.map(([k, v, mono]) => (
        <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-6">
          <dt className="text-sm text-muted">{k}</dt>
          <dd className={`min-w-0 break-words whitespace-pre-line ${mono ? 'font-mono text-[13px]' : ''} ${v ? '' : 'text-muted'}`}>{v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ title, children, note }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl">{title}</h2>
      {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const host = (u) => {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
};

function Meter({ value, min, max, unit = 'characters' }) {
  const cap = max * 1.5;
  const pct = Math.min(100, (value / cap) * 100);
  const ok = value >= min && value <= max;
  return (
    <div>
      <div className="relative h-2 bg-panel-2">
        <div className="absolute inset-y-0 bg-good/25" style={{ left: `${(min / cap) * 100}%`, width: `${((max - min) / cap) * 100}%` }} />
        <div className={`absolute inset-y-0 left-0 ${ok ? 'bg-good' : 'bg-warn'}`} style={{ width: `${pct}%`, animation: 'bar 0.7s ease-out both' }} />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {value} {unit} · heuristic range {min}–{max} (green band). Search engines may rewrite snippets.
      </p>
    </div>
  );
}

function Serp({ url, title, description }) {
  return (
    <div className="max-w-2xl border border-line bg-white p-4 text-left">
      <div className="truncate text-xs text-[#202124]">{host(url)}</div>
      <div className="mt-0.5 truncate text-xl text-[#1a0dab]">{title || 'No title found'}</div>
      <div className="mt-0.5 line-clamp-2 text-sm text-[#4d5156]">{description || 'No meta description found.'}</div>
    </div>
  );
}

function ShareCard({ image, title, description, site }) {
  return (
    <div className="max-w-md border border-line bg-surface">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[1.91/1] w-full bg-panel-2 object-cover" />
      ) : (
        <div className="grid aspect-[1.91/1] place-items-center bg-panel-2 text-sm text-muted">No image declared</div>
      )}
      <div className="p-3">
        <div className="text-xs uppercase text-muted">{site}</div>
        <div className="font-semibold">{title || '—'}</div>
        <div className="line-clamp-2 text-sm text-muted">{description || '—'}</div>
      </div>
    </div>
  );
}

const Title = ({ r }) => (
  <>
    <Block title="Search result preview"><Serp url={r.url} title={r.metadata.title} description={r.metadata.description} /></Block>
    <Block title="Length"><Meter value={r.metadata.title.length} {...LIMITS.title} /></Block>
    <Block title="Value"><p className="evidence">{r.metadata.title || '—'}</p></Block>
  </>
);

const Description = ({ r }) => (
  <>
    <Block title="Search result preview"><Serp url={r.url} title={r.metadata.title} description={r.metadata.description} /></Block>
    <Block title="Length"><Meter value={r.metadata.description.length} {...LIMITS.description} /></Block>
    <Block title="Value"><p className="evidence">{r.metadata.description || '—'}</p></Block>
  </>
);

const LEVEL = {
  1: { chip: 'bg-accent text-white', text: 'text-lg font-semibold', bar: 'bg-accent' },
  2: { chip: 'bg-accent/15 text-accent', text: 'font-medium', bar: 'bg-accent/60' },
  3: { chip: 'bg-panel-2 text-muted', text: 'text-sm', bar: 'bg-accent/30' },
};

const Headings = ({ r }) => {
  const { h1, h2, h3 } = r.headings;
  const rows = [
    ...h1.map((t) => ({ l: 1, t })),
    ...h2.slice(0, 40).map((t) => ({ l: 2, t })),
    ...h3.slice(0, 40).map((t) => ({ l: 3, t })),
  ];
  const total = h1.length + h2.length + h3.length;
  const stats = [
    ['H1', h1.length, h1.length === 1 ? 'Exactly one — ideal' : h1.length === 0 ? 'Missing' : 'More than one', h1.length === 1 ? 'text-good' : 'text-warn', 1],
    ['H2', h2.length, 'Main sections', 'text-muted', 2],
    ['H3', h3.length, 'Sub-sections', 'text-muted', 3],
    ['Words', r.content.wordCount.toLocaleString(), 'In the HTML', 'text-muted', 0],
  ];
  return (
    <>
      <Block title="Counts">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(([k, v, hint, tone, lvl]) => (
            <div key={k} className="card card-hover p-4">
              <div className="flex items-center justify-between">
                <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${lvl ? LEVEL[lvl].chip : 'bg-panel-2 text-muted'}`}>{k}</span>
                <span className={`text-xs ${tone}`}>{hint}</span>
              </div>
              <div className="mt-3 text-3xl font-semibold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        {total > 0 && (
          <div className="mt-3" aria-hidden>
            <div className="flex h-2 overflow-hidden rounded-full bg-panel-2">
              {[[h1.length, 1], [h2.length, 2], [h3.length, 3]].map(([n, l]) => n > 0 && (
                <div key={l} className={LEVEL[l].bar} style={{ width: `${(n / total) * 100}%`, animation: 'bar 0.7s ease-out both' }} />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">Share of headings by level</p>
          </div>
        )}
      </Block>
      <Block title="Heading outline" note="Grouped by level; shows up to 40 H2 and H3 entries.">
        {rows.length === 0 ? (
          <p className="card p-4 text-muted">No H1–H3 headings found.</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {rows.map((h, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-panel-2/60" style={{ paddingLeft: `${1 + (h.l - 1) * 1.75}rem` }}>
                {h.l > 1 && <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-line" />}
                <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${LEVEL[h.l].chip}`}>H{h.l}</span>
                <span className={`min-w-0 break-words ${LEVEL[h.l].text} ${h.t ? '' : 'italic text-muted'}`}>{h.t || '(empty)'}</span>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
};

const norm = (u) => (u || '').replace(/\/+$/, '').toLowerCase();

const Canonical = ({ r }) => {
  const m = r.metadata;
  const match = m.canonical ? (norm(m.canonical) === norm(r.url) ? 'Matches the analyzed URL' : 'Points to a different URL (page declares another as preferred)') : '';
  return (
    <>
      <Block title="Declaration">
        <Table rows={[['Canonical', m.canonical, true], ['Analyzed URL', r.url, true], ['Comparison', match], ['Canonical tags', String(m.canonicalCount)]]} />
      </Block>
      <Block title="Alternate languages (hreflang)">
        {m.hreflang.length ? (
          <Table rows={m.hreflang.slice(0, 50).map((h) => [h.lang, h.href, true])} />
        ) : (
          <p className="text-muted">No hreflang annotations found.</p>
        )}
      </Block>
    </>
  );
};

const Robots = ({ r }) => {
  const all = [r.metadata.robots, r.metadata.googlebot, r.response.xRobotsTag].filter(Boolean).join(', ').toLowerCase();
  const flags = ['noindex', 'nofollow', 'noarchive', 'nosnippet', 'none'].filter((f) => all.includes(f));
  return (
    <>
      <Block title="Directives found">
        <Table rows={[['meta robots', r.metadata.robots, true], ['meta googlebot', r.metadata.googlebot, true], ['X-Robots-Tag header', r.response.xRobotsTag, true]]} />
      </Block>
      <Block title="Interpretation">
        <p>{flags.length ? <>Restrictive directives present: <b>{flags.join(', ')}</b>.</> : 'No restrictive directives found; defaults (index, follow) apply.'}</p>
        <p className="mt-2 text-sm text-muted">robots.txt is not fetched in this phase, so crawl blocking is not evaluated.</p>
      </Block>
    </>
  );
};

const OpenGraph = ({ r }) => {
  const og = r.metadata.og;
  return (
    <>
      <Block title="Share preview"><ShareCard image={og.image} title={og.title || r.metadata.title} description={og.description || r.metadata.description} site={host(og.url || r.url)} /></Block>
      <Block title="All og: tags">
        {Object.keys(og).length ? <Table rows={Object.entries(og).map(([k, v]) => [`og:${k}`, v, true])} /> : <p className="text-muted">No Open Graph tags found.</p>}
      </Block>
    </>
  );
};

const Twitter = ({ r }) => {
  const tw = r.metadata.twitter;
  const og = r.metadata.og;
  return (
    <>
      <Block title="Share preview" note="Missing Twitter values fall back to Open Graph where platforms support it.">
        <ShareCard image={tw.image || og.image} title={tw.title || og.title || r.metadata.title} description={tw.description || og.description || r.metadata.description} site={host(r.url)} />
      </Block>
      <Block title="All twitter: tags">
        {Object.keys(tw).length ? <Table rows={Object.entries(tw).map(([k, v]) => [`twitter:${k}`, v, true])} /> : <p className="text-muted">No Twitter Card tags found.</p>}
      </Block>
    </>
  );
};

const Images = ({ r }) => {
  const [onlyMissing, setOnlyMissing] = useState(false);
  const { images } = r;
  const rows = images.items.filter((i) => !onlyMissing || (!i.hasAlt && !i.decorative));
  return (
    <>
      <Block title="Summary">
        <Table rows={[['Images found', String(images.total)], ['Missing alt attribute', String(images.missingAlt)], ['Empty alt (decorative)', String(images.emptyAlt)]]} />
      </Block>
      <Block title="Image list">
        <label className="mb-3 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Only images missing alt
        </label>
        <ul className="max-h-[32rem] overflow-auto border-y border-line">
          {rows.map((img, i) => (
            <li key={i} className="flex gap-3 border-b border-line py-2.5 last:border-0">
              <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${img.hasAlt ? 'bg-good' : img.decorative ? 'bg-line' : 'bg-bad'}`} />
              <span className="min-w-0">
                <span className="block truncate font-mono text-xs text-muted">{img.src || '(no src)'}</span>
                <span className={img.hasAlt || img.decorative ? '' : 'text-bad'}>{img.hasAlt ? img.alt || '(decorative — empty alt)' : img.decorative ? 'No alt (presentational / tracking image — not counted)' : 'Missing alt attribute'}</span>
              </span>
            </li>
          ))}
          {rows.length === 0 && <li className="py-6 text-center text-muted">Nothing to show.</li>}
        </ul>
        {images.total > images.items.length && <p className="mt-2 text-xs text-muted">Showing first {images.items.length} of {images.total}.</p>}
      </Block>
    </>
  );
};

const Links = ({ r }) => {
  const [mode, setMode] = useState('all');
  const { links } = r;
  const rows = links.items.filter((l) => mode === 'all' || (mode === 'internal') === l.internal);
  return (
    <>
      <Block title="Summary">
        <Table rows={[['Total links', String(links.total)], ['Internal', String(links.internal)], ['External', String(links.external)], ['Nofollow', String(links.nofollow)]]} />
      </Block>
      <Block title="Link list" note="Link status is not checked; broken-link detection arrives with the crawler (Phase 3).">
        <div className="mb-3 flex gap-4 text-sm">
          {['all', 'internal', 'external'].map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
              className={`border-b-2 pb-0.5 capitalize ${mode === m ? 'border-accent font-semibold text-accent' : 'border-transparent text-muted'}`}>{m}</button>
          ))}
        </div>
        <ul className="max-h-[32rem] overflow-auto border-y border-line">
          {rows.map((l, i) => (
            <li key={i} className="border-b border-line py-2 last:border-0">
              <span className="block truncate">{l.text || <em className="text-muted">(no anchor text)</em>}</span>
              <span className="block truncate font-mono text-xs text-muted">{l.href}{l.nofollow ? '  · nofollow' : ''}</span>
            </li>
          ))}
        </ul>
        {links.total > links.items.length && <p className="mt-2 text-xs text-muted">Showing first {links.items.length} of {links.total}.</p>}
      </Block>
    </>
  );
};

const Structured = ({ r }) => {
  const sd = r.structuredData;
  return (
    <Block title="JSON-LD blocks" note="Valid JSON-LD does not prove rich-result eligibility.">
      {!sd.items.length && !sd.errors.length && <p className="text-muted">No JSON-LD found.</p>}
      {sd.errors.map((e) => (
        <div key={e.index} className="mb-3 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm">
          <b className="text-bad">Block {e.index + 1} could not be parsed:</b> {e.message}
          <pre className="mt-1 overflow-auto font-mono text-xs text-muted">{e.snippet}</pre>
        </div>
      ))}
      {sd.items.map((it, i) => (
        <details key={i} className="border-b border-line py-2" open={i === 0}>
          <summary className="cursor-pointer font-medium">{it.type}</summary>
          <pre className="mt-2 max-h-80 overflow-auto bg-panel-2 p-3 font-mono text-xs">{JSON.stringify(it.data, null, 2)}</pre>
        </details>
      ))}
    </Block>
  );
};

const LAB_ORDER = [['lcp', 'LCP'], ['cls', 'CLS'], ['tbt', 'TBT'], ['fcp', 'FCP'], ['si', 'Speed Index']];
const FIELD_ORDER = [['lcp', 'LCP'], ['inp', 'INP'], ['cls', 'CLS'], ['ttfb', 'TTFB']];
const RATING_TEXT = { good: 'text-good', 'needs-improvement': 'text-warn', poor: 'text-bad' };
const fmtMetric = (name, v) => (v == null ? '—' : name === 'cls' ? String(Math.round(v * 1000) / 1000) : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);

function PerformanceSummary() {
  const { perf } = useReport();
  const results = ['mobile', 'desktop'].map((k) => perf.results?.[k]).filter(Boolean);
  return (
    <Block title="Performance & Core Web Vitals" note="Separate from the 100-point HTML score. Lab = a controlled test; field = real Chrome users.">
      {results.length === 0 ? (
        <p className="text-muted">
          Not run yet.{' '}
          <Link href="/report/performance" className="text-accent underline underline-offset-4">Run the performance test</Link>{' '}
          — one run tests both mobile and desktop.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-2 pr-4">Metric</th>
                  {results.map((p) => <th key={p.strategy} className="py-2 pr-4 capitalize">{p.strategy}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="py-2 pr-4 font-medium">Lab performance score</td>
                  {results.map((p) => <td key={p.strategy} className="py-2 pr-4 font-mono">{p.lab.score ?? '—'}{p.lab.score !== null && ' / 100'}</td>)}
                </tr>
                {LAB_ORDER.map(([k, label]) => (
                  <tr key={k}>
                    <td className="py-2 pr-4">{label} <span className="text-xs text-muted">lab</span></td>
                    {results.map((p) => {
                      const m = p.lab.metrics[k];
                      return <td key={p.strategy} className={`py-2 pr-4 font-mono ${RATING_TEXT[m?.rating] || ''}`}>{m ? fmtMetric(k, m.value) : '—'}</td>;
                    })}
                  </tr>
                ))}
                {FIELD_ORDER.map(([k, label]) => (
                  <tr key={`f${k}`}>
                    <td className="py-2 pr-4">{label} <span className="text-xs text-muted">field</span></td>
                    {results.map((p) => {
                      const m = p.field.metrics?.[k];
                      return <td key={p.strategy} className={`py-2 pr-4 font-mono ${RATING_TEXT[m?.rating] || ''}`}>{m ? fmtMetric(k, m.p75) : '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm">
            <Link href="/report/performance" className="text-accent underline underline-offset-4">Full performance report and fixes →</Link>
          </p>
        </>
      )}
    </Block>
  );
}

const Technical = ({ r }) => {
  const m = r.metadata;
  return (
    <>
      <PerformanceSummary />
      <Block title="Response">
        <Table rows={[
          ['Final URL', r.url, true],
          ['Status', `HTTP ${r.statusCode}`, true],
          ['Redirects', r.redirects.map((x) => `${x.status} → ${x.to}`).join('\n') || 'None', true],
          ['Content type', r.response.contentType, true],
          ['Encoding', r.response.contentEncoding || 'none', true],
          ['Server', r.response.server, true],
          ['Cache-Control', r.response.cacheControl, true],
          ['Size / time', `${(r.fetch.bytes / 1024).toFixed(0)} KB decoded · ${r.fetch.ms} ms`, true],
        ]} />
      </Block>
      <Block title="Document declarations">
        <Table rows={[['Protocol', r.url.startsWith('https://') ? 'HTTPS' : 'HTTP'], ['html lang', m.lang, true], ['Viewport', m.viewport, true], ['Charset', m.charset, true], ['Favicon', m.favicon, true]]} />
      </Block>
    </>
  );
};

const RESULT = {
  same: ['Same', 'text-muted'],
  added: ['Added by JavaScript', 'text-warn'],
  changed: ['Changed by JavaScript', 'text-warn'],
  removed: ['Removed by JavaScript', 'text-bad'],
};

const Rendering = ({ r }) => {
  const rd = r.render;
  const d = rd?.diff;
  return (
    <>
      <Block title="What was analysed">
        {rd?.used ? (
          <p>
            The whole report is built from the <b>live, JavaScript-rendered page</b> ({(rd.ms / 1000).toFixed(1)} s).
            {rd.rawAvailable ? ' The raw server HTML was fetched too and is compared below.' : ' The raw server HTML could not be fetched, so no comparison is available.'}
          </p>
        ) : (
          <p className="text-muted">
            Server HTML only. {rd?.reason || 'Live rendering was not used.'}
          </p>
        )}
      </Block>

      {d && (
        <>
          <Block title="How much depends on JavaScript" note="Share of visible words that exist only after JavaScript runs.">
            <div className="card p-4">
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold tabular-nums">{d.dependence}%</p>
                <p className="text-sm text-muted">
                  raw {d.wordsRaw.toLocaleString()} words → rendered {d.wordsRendered.toLocaleString()} words
                </p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-panel-2">
                <div className={`h-full rounded-full ${d.level === 'high' ? 'bg-bad' : d.level === 'moderate' ? 'bg-warn' : 'bg-good'}`}
                  style={{ width: `${Math.max(2, d.dependence)}%`, animation: 'bar 0.8s ease-out both' }} />
              </div>
              <p className="mt-2 text-xs text-muted capitalize">{d.level} JavaScript dependence</p>
            </div>
          </Block>

          <Block title="Raw HTML vs live rendered page">
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-4 py-2.5">Field</th><th className="px-4 py-2.5">Raw HTML</th><th className="px-4 py-2.5">Live rendered</th><th className="px-4 py-2.5">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {d.items.map((i) => (
                    <tr key={i.field}>
                      <td className="px-4 py-2.5 font-medium">{i.label}</td>
                      <td className="max-w-[16rem] break-words px-4 py-2.5 font-mono text-xs">{i.raw || <span className="text-muted">—</span>}</td>
                      <td className="max-w-[16rem] break-words px-4 py-2.5 font-mono text-xs">{i.rendered || <span className="text-muted">—</span>}</td>
                      <td className={`px-4 py-2.5 text-xs font-semibold ${RESULT[i.result][1]}`}>{RESULT[i.result][0]}</td>
                    </tr>
                  ))}
                  {d.counts.map((c) => (
                    <tr key={c.label}>
                      <td className="px-4 py-2.5 font-medium">{c.label}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{c.raw.toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{c.rendered.toLocaleString()}</td>
                      <td className={`px-4 py-2.5 text-xs font-semibold ${RESULT[c.result][1]}`}>{c.result === 'same' ? 'Same' : c.result === 'added' ? 'More after JavaScript' : 'Fewer after JavaScript'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>
        </>
      )}

      {rd?.used && (
        <Block title="Render health" note="Problems seen while the page was rendering.">
          {rd.consoleErrors.length + rd.failedRequests.length + rd.httpErrors.length === 0 ? (
            <p className="text-good">No console errors or failed requests.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Console errors', rd.consoleErrors.map((e) => e.text)],
                ['Failed requests', [...rd.failedRequests.map((f) => `${f.reason} — ${f.url}`), ...rd.httpErrors.map((h) => `HTTP ${h.status} — ${h.url}`)]],
              ].map(([title, rows]) => (
                <div key={title} className="card p-4">
                  <p className="font-semibold">{title} <span className="text-muted">({rows.length})</span></p>
                  <ul className="mt-2 max-h-56 space-y-1.5 overflow-auto font-mono text-xs text-muted">
                    {rows.slice(0, 12).map((t, i) => <li key={i} className="break-words">{t}</li>)}
                    {rows.length === 0 && <li>None</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Block>
      )}
    </>
  );
};

const ContentQuality = ({ r }) => {
  const st = r.content.stats;
  if (!st) return null;
  return (
    <Block title="Text statistics">
      <Table rows={[
        ['Words', r.content.wordCount.toLocaleString()],
        ['Reading ease (Flesch)', st.flesch == null ? 'Not measured (needs 100+ words of English)' : `${st.flesch} / 100 — ${st.flesch >= 60 ? 'plain English' : st.flesch >= 50 ? 'fairly easy' : st.flesch >= 30 ? 'difficult' : 'very difficult'}`],
        ['Average sentence length', st.sentences ? `${st.avgSentenceWords} words` : '—'],
        ['Reading time', `about ${st.readingMinutes} min`],
        ['Most repeated word', st.topTerm ? `"${st.topTerm.term}" — ${st.topTerm.count} times (${st.topTerm.pct}%)` : '—'],
      ]} />
    </Block>
  );
};

const Accessibility = ({ r }) => {
  const a = r.a11y;
  if (!a) return null;
  return (
    <Block title="What was counted" note="Judged from the page markup. Colour contrast and keyboard behaviour need a browser test and are not included.">
      <Table rows={[
        ['Form fields', `${a.fields} (${a.unlabelledFields} without a label)`],
        ['Links', `${a.links} (${a.unnamedLinks} without a name)`],
        ['Buttons', `${a.buttons} (${a.unnamedButtons} without a name)`],
        ['Landmarks', `main: ${a.hasMain ? 'yes' : 'no'}, nav: ${a.hasNav ? 'yes' : 'no'}`],
        ['Duplicate ids', String(a.duplicateIds)],
        ['Iframes', `${a.iframes} (${a.iframesNoTitle} without a title)`],
      ]} />
    </Block>
  );
};

export const DETAILS = {
  'content-quality': ContentQuality, accessibility: Accessibility,
  rendering: Rendering,
  title: Title, description: Description, headings: Headings, canonical: Canonical, robots: Robots,
  'open-graph': OpenGraph, 'twitter-cards': Twitter, images: Images, links: Links,
  'structured-data': Structured, technical: Technical,
};
