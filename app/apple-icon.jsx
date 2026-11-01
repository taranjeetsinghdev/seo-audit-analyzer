import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #142c43, #1c5269)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="132" height="132" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="20" fill="none" stroke="#8bd8e3" strokeOpacity=".25" strokeWidth="2" />
          <path d="M15 39h8l6-14 8 20 6-13h6" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="49" cy="32" r="4" fill="#65d6c5" />
        </svg>
      </div>
    ),
    size,
  );
}
