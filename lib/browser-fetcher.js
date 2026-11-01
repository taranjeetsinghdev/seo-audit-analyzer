import fs from 'node:fs';
import { FetchError } from './html-fetcher.js';
import { assertAllowedUrl, resolvePublicAddresses } from './url-validation.js';
import { acceptLanguageFor } from './countries.js';

/**
 * Live renderer: loads a page in a real headless Chrome (playwright-core + the Chrome already
 * installed — no paid service, no bundled download) and returns the rendered DOM.
 *
 * Reliability: one shared browser that is relaunched if it dies and closed when idle; one render
 * at a time with a bounded queue; a hard per-render budget; contexts always closed.
 * Safety: every request the browser makes goes through the same URL / private-address checks as
 * the plain fetcher, and non-essential resources (images, media, fonts, CSS) are skipped.
 */

const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

export function findChrome() {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  return CANDIDATES.find((p) => fs.existsSync(p)) || null;
}

/** Rendering is available when a Chrome exists and it has not been switched off. */
export const renderAvailable = () => process.env.BROWSER_FALLBACK !== 'off' && process.env.RENDER_MODE !== 'off' && !!findChrome();
export const browserAvailable = renderAvailable;

// ---------- shared browser ----------
let browserPromise = null;
let idleTimer = null;
const IDLE_MS = 45_000;

async function getBrowser(executablePath) {
  if (browserPromise) {
    const existing = await browserPromise.catch(() => null);
    if (existing && existing.isConnected()) return existing;
    browserPromise = null;
  }
  const launching = (async () => {
    const { chromium } = await import('playwright-core');
    // Invisible by default: analysing a site must never pop a window or tab open on the host.
    // BROWSER_VISIBLE=true opts in to an on-screen window for sites that reject headless Chrome.
    const headless = process.env.BROWSER_VISIBLE !== 'true';
    const browser = await chromium.launch({
      executablePath,
      headless,
      args: [
        '--window-size=1280,900', '--mute-audio', '--no-first-run', '--disable-gpu', '--disable-dev-shm-usage',
        // Chrome refuses to start as root without this (typical on panel-managed servers).
        // Prefer running the app as a non-root user; set CHROME_NO_SANDBOX=false to force the sandbox.
        ...((process.getuid?.() === 0 && process.env.CHROME_NO_SANDBOX !== 'false') || process.env.CHROME_NO_SANDBOX === 'true' ? ['--no-sandbox'] : []),
      ],
    });
    browser.on('disconnected', () => {
      if (browserPromise === launching) browserPromise = null;
    });
    return browser;
  })();
  browserPromise = launching;
  launching.catch(() => {
    if (browserPromise === launching) browserPromise = null;
  });
  return launching;
}

function scheduleIdleClose() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    const p = browserPromise;
    browserPromise = null;
    const b = await p?.catch(() => null);
    await b?.close().catch(() => {});
  }, IDLE_MS);
  idleTimer.unref?.();
}

// ---------- one render at a time, bounded queue ----------
let chain = Promise.resolve();
let waiting = 0;
const MAX_WAITING = 4;
function withLock(fn) {
  if (waiting >= MAX_WAITING) {
    return Promise.reject(new FetchError('The rendering service is busy right now. Please try again in a moment.', 'busy'));
  }
  waiting += 1;
  const run = chain.then(fn, fn).finally(() => {
    waiting -= 1;
  });
  chain = run.catch(() => {});
  return run;
}

const SKIPPED = new Set(['image', 'media', 'font', 'stylesheet']);

/** Poll until the DOM size stops changing (client-side rendering settled), within a cap. */
async function waitForStableDom(page, capMs = 4000) {
  const end = Date.now() + capMs;
  let last = -1;
  let stable = 0;
  while (Date.now() < end && stable < 2) {
    const size = await page.evaluate(() => document.documentElement.outerHTML.length).catch(() => -1);
    stable = size === last ? stable + 1 : 0;
    last = size;
    await page.waitForTimeout(250);
  }
}

