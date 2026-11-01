'use client';

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('light');

  // Light is the default; only an explicit saved choice switches to dark.
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const next = theme === 'dark' ? 'light' : 'dark';
    const apply = () => {
      root.dataset.theme = next;
      setTheme(next);
    };
    root.classList.add('theme-anim');
    const done = () => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-anim')));
    if (document.startViewTransition) {
      document.startViewTransition(() => flushSync(apply)).finished.then(done, done);
    } else {
      apply();
      done();
    }
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* storage unavailable */
    }
  };

  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label}
      className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted transition hover:border-accent hover:text-accent active:scale-95">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {dark ? (
          <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </button>
  );
}
