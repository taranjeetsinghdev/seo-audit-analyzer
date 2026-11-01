'use client';

import { securityIssues } from '@/lib/security-issues';
import { combineScores, gradeFor } from '@/lib/overall-score';
import { aggregateSite } from '@/lib/site-scores';
import { auditSitemap, sitemapIssues } from '@/lib/sitemap-audit';
import { performanceIssues } from '@/lib/performance-issues';
import { collectTargets, linkIssues, summarize, linkScore } from '@/lib/link-verdict';
import { issuePriority } from '@/lib/scoring-engine';
import { findCountry } from '@/lib/countries';
import { toast } from '@/lib/toast';
import { COUNTRY_FILTER } from '@/lib/features';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const Ctx = createContext(null);
const KEY = 'seo-audit-analyzer:report';
const PERF_KEY = 'seo-audit-analyzer:performance';
const RENDER_KEY = 'seo-audit-analyzer:live-render';
const COUNTRY_KEY = 'seo-audit-analyzer:country';
const LINK_KEY = 'seo-audit-analyzer:link-check';
const SITE_KEY = 'seo-audit-analyzer:site-crawl';
const NO_SITE = { status: 'idle', pages: [], done: 0, max: 0, message: '', result: null, error: '' };
const POP_KEY = 'seo-audit-analyzer:popularity';
const NO_POP = { status: 'idle', data: null, error: '' };
const HIST_KEY = 'seo-audit-analyzer:popularity-history';
const SEC_KEY = 'seo-audit-analyzer:security';
const NO_SEC = { status: 'idle', data: null, error: '' };
const NO_HIST = { status: 'idle', months: [], done: 0, history: null, error: '' };
const NO_LINKS = { status: 'idle', total: 0, done: 0, results: [], summary: null, score: null, error: '' };

