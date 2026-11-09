import Link from 'next/link';

export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="12" fill="#d95732" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="#fff8ed" strokeOpacity=".24" strokeWidth="2" />
      <path d="M14 37h10l6-12 8 19 6-12h6" fill="none" stroke="#fff8ed" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="32" r="3.5" fill="#f3c76a" />
    </svg>
  );
}

export default function Logo() {
  return (
    <Link href="/" className="brand-lockup group flex items-center gap-2.5 text-ink" aria-label="SEO Audit Analyzer home">
      <LogoMark className="brand-mark h-9 w-9 shrink-0 transition-transform duration-300 group-hover:scale-105" />
      <span className="brand-wordmark">
        <span className="brand-kicker">SEO / AUDIT</span>
        <span className="brand-name">Analyzer<span className="brand-period">.</span></span>
      </span>
    </Link>
  );
}
