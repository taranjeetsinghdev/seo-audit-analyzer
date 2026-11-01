export class UrlValidationError extends Error {
  constructor(message, code = 'invalid_url') {
    super(message);
    this.name = 'UrlValidationError';
    this.code = code;
  }
}

const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);
const BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home', '.corp'];
const DNS_URL = 'https://cloudflare-dns.com/dns-query';

function ipFamily(ip) {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip.split('.').every((part) => Number(part) <= 255) ? 4 : 0;
  }
  return ip.includes(':') && expandIPv6(ip) ? 6 : 0;
}

/** Parse and normalise user input into a public-looking http(s) URL. */
export function normalizeUserUrl(input) {
  if (typeof input !== 'string') throw new UrlValidationError('URL must be a string.');
  let raw = input.trim();
  if (!raw) throw new UrlValidationError('Please enter a URL.');
  if (raw.length > 2048) throw new UrlValidationError('URL is too long.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlValidationError('That does not look like a valid URL.');
  }
  assertAllowedUrl(url);
  url.hash = '';
  return url;
}

/** Synchronous checks applied to the initial URL and every redirect target. */
export function assertAllowedUrl(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlValidationError('Only http and https URLs are supported.', 'blocked_scheme');
  }
  if (url.username || url.password) {
    throw new UrlValidationError('URLs with embedded credentials are not allowed.', 'blocked_credentials');
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new UrlValidationError(`Port ${url.port} is not allowed.`, 'blocked_port');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host) throw new UrlValidationError('URL has no hostname.');
  if (host === 'localhost' || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UrlValidationError('Local and internal hostnames are not allowed.', 'blocked_host');
  }
  if (ipFamily(host) && isPrivateIp(host)) {
    throw new UrlValidationError('Private and reserved IP addresses are not allowed.', 'blocked_ip');
  }
  if (!ipFamily(host) && !host.includes('.')) {
    throw new UrlValidationError('Hostname must be a fully-qualified domain.', 'blocked_host');
  }
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0);
}

const V4_BLOCKS = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3], // multicast + reserved + broadcast (224.0.0.0 - 255.255.255.255)
].map(([base, bits]) => [ipv4ToInt(base), bits]);

function isPrivateIPv4(ip) {
  const n = ipv4ToInt(ip);
  return V4_BLOCKS.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    return n >= base && n < base + size;
  });
}

/** Expand an IPv6 string into eight 16-bit groups. Returns null if unparsable. */
function expandIPv6(ip) {
  let addr = ip.split('%')[0];
  const dotted = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split('.').map(Number);
    addr =
      addr.slice(0, -dotted[1].length) +
      ((a << 8) | b).toString(16) +
      ':' +
      ((c << 8) | d).toString(16);
  }
  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  const nums = groups.map((g) => parseInt(g || '0', 16));
  return nums.length === 8 && nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff)
    ? nums
    : null;
}

function embeddedV4(hi, lo) {
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

function isPrivateIPv6(ip) {
  const g = expandIPv6(ip);
  if (!g) return true; // fail closed
  const [a, b, c, d, e, f, g6, h] = g;
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && h === 1) return true; // ::1
  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && f === 0xffff) {
    return isPrivateIPv4(embeddedV4(g6, h)); // ::ffff:a.b.c.d
  }
  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && f === 0) {
    return true; // deprecated IPv4-compatible
  }
  if (a === 0x64 && b === 0xff9b) return isPrivateIPv4(embeddedV4(g6, h)); // NAT64
  if (a === 0x2002) return isPrivateIPv4(embeddedV4(b, c)); // 6to4
  if ((a & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((a & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((a & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local
  if ((a & 0xff00) === 0xff00) return true; // multicast
  if (a === 0x2001 && b === 0x0db8) return true; // documentation
  if (a === 0x2001 && b === 0) return true; // Teredo
  return false;
}

export function isPrivateIp(ip) {
  const family = ipFamily(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

async function dnsQuery(hostname, type) {
  const url = new URL(DNS_URL);
  url.searchParams.set('name', hostname);
  url.searchParams.set('type', type);
  const response = await fetch(url, {
    headers: { Accept: 'application/dns-json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`DNS query returned HTTP ${response.status}`);
  return response.json();
}

/** Resolve a hostname over HTTPS and reject any private or reserved answers. */
export async function resolvePublicAddresses(hostname, depth = 0) {
  const host = hostname.replace(/^\[|\]$/g, '');
  const family = ipFamily(host);
  if (family) {
    if (isPrivateIp(host)) throw new UrlValidationError('Private address blocked.', 'blocked_ip');
    return [{ address: host, family }];
  }
  if (depth > 5) throw new UrlValidationError(`Could not resolve host "${host}".`, 'dns_failure');

  let answers;
  try {
    answers = (await Promise.all([dnsQuery(host, 'A'), dnsQuery(host, 'AAAA')])).flatMap((result) => result.Answer || []);
  } catch {
    throw new UrlValidationError(`Could not resolve host "${host}".`, 'dns_failure');
  }

  const records = answers
    .filter((answer) => answer.type === 1 || answer.type === 28)
    .map((answer) => ({ address: answer.data, family: answer.type === 1 ? 4 : 6 }));
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new UrlValidationError('Host resolves to a private or reserved address.', 'blocked_ip');
  }
  if (records.length) return records;

  const alias = answers.find((answer) => answer.type === 5)?.data?.replace(/\.$/, '');
  if (alias) return resolvePublicAddresses(alias, depth + 1);
  throw new UrlValidationError(`No DNS records for "${host}".`, 'dns_failure');
}
