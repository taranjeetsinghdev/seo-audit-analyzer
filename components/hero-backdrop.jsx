// Decorative hero animation: a slowly rotating aurora, orbiting rings and floating audit "chips".
// Pure CSS, aria-hidden, paused for reduced-motion users via the global rule.
const CHIPS = [
  ['<title>', 'pass', '6%', '18%', 0],
  ['HTTPS', 'pass', '90%', '12%', 1.2],
  ['alt text', 'fail', '3%', '58%', 2.1],
  ['LCP 2.1s', 'pass', '93%', '52%', 0.6],
  ['canonical', 'pass', '12%', '86%', 1.7],
  ['og:image', 'warn', '86%', '88%', 2.6],
  ['JSON-LD', 'pass', '24%', '4%', 3.1],
  ['robots.txt', 'pass', '74%', '3%', 0.9],
];
const TONE = { pass: 'bg-good', warn: 'bg-warn', fail: 'bg-bad' };

export default function HeroBackdrop() {
  return (
    <div aria-hidden className="no-print pointer-events-none absolute inset-x-0 top-0 -z-[1] hidden h-[44rem] overflow-hidden sm:block">
      <div className="hero-aurora" />
      <div className="hero-rings">
        <span /><span /><span />
      </div>
      <div className="absolute inset-x-0 top-0 h-[28rem]">
      {CHIPS.map(([label, status, left, top, delay]) => (
        <span key={label} className="hero-chip" style={{ ...(parseInt(left, 10) > 50 ? { right: `${100 - parseInt(left, 10)}%` } : { left }), top, animationDelay: `${delay}s` }}>
          <i className={`h-1.5 w-1.5 rounded-full ${TONE[status]}`} />{label}
        </span>
      ))}
      </div>
    </div>
  );
}
