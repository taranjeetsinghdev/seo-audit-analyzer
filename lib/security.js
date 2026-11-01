import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import { safeLookup } from './html-fetcher.js';
import { normalizeUserUrl, resolvePublicAddresses } from './url-validation.js';

/**
 * Security & infrastructure audit: response headers, HTTPS redirect, TLS certificate, DNS / email records,
 * domain registration (RDAP) and hosting. Every value is read live from the domain: no keys, no estimates.
 */

const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'or', 'ne']);

/** Registrable domain (best effort without a public-suffix list). */
export function apexOf(host) {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2) return labels.join('.');
  const take = labels[labels.length - 1].length === 2 && SECOND_LEVEL.has(labels[labels.length - 2]) ? 3 : 2;
  return labels.slice(-take).join('.');
}

const item = (id, group, title, status, weight, detail, fix = '') => ({ id, group, title, status, weight, detail, fix });

const header = (h, name) => {
  const v = h[name];
  return Array.isArray(v) ? v.join(', ') : v ? String(v) : '';
};

/** Grade the security response headers. `h` is a lower-cased Node headers object. */
export function headerItems(h) {
  const out = [];
  const hsts = header(h, 'strict-transport-security');
  const maxAge = Number(/max-age=(\d+)/i.exec(hsts)?.[1] || 0);
  out.push(
    !hsts ? item('hsts', 'Headers', 'Strict-Transport-Security (HSTS)', 'fail', 20, 'Header is missing.', 'Send "Strict-Transport-Security: max-age=31536000; includeSubDomains" so browsers always use HTTPS.')
      : maxAge < 15552000 ? item('hsts', 'Headers', 'Strict-Transport-Security (HSTS)', 'warn', 20, `max-age is ${maxAge}s (under 6 months).`, 'Raise max-age to at least 31536000 (one year).')
        : item('hsts', 'Headers', 'Strict-Transport-Security (HSTS)', 'pass', 20, hsts),
  );
  const csp = header(h, 'content-security-policy');
  out.push(
    !csp ? item('csp', 'Headers', 'Content-Security-Policy', 'fail', 20, 'Header is missing.', 'Add a Content-Security-Policy to limit where scripts, styles and frames can load from.')
      : /unsafe-inline|unsafe-eval/i.test(csp) ? item('csp', 'Headers', 'Content-Security-Policy', 'warn', 20, `${csp.slice(0, 200)}${csp.length > 200 ? '…' : ''}`, 'Remove "unsafe-inline" / "unsafe-eval" and use nonces or hashes instead.')
        : item('csp', 'Headers', 'Content-Security-Policy', 'pass', 20, `${csp.slice(0, 200)}${csp.length > 200 ? '…' : ''}`),
  );
  const xfo = header(h, 'x-frame-options');
  const frameAncestors = /frame-ancestors/i.test(csp);
  out.push(
    xfo || frameAncestors ? item('framing', 'Headers', 'Clickjacking protection', 'pass', 10, xfo ? `X-Frame-Options: ${xfo}` : 'CSP frame-ancestors is set.')
      : item('framing', 'Headers', 'Clickjacking protection', 'fail', 10, 'Neither X-Frame-Options nor CSP frame-ancestors is set.', 'Send "X-Frame-Options: SAMEORIGIN" or a CSP frame-ancestors directive.'),
  );
  out.push(
    header(h, 'x-content-type-options').toLowerCase() === 'nosniff' ? item('nosniff', 'Headers', 'X-Content-Type-Options', 'pass', 10, 'nosniff')
      : item('nosniff', 'Headers', 'X-Content-Type-Options', 'fail', 10, 'Header is missing.', 'Send "X-Content-Type-Options: nosniff".'),
  );
  const ref = header(h, 'referrer-policy');
  out.push(
    ref ? (/unsafe-url|no-referrer-when-downgrade/i.test(ref) ? item('referrer', 'Headers', 'Referrer-Policy', 'warn', 10, ref, 'Use "strict-origin-when-cross-origin" or stricter.') : item('referrer', 'Headers', 'Referrer-Policy', 'pass', 10, ref))
      : item('referrer', 'Headers', 'Referrer-Policy', 'fail', 10, 'Header is missing.', 'Send "Referrer-Policy: strict-origin-when-cross-origin".'),
  );
  const pp = header(h, 'permissions-policy');
  out.push(pp ? item('permissions', 'Headers', 'Permissions-Policy', 'pass', 5, pp.slice(0, 200)) : item('permissions', 'Headers', 'Permissions-Policy', 'warn', 5, 'Header is missing.', 'Add a Permissions-Policy that disables features the site does not use (camera, microphone, geolocation).'));
  const powered = header(h, 'x-powered-by');
  const server = header(h, 'server');
  const leaks = powered || (/\d+\.\d+/.test(server) ? server : '');
  out.push(leaks ? item('disclosure', 'Headers', 'Server version disclosure', 'warn', 5, `Exposes: ${leaks}`, 'Hide X-Powered-By and version numbers in the Server header.') : item('disclosure', 'Headers', 'Server version disclosure', 'pass', 5, server ? `Server: ${server}` : 'No version information exposed.'));
  return out;
}

