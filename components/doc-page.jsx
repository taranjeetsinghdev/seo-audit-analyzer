import SiteHeader from './site-header';
import SiteFooter from './site-footer';

/** Shared shell for plain content pages (about, privacy, terms, contact). */
export default function DocPage({ eyebrow, title, intro, updated, children }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pb-6 pt-12">
        <p className="eyebrow text-accent">{eyebrow}</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 text-lg text-muted text-pretty">{intro}</p>}
        {updated && <p className="mt-2 text-xs text-muted">Last updated {updated}</p>}
        <div className="card mt-8 space-y-4 p-6 leading-relaxed sm:p-8 [&_h2]:mt-6 [&_h2]:text-xl [&_li]:ml-5 [&_li]:list-disc [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-panel-2 [&_code]:px-1 [&_code]:text-sm">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
