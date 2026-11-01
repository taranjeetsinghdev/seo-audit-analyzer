import http from 'node:http';
import https from 'node:https';
import { assertAllowedUrl, UrlValidationError } from './url-validation.js';
import { safeLookup } from './html-fetcher.js';
import { classify } from './link-verdict.js';

/**
 * Live link probing. Free, no external service. Never downloads bodies: it reads response
 * headers (HEAD, then a 1-byte ranged GET when HEAD is refused) and closes the socket.
 * Every hop is validated and connects through the same public-address-only DNS lookup as the
 * page fetcher, so submitted pages cannot make us touch private networks.
 */

const UA = 'SEOAuditAnalyzerBot/0.1 (+link check)';

function probeOnce(url, method, timeoutMs) {
  return new Promise((resolve) => {
    const lib = url.protocol === 'https:' ? https : http;
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    };
    const req = lib.request(
      url,
      {
        method,
        lookup: safeLookup,
        agent: false,
        headers: {
          'User-Agent': UA,
          Accept: '*/*',
          'Accept-Language': 'en',
          ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
        },
      },
      (res) => {
        const out = { status: res.statusCode || 0, location: res.headers.location };
        res.destroy();
        finish(out);
      },
    );
    const timer = setTimeout(() => {
      req.destroy();
      finish({ error: 'timeout' });
    }, timeoutMs);
    req.on('error', (err) => {
      const cause = err.cause || err;
      if (cause instanceof UrlValidationError) return finish({ error: cause.code === 'dns_failure' ? 'dns' : 'blocked_target' });
      const code = err.code || cause.code || '';
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return finish({ error: 'dns' });
      if (code === 'ECONNREFUSED') return finish({ error: 'refused' });
      if (code === 'ECONNRESET' || /socket hang up/i.test(err.message)) return finish({ error: 'reset' });
      if (/CERT|SSL|TLS|self.signed|certificate/i.test(code + err.message)) return finish({ error: 'tls' });
      finish({ error: 'other' });
    });
    req.end();
  });
}

/** Probe one URL, following redirects (validated at each hop). */
export async function probe(href, { timeoutMs = 8000, maxRedirects = 5 } = {}) {
  const started = Date.now();
  const redirects = [];
  let url;
  try {
    url = new URL(href);
    assertAllowedUrl(url);
  } catch {
    return { status: null, error: 'blocked_target', redirects, finalUrl: href, ms: 0 };
  }

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    try {
      assertAllowedUrl(url);
    } catch {
      return { status: null, error: 'blocked_target', redirects, finalUrl: url.href, ms: Date.now() - started };
    }
    let res = await probeOnce(url, 'HEAD', timeoutMs);
    // Many servers mishandle HEAD: confirm any failure with a tiny GET before reporting it.
    if (res.error === 'timeout' || res.error === 'other' || res.error === 'reset' || (res.status && res.status >= 400)) {
      const get = await probeOnce(url, 'GET', timeoutMs);
      if (!get.error || res.error) res = get;
    }
    if (res.error) return { status: null, error: res.error, redirects, finalUrl: url.href, ms: Date.now() - started };
    if (res.status >= 300 && res.status < 400 && res.location) {
      let next;
      try {
        next = new URL(res.location, url);
      } catch {
        return { status: res.status, redirects, finalUrl: url.href, ms: Date.now() - started };
      }
      redirects.push({ status: res.status, to: next.href });
      url = next;
      continue;
    }
    return { status: res.status, redirects, finalUrl: url.href, ms: Date.now() - started };
  }
  return { status: null, error: 'redirect_loop', redirects, finalUrl: url.href, ms: Date.now() - started };
}

/**
 * Check many targets with bounded concurrency (global and per host), reporting each result as
 * soon as it is known. `isCancelled` lets the caller stop early (client disconnected).
 */
export async function checkLinks(targets, { concurrency = 10, perHost = 3, onResult, isCancelled = () => false } = {}) {
  const queue = [...targets];
  const active = new Map(); // host -> count
  const results = [];
  let running = 0;

  return new Promise((resolve) => {
    const next = () => {
      if (isCancelled()) {
        if (running === 0) resolve(results);
        return;
      }
      for (let i = 0; i < queue.length && running < concurrency; ) {
        let host = '';
        try {
          host = new URL(queue[i].href).hostname;
        } catch {
          /* handled by probe */
        }
        if ((active.get(host) || 0) >= perHost) {
          i += 1;
          continue;
        }
        const [t] = queue.splice(i, 1);
        running += 1;
        active.set(host, (active.get(host) || 0) + 1);
        probe(t.href)
          .then((p) => {
            const c = classify(p);
            const r = { ...t, status: p.status, finalUrl: p.finalUrl, redirects: p.redirects, ms: p.ms, error: p.error || null, verdict: c.verdict, reason: c.reason };
            results.push(r);
            onResult?.(r, results.length);
          })
          .catch(() => {
            const r = { ...t, status: null, finalUrl: t.href, redirects: [], ms: 0, error: 'other', verdict: 'error', reason: 'Request failed' };
            results.push(r);
            onResult?.(r, results.length);
          })
          .finally(() => {
            running -= 1;
            active.set(host, active.get(host) - 1);
            next();
          });
      }
      if (running === 0 && (queue.length === 0 || isCancelled())) resolve(results);
    };
    next();
  });
}