/** Score = weighted share of applicable items (pass 1, warn 0.5, fail 0). */
export function scoreItems(items) {
  let got = 0;
  let max = 0;
  for (const i of items) {
    if (i.status === 'na' || i.status === 'info' || !i.weight) continue;
    max += i.weight;
    got += i.weight * (i.status === 'pass' ? 1 : i.status === 'warn' ? 0.5 : 0);
  }
  const score = max ? Math.round((got / max) * 100) : null;
  const grade = score === null ? '–' : score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'F';
  return { score, grade };
}

export function certItems(cert) {
  if (!cert) return [item('cert', 'HTTPS & certificate', 'TLS certificate', 'fail', 20, 'Could not complete a TLS handshake.', 'Install a valid certificate and serve the site on port 443.')];
  const out = [];
  out.push(cert.authorized ? item('cert', 'HTTPS & certificate', 'Certificate is trusted', 'pass', 20, `Issued by ${cert.issuer}.`)
    : item('cert', 'HTTPS & certificate', 'Certificate is trusted', 'fail', 20, `Browsers would reject it: ${cert.authError}.`, 'Install a certificate from a trusted CA that covers this hostname.'));
  const d = cert.daysLeft;
  out.push(d <= 0 ? item('cert-expiry', 'HTTPS & certificate', 'Certificate expiry', 'fail', 10, `Expired ${Math.abs(d)} days ago.`, 'Renew the certificate immediately.')
    : d < 14 ? item('cert-expiry', 'HTTPS & certificate', 'Certificate expiry', 'fail', 10, `Expires in ${d} days.`, 'Renew now and enable automatic renewal.')
      : d < 30 ? item('cert-expiry', 'HTTPS & certificate', 'Certificate expiry', 'warn', 10, `Expires in ${d} days.`, 'Renew soon and enable automatic renewal.')
        : item('cert-expiry', 'HTTPS & certificate', 'Certificate expiry', 'pass', 10, `Valid for ${d} more days (until ${cert.validTo.slice(0, 10)}).`));
  const old = /TLSv1(\.0|\.1)?$/.test(cert.protocol || '');
  out.push(old ? item('tls-version', 'HTTPS & certificate', 'TLS protocol version', 'fail', 5, `Negotiated ${cert.protocol}.`, 'Disable TLS 1.0/1.1 and offer TLS 1.2 and 1.3.')
    : item('tls-version', 'HTTPS & certificate', 'TLS protocol version', 'pass', 5, `Negotiated ${cert.protocol}.`));
  return out;
}

