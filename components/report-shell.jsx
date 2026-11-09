'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ReportSkeleton from './report-skeleton';
import Logo from './logo';
import ThemeToggle from './theme-toggle';
import AnalyzeForm from './analyze-form';
import CountrySelect from './country-select';
import { DownloadMenu } from './downloads';
import { useReport } from './report-context';
import { MODULES, SECTIONS, moduleStatus } from '@/lib/modules';
import { STATUS_STYLE } from './labels';
import SidebarNav from './sidebar-nav';

function NavLink({ href, active, children, status, badge }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition ${
        active ? 'bg-accent/10 font-semibold text-accent' : 'text-muted hover:bg-panel-2 hover:text-ink'
      }`}
    >
      {status ? <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_STYLE[status]?.dot}`} /> : <span className="h-2 w-2 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge ? <span className="rounded-full bg-panel-2 px-1.5 text-[11px] font-semibold text-muted">{badge}</span> : null}
    </Link>
  );
}

export default function ReportShell({ children }) {
  const { report, exportReport, hydrated, status, progress, error, analyzing } = useReport();
  const pathname = usePathname();
  const shown = exportReport || report;

  const items = report
    ? [
        { href: '/report', label: 'Overview', section: null },
        { href: '/report/keywords', label: 'Keywords overview', section: 'Content' },
        ...MODULES.flatMap((m) => [
          { href: `/report/${m.slug}`, label: m.label, section: m.section, status: moduleStatus(m, report.checks) },
          ...(m.slug === 'technical' ? [{ href: '/report/performance', label: 'Performance', section: 'Technical' }] : []),
          ...(m.slug === 'twitter-cards' ? [{ href: '/report/social-profiles', label: 'Social profiles', section: 'Social' }] : []),
          ...(m.slug === 'links' ? [{ href: '/report/broken-links', label: 'Broken links', section: 'Content' }] : []),
        ]),
        { href: '/report/sitemap', label: 'Sitemap & robots', section: 'Site & market' },
        { href: '/report/ai-access', label: 'AI & crawler access', section: 'Site & market' },
        { href: '/report/security', label: 'Security & infrastructure', section: 'Site & market' },
        { href: '/report/traffic', label: 'Traffic overview', section: 'Site & market' },
        { href: '/report/site-crawl', label: 'Site-wide issues', section: 'Site & market' },
        { href: '/report/recommendations', label: 'Recommendations', section: 'Report', badge: shown.issues.length },
        { href: '/report/export', label: 'Download report', section: 'Report' },
      ]
    : [];

  return (
    <div className="min-h-dvh">
      <header className="report-header no-print sticky top-0 z-30 border-b border-line/70 backdrop-blur-md">
        <div className="report-header-inner mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
          <Logo />
          <div className="order-last w-full sm:order-none sm:w-auto sm:max-w-lg sm:flex-1">
            <AnalyzeForm initial={status === 'loading' && analyzing ? analyzing.url : report ? report.requestedUrl : ''} key={status === 'loading' ? `run-${analyzing?.startedAt}` : report?.generatedAt || 'empty'} />
          </div>
          <div className="report-header-actions ml-auto flex items-center gap-2">
            <CountrySelect compact />
            {shown && <DownloadMenu report={shown} />}
            <ThemeToggle />
          </div>
        </div>
        {status === 'loading' && (
          <div className="relative border-t border-line bg-panel-2 px-5 py-1.5 font-mono text-xs" aria-live="polite">
            <span className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-gradient-to-r from-accent to-accent-2" />
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            {progress.length ? progress[progress.length - 1].message : 'Starting live analysis…'}
            {progress.length > 0 && progress[progress.length - 1].score != null && (
              <span className="ml-3 rounded bg-surface px-1.5 py-0.5 font-semibold tabular-nums">score {progress[progress.length - 1].score}</span>
            )}
          </div>
        )}
      </header>

      {!hydrated ? null : status === 'loading' ? (
        <ReportSkeleton message={progress.length ? progress[progress.length - 1].message : 'Starting live analysis…'} />
      ) : !report ? (
        <div className="mx-auto max-w-xl px-5 py-24 text-center">
          <h1 className="text-3xl">{status === 'error' ? 'Analysis failed' : 'No report yet'}</h1>
          <p role={status === 'error' ? 'alert' : undefined} className="mt-2 text-muted">{status === 'error' && error ? error : 'Enter a URL above, or start from the home page.'}</p>
          <Link href="/" className="btn btn-primary mt-6">Go to home</Link>
        </div>
      ) : (
        <div className="report-workspace mx-auto grid gap-x-6 px-5 py-6 lg:grid-cols-[16.5rem_minmax(0,1fr)] xl:gap-x-8">
          <aside className="no-print hidden lg:block">
            <SidebarNav items={items} pathname={pathname} groups={[...SECTIONS, 'Site & market', 'Report']} />
          </aside>

          <nav aria-label="Report modules" className="report-mobile-nav no-print -mx-5 mb-4 flex gap-1.5 overflow-x-auto px-5 pb-1 lg:hidden">
            {items.map((i) => (
              <Link key={i.href} href={i.href} aria-current={pathname === i.href ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                  pathname === i.href ? 'border-accent bg-accent/10 font-semibold text-accent' : 'border-line bg-surface text-muted'
                }`}>
                {i.status && <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[i.status]?.dot}`} />}
                {i.label}
              </Link>
            ))}
          </nav>

          <main className="report-main min-w-0 pb-16">{children}</main>
        </div>
      )}
    </div>
  );
}
