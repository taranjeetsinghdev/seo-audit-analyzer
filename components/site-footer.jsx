import Link from 'next/link';
import Logo from './logo';
import { SITE } from '@/lib/site';

const COLUMNS = [
  { title: 'Product', links: [['/#how-it-works', 'How it works'], ['/#modules', 'What gets checked'], ['/#features', 'Features'], ['/#method', 'Scoring method']] },
  { title: 'Company', links: [['/about', 'About us'], ['/contact', 'Contact'], ['/#faq', 'FAQ']] },
  { title: 'Legal', links: [['/privacy', 'Privacy policy'], ['/terms', 'Terms of use']] },
];

export default function SiteFooter() {
  return (
    <footer className="no-print mt-24 border-t border-line bg-surface/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">
            {SITE.tagline}. Every score comes with the evidence, the reasoning and a fix.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="eyebrow">{col.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map(([href, label]) => (
                <li key={label}><Link href={href} className="text-muted transition hover:text-accent">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE.name}. Scoring rubric 2026.3.</p>
          <p>Audit scores are not Google ranking scores. Not affiliated with Google.</p>
        </div>
      </div>
    </footer>
  );
}
