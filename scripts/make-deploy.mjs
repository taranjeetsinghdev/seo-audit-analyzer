// Runs automatically after `npm run build` (npm "postbuild" hook).
// Assembles ./deploy so that "upload it, restart PM2" is the whole deployment:
//   - default port / host are baked into server.js
//   - runtime settings (API keys etc.) are bundled as ./deploy/.env and loaded by server.js
//   - start.sh (re)creates the PM2 process correctly
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd(); 
const dist = path.resolve(root, process.env.NEXT_DIST_DIR || '.next');
const out = path.resolve(root, process.env.DEPLOY_DIR || 'deploy');
const standalone = path.join(dist, 'standalone');

// DEPLOY_* settings may live in .env.local (so you set them once) or in the real environment.
function fileSetting(name) {
  for (const f of ['.env.production.local', '.env.local']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`, 'm'));
    if (m && m[1]) return m[1].replace(/^(['"])(.*)\\1$/, '$2');
  }
  return undefined;
}
const setting = (name, fallback) => process.env[name] || fileSetting(name) || fallback;

const PORT = Number(setting('DEPLOY_PORT', 5007));
const HOST = setting('DEPLOY_HOST', '127.0.0.1');
const APP = setting('DEPLOY_APP_NAME', 'seo-audit-analyzer');

if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  console.error(`✗ ${path.relative(root, standalone)}/server.js not found. Is output: 'standalone' set in next.config.mjs?`);
  process.exit(1);
}

// Keep a previously uploaded/edited .env if someone customised it only on the server? No: this folder
// is a build artefact, so always start clean.
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 1) the self-contained server
fs.cpSync(standalone, out, { recursive: true });

// 2) bake default port/host and an env-file loader into server.js
const serverFile = path.join(out, 'server.js');
let server = fs.readFileSync(serverFile, 'utf8');
const portHost = server
  .replace(/(const currentPort = parseInt\(process\.env\.PORT, 10\) \|\| )\d+/, `$1${PORT}`)
  .replace(/(const hostname = process\.env\.HOSTNAME \|\| )'[^']*'/, `$1'${HOST}'`);
if (portHost === server) console.warn('! Could not patch the default port in server.js (Next.js changed its template?)');

const LOADER = `
// --- seo-audit-analyzer: load ./.env (runtime settings) without overriding the real environment ---
try {
  const __envFile = path.join(__dirname, '.env');
  if (require('node:fs').existsSync(__envFile)) {
    for (const line of require('node:fs').readFileSync(__envFile, 'utf8').split(/\\r?\\n/)) {
      const m = line.match(/^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(.*?)\\s*$/);
      if (m && !m[1].startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\\1$/, '$2');
    }
  }
} catch { /* ignore a malformed .env */ }
`;
// insert right after __dirname is defined (before anything reads process.env)
const withLoader = portHost.replace(/(const __dirname = [^\n]*\n)/, `$1${LOADER}`);
if (withLoader === portHost) console.warn('! Could not insert the .env loader into server.js');
fs.writeFileSync(serverFile, withLoader);

// 3) runtime settings -> deploy/.env (skip build-only values and empty entries)
let envNote = 'no .env.local found; set API keys in the server environment instead';
const envSource = process.env.DEPLOY_ENV_FILE
  ? path.resolve(root, process.env.DEPLOY_ENV_FILE)
  : [path.join(root, '.env.production.local'), path.join(root, '.env.local')].find((f) => fs.existsSync(f));
if (process.env.DEPLOY_INCLUDE_ENV !== 'false' && envSource && fs.existsSync(envSource)) {
  const SKIP = /^(PORT|HOSTNAME|NEXT_DIST_DIR|DEPLOY_[A-Z_]+|NODE_ENV)$/;
  const lines = fs
    .readFileSync(envSource, 'utf8')
    .split(/\r?\n/)
    .filter((l) => {
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      return m && m[2] && !SKIP.test(m[1]);
    });
  fs.writeFileSync(path.join(out, '.env'), `${lines.join('\n')}\n`, { mode: 0o600 });
  envNote = `${lines.length} setting(s) from ${path.basename(envSource)} bundled as deploy/.env`;
}

// 4) static assets and public files
const staticSrc = path.join(dist, 'static');
if (fs.existsSync(staticSrc)) {
  const staticDest = path.join(out, path.relative(root, dist) || '.next', 'static');
  fs.mkdirSync(path.dirname(staticDest), { recursive: true });
  fs.cpSync(staticSrc, staticDest, { recursive: true });
}
const pub = path.join(root, 'public');
if (fs.existsSync(pub)) fs.cpSync(pub, path.join(out, 'public'), { recursive: true });

// 5) start.sh: always safe, even if the folder was replaced since PM2 last started
fs.writeFileSync(
  path.join(out, 'start.sh'),
  `#!/usr/bin/env bash
# (Re)creates the PM2 process from this folder. Safe to run any time.
cd "$(dirname "$0")" || exit 1
pm2 delete ${APP} >/dev/null 2>&1 || true
pm2 start server.js --name ${APP} --max-memory-restart 1G
pm2 save
pm2 status ${APP}
`,
  { mode: 0o755 },
);

fs.writeFileSync(
  path.join(out, 'DEPLOY.txt'),
  `SEO Intelligence — deploy folder
================================
Default address: ${HOST}:${PORT}   (baked into server.js)
Settings:        ./.env is loaded automatically (API keys etc.)

FIRST TIME (on the server, inside this folder):
    pm2 start server.js --name ${APP}
    pm2 save

EVERY UPDATE:
    1. Upload the files of this folder, overwriting the existing ones
       (overwrite the contents — do not delete the folder itself).
    2. pm2 restart ${APP}

IF THE SITE SHOWS 502 AFTER AN UPDATE (e.g. the folder was deleted and recreated):
    bash start.sh

nginx: proxy_pass http://${HOST}:${PORT};  with proxy_buffering off and proxy_read_timeout 180s.
Needs Node 18.18+. Google Chrome is optional (live rendering / PDF).
Keep .env private: it holds API keys. It is never served by the app.
`,
);

const size = (dir) => {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    n += e.isDirectory() ? size(p) : fs.statSync(p).size;
  }
  return n;
};
console.log(`\n✓ Deploy folder ready: ${path.relative(root, out) || '.'}/  (${(size(out) / 1048576).toFixed(0)} MB)`);
console.log(`  Port ${PORT} · host ${HOST} · ${envNote}`);
console.log(`  On the server:  pm2 start server.js --name ${APP}   (later: pm2 restart ${APP})\n`);
