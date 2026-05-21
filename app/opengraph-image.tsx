import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = "Conjuncture — Thailand's Open Procurement Platform";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#111111',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              color: '#ffffff',
              fontSize: '28px',
              fontWeight: '700',
              letterSpacing: '2px',
            }}
          >
            CONJUNCTURE
          </span>
          <span style={{ color: '#444444', fontSize: '22px' }}>•</span>
          <span style={{ fontSize: '24px' }}>🇹🇭</span>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              color: '#ffffff',
              fontSize: '72px',
              fontWeight: '700',
              letterSpacing: '-2px',
              lineHeight: '1.05',
            }}
          >
            Thailand&apos;s Open
            <br />
            Procurement Platform
          </div>
          <div
            style={{
              color: '#888888',
              fontSize: '26px',
              lineHeight: '1.4',
            }}
          >
            Sealed bids · Escrow payments · Government tenders · Verified vendors
          </div>
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <span style={{ color: '#555555', fontSize: '22px', letterSpacing: '0.5px' }}>
            conjuncture.work
          </span>
          <span
            style={{
              background: '#ffffff',
              color: '#111111',
              fontSize: '18px',
              fontWeight: '600',
              padding: '12px 28px',
              borderRadius: '8px',
            }}
          >
            Join the Waitlist
          </span>
        </div>
      </div>
    ),
    size,
  );
}
