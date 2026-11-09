import React, { useState, useEffect, useCallback } from 'react';

interface BrandedIntroScreenProps {
  onComplete: () => void;
}

export const BrandedIntroScreen: React.FC<BrandedIntroScreenProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'entering' | 'holding' | 'exiting' | 'finished'>('entering');

  const finishIntro = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      } catch {}
    }
    setPhase('finished');
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    // Respect reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Check if intro has already played in this browser session
    const alreadySeen =
      typeof window !== 'undefined' && sessionStorage.getItem('lm_dinein_intro_seen') === 'true';

    if (prefersReducedMotion || alreadySeen) {
      finishIntro();
      return;
    }

    // Sequence timing: 300ms enter -> 1000ms hold -> 300ms exit
    const holdTimer = setTimeout(() => {
      setPhase('holding');
    }, 350);

    const exitTimer = setTimeout(() => {
      setPhase('exiting');
    }, 1350);

    const completeTimer = setTimeout(() => {
      finishIntro();
    }, 1700);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [finishIntro]);

  if (phase === 'finished') return null;

  return (
    <div
      onClick={finishIntro}
      role="banner"
      aria-label="Little Monkey Café Welcome"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#080808',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        opacity: phase === 'exiting' ? 0 : 1,
        transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: phase === 'exiting' ? 'none' : 'auto',
      }}
    >
      {/* Top Right SKIP Action */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          finishIntro();
        }}
        aria-label="Skip intro animation"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10,
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '999px',
          padding: '6px 14px',
          color: '#FAF7F2',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.15s ease',
        }}
      >
        SKIP →
      </button>

      {/* Subtle Restrained Solar Amber Lighting */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'clamp(300px, 50vw, 540px)',
          height: 'clamp(300px, 50vw, 540px)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251, 195, 36, 0.16) 0%, rgba(251, 195, 36, 0.04) 50%, transparent 70%)',
          filter: 'blur(32px)',
          pointerEvents: 'none',
          opacity: phase === 'entering' ? 0.3 : 1,
          transition: 'opacity 0.6s ease',
        }}
      />

      {/* Centerpiece Logo Container */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          transform: phase === 'entering' ? 'scale(0.92) translateY(8px)' : 'scale(1) translateY(0)',
          opacity: phase === 'entering' ? 0 : 1,
          transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s ease',
        }}
      >
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <img
            src="/branding/little-monkey-logo-transparent.png"
            alt="Little Monkey Café"
            style={{
              height: 'clamp(64px, 12vw, 92px)',
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
              filter: 'drop-shadow(0 8px 24px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 16px rgba(251, 195, 36, 0.25))',
            }}
          />
        </div>

        <h1
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(20px, 4vw, 28px)',
            fontWeight: 700,
            color: '#FAF7F2',
            letterSpacing: '0.02em',
            margin: '0 0 6px 0',
          }}
        >
          Little Monkey Café
        </h1>

        <p
          style={{
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontSize: 'clamp(11px, 2.2vw, 13px)',
            color: '#FBC324',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            margin: 0,
            opacity: 0.9,
          }}
        >
          Coffee and More • Hanamkonda
        </p>

        <span
          style={{
            marginTop: '28px',
            fontSize: '11px',
            color: '#666666',
            letterSpacing: '0.05em',
          }}
        >
          Tap anywhere to continue
        </span>
      </div>
    </div>
  );
};
