import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo';

export const runtime = 'edge';
export const alt = `${SITE_NAME} — Kerala PSC E-Books, Mock Tests & Quizzes`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Default social share card. Pages without their own image (see
// DEFAULT_OG_IMAGE in lib/seo) point here explicitly, because a child segment
// that sets `openGraph` would otherwise drop the inherited file-based image.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #0e2438 0%, #0c1d34 50%, #081328 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #f59e0b, #facc15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f172a',
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            PSC
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -0.5 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2 }}>
            Crack Kerala PSC with smarter preparation
          </div>
          <div style={{ fontSize: 32, color: '#94a3b8', lineHeight: 1.3 }}>
            Interactive e-books · Audio lessons · Video classes · Mock tests & quizzes
          </div>
        </div>
        <div style={{ display: 'flex', height: 8, borderRadius: 8, background: 'linear-gradient(90deg, #fbbf24, #06b6d4, #34d399)' }} />
      </div>
    ),
    size,
  );
}
