import { assertAllowedUrl, resolvePublicAddresses } from './url-validation.js';
import { classify } from './link-verdict.js';

/**
 * Live link probing. Never downloads response bodies: it reads response headers and cancels the
 * stream. Every redirect is validated before it is fetched.
 */

async function probeOnce(url, method, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await resolvePublicAddresses(url.hostname);
    const response = await fetch(url, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: '*/*',
        'Accept-Language': 'en',
        ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
      },
    });
    const location = response.headers.get('location');
    await response.body?.cancel();
    return { status: response.status, location };
  } catch (error) {
    if (error?.code === 'blocked_ip' || error?.code === 'blocked_host' || error?.code === 'blocked_scheme') {
      return { error: 'blocked_target' };
    }
    if (error?.code === 'dns_failure') return { error: 'dns' };
    if (controller.signal.aborted) return { error: 'timeout' };
    return { error: 'other' };
  } finally {
    clearTimeout(timer);
  }
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
    let response = await probeOnce(url, 'HEAD', timeoutMs);
    if (response.error || (response.status && response.status >= 400)) {
      const get = await probeOnce(url, 'GET', timeoutMs);
      if (!get.error || response.error) response = get;
    }
    if (response.error) {
      return { status: null, error: response.error, redirects, finalUrl: url.href, ms: Date.now() - started };
    }
    if (response.status >= 300 && response.status < 400 && response.location) {
      let next;
      try {
        next = new URL(response.location, url);
      } catch {
        return { status: response.status, redirects, finalUrl: url.href, ms: Date.now() - started };
      }
      redirects.push({ status: response.status, to: next.href });
      url = next;
      continue;
    }
    return { status: response.status, redirects, finalUrl: url.href, ms: Date.now() - started };
  }
  return { status: null, error: 'redirect_loop', redirects, finalUrl: url.href, ms: Date.now() - started };
}

/**
 * Check many targets with bounded concurrency (global and per host), reporting each result as
 * soon as it is known. `isCancelled` lets the caller stop early (client disconnected).
 */
export async function checkLinks(targets, { concurrency = 10, perHost = 3, onResult, isCancelled = () => false } = {}) {
  const queue = [...targets];
  const active = new Map();
  const results = [];
  let running = 0;

  return new Promise((resolve) => {
    const next = () => {
      if (isCancelled()) {
        if (running === 0) resolve(results);
        return;
      }
      for (let i = 0; i < queue.length && running < concurrency;) {
        let host = '';
        try {
          host = new URL(queue[i].href).hostname;
        } catch {
          // probe() records the invalid target.
        }
        if ((active.get(host) || 0) >= perHost) {
          i += 1;
          continue;
        }
        const [target] = queue.splice(i, 1);
        running += 1;
        active.set(host, (active.get(host) || 0) + 1);
        probe(target.href)
          .then((result) => {
            const verdict = classify(result);
            const record = {
              ...target,
              status: result.status,
              finalUrl: result.finalUrl,
              redirects: result.redirects,
              ms: result.ms,
              error: result.error || null,
              verdict: verdict.verdict,
              reason: verdict.reason,
            };
            results.push(record);
            onResult?.(record, results.length);
          })
          .catch(() => {
            const record = { ...target, status: null, finalUrl: target.href, redirects: [], ms: 0, error: 'other', verdict: 'error', reason: 'Request failed' };
            results.push(record);
            onResult?.(record, results.length);
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
