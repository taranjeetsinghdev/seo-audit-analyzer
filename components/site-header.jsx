import Link from 'next/link';
import Logo from './logo';
import ThemeToggle from './theme-toggle';
import CountrySelect from './country-select';

const NAV = [
  ['/#how-it-works', 'How it works'],
  ['/#features', 'Features'],
  ['/about', 'About'],
  ['/#faq', 'FAQ'],
];

export default function SiteHeader() {
  return (
    <header className="site-header no-print sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5">
        <Logo />
        <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 text-sm sm:flex">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="site-nav-link rounded-md px-3 py-1.5 text-muted transition hover:bg-panel-2 hover:text-ink">{label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <CountrySelect compact />
          <ThemeToggle />
        </div>
      </div>
      <nav aria-label="Primary" className="no-scrollbar flex gap-1 overflow-x-auto border-t border-line/70 px-4 py-2 sm:hidden">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted transition hover:bg-panel-2 hover:text-ink">{label}</Link>
        ))}
      </nav>
    </header>
  );
}
