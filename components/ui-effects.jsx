'use client';

import { useEffect } from 'react';

/** Global interaction polish: spotlight cards and scroll-reveal. No visual output of its own. */
export default function UiEffects() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('reveal-ready');

    // Spotlight: expose pointer position to the nearest .spot element.
    const onMove = (e) => {
      const el = e.target instanceof Element ? e.target.closest('.spot') : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });

    // Reveal-on-scroll for [data-reveal], including nodes added after navigation.
    let io = null;
    const reveal = (el) => el.classList.add('in');
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              reveal(entry.target);
              io.unobserve(entry.target);
            }
          }
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
      );
    }
    const scan = () => {
      document.querySelectorAll('[data-reveal]:not(.in):not([data-seen])').forEach((el) => {
        el.setAttribute('data-seen', '');
        if (io) io.observe(el);
        else reveal(el);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('pointermove', onMove);
      mo.disconnect();
      io?.disconnect();
      root.classList.remove('reveal-ready');
    };
  }, []);

  return null;
}
