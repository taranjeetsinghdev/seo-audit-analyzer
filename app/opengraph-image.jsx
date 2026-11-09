import { ImageResponse } from 'next/og';

export const alt = 'SEO Audit Analyzer — evidence-led site diagnostics';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#f1eee5', color: '#20231e', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 14, height: '100%', background: '#d95732' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ width: 76, height: 76, background: '#d95732', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="58" height="58" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="20" fill="none" stroke="#fff8ed" strokeOpacity=".24" strokeWidth="2" />
              <path d="M14 37h10l6-12 8 19 6-12h6" fill="none" stroke="#fff8ed" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="50" cy="32" r="3.5" fill="#f3c76a" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#70736a', fontSize: 14, fontWeight: 600, letterSpacing: 3 }}>SEO / AUDIT</div>
            <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 38, fontWeight: 700, letterSpacing: -1 }}>Analyzer<span style={{ color: '#d95732' }}>.</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 830 }}>
            <div style={{ color: '#d95732', fontSize: 16, fontWeight: 600, letterSpacing: 3 }}>INDEPENDENT SITE DIAGNOSTICS</div>
            <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3, marginTop: 18 }}>Find the signal in your site.</div>
            <div style={{ fontSize: 25, color: '#70736a', marginTop: 24 }}>Evidence-led SEO audits. Clear findings. Better next steps.</div>
          </div>
          <div style={{ width: 150, height: 150, border: '2px solid #d7d1c4', borderRadius: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d95732', fontSize: 42, fontWeight: 700 }}>86<span style={{ color: '#70736a', fontSize: 16 }}>/100</span></div>
        </div>
      </div>
    ),
    size,
  );
}