/** Holds the current report across pages; restored from sessionStorage on refresh. */
export function ReportProvider({ children }) {
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');
  const [progress, setProgress] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [country, setCountryState] = useState('');
  const countryRef = useRef('');
  const reportRef = useRef(null);
  const [analyzing, setAnalyzing] = useState(null);
  const [liveRender, setLiveRenderState] = useState(true);
  const renderRef = useRef(true);
  const [popularity, setPopularity] = useState(NO_POP);
  const [popHistory, setPopHistory] = useState(NO_HIST);
  const histToken = useRef(0);
  const popRunner = useRef(null);
  const histRunner = useRef(null);
  const [security, setSecurity] = useState(NO_SEC);
  const secRunner = useRef(null);
  const secToken = useRef(0);
  const popToken = useRef(0);
  const [siteCrawl, setSiteCrawl] = useState(NO_SITE);
  const siteToken = useRef(0);
  const siteRunner = useRef(null);
  const siteAbort = useRef(null);
  const [linkCheck, setLinkCheck] = useState(NO_LINKS);
  const linkRunner = useRef(null);
  const linkToken = useRef(0);
  const perfRunner = useRef(null);
  const perfToken = useRef(0);
  const [perf, setPerf] = useState({ status: 'idle', results: null, errors: {}, error: '' });

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) {
        const restored = JSON.parse(saved);
        setReport(restored);
        reportRef.current = restored;
        setStatus('done');
      }
      const savedCountry = COUNTRY_FILTER ? localStorage.getItem(COUNTRY_KEY) : null;
      if (!COUNTRY_FILTER) localStorage.removeItem(COUNTRY_KEY); // forget an old selection: everything is worldwide
      if (savedCountry && findCountry(savedCountry)) {
        setCountryState(savedCountry);
        countryRef.current = savedCountry;
      }
      const savedRender = localStorage.getItem(RENDER_KEY);
      if (savedRender === 'off') {
        setLiveRenderState(false);
        renderRef.current = false;
      }
      const savedHist = sessionStorage.getItem(HIST_KEY);
      if (saved && savedHist) { const h = JSON.parse(savedHist); setPopHistory({ ...NO_HIST, status: 'done', months: h.months, history: h }); }
      const savedSec = sessionStorage.getItem(SEC_KEY);
      if (saved && savedSec) setSecurity({ status: 'done', data: JSON.parse(savedSec), error: '' });
      const savedPop = sessionStorage.getItem(POP_KEY);
      if (saved && savedPop) setPopularity({ status: 'done', data: JSON.parse(savedPop), error: '' });
      const savedSite = sessionStorage.getItem(SITE_KEY);
      if (saved && savedSite) setSiteCrawl({ ...NO_SITE, status: 'done', result: JSON.parse(savedSite) });
      const savedLinks = sessionStorage.getItem(LINK_KEY);
      if (saved && savedLinks) setLinkCheck({ ...NO_LINKS, ...JSON.parse(savedLinks), status: 'done' });
      const savedPerf = sessionStorage.getItem(PERF_KEY);
      if (saved && savedPerf) setPerf({ status: 'done', ...JSON.parse(savedPerf), error: '' });
    } catch {
      /* ignore unreadable storage */
    }
    setHydrated(true);
  }, []);

  const analyze = useCallback(async (target) => {
    setAnalyzing({ url: target, country: countryRef.current, render: renderRef.current, startedAt: Date.now() });
    setStatus('loading');
    setError('');
    setProgress([]);
    try {
      const res = await fetch('/api/seo-analyze?stream=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target, render: renderRef.current, country: countryRef.current || undefined }),
        cache: 'no-store',
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Analysis failed.');
      }

      // Read newline-delimited JSON events as the server emits them.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result = null;
      const handle = (line) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === 'progress') setProgress((p) => [...p, event]);
        else if (event.type === 'result') result = event.report;
        else if (event.type === 'error') throw new Error(event.message);
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(handle);
      }
      handle(buffer);
      if (!result) throw new Error('The analysis ended without a result.');

      setReport(result);
      reportRef.current = result;
      setStatus('done');
      setPerf({ status: 'idle', results: null, errors: {}, error: '' });
      // Start the free performance test straight away so the overall score completes on its own.
      perfRunner.current?.(result.url);
      linkRunner.current?.(result);
      setSiteCrawl(NO_SITE);
      siteRunner.current?.(result.url); // audit every page of the site, not only the one entered
      popRunner.current?.(result.url);
      secRunner.current?.(result.url);
      setPopHistory(NO_HIST);
      histRunner.current?.(result.url); // prefetch the trend now so it is ready before the Traffic page is opened
      try {
        sessionStorage.removeItem(PERF_KEY);
        sessionStorage.removeItem(LINK_KEY);
        sessionStorage.removeItem(SITE_KEY);
        sessionStorage.removeItem(POP_KEY);
        sessionStorage.removeItem(SEC_KEY);
        sessionStorage.removeItem(HIST_KEY);
      } catch {
        /* ignore */
      }
      try {
        sessionStorage.setItem(KEY, JSON.stringify(result));
      } catch {
        /* storage full or unavailable */
      }
      return true;
    } catch (err) {
      setError(err.message || 'Network error.');
      setStatus('error');
      return false;
    }
  }, []);

  // Traffic overview: popularity rank history (free, Tranco). Loads automatically after the audit.
  const runPopularity = useCallback(async (target) => {
    const id = (popToken.current += 1);
    setPopularity({ status: 'loading', data: null, error: '' });
    try {
      const res = await fetch('/api/popularity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: target }), cache: 'no-store',
      });
      const j = await res.json();
      if (id !== popToken.current) return;
      if (!res.ok) throw new Error(j?.error?.message || 'Traffic data unavailable.');
      setPopularity({ status: 'done', data: j, error: '' });
      try {
        sessionStorage.setItem(POP_KEY, JSON.stringify(j));
      } catch {
        /* ignore */
      }
    } catch (err) {
      if (id !== popToken.current) return;
      setPopularity({ status: 'error', data: null, error: err.message || 'Network error.' });
    }
  }, []);
  popRunner.current = runPopularity;

  // Security & infrastructure audit (headers, TLS, DNS, domain). Loads automatically after the audit.
  const runSecurity = useCallback(async (target) => {
    const id = (secToken.current += 1);
    setSecurity({ status: 'loading', data: null, error: '' });
    try {
      const res = await fetch('/api/security', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: target }), cache: 'no-store',
      });
      const j = await res.json();
      if (id !== secToken.current) return;
      if (!res.ok) throw new Error(j?.error?.message || 'Security audit unavailable.');
      setSecurity({ status: 'done', data: j, error: '' });
      try {
        sessionStorage.setItem(SEC_KEY, JSON.stringify(j));
      } catch {
        /* ignore */
      }
    } catch (err) {
      if (id !== secToken.current) return;
      setSecurity({ status: 'error', data: null, error: err.message || 'Network error.' });
    }
  }, []);
  secRunner.current = runSecurity;

  // 12-month popularity history: months stream in as each monthly list is searched.
  const runPopHistory = useCallback(async (target) => {
    const id = (histToken.current += 1);
    setPopHistory({ ...NO_HIST, status: 'running' });
    try {
      const res = await fetch('/api/popularity/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: target }), cache: 'no-store',
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error?.message || 'History lookup failed.');
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let finished = false;
      const handle = (line) => {
        if (!line.trim() || id !== histToken.current) return;
        const e = JSON.parse(line);
        if (e.type === 'month') {
          setPopHistory((p) => {
            const months = [...p.months.filter((m) => m.key !== e.month.key), e.month].sort((a, b) => a.key.localeCompare(b.key));
            return { ...p, months, done: months.length };
          });
        } else if (e.type === 'done') {
          finished = true;
          setPopHistory({ status: 'done', months: e.history.months, done: e.history.months.length, history: e.history, error: '' });
          try {
            sessionStorage.setItem(HIST_KEY, JSON.stringify(e.history));
          } catch {
            /* ignore */
          }
        } else if (e.type === 'error') throw new Error(e.message);
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        lines.forEach(handle);
      }
      handle(buf);
      if (!finished && id === histToken.current) throw new Error('The history lookup ended early.');
    } catch (err) {
      if (id !== histToken.current) return;
      setPopHistory((p) => ({ ...p, status: 'error', error: err.message || 'History lookup failed.' }));
    }
  }, []);

  histRunner.current = runPopHistory;

  // Site-wide crawl: streams pages as they are fetched, then the full analysis.
  const runSiteCrawl = useCallback(async (url, maxPages = 50) => {
    const id = (siteToken.current += 1);
    siteAbort.current?.abort(); // frees the server-side crawl lock from a previous run
    const abort = new AbortController();
    siteAbort.current = abort;
    setSiteCrawl({ ...NO_SITE, status: 'running', max: maxPages, message: 'Starting crawl…' });
    try {
      const res = await fetch('/api/site-crawl', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, maxPages }), cache: 'no-store', signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error?.message || 'The site crawl could not start.');
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let finished = false;
      const handle = (line) => {
        if (!line.trim() || id !== siteToken.current) return;
        const e = JSON.parse(line);
        if (e.type === 'progress') setSiteCrawl((p) => ({ ...p, message: e.message }));
        else if (e.type === 'page') setSiteCrawl((p) => ({ ...p, pages: [...p.pages, e.page], done: e.done, max: e.max, message: `Crawled ${e.done} of up to ${e.max} pages` }));
        else if (e.type === 'result') {
          finished = true;
          const result = { crawl: e.crawl, analysis: e.analysis, at: new Date().toISOString() };
          setSiteCrawl((p) => ({ ...p, status: 'done', result, message: '' }));
          try {
            sessionStorage.setItem(SITE_KEY, JSON.stringify({ ...result, crawl: { ...result.crawl, pages: result.crawl.pages.map(({ url: u, finalUrl, status, verdict, depth, ms, title, description, h1, words, inlinks, inSitemap, noindex, canonical, redirects, audit }) => ({ url: u, finalUrl, status, verdict, depth, ms, title, description, h1, words, inlinks, inSitemap, noindex, canonical, redirects, audit })) } }));
          } catch {
            /* too large or unavailable */
          }
        } else if (e.type === 'error') throw new Error(e.message);
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        lines.forEach(handle);
      }
      handle(buf);
      if (!finished && id === siteToken.current) throw new Error('The crawl ended early.');
    } catch (err) {
      if (id !== siteToken.current || err.name === 'AbortError') return;
      setSiteCrawl((p) => ({ ...p, status: 'error', error: err.message || 'Crawl failed.' }));
    }
  }, []);

  siteRunner.current = runSiteCrawl;

  // Live link checking: streams results as each link is probed.
  const runLinkCheck = useCallback(async (rep) => {
    const id = (linkToken.current += 1);
    const targets = collectTargets(rep);
    if (!targets.length) {
      setLinkCheck({ ...NO_LINKS, status: 'done', summary: summarize([]), score: null });
      return;
    }
    setLinkCheck({ ...NO_LINKS, status: 'running', total: targets.length });
    try {
      const res = await fetch('/api/link-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }),
        cache: 'no-store',
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Link check failed.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let results = [];
      let finished = false;
      const handle = (line) => {
        if (!line.trim() || id !== linkToken.current) return;
        const e = JSON.parse(line);
        if (e.type === 'result') {
          results = [...results, e.result];
          const summary = summarize(results);
          setLinkCheck({ status: 'running', total: e.total, done: e.done, results, summary, score: linkScore(summary), error: '' });
        } else if (e.type === 'done') {
          finished = true;
          const next = { total: results.length, done: results.length, results, summary: e.summary, score: e.score };
          setLinkCheck({ status: 'done', error: '', ...next });
          try {
            sessionStorage.setItem(LINK_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
        } else if (e.type === 'error') {
          throw new Error(e.message);
        }
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(handle);
      }
      handle(buffer);
      if (!finished && id === linkToken.current) throw new Error('The link check ended early.');
    } catch (err) {
      if (id !== linkToken.current) return;
      setLinkCheck((prev) => ({ ...prev, status: 'error', error: err.message || 'Network error.' }));
    }
  }, []);

  linkRunner.current = runLinkCheck;

  // Choose the visitor's country. If a report is open, the whole analysis is re-run from that viewpoint.
  const setCountry = useCallback((code) => {
    if (!COUNTRY_FILTER) return;
    const next = code && findCountry(code) ? code : '';
    if (next === countryRef.current) return;
    countryRef.current = next;
    setCountryState(next);
    try {
      localStorage.setItem(COUNTRY_KEY, next);
    } catch {
      /* ignore */
    }
    const current = reportRef.current;
    if (current) {
      const c = findCountry(next);
      toast(c ? `Re-analysing as a visitor from ${c.name}…` : 'Re-analysing worldwide…');
      analyze(current.requestedUrl || current.url);
    }
  }, [analyze]);

  const setLiveRender = useCallback((on) => {
    renderRef.current = on;
    setLiveRenderState(on);
    try {
      localStorage.setItem(RENDER_KEY, on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }, []);

  // One run tests mobile and desktop together; switching devices afterwards needs no new test.
  const runPerformance = useCallback(async (target) => {
    const id = (perfToken.current += 1);
    setPerf({ status: 'loading', results: null, errors: {}, error: '' });
    try {
      const res = await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (id !== perfToken.current) return; // a newer run superseded this one
      if (!res.ok) throw new Error(data?.error?.message || 'Performance test failed.');
      const next = { results: data.results, errors: data.errors || {} };
      setPerf({ status: 'done', ...next, error: '' });
      try {
        sessionStorage.setItem(PERF_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    } catch (err) {
      if (id !== perfToken.current) return;
      setPerf({ status: 'error', results: null, errors: {}, error: err.message || 'Network error.' });
    }
  }, []);

  perfRunner.current = runPerformance;

  // Report plus the optional modules (performance, link health): scores, issues and exports include them.
  const exportReport = useMemo(() => {
    const perfList = perf.results ? Object.values(perf.results).filter(Boolean) : [];
    const linksReady = linkCheck.results.length > 0 && (linkCheck.status === 'done' || linkCheck.status === 'running');
    const siteDone = siteCrawl.status === 'done' && siteCrawl.result;
    const popData = popularity.status === 'done' && popularity.data?.found ? popularity.data : null;
    const secData = security.status === 'done' ? security.data : null;
    const sitemapAudit = siteCrawl.status === 'done' && siteCrawl.result ? auditSitemap(siteCrawl.result.crawl) : null;
    const siteAudit = report && siteCrawl.status === 'done' && siteCrawl.result ? aggregateSite(siteCrawl.result.crawl.pages, report) : null;
    if (!report || (!perfList.length && !linksReady && !siteDone && !popData && !secData)) return report;

    const linkResult = linksReady ? { results: linkCheck.results, summary: linkCheck.summary, score: linkCheck.score } : null;
    const combined = combineScores(
      report,
      perf.results,
      linkResult && linkCheck.status === 'done' ? linkResult : null,
      siteDone ? { score: siteCrawl.result.analysis.score, counts: siteCrawl.result.analysis.counts } : null,
      siteAudit,
      secData,
      sitemapAudit,
    );
    const extraIssues = [
      ...(perfList.length ? performanceIssues(perfList) : []),
      ...(linksReady ? linkIssues(linkCheck.results) : []),
      ...(siteDone ? siteCrawl.result.analysis.issues.map((i) => ({ ...i })) : []),
      ...(secData ? securityIssues(secData) : []),
      ...(sitemapAudit ? sitemapIssues(sitemapAudit) : []),
    ];

    const next = {
      ...report,
      issues: [...report.issues, ...extraIssues].sort((a, b) => b.priority - a.priority),
      coverage: {
        ...report.coverage,
        notEvaluated: report.coverage.notEvaluated.filter(
          (n) => !(perfList.length && n.id === 'performance') && !(linkCheck.status === 'done' && n.id === 'broken-links') && !(siteDone && n.id === 'sitewide'),
        ),
      },
    };
    if (siteAudit) next.siteAudit = siteAudit;
    if (sitemapAudit) next.sitemap = sitemapAudit;
    if (perfList.length) next.performance = perfList;
    if (secData) next.security = secData;
    if (popData) next.popularity = { ...popData, monthly: popHistory.status === 'done' && popHistory.history ? popHistory.history.months : null };
    if (siteDone) {
      const { crawl, analysis } = siteCrawl.result;
      next.siteCrawl = {
        origin: crawl.origin, ms: crawl.ms, robots: crawl.robots, sitemap: { found: crawl.sitemap.found, count: crawl.sitemap.urls.length },
        counts: analysis.counts, score: analysis.score, truncated: crawl.truncated, discovered: crawl.discovered,
        pages: crawl.pages.map((p) => ({ score: p.audit?.score ?? null, url: p.url, status: p.status, verdict: p.verdict, depth: p.depth, title: p.title, words: p.words, inlinks: p.inlinks, inSitemap: p.inSitemap })),
      };
    }
    if (combined.performance || combined.links || siteAudit || combined.security || combined.sitemap) {
      const g = gradeFor(combined.overall);
      Object.assign(next, {
        htmlScore: combined.htmlScore,
        score: combined.overall,
        grade: g.grade,
        gradeLabel: g.label,
        sections: [...(siteAudit ? siteAudit.sections : report.sections), ...[combined.performance, combined.links, combined.site, combined.security, combined.sitemap].filter(Boolean)],
        scoring: { ...report.scoring, pointsEarned: combined.earned, pointsPossible: combined.possible },
        includesPerformance: !!combined.performance,
        includesLinks: !!combined.links,
        includesSiteAudit: siteAudit ? siteAudit.pages : 0,
        includesSite: !!combined.site,
        includesSecurity: !!combined.security,
        includesSitemap: !!combined.sitemap,
      });
    }
    return next;
  }, [report, perf.results, linkCheck, siteCrawl, popularity, popHistory, security]);

  const value = useMemo(
    () => ({ report, exportReport, status, error, progress, hydrated, analyze, analyzing, country, setCountry, perf, runPerformance, liveRender, setLiveRender, linkCheck, runLinkCheck, siteCrawl, runSiteCrawl, popularity, runPopularity, popHistory, runPopHistory, security, runSecurity }),
    [report, exportReport, status, error, progress, hydrated, analyze, analyzing, country, setCountry, perf, runPerformance, liveRender, setLiveRender, linkCheck, runLinkCheck, siteCrawl, runSiteCrawl, popularity, runPopularity, popHistory, runPopHistory, security, runSecurity],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useReport = () => useContext(Ctx);
