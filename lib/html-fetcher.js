import { assertAllowedUrl, resolvePublicAddresses, UrlValidationError } from './url-validation.js';

export class FetchError extends Error {
  constructor(message, code = 'fetch_failed', extra = {}) {
    super(message);
    this.name = 'FetchError';
    this.code = code;
    Object.assign(this, extra);
  }
}

const DEFAULTS = {
  headerTimeoutMs: 10_000,
  timeoutMs: 25_000,
  maxBytes: 3 * 1024 * 1024,
  maxRedirects: 5,
  userAgent: 'SEOAuditAnalyzerBot/0.1 (+https://github.com/seo-audit-analyzer; SEO audit)',
};

function decode(bytes, contentType) {
  const charset = /charset=([\w-]+)/i.exec(contentType || '')?.[1]?.toLowerCase();
  try {
    return new TextDecoder(charset || 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

async function readBody(response, { maxBytes, onProgress, url, contentType, controller }) {
  if (!response.body) return { html: '', bytes: 0 };
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let reported = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        controller.abort();
        throw new FetchError(`Response exceeded the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`, 'too_large');
      }
      chunks.push(value);
      if (total - reported >= 64 * 1024) {
        reported = total;
        onProgress?.({ stage: 'download', message: `Downloaded ${Math.round(total / 1024)} KB` });
      }
    }
  } catch (error) {
    if (error instanceof FetchError) throw error;
    if (controller.signal.aborted) {
      throw new FetchError(`The page took too long to download from ${url.hostname}.`, 'timeout');
    }
    throw new FetchError(`Failed to read response: ${error.message}`, 'connect_failed');
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { html: decode(bytes, contentType), bytes: total };
}

/** Fetch an HTML page, validating the URL and every redirect hop. */
export async function fetchHtml(startUrl, opts = {}) {
  const options = { ...DEFAULTS, ...opts };
  let url = startUrl;
  const redirects = [];
  const started = Date.now();

  for (let hop = 0; hop <= options.maxRedirects; hop += 1) {
    options.onLocation?.(url);
    assertAllowedUrl(url);
    options.onProgress?.({ stage: 'resolve', message: `Resolving ${url.hostname} and checking it is a public address` });
    await resolvePublicAddresses(url.hostname);

    const controller = new AbortController();
    let timedOut = false;
    let headerTimedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs);
    const headerTimer = setTimeout(() => {
      headerTimedOut = true;
      controller.abort();
    }, options.headerTimeoutMs);

    let response;
    try {
      options.onProgress?.({ stage: 'connect', message: `Requesting ${url.href}` });
      response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': options.userAgent,
          Accept: options.anyText ? '*/*' : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'Accept-Language': options.acceptLanguage || 'en',
        },
      });
    } catch (error) {
      clearTimeout(timer);
      const message = headerTimedOut
        ? `${url.hostname} did not respond within ${options.headerTimeoutMs / 1000}s.`
        : timedOut
          ? `The page took longer than ${options.timeoutMs / 1000}s to download.`
          : `Could not connect: ${error.message}`;
      throw new FetchError(message, headerTimedOut ? 'no_response' : timedOut ? 'timeout' : 'connect_failed');
    } finally {
      clearTimeout(headerTimer);
    }

    const headers = Object.fromEntries(response.headers.entries());
    const status = response.status;
    if (status >= 300 && status < 400 && headers.location) {
      clearTimeout(timer);
      await response.body?.cancel();
      let next;
      try {
        next = new URL(headers.location, url);
      } catch {
        throw new FetchError('Redirect target was not a valid URL.', 'bad_redirect');
      }
      redirects.push({ from: url.href, to: next.href, status });
      options.onProgress?.({ stage: 'redirect', message: `HTTP ${status} redirect → ${next.href}` });
      url = next;
      continue;
    }

    const type = String(headers['content-type'] || '').toLowerCase();
    const looksHtml = !type || /text\/html|application\/xhtml\+xml/.test(type) || (options.anyText && /text\/|xml|json/.test(type));
    if (!looksHtml) {
      clearTimeout(timer);
      await response.body?.cancel();
      throw new FetchError(`Expected an HTML page but received "${type.split(';')[0]}".`, 'non_html', {
        statusCode: status,
        contentType: type,
      });
    }

    options.onProgress?.({ stage: 'download', message: `HTTP ${status} · receiving ${type.split(';')[0] || 'document'}` });
    try {
      const body = await readBody(response, { maxBytes: options.maxBytes, onProgress: options.onProgress, url, contentType: type, controller });
      return {
        finalUrl: url.href,
        statusCode: status,
        headers,
        ...body,
        redirects,
        fetchMs: Date.now() - started,
        fetchedAt: new Date().toISOString(),
        method: 'http',
      };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new FetchError(`Too many redirects (limit ${options.maxRedirects}).`, 'too_many_redirects');
}

/** Fetch a text-like resource (robots.txt, sitemap.xml) with the same safeguards as pages. */
export const fetchText = (url, opts = {}) =>
  fetchHtml(url, { maxBytes: 1024 * 1024, headerTimeoutMs: 8000, timeoutMs: 15_000, maxRedirects: 3, ...opts, anyText: true });
