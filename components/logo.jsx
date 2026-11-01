import Link from 'next/link';

export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="audit-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#142c43" />
          <stop offset="1" stopColor="#1c5269" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#audit-mark)" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="#8bd8e3" strokeOpacity=".25" strokeWidth="2" />
      <path d="M15 39h8l6-14 8 20 6-13h6" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="49" cy="32" r="4" fill="#65d6c5" />
    </svg>
  );
}

export default function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5 text-ink" aria-label="SEO Audit Analyzer home">
      <LogoMark className="h-8 w-8 transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105" />
      <span className="text-[16px] font-bold tracking-tight sm:text-[17px]">SEO Audit <span className="text-accent">Analyzer</span></span>
    </Link>
  );
}
