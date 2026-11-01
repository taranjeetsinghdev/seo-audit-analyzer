'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReport } from './report-context';
import { PageHead } from './module-page';
import CountUp from './count-up';
import { collectSocial, groupByPlatform, CORE_PLATFORMS } from '@/lib/social';

const STATE = {
  valid: { label: 'Valid', text: 'text-good', dot: 'bg-good' },
  broken: { label: 'Broken', text: 'text-bad', dot: 'bg-bad' },
  unverified: { label: 'Unverified', text: 'text-warn', dot: 'bg-warn' },
  wrong: { label: 'Not a profile link', text: 'text-warn', dot: 'bg-warn' },
  checking: { label: 'Checking…', text: 'text-muted', dot: 'bg-muted animate-pulse' },
};
const KIND_NOTE = {
  share: 'This is a "share this page" button link. It does not point to your account.',
  generic: 'This only points to the network or a utility page, not to your account.',
  content: 'This points to a single post/video/repo. Link the account itself for a profile.',
  invalid: 'The address looks malformed.',
};

/** Final state for one found URL, from its format verdict and the live probe. */
function stateOf(item, probe, running) {
  if (item.kind !== 'profile') return { key: 'wrong', note: item.label || KIND_NOTE[item.kind] };
  if (!probe) return { key: running ? 'checking' : 'unverified', note: running ? 'Contacting the site…' : 'Not checked yet.' };
  if (probe.verdict === 'ok') return { key: 'valid', note: `Reachable (HTTP ${probe.status})` };
  if (probe.verdict === 'broken') return { key: 'broken', note: probe.reason };
  return { key: 'unverified', note: probe.reason };
}

export default function SocialProfilesPage() {
  const { report } = useReport();
  const found = useMemo(() => (report ? collectSocial(report) : []), [report]);
  const [probes, setProbes] = useState({});
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    const urls = found.filter((f) => f.kind === 'profile').map((f) => f.url);
    if (!urls.length) { setStatus('done'); return; }
    setStatus('running');
    setError('');
    try {
      const res = await fetch('/api/social-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls }), cache: 'no-store',
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || 'Check failed.');
      setProbes(Object.fromEntries(j.results.map((r) => [r.url, r])));
      setStatus('done');
    } catch (err) {
      setError(err.message || 'Network error.');
      setStatus('error');
    }
  }, [found]);

  useEffect(() => {
    setProbes({});
    if (report) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.generatedAt]);

  if (!report) return null;
  const running = status === 'running';
  const groups = groupByPlatform(found);
  const rows = found.map((f) => ({ ...f, st: stateOf(f, probes[f.url], running) }));
  const count = (k) => rows.filter((r) => r.st.key === k).length;
  const linkedCore = CORE_PLATFORMS.filter((p) => rows.some((r) => r.platform === p.id && r.kind === 'profile')).length;
  const missing = CORE_PLATFORMS.filter((p) => !rows.some((r) => r.platform === p.id));
  const tiles = [
    ['Networks linked', new Set(rows.map((r) => r.platform)).size, 'text-accent'],
    ['Valid profiles', count('valid'), 'text-good'],
    ['Broken', count('broken'), 'text-bad'],
    ['Need attention', count('wrong') + count('unverified'), 'text-warn'],
  ];

  const fixes = [
    ...rows.filter((r) => r.st.key === 'broken').map((r) => `Fix or remove the broken ${r.platform} link ${r.url} — ${r.st.note}.`),
    ...rows.filter((r) => r.st.key === 'wrong').map((r) => `Replace ${r.url} with the account address: ${r.st.note}`),
    ...missing.map((p) => `No ${p.name} link found on this page. Add one (and list it in your JSON-LD "sameAs") if you have an account.`),
  ];

  return (
    <article>
      <PageHead eyebrow="Social · Live profile check" title="Social profiles">
        <p className="mt-2 max-w-2xl text-muted">
          Finds every social-network link on the page (including JSON-LD <span className="font-mono text-xs">sameAs</span>), checks that each one points to a real
          account rather than a share button or homepage, then requests it live to see whether it still works.
        </p>
      </PageHead>

      <div className="card rise mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{linkedCore} of {CORE_PLATFORMS.length} major networks linked</p>
            <div className="mt-1.5 flex gap-1.5">
              {CORE_PLATFORMS.map((p) => {
                const on = rows.some((r) => r.platform === p.id && r.kind === 'profile');
                return <span key={p.id} title={`${p.name}: ${on ? 'linked' : 'not linked'}`} className={`h-2 w-10 rounded-full ${on ? 'bg-good' : 'bg-line'}`} />;
              })}
            </div>
          </div>
          <button type="button" disabled={running} onClick={run} className="btn btn-primary no-print px-4 py-2">
            {running ? 'Checking…' : '↻ Re-check'}
          </button>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map(([label, value, cls]) => (
            <div key={label} className={`card stat-tile p-4 ${cls}`}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-1 text-3xl font-bold"><CountUp value={value} duration={600} /></dd>
            </div>
          ))}
        </dl>
        {status === 'error' && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
      </div>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        {groups.map(({ platform: p, items }, gi) => (
          <div key={p.id} className="card tile-anim p-4" style={{ '--d': `${gi * 40}ms` }}>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: p.color }}>{p.name[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-muted">{items.length ? `${items.length} link${items.length > 1 ? 's' : ''} found` : 'Not linked from this page'}</p>
              </div>
              {!items.length && <span className="rounded-full bg-panel-2 px-2.5 py-0.5 text-xs font-semibold text-muted">Missing</span>}
            </div>
            {items.length > 0 && (
              <ul className="mt-3 divide-y divide-line">
                {items.map((it) => {
                  const st = rows.find((r) => r.url === it.url).st;
                  const S = STATE[st.key];
                  return (
                    <li key={it.url} className="py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <a href={it.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-mono text-xs hover:text-accent">{it.handle || it.url}</a>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${S.text}`}><span className={`h-2 w-2 rounded-full ${S.dot}`} />{S.label}</span>
                      </div>
                      <p className="mt-0.5 break-all text-[11px] text-muted">{it.url}</p>
                      <p className="mt-0.5 text-xs text-muted">{st.note} · found in {it.sources.join(' + ')}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </section>

      {status === 'done' && fixes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl">What to fix</h2>
          <ul className="mt-3 space-y-2">
            {fixes.map((f, i) => <li key={i} className="card rise px-4 py-3 text-sm">{f}</li>)}
          </ul>
        </section>
      )}

      <p className="mt-6 text-xs text-muted">
        “Valid” means the address is shaped like a real profile and answered successfully. Facebook, Instagram, LinkedIn and X often show a login page or
        block automated requests, so those links may show “Unverified” even when they work in a browser — we never guess. Only links found on this one page are checked.
      </p>
    </article>
  );
}
