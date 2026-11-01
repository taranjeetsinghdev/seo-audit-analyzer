'use client';

import { useEffect, useRef, useState } from 'react';

/** Animates a number from 0 to `value`. Respects reduced motion. */
export default function CountUp({ value, duration = 900, className }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = useState(reduced ? value : 0);
  const raf = useRef(0);

  useEffect(() => {
    if (value === null || value === undefined) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(value);
      return undefined;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setN(Math.round(value * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  if (value === null || value === undefined) return <span className={className}>–</span>;
  return <span className={`tabular-nums ${className || ''}`}>{n}</span>;
}
