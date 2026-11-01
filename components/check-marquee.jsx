const ITEMS = ['Title tag', 'Meta description', 'Headings', 'Canonical', 'Open Graph', 'Structured data', 'Alt text', 'Core Web Vitals',
  'Broken links', 'Sitemap', 'robots.txt', 'Security headers', 'TLS', 'Accessibility', 'JS rendering', 'Keywords', 'Traffic rank'];

// Endless ticker of what gets checked. Two identical halves translate by -50% for a seamless loop.
export default function CheckMarquee() {
  return (
    <div className="marquee mt-16" aria-label="Checks included in every audit">
      <div className="marquee-track" aria-hidden>
        {[...ITEMS, ...ITEMS].map((t, i) => (
          <span key={i} className="marquee-item"><b>✦</b>{t}</span>
        ))}
      </div>
    </div>
  );
}