export function emailItems({ mx, spf, dmarc, caa }) {
  const out = [];
  const mail = mx.length > 0;
  if (!mail) {
    out.push(item('spf', 'DNS & email', 'SPF record', 'na', 5, 'No MX records: the domain does not receive email.'));
    out.push(item('dmarc', 'DNS & email', 'DMARC policy', dmarc ? 'pass' : 'warn', 5, dmarc || 'No DMARC record.', dmarc ? '' : 'Publish "v=DMARC1; p=reject" to stop others spoofing the domain.'));
  } else {
    out.push(!spf ? item('spf', 'DNS & email', 'SPF record', 'fail', 5, 'No SPF record found.', 'Publish a TXT record such as "v=spf1 include:<your-mail-provider> -all".')
      : /\+all\b|\s\?all\b/.test(spf) ? item('spf', 'DNS & email', 'SPF record', 'fail', 5, spf, 'Replace "+all" / "?all" with "~all" or "-all".')
        : item('spf', 'DNS & email', 'SPF record', 'pass', 5, spf));
    const policy = /(?:^|;)\s*p=(\w+)/i.exec(dmarc || '')?.[1]?.toLowerCase();
    out.push(!dmarc ? item('dmarc', 'DNS & email', 'DMARC policy', 'fail', 5, 'No DMARC record found.', 'Publish a TXT record at _dmarc with "v=DMARC1; p=quarantine; rua=mailto:…".')
      : policy === 'none' ? item('dmarc', 'DNS & email', 'DMARC policy', 'warn', 5, dmarc, 'Move the policy from "none" to "quarantine" or "reject".')
        : item('dmarc', 'DNS & email', 'DMARC policy', 'pass', 5, dmarc));
  }
  out.push(caa.length ? item('caa', 'DNS & email', 'CAA record', 'pass', 3, caa.join(' · ')) : item('caa', 'DNS & email', 'CAA record', 'warn', 3, 'No CAA record.', 'Add a CAA record to limit which CAs may issue certificates for the domain.'));
  return out;
}

// ---------- live lookups ----------

const withTimeout = (p, ms, fallback) => Promise.race([p.catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), ms))]);

function getTls(host) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const socket = tls.connect({ host, port: 443, servername: host, lookup: safeLookup, rejectUnauthorized: false, timeout: 8000 }, () => {
      const c = socket.getPeerCertificate();
      const validTo = c?.valid_to ? new Date(c.valid_to) : null;
      finish(c && c.subject ? {
        authorized: socket.authorized, authError: socket.authorizationError ? String(socket.authorizationError) : '',
        protocol: socket.getProtocol(), issuer: c.issuer?.O || c.issuer?.CN || 'unknown',
        subject: c.subject?.CN || '', altNames: String(c.subjectaltname || '').split(', ').map((s) => s.replace(/^DNS:/, '')).filter(Boolean).slice(0, 12),
        validFrom: new Date(c.valid_from).toISOString(), validTo: validTo.toISOString(), daysLeft: Math.floor((validTo - Date.now()) / 86_400_000),
      } : null);
      socket.end();
    });
    socket.on('error', () => finish(null));
    socket.on('timeout', () => { socket.destroy(); finish(null); });
  });
}

