'use client';

import { useEffect, useState } from 'react';

/** Listens for `app:toast` events (see lib/toast.js) and shows a short message. */
export default function Toaster() {
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let timer;
    const onToast = (e) => {
      setMsg({ text: e.detail, id: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2600);
    };
    window.addEventListener('app:toast', onToast);
    return () => {
      window.removeEventListener('app:toast', onToast);
      clearTimeout(timer);
    };
  }, []);

  if (!msg) return null;
  return (
    <div role="status" aria-live="polite"
      className="toast no-print fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full border border-line bg-primary px-4 py-2 text-sm font-medium text-on-primary shadow-lg">
      {msg.text}
    </div>
  );
}
