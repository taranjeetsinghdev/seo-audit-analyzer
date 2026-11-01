import { ImageResponse } from 'next/og';

export const alt = 'SEO Audit Analyzer — evidence-backed SEO audits';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #f3f6fa 0%, #e4f3f5 100%)', color: '#182b3b', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 72, height: 72, background: 'linear-gradient(135deg, #142c43, #1c5269)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="52" height="52" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="20" fill="none" stroke="#8bd8e3" strokeOpacity=".25" strokeWidth="2" />
              <path d="M15 39h8l6-14 8 20 6-13h6" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="49" cy="32" r="4" fill="#65d6c5" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>SEO Audit Analyzer</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, maxWidth: 940 }}>Every finding shows the evidence behind it.</div>
          <div style={{ fontSize: 32, color: '#708092', marginTop: 24 }}>Titles · headings · indexing · social cards · links · structured data</div>
        </div>
      </div>
    ),
    size,
  );
}