function headOnly(url) {
  return new Promise((resolve) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, { method: 'GET', lookup: safeLookup, agent: false, timeout: 9000, headers: { 'User-Agent': 'SEOAuditAnalyzerBot/0.1 (security check)', Accept: '*/*' } }, (res) => {
      resolve({ status: res.statusCode, headers: res.headers });
      res.destroy();
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

const txt = async (name) => (await dns.resolveTxt(name).catch(() => [])).map((r) => r.join(''));

async function getAsn(ip) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return null;
  const rev = ip.split('.').reverse().join('.');
  const [origin] = await txt(`${rev}.origin.asn.cymru.com`);
  if (!origin) return null;
  const [asn, prefix, country] = origin.split('|').map((s) => s.trim());
  const [name] = await txt(`AS${asn.split(' ')[0]}.asn.cymru.com`);
  return { asn: `AS${asn.split(' ')[0]}`, prefix, country, name: name ? name.split('|').pop().trim() : '' };
}

let rdapBootstrap = null;
/** IANA's RDAP bootstrap maps each TLD to its registry's server (cached for the life of the process). */
async function rdapBase(tld) {
  if (!rdapBootstrap) {
    const res = await fetch('https://data.iana.org/rdap/dns.json', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    rdapBootstrap = new Map();
    for (const [tlds, urls] of (await res.json()).services || []) {
      const url = urls.find((u) => u.startsWith('https://')) || urls[0];
      for (const t of tlds) rdapBootstrap.set(t, url.endsWith('/') ? url : `${url}/`);
    }
  }
  return rdapBootstrap.get(tld.toLowerCase()) || null;
}

async function getRdap(apex) {
  try {
    const base = await rdapBase(apex.split('.').pop());
    if (!base) return null;
    const res = await fetch(`${base}domain/${encodeURIComponent(apex)}`, { redirect: 'follow', signal: AbortSignal.timeout(9000), headers: { Accept: 'application/rdap+json' } });
    if (!res.ok) return null;
    const j = await res.json();
    const ev = (a) => j.events?.find((e) => e.eventAction === a)?.eventDate || null;
    const reg = j.entities?.find((e) => e.roles?.includes('registrar'));
    const registrar = reg?.vcardArray?.[1]?.find((f) => f[0] === 'fn')?.[3] || '';
    const created = ev('registration');
    const expires = ev('expiration');
    return {
      registrar, created, expires, updated: ev('last changed'),
      ageDays: created ? Math.floor((Date.now() - new Date(created)) / 86_400_000) : null,
      daysToExpiry: expires ? Math.floor((new Date(expires) - Date.now()) / 86_400_000) : null,
      status: (j.status || []).slice(0, 6),
    };
  } catch {
    return null;
  }
}

const CDN_HINTS = [
  ['Cloudflare', (h) => h['cf-ray'] || /cloudflare/i.test(h.server || '')], ['Vercel', (h) => h['x-vercel-id']], ['Netlify', (h) => h['x-nf-request-id']],
  ['Fastly', (h) => h['x-served-by'] && /cache/i.test(h['x-served-by'])], ['Akamai', (h) => /akamai/i.test(h.server || '') || h['x-akamai-transformed']],
  ['Amazon CloudFront', (h) => h['x-amz-cf-id'] || /cloudfront/i.test(h.via || '')], ['Sucuri', (h) => h['x-sucuri-id']], ['Google Cloud', (h) => /gws|gse|esf/i.test(h.server || '')],
];
export const detectCdn = (h) => CDN_HINTS.find(([, f]) => f(h))?.[0] || '';

/** Run the whole audit for a URL. */
export async function auditSecurity(input) {
  const url = normalizeUserUrl(input);
  const host = url.hostname;
  const apex = apexOf(host);
  const addresses = await resolvePublicAddresses(host);

  const [https_, plain, cert] = await Promise.all([
    withTimeout(headOnly(new URL(`https://${host}/`)), 11000, null),
    withTimeout(headOnly(new URL(`http://${host}/`)), 11000, null),
    withTimeout(getTls(host), 10000, null),
  ]);

  const redirectsToHttps = !!plain && plain.status >= 300 && plain.status < 400 && /^https:\/\//i.test(String(plain.headers.location || ''));
  const httpItems = [
    plain === null ? item('http-redirect', 'HTTPS & certificate', 'HTTP redirects to HTTPS', 'na', 10, 'Port 80 did not answer (HTTPS-only).')
      : redirectsToHttps ? item('http-redirect', 'HTTPS & certificate', 'HTTP redirects to HTTPS', 'pass', 10, `http:// answers ${plain.status} → ${plain.headers.location}`)
        : item('http-redirect', 'HTTPS & certificate', 'HTTP redirects to HTTPS', 'fail', 10, `http:// answers ${plain.status} without redirecting to https://.`, 'Redirect all http:// requests to https:// with a 301.'),
  ];
  const headers = https_?.headers || {};
  const items = [
    ...httpItems,
    ...certItems(cert),
    ...(https_ ? headerItems(headers) : [item('headers', 'Headers', 'Security headers', 'na', 0, 'The HTTPS response could not be read.')]),
  ];
  return {
    host, apex, checkedAt: new Date().toISOString(),
    ...scoreItems(items),
    items,
    tls: cert,
    cdn: detectCdn(headers),
  };
}
