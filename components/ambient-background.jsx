// Page-wide animated backdrop: slow-drifting soft colour fields over a faint dot grid.
// Pure CSS, fixed behind all content, no JavaScript.
export default function AmbientBackground() {
  return (
    <div aria-hidden className="no-print pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="ambient-blob ambient-1" />
      <div className="ambient-blob ambient-2" />
      <div className="ambient-blob ambient-3" />
      <div className="ambient-blob ambient-4" />
      <div className="ambient-dots absolute inset-0" />
    </div>
  );
}
