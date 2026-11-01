import Link from 'next/link';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import HomeHero from '@/components/home-hero';
import HeroScene from '@/components/hero-scene';
import HeroBackdrop from '@/components/hero-backdrop';
import CheckMarquee from '@/components/check-marquee';
import { StatsStrip, ModuleExplorer, ScoreExplorer } from '@/components/home-sections';
import { MODULES, EXTRA_PAGES } from '@/lib/modules';
import { SITE } from '@/lib/site';

const STEPS = [
  ['Enter a URL', 'Paste any public page address. We validate it and refuse private or internal targets.'],
  ['We fetch and inspect it live', 'The page is downloaded fresh and parsed. You watch each stage as it happens.'],
  ['Read, fix, download', 'Browse one page per module, work through prioritised fixes, then export the full report.'],
];

const FEATURES = [
  ['Evidence for every finding', 'Each check shows the exact title, tag or value it found — nothing is a black box.'],
  ['Fixes ranked by impact', 'Issues are ordered by impact × confidence so you know what to change first.'],
  ['Honest coverage', 'Checks that do not apply or were not measured are labelled, never faked or silently scored.'],
  ['Twenty-three focused pages', 'On-page, indexing, social, content, accessibility, rendering, performance, links, sitemap, security, keywords and traffic.'],
  ['Server HTML analysis', 'Fetches each page and parses its returned HTML with Cheerio; JavaScript execution is not available on Workers.'],
  ['Download everything', 'Full report as HTML, PDF, Markdown, CSV or JSON — ready to share with a client or ticket.'],
  ['Safe by design', 'Strict network safeguards block private addresses, unsafe redirects and oversized responses.'],
];

const FAQ = [
  ['Is the score a Google ranking score?', 'No. It is a custom audit score from a published rubric (version 2026.3). It shows how a page performs against those checks and does not predict or guarantee rankings.'],
  ['Does it check JavaScript-rendered content?', 'No. The Cloudflare Workers deployment analyzes server-returned HTML and does not execute page JavaScript.'],
  ['Are results live or cached?', 'Live. Every analysis fetches the page at that moment, and the report shows the exact time it was generated.'],
  ['Do I need an account?', 'No. There are no accounts. Your current report lives in your browser tab and is cleared when you close it.'],
  ['Does it measure performance?', 'Yes. A Lighthouse lab test and real-user Core Web Vitals from Google\'s free APIs run automatically after the audit and feed the overall score. Backlink counts need a paid index and are not included.'],
  ['Can I analyse any website?', 'Any public http or https page you are permitted to test. Private network addresses and non-HTML responses are rejected.'],
];

const ALL_MODULES = [
  ...MODULES.map((m) => ({ slug: m.slug, label: m.label, section: m.section, summary: m.summary, checks: m.checks })),
  { slug: 'performance', label: 'Performance & Core Web Vitals', section: 'Technical', summary: 'Lighthouse lab test plus real-user field data from Google, mobile and desktop.', checks: [] },
  { slug: 'broken-links', label: 'Broken links', section: 'Content', summary: 'Every link on the page is requested live and checked for errors and redirects.', checks: [] },
  { slug: 'social-profiles', label: 'Social profiles', section: 'Social', summary: 'Finds every Facebook, Instagram, X, LinkedIn, YouTube and other social link and checks each one is a real, working profile.', checks: [] },
  { slug: 'ai-access', label: 'AI & crawler access', section: 'Site & market', summary: 'Which AI and search crawlers robots.txt allows, and whether llms.txt exists.', checks: [] },
  { slug: 'site-crawl', label: 'Site-wide issues', section: 'Site & market', summary: 'Crawls internal pages for duplicate titles, missing descriptions and thin content.', checks: [] },
  { slug: 'keywords', label: 'Keywords overview', section: 'Site & market', summary: 'Primary keywords found on the page plus platform-focused keyword ideas.', checks: [] },
  { slug: 'sitemap', label: 'Sitemap & robots', section: 'Site & market', summary: 'Reads robots.txt and the XML sitemap live and checks them against the pages found.', checks: [] },
  { slug: 'security', label: 'Security & infrastructure', section: 'Site & market', summary: 'Security headers, TLS certificate, DNS and email records, domain age and hosting.', checks: [] },
  { slug: 'traffic', label: 'Traffic overview', section: 'Site & market', summary: 'Worldwide popularity rank and a six-month trend from the Tranco list.', checks: [] },
];

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE.name,
    description: SITE.description,
    url: SITE.url,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  },
];

