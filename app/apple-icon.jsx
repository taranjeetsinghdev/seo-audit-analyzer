import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#d95732', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 28 }}>
        <svg width="132" height="132" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="20" fill="none" stroke="#fff8ed" strokeOpacity=".24" strokeWidth="2" />
          <path d="M14 37h10l6-12 8 19 6-12h6" fill="none" stroke="#fff8ed" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="50" cy="32" r="3.5" fill="#f3c76a" />
        </svg>
      </div>
    ),
    size,
  );
}
