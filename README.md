# SEO Intelligence

A transparent single-page SEO audit tool built with **Next.js 15 (App Router) + JavaScript**, Tailwind CSS 4 and Cheerio.
Enter a URL and get a documented score, the evidence behind every check, and fixes ranked by impact and confidence.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (node:test)
npm run build && npm start
```

Node 18.18+ is supported (Tailwind is pinned to 4.1.x and Cheerio to 1.0.x for that reason; newer majors want Node 20+).

## Architecture

```
POST /api/seo-analyze  { "url": "https://example.com" }
  → url-validation   scheme / port / credentials / private-IP blocking (IPv4, IPv6, mapped, NAT64, 6to4)
  → html-fetcher     http(s) with connect-time DNS validation, redirect re-validation,
                     timeout, 3 MB decompressed-size cap, content-type check
  → seo-extractor    Cheerio: metadata, headings, images, links, JSON-LD
  → seo-rules        19 scored checks (100 pts, incl. 5 live-rendering checks) + advisory checks (0 pts)
  → scoring-engine   score = earned ÷ applicable points × 100; prioritised issues
  → JSON report      checks, issues, coverage, rubricVersion, generatedAt
```

- `app/` – home, `/report` overview, `/report/[slug]` module pages, API handler
- `components/` – module pages and detail views, shell/navigation, downloads, full-report view
- `lib/` – framework-free analysis modules (unit tested)
- `tests/` – URL validation, rules and scoring tests

## Pages

`/` landing + URL form · `/report` overview · one page per module: `title`, `description`, `headings`, `canonical`,
`robots`, `open-graph`, `twitter-cards`, `images`, `links`, `structured-data`, `technical` · `recommendations` ·
`export` (download the whole report as HTML, PDF/print, Markdown, CSV or JSON). The module map lives in `lib/modules.js`.
The current report is kept in `sessionStorage` so pages survive a refresh.

## Scoring

Pass = full weight, warning = half, fail = zero. Not-applicable and errored checks leave the denominator, and the report
discloses how many checks ran. Title/description length ranges are heuristics. **This is not a Google ranking score.**
Advisory checks (HTTP status, duplicate tags, content depth, internal links) are shown but do not change the score.

## Live rendering (free, no external service)

Analysis is built from the **live, JavaScript-rendered DOM**. The server fetches the raw HTML, then renders the page in
headless Chrome via `playwright-core` (uses the Chrome already installed; set `CHROME_PATH` otherwise) and compares the
two on `/report/rendering`. Safeguards: shared browser that relaunches and idles out, one render at a time with a bounded
queue, per-render time budget, and the same private-address checks on every browser request. Turn it off per analysis
with the home-page switch, or globally with `RENDER_MODE=off`. Without a browser the app falls back to raw HTML and says so.

## Performance (free, on demand)

`/report/performance` calls Google PageSpeed Insights (Lighthouse lab data + CrUX field data) and falls back to the
Chrome UX Report API. Needs `GOOGLE_API_KEY` in `.env.local` with both APIs enabled — no billing account required.
Results are cached for 1 hour, rate-limited below Google's 30/min quota, and kept out of the 100-point HTML score.

## Site-wide issues and link checking (free)

- **Site-wide issues** (`/report/site-crawl`): a polite, bounded crawl (10–50 pages, robots.txt honoured, HTML only) that finds
  duplicate titles/descriptions/content, errors, redirects, thin pages, noindex pages, sitemap problems and — only on complete
  crawls — orphan pages. Feeds a 10-point *Site health* score.
- **Broken links** (`/report/broken-links`): live HEAD/GET probing of every link and image on the page.

## Not yet implemented (reported as "not evaluated")

Actual Google indexing and rankings (Google releases this only to a property's verified owner), backlinks and competitor metrics (need a specialist data provider), and
keyword/rank tracking. The report always states what was not measured.

## Production notes

- Rate limiting and the 5-minute report cache are in-memory per instance; use a shared store for multi-instance deploys.
- Add network-level egress restrictions for the fetcher in production — in-app SSRF validation is defence in depth.
