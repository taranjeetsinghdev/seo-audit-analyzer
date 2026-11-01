/** Placeholder shaped like the real report while an analysis runs (replaces the old full-screen loader). */
const Sk = ({ className = '', style }) => <div className={`skeleton ${className}`} style={style} />;
const width = (i, min = 45, spread = 45) => `${min + ((i * 37) % spread)}%`;

function NavSkeleton() {
  return (
    <aside className="hidden lg:block" aria-hidden>
      <div className="card space-y-5 p-3">
        {[3, 2, 3, 2].map((rows, g) => (
          <div key={g} className="space-y-2.5">
            <Sk className="ml-2 h-2.5 w-16 rounded" />
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-2">
                <Sk className="h-2 w-2 rounded-full" />
                <Sk className="h-3.5 rounded" style={{ width: width(g * 5 + i, 50, 40) }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function ReportSkeleton({ message }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="mx-auto max-w-7xl px-5 py-6">
      <span className="sr-only">{message || 'Analysing…'}</span>
      <div className="grid gap-x-8 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <NavSkeleton />
        <div className="min-w-0 space-y-6" aria-hidden>
          {/* page heading */}
          <div className="space-y-3">
            <Sk className="h-3 w-20 rounded" />
            <Sk className="h-9 w-72 max-w-full rounded-lg" />
            <Sk className="h-3.5 w-[28rem] max-w-full rounded" />
          </div>

          {/* score card */}
          <div className="card grid gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center">
            <div className="mx-auto flex flex-col items-center gap-3">
              <Sk className="h-44 w-44 rounded-full" />
              <Sk className="h-6 w-36 rounded-full" />
            </div>
            <div className="space-y-5">
              <div className="space-y-2.5"><Sk className="h-7 w-52 rounded-lg" /><Sk className="h-3.5 w-80 max-w-full rounded" /></div>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between"><Sk className="h-3.5 w-28 rounded" /><Sk className="h-3.5 w-14 rounded" /></div>
                  <Sk className="h-2.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* stat tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="card space-y-3 p-4"><Sk className="h-3 w-16 rounded" /><Sk className="h-8 w-14 rounded-lg" /></div>
            ))}
          </div>

          {/* findings list */}
          <div className="space-y-3">
            <Sk className="h-6 w-56 rounded-lg" />
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="card flex items-center gap-4 p-4">
                <Sk className="h-9 w-9 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <Sk className="h-4 rounded" style={{ width: width(i, 40, 35) }} />
                  <Sk className="h-3 rounded" style={{ width: width(i + 2, 55, 40) }} />
                </div>
                <Sk className="hidden h-6 w-16 shrink-0 rounded-full sm:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {message && <p className="mt-6 text-center font-mono text-xs text-muted">{message}</p>}
    </div>
  );
}
