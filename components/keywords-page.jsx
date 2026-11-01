'use client';

import { useEffect, useMemo, useState } from 'react';
import { useReport } from './report-context';
import { PageHead } from './module-page';
import { platformDefaults } from '@/lib/keywords';

const Chip = ({ on, label }) => (
  <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${on ? 'bg-good/15 text-good' : 'bg-panel-2 text-muted'}`}>{label}</span>
);

function Row({ k, max }) {
  return (
    <tr className="align-middle">
      <td className="py-2 pr-3 font-medium">{k.term}</td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-panel-2"><span className="block h-full rounded-full bg-accent" style={{ width: `${(k.count / max) * 100}%` }} /></span>
          <span className="w-6 text-right font-mono text-xs">{k.count}</span>
        </div>
      </td>
      <td className={`py-2 pr-3 text-right font-mono text-xs ${k.density > 3 ? 'text-warn' : ''}`}>{k.density}%</td>
      <td className="py-2">
        <span className="flex flex-wrap gap-1">
          <Chip on={k.inTitle} label="Title" /><Chip on={k.inH1} label="H1" /><Chip on={k.inDescription} label="Desc" />
          <Chip on={k.inUrl} label="URL" /><Chip on={k.inHeadings} label="H2/H3" /><Chip on={k.inAlt} label="Alt" />
        </span>
      </td>
    </tr>
  );
}

export default function KeywordsPage() {
  const { report } = useReport();
  const [ideas, setIdeas] = useState({ status: 'idle', groups: [], error: '' });
  const [copied, setCopied] = useState('');
  const [platform, setPlatform] = useState({ brand: '', topic: '', place: '' });
  const [edited, setEdited] = useState(false);
  const kw = report?.keywords;

  // The platform this report is about: brand + core topic, derived from the page (editable below).
  const defaults = useMemo(
    () => (report && kw ? platformDefaults({
      url: report.url, title: report.metadata?.title, h1: report.headings?.h1, ogSiteName: report.metadata?.og?.site_name, keywords: kw,
    }) : { brand: '', topic: '' }),
    [report, kw],
  );
  useEffect(() => {
    const place = [report?.location?.city, report?.location?.country].filter(Boolean).join(', ');
    setPlatform({ brand: defaults.brand, topic: defaults.topic, place });
    setEdited(false);
  }, [defaults.brand, defaults.topic, report?.location?.city, report?.location?.country]);

  // Fetch ideas for the platform. Depends on the *applied* query (not on the loading state), so a
  // state change can never cancel its own request.
  const [applied, setApplied] = useState(null);
  useEffect(() => {
    if (defaults.brand || defaults.topic) {
      setApplied({ brand: defaults.brand, topic: defaults.topic, place: [report?.location?.city, report?.location?.country].filter(Boolean).join(', '), n: 0 });
    }
  }, [defaults.brand, defaults.topic, report?.location?.city, report?.location?.country]);

  useEffect(() => {
    if (!applied || !report) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), 25_000);
    setIdeas({ status: 'loading', groups: [], error: '' });
    fetch('/api/keyword-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: applied.brand,
        topic: applied.topic,
        context: defaults.context,
        phrases: defaults.phrases,
        // "Perth, Australia" -> city + country; a lone name is treated as the city
        location: applied.place ? { city: applied.place.split(',')[0].trim(), country: (applied.place.split(',')[1] || report.location?.country || '').trim(), code: report.location?.code } : null,
        lang: (report.metadata?.lang || 'en').slice(0, 2),
        country: report.country?.code,
      }),
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error?.message || `Suggestions unavailable (HTTP ${r.status}).`);
        setIdeas({ status: 'done', groups: j.groups || [], error: '' });
      })
      .catch((e) => {
        if (controller.signal.reason === 'unmount') return;
        setIdeas({ status: 'error', groups: [], error: e.name === 'AbortError' ? 'The request timed out.' : e.message });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort('unmount');
    };
  }, [applied, report?.url]);

  if (!report) return null;

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (!kw?.primary) {
    return (
      <article>
        <PageHead eyebrow="Start here" title="Keywords overview" />
        <p className="card mt-6 p-6 text-muted">
          Not enough text was found on this page to build a keyword profile. If the page renders its content with JavaScript, run the analysis with
          Live rendering switched on.
        </p>
      </article>
    );
  }

  const maxCount = Math.max(...kw.keywords.map((k) => k.count), 1);
  const maxPhrase = Math.max(...kw.phrases.map((k) => k.count), 1);
  const pass = kw.checks.filter((c) => c.ok).length;

  return (
    <article>
      <PageHead eyebrow="Start here · Live from the page" title="Keywords overview">
        <p className="mt-2 max-w-2xl text-muted">
          What this page is actually about: its strongest keywords, where each one appears, and live keyword ideas from search autocomplete.
        </p>
      </PageHead>

      <section className="card rise mt-5 grid gap-5 p-5 md:grid-cols-[1fr_1fr]">
        <div>
          <p className="text-xs text-muted">Primary keyword</p>
          <p className="mt-1 text-3xl font-bold leading-tight">{kw.primary.term}</p>
          <p className="mt-1 text-sm text-muted">
            appears {kw.primary.count}× · {kw.primary.density}% of {kw.totalWords.toLocaleString()} words
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[['Words', kw.totalWords.toLocaleString()], ['Unique terms', kw.uniqueTerms.toLocaleString()], ['Placement', `${pass}/${kw.checks.length}`]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-panel-2 px-2 py-2"><dt className="text-[11px] text-muted">{k}</dt><dd className="text-lg font-bold tabular-nums">{v}</dd></div>
            ))}
          </dl>
        </div>
        <div>
          <p className="text-sm font-semibold">Where the primary keyword appears</p>
          <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
            {kw.checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${c.ok ? 'bg-good/15 text-good' : 'bg-bad/10 text-bad'}`}>{c.ok ? '✓' : '×'}</span>
                <span className={c.ok ? '' : 'text-muted'}>{c.label}</span>
              </li>
            ))}
          </ul>
          {kw.stuffed.length > 0 && (
            <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs">
              Possible over-optimisation: <b>{kw.stuffed.join(', ')}</b> exceeds 3% of the page text.
            </p>
          )}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card overflow-x-auto p-5">
          <h2 className="text-lg">Top keywords</h2>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted"><th className="pb-2">Keyword</th><th className="pb-2">Count</th><th className="pb-2 text-right">Density</th><th className="pb-2">Appears in</th></tr></thead>
            <tbody className="divide-y divide-line">{kw.keywords.slice(0, 12).map((k) => <Row key={k.term} k={k} max={maxCount} />)}</tbody>
          </table>
        </section>
        <section className="card overflow-x-auto p-5">
          <h2 className="text-lg">Top phrases</h2>
          {kw.phrases.length ? (
            <table className="mt-3 w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-muted"><th className="pb-2">Phrase</th><th className="pb-2">Count</th><th className="pb-2 text-right">Density</th><th className="pb-2">Appears in</th></tr></thead>
              <tbody className="divide-y divide-line">{kw.phrases.slice(0, 10).map((k) => <Row key={k.term} k={k} max={maxPhrase} />)}</tbody>
            </table>
          ) : <p className="mt-3 text-sm text-muted">No repeated two- or three-word phrases on this page.</p>}
        </section>
      </div>

      <section className="card mt-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg">Keyword ideas <span className="text-sm font-normal text-muted">— what people search for about this platform</span></h2>
          {ideas.status === 'loading' && <span className="flex items-center gap-2 text-sm text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" />Loading…</span>}
        </div>

        <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); setApplied({ ...platform, n: Date.now() }); setEdited(false); }}>
          <div>
            <label htmlFor="kw-brand" className="text-xs font-medium text-muted">Platform / brand name</label>
            <input id="kw-brand" value={platform.brand} onChange={(e) => { setPlatform((p) => ({ ...p, brand: e.target.value })); setEdited(true); }}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
          </div>
          <div>
            <label htmlFor="kw-topic" className="text-xs font-medium text-muted">What it does (topic)</label>
            <input id="kw-topic" value={platform.topic} onChange={(e) => { setPlatform((p) => ({ ...p, topic: e.target.value })); setEdited(true); }} placeholder="e.g. trail running shoes"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
          </div>
          <div>
            <label htmlFor="kw-place" className="text-xs font-medium text-muted">Where it operates</label>
            <input id="kw-place" value={platform.place} onChange={(e) => { setPlatform((p) => ({ ...p, place: e.target.value })); setEdited(true); }} placeholder="e.g. Perth, Australia"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
          </div>
          <button type="submit" disabled={ideas.status === 'loading' || (!platform.brand.trim() && !platform.topic.trim())} className={`btn px-4 py-2 ${edited ? 'btn-primary' : 'btn-ghost'}`}>
            {edited ? 'Update ideas' : '↻ Refresh'}
          </button>
        </form>
        <p className="mt-1.5 text-[11px] text-muted">
          Only searches that name <b className="text-ink">{platform.brand || 'the platform'}</b>{platform.topic ? <> or are about <b className="text-ink">{platform.topic}</b> in its own context</> : null}{platform.place ? <> (around <b className="text-ink">{platform.place}</b>)</> : null} are shown.
          Detected from the page; edit the fields if it guessed wrong.
        </p>

        {ideas.status === 'error' && (
          <p className="mt-3 text-sm text-muted">
            Suggestions are unavailable right now. {ideas.error}{' '}
            <button type="button" className="font-medium text-accent hover:underline" onClick={() => setApplied((a) => ({ ...a, n: Date.now() }))}>Retry</button>
          </p>
        )}
        {ideas.status === 'done' && ideas.groups.every((g) => !g.ideas.length) && (
          <p className="mt-3 rounded-lg bg-panel-2 px-3 py-2 text-sm text-muted">
            No searches about this platform were found. That usually means the brand is too small or new to appear in search suggestions. Try a broader topic above.
          </p>
        )}

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {ideas.groups.filter((g) => g.ideas.length).map((g) => (
            <div key={g.id}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</p>
              <ul className="mt-2 space-y-0.5">
                {g.ideas.map((i) => (
                  <li key={i}>
                    <button type="button" onClick={() => copy(i)} title="Copy"
                      className="group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm transition hover:bg-panel-2">
                      <span>{i}</span>
                      <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100">{copied === i ? 'copied' : 'copy'}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {g.source && <p className="mt-1.5 text-[11px] text-muted">{g.source}</p>}
            </div>
          ))}
        </div>
      </section>

      <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-muted">
        <b className="text-ink">What&apos;s here, and what isn&apos;t:</b> counts, density and placement come from this page&apos;s live text. Monthly search
        volumes and the positions a domain ranks at are paid data (or available to the owner in Google Search Console), so they aren&apos;t shown.
      </p>
    </article>
  );
}