export default function Home() {
  return (
    <div className="overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-5">
        <section className="relative pb-6 pt-0 text-left">
          <HeroBackdrop />
          <div className="home-hero">
            <div className="home-hero-copy">
              <p className="hero-in hero-badge">
                <span className="live-dot h-2 w-2 rounded-full bg-good" /> Your website, under the microscope
              </p>
              <h1 className="hero-in mt-6 max-w-3xl text-5xl leading-[0.98] text-balance sm:text-7xl">
                Make every page <span className="gradient-text">search-ready.</span>
              </h1>
              <p className="hero-in mt-6 max-w-xl text-lg text-muted text-pretty">
                A clear, evidence-first SEO audit that turns technical mysteries into your next best moves.
              </p>
              <div className="hero-in mt-8 max-w-2xl">
                <HomeHero />
              </div>
              <p className="hero-in hero-proof mt-5">
                <span aria-hidden>✓</span> Free, instant and no account needed
                <span className="hero-proof-divider" aria-hidden>·</span>
                <a href="#modules">Explore 23 audit modules <span aria-hidden>↗</span></a>
              </p>
            </div>

            <div className="audit-preview" aria-label="Illustrative SEO audit report preview">
              <div className="preview-glow" aria-hidden />
              <div className="preview-window">
                <div className="preview-topbar">
                  <div className="preview-dots" aria-hidden><i /><i /><i /></div>
                  <span className="preview-address">example.com / audit</span>
                  <span className="preview-live"><i /> LIVE</span>
                </div>
                <div className="preview-content">
                  <div className="preview-heading">
                    <div>
                      <p className="preview-kicker">AUDIT OVERVIEW</p>
                      <p className="preview-domain">example.com</p>
                    </div>
                    <span className="preview-period">JUST NOW</span>
                  </div>
                  <div className="preview-score-card">
                    <div className="preview-score-ring"><span>86</span><small>/100</small></div>
                    <div className="preview-score-copy">
                      <strong>Looking good</strong>
                      <span>A few wins are waiting for you.</span>
                      <div className="preview-score-track"><i /></div>
                    </div>
                  </div>
                  <div className="preview-checks">
                    <div className="preview-check"><span className="preview-check-icon is-good">✓</span><span>Page titles</span><b>Great</b></div>
                    <div className="preview-check"><span className="preview-check-icon is-good">✓</span><span>Page speed</span><b>Fast</b></div>
                    <div className="preview-check"><span className="preview-check-icon is-warn">!</span><span>Image alt text</span><b>3 to fix</b></div>
                  </div>
                  <div className="preview-tip">
                    <span className="preview-tip-icon">✳</span>
                    <span><b>Your next best move</b><small>Add descriptive alt text to 3 images</small></span>
                    <span className="preview-tip-arrow">↗</span>
                  </div>
                </div>
              </div>
              <span className="preview-float preview-float-top"><i>↗</i> Visibility, made clear</span>
              <span className="preview-float preview-float-bottom"><i>✦</i> Built on real evidence</span>
            </div>
          </div>
        </section>

        <CheckMarquee />

        <section className="py-8" aria-label="At a glance"><StatsStrip /></section>
        <section className="hero-demo-section" aria-label="Interactive example audit">
          <div className="hero-demo-heading" data-reveal>
            <div>
              <p className="eyebrow text-accent">A closer look</p>
              <h2 className="mt-2 text-3xl sm:text-4xl">Watch your audit take shape.</h2>
            </div>
            <p className="max-w-md text-muted">Every score has a reason. Follow a sample audit as it checks a page and builds a report.</p>
          </div>
          <HeroScene />
        </section>

        <section id="how-it-works" className="scroll-mt-20 py-16">
          <p className="eyebrow text-accent" data-reveal>How it works</p>
          <h2 className="mt-2 text-3xl sm:text-4xl" data-reveal>From URL to fixes in three steps</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} data-reveal style={{ '--d': `${i * 90}ms` }} className="card card-hover spot p-6">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-lg font-bold text-on-accent">{i + 1}</span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="modules" className="scroll-mt-20 py-12" aria-labelledby="index">
          <p className="eyebrow text-accent" data-reveal>Coverage</p>
          <h2 id="index" className="mt-2 text-3xl sm:text-4xl" data-reveal>What gets checked</h2>
          <p className="mt-2 max-w-xl text-muted" data-reveal>Each module has its own page, with its checks, evidence and recommendations.</p>
          <ModuleExplorer modules={ALL_MODULES} />
        </section>

        <section id="features" className="scroll-mt-20 py-16">
          <p className="eyebrow text-accent" data-reveal>Why it&apos;s different</p>
          <h2 className="mt-2 text-3xl sm:text-4xl" data-reveal>Built to be trusted</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([title, body], i) => (
              <li key={title} data-reveal style={{ '--d': `${(i % 3) * 70}ms` }} className="card card-hover spot p-6">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="method" className="scroll-mt-20 py-8">
          <ScoreExplorer />
        </section>

        <section id="about" className="scroll-mt-20 py-16">
          <div className="grid gap-8 sm:grid-cols-[1fr_1.5fr]">
            <div data-reveal>
              <p className="eyebrow text-accent">About us</p>
              <h2 className="mt-2 text-3xl sm:text-4xl">Show the work.</h2>
            </div>
            <div className="space-y-3 text-muted" data-reveal style={{ '--d': '80ms' }}>
              <p>
                Most SEO tools hand you one number and a pile of warnings. We think a score is only useful if
                you can see what produced it. SEO Audit Analyzer reports the exact value found on your page,
                explains why it matters, and says plainly what it did not measure.
              </p>
              <p>
                Everything runs on free, public data sources, and anything we cannot measure is labelled as
                such rather than estimated.
              </p>
              <p><Link href="/about" className="font-medium text-accent underline underline-offset-4">Read more about us →</Link></p>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 py-8">
          <p className="eyebrow text-accent" data-reveal>FAQ</p>
          <h2 className="mt-2 text-3xl sm:text-4xl" data-reveal>Frequently asked questions</h2>
          <div className="mt-8 grid gap-3">
            {FAQ.map(([q, a], i) => (
              <details key={q} data-reveal style={{ '--d': `${i * 50}ms` }} className="card group px-5 py-4 transition open:shadow-[var(--shadow)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-panel-2 text-lg leading-none text-muted transition group-open:rotate-45 group-open:bg-accent group-open:text-on-accent">+</span>
                </summary>
                <p className="mt-3 max-w-3xl text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section data-reveal className="relative my-16 overflow-hidden rounded-lg border border-line bg-surface p-7 text-center shadow-[var(--shadow-sm)] sm:p-10">
          <h2 className="mx-auto max-w-xl text-3xl sm:text-4xl">See what your page is really telling search engines.</h2>
          <p className="mx-auto mt-3 max-w-md text-muted">Free, live and no sign-up. Takes a few seconds.</p>
          <a href="#url-hero" className="btn btn-primary mt-7 px-6 py-3 text-base">
            Audit a page →
          </a>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
