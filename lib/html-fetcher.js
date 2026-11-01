import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
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
  headerTimeoutMs: 10_000, // no response headers by then → likely bot protection
  timeoutMs: 25_000, // whole request, including download
  maxBytes: 3 * 1024 * 1024,
  maxRedirects: 5,
  userAgent: 'SEOAuditAnalyzerBot/0.1 (+https://github.com/seo-audit-analyzer; SEO audit)',
};

/**
 * DNS lookup that validates addresses at connection time. Because the socket
 * connects to exactly the address returned here, DNS rebinding between a
 * pre-check and the connect cannot swap in a private address.
 */
export function safeLookup(hostname, options, callback) {
  resolvePublicAddresses(hostname).then(
    (records) => {
      if (options && options.all) return callback(null, records);
      callback(null, records[0].address, records[0].family);
    },
    (err) => callback(err),
  );
}

function requestOnce(url, { timeoutMs, headerTimeoutMs, maxBytes, userAgent, onProgress, anyText, acceptLanguage }) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    let settled = false;
    const done = (fn, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(headerTimer);
      fn(val);
    };

    const req = lib.request(
      url,
      {
        method: 'GET',
        lookup: safeLookup,
        agent: false,
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': acceptLanguage || 'en',
        },
      },
      (res) => {
        clearTimeout(headerTimer);
        const status = res.statusCode || 0;
        const headers = res.headers;

        if (status >= 300 && status < 400 && headers.location) {
          res.resume();
          return done(resolve, { status, headers, redirect: headers.location });
        }

        const type = String(headers['content-type'] || '').toLowerCase();
        const looksHtml = !type || /text\/html|application\/xhtml\+xml/.test(type) || (anyText && /text\/|xml|json/.test(type));
        if (!looksHtml) {
          res.destroy();
          return done(
            reject,
            new FetchError(`Expected an HTML page but received "${type.split(';')[0]}".`, 'non_html', {
              statusCode: status,
              contentType: type,
            }),
          );
        }

        let stream = res;
        const encoding = String(headers['content-encoding'] || '').toLowerCase();
        if (encoding === 'gzip' || encoding === 'x-gzip') stream = res.pipe(zlib.createGunzip());
        else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());

        onProgress?.({ stage: 'download', message: `HTTP ${status} · receiving ${type.split(';')[0] || 'document'}` });
        const chunks = [];
        let total = 0;
        let reported = 0;
        stream.on('data', (chunk) => {
          total += chunk.length;
          if (total - reported >= 64 * 1024) {
            reported = total;
            onProgress?.({ stage: 'download', message: `Downloaded ${Math.round(total / 1024)} KB` });
          }
          if (total > maxBytes) {
            res.destroy();
            req.destroy();
            return done(
              reject,
              new FetchError(`Response exceeded the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`, 'too_large'),
            );
          }
          chunks.push(chunk);
        });
        stream.on('end', () =>
          done(resolve, { status, headers, body: Buffer.concat(chunks), contentType: type }),
        );
        stream.on('error', (err) => done(reject, new FetchError(`Failed to read response: ${err.message}`)));
      },
    );

    const timer = setTimeout(() => {
      req.destroy();
      done(reject, new FetchError(`The page took longer than ${timeoutMs / 1000}s to download.`, 'timeout'));
    }, timeoutMs);

    // Connected but no answer: typical of CDN bot protection silently dropping automated clients.
    const headerTimer = setTimeout(() => {
      req.destroy();
      done(
        reject,
        new FetchError(
          `${url.hostname} accepted the connection but did not respond within ${headerTimeoutMs / 1000}s. ` +
            'This usually means the site\'s bot protection (e.g. Akamai or Cloudflare) blocks automated requests. ' +
            'Try a different page on the site, or one you control.',
          'no_response',
        ),
      );
    }, headerTimeoutMs);

    req.on('error', (err) => {
      if (err instanceof UrlValidationError) return done(reject, err);
      if (err.cause instanceof UrlValidationError) return done(reject, err.cause);
      if (err.code === 'ECONNRESET' || /socket hang up/i.test(err.message)) {
        return done(
          reject,
          new FetchError(
            `${url.hostname} closed the connection without responding. It is probably blocking automated requests; try a different page, or one you control.`,
            'blocked',
          ),
        );
      }
      done(reject, new FetchError(`Could not connect: ${err.message}`, 'connect_failed'));
    });
    req.end();
  });
}

function decode(buffer, contentType) {
  const charset = /charset=([\w-]+)/i.exec(contentType || '')?.[1]?.toLowerCase();
  const head = buffer.subarray(0, 2048).toString('latin1');
  const metaCharset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]?.toLowerCase();
  const label = charset || metaCharset || 'utf-8';
  try {
    return new TextDecoder(label).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

/** Fetch an HTML page, validating every redirect hop. */
export async function fetchHtml(startUrl, opts = {}) {
  const options = { ...DEFAULTS, ...opts };
  let url = startUrl;
  const redirects = [];
  const started = Date.now();

  for (let hop = 0; hop <= options.maxRedirects; hop += 1) {
    // Remember where we got to, so a browser retry can start from the post-redirect URL.
    options.onLocation?.(url);
    assertAllowedUrl(url);
    options.onProgress?.({ stage: 'resolve', message: `Resolving ${url.hostname} and checking it is a public address` });
    await resolvePublicAddresses(url.hostname);
    options.onProgress?.({ stage: 'connect', message: `Requesting ${url.href}` });
    const res = await requestOnce(url, options);

    if (res.redirect) {
      let next;
      try {
        next = new URL(res.redirect, url);
      } catch {
        throw new FetchError('Redirect target was not a valid URL.', 'bad_redirect');
      }
      redirects.push({ from: url.href, to: next.href, status: res.status });
      options.onProgress?.({ stage: 'redirect', message: `HTTP ${res.status} redirect → ${next.href}` });
      url = next;
      continue;
    }

    return {
      finalUrl: url.href,
      statusCode: res.status,
      headers: res.headers,
      html: decode(res.body, res.contentType),
      bytes: res.body.length,
      redirects,
      fetchMs: Date.now() - started,
      fetchedAt: new Date().toISOString(),
      method: 'http',
    };
  }
  throw new FetchError(`Too many redirects (limit ${options.maxRedirects}).`, 'too_many_redirects');
}

/** Fetch a text-like resource (robots.txt, sitemap.xml) with the same safeguards as pages. */
export const fetchText = (url, opts = {}) => fetchHtml(url, { maxBytes: 1024 * 1024, headerTimeoutMs: 8000, timeoutMs: 15000, maxRedirects: 3, ...opts, anyText: true });