/** Scroll in steps so lazily rendered sections mount before we read the DOM. */
async function triggerLazyContent(page) {
  await page
    .evaluate(async () => {
      const total = Math.min(document.documentElement.scrollHeight, 12000);
      for (let y = 0; y < total; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
    })
    .catch(() => {});
}

export function renderPage(startUrl, { timeoutMs = 70_000, maxBytes = 5 * 1024 * 1024, onProgress, country = null } = {}) {
  return withLock(async () => {
    const executablePath = findChrome();
    if (!executablePath) {
      throw new FetchError('No Chrome browser was found on the server for live rendering. Set CHROME_PATH to enable it.', 'no_browser');
    }
    const started = Date.now();
    let browser;
    try {
      browser = await getBrowser(executablePath);
    } catch (err) {
      throw new FetchError(`The rendering browser could not start: ${String(err.message).split('\n')[0]}`, 'browser_failed');
    }
    clearTimeout(idleTimer);

    const hostOk = new Map();
    const consoleErrors = [];
    const failedRequests = [];
    const httpErrors = [];
    let context;
    try {
      // A visitor from the chosen country: their language, time zone and (capital-city) location.
      context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        locale: country?.locale || 'en-US',
        ...(country
          ? {
              timezoneId: country.timezone,
              geolocation: { latitude: country.lat, longitude: country.lon },
              permissions: ['geolocation'],
              extraHTTPHeaders: { 'Accept-Language': acceptLanguageFor(country) },
            }
          : {}),
      });
      await context.route('**/*', async (route) => {
        const req = route.request();
        if (SKIPPED.has(req.resourceType())) return route.abort();
        try {
          const u = new URL(req.url());
          if (u.protocol !== 'http:' && u.protocol !== 'https:') return route.abort();
          assertAllowedUrl(u);
          if (!hostOk.has(u.hostname)) hostOk.set(u.hostname, resolvePublicAddresses(u.hostname).then(() => true, () => false));
          if (!(await hostOk.get(u.hostname))) return route.abort('blockedbyclient');
        } catch {
          return route.abort('blockedbyclient');
        }
        return route.continue();
      });

      const page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);
      page.on('console', (m) => {
        if (m.type() === 'error' && consoleErrors.length < 25) consoleErrors.push({ text: m.text().slice(0, 240) });
      });
      page.on('pageerror', (e) => {
        if (consoleErrors.length < 25) consoleErrors.push({ text: `Uncaught: ${String(e.message).slice(0, 220)}` });
      });
      page.on('requestfailed', (r) => {
        const why = r.failure()?.errorText || 'failed';
        if (SKIPPED.has(r.resourceType()) || /BLOCKED_BY_CLIENT|ERR_ABORTED/.test(why)) return;
        if (failedRequests.length < 25) failedRequests.push({ url: r.url().slice(0, 200), reason: why });
      });
      page.on('response', (r) => {
        if (r.status() >= 400 && !SKIPPED.has(r.request().resourceType()) && httpErrors.length < 25) {
          httpErrors.push({ url: r.url().slice(0, 200), status: r.status() });
        }
      });

      onProgress?.({ stage: 'render', message: `Rendering the live page: ${startUrl.href}` });
      let response;
      try {
        response = await page.goto(startUrl.href, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      } catch (err) {
        const msg = String(err.message).split('\n')[0];
        if (/timeout/i.test(msg)) throw new FetchError(`Even a real browser could not load the page within ${Math.round(timeoutMs / 1000)}s.`, 'timeout');
        throw new FetchError(`The browser could not load the page: ${msg.replace(/^page\.goto: /, '')}`, 'browser_failed');
      }
      if (!response) throw new FetchError('The browser did not receive a response.', 'browser_failed');

      onProgress?.({ stage: 'render', message: 'Waiting for JavaScript to finish rendering…' });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await triggerLazyContent(page);
      await waitForStableDom(page);

      // The page may still be redirecting client-side; retry until the DOM is readable.
      let html = null;
      for (let attempt = 0; attempt < 6 && html === null; attempt += 1) {
        try {
          html = await page.content();
        } catch (err) {
          if (!/navigating|context was destroyed/i.test(err.message)) {
            throw new FetchError(`The browser could not read the page: ${String(err.message).split('\n')[0]}`, 'browser_failed');
          }
          await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
          await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
          await page.waitForTimeout(600);
        }
      }
      if (html === null) throw new FetchError('The page kept navigating and never settled.', 'browser_failed');

      const finalUrl = new URL(page.url());
      assertAllowedUrl(finalUrl);
      const bytes = Buffer.byteLength(html);
      if (bytes > maxBytes) throw new FetchError('The rendered page exceeded the size limit.', 'too_large');

      const redirects = [];
      let r = response.request().redirectedFrom();
      while (r) {
        redirects.unshift({ from: r.url(), to: r.url(), status: 301 });
        r = r.redirectedFrom();
      }

      onProgress?.({ stage: 'render', message: `Rendered DOM captured: ${Math.round(bytes / 1024)} KB` });
      return {
        finalUrl: finalUrl.href,
        statusCode: response.status(),
        headers: response.headers(),
        html,
        bytes,
        redirects,
        fetchMs: Date.now() - started,
        fetchedAt: new Date().toISOString(),
        method: 'rendered',
        renderInfo: { consoleErrors, failedRequests, httpErrors },
      };
    } catch (err) {
      if (err instanceof FetchError) throw err;
      throw new FetchError(`Live rendering failed: ${String(err.message).split('\n')[0]}`, 'browser_failed');
    } finally {
      await context?.close().catch(() => {});
      scheduleIdleClose();
    }
  });
}

/**
 * Render trusted-generated HTML to a PDF with the same browser (free, no external service).
 * JavaScript and all network access are disabled for this context: it only paints the markup.
 */
export function htmlToPdf(html, { footer = 'SEO Audit Analyzer' } = {}) {
  return withLock(async () => {
    const executablePath = findChrome();
    if (!executablePath) throw new FetchError('No Chrome browser is available to generate PDFs.', 'no_browser');
    let browser;
    try {
      browser = await getBrowser(executablePath);
    } catch (err) {
      throw new FetchError(`The PDF browser could not start: ${String(err.message).split('\n')[0]}`, 'browser_failed');
    }
    clearTimeout(idleTimer);
    let context;
    try {
      context = await browser.newContext({ javaScriptEnabled: false });
      await context.route('**/*', (route) => route.abort());
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      return await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `<div style="width:100%;font-size:8px;color:#667085;padding:0 14mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif"><span>${footer}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
        margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
      });
    } catch (err) {
      throw new FetchError(`PDF generation failed: ${String(err.message).split('\n')[0]}`, 'browser_failed');
    } finally {
      await context?.close().catch(() => {});
      scheduleIdleClose();
    }
  });
}

// Backwards-compatible name used by the blocked-site fallback.
export const fetchWithBrowser = renderPage;
