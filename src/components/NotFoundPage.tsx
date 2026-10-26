import React from 'react';
import { Home, ArrowLeft } from 'lucide-react';

interface NotFoundPageProps {
  onBackToHome?: () => void;
  onGoBack?: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onBackToHome, onGoBack }) => {
  const handleHomeClick = () => {
    if (onBackToHome) {
      onBackToHome();
    } else {
      window.location.href = '/';
    }
  };

  const handleBackClick = () => {
    if (onGoBack) {
      onGoBack();
    } else {
      if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    }
  };

  return (
    <div
      className="lm-not-found-viewport"
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#050505',
        backgroundImage: `
          radial-gradient(circle at 50% 18%, rgba(255, 194, 26, 0.05) 0%, transparent 55%),
          radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.015) 0%, transparent 40%)
        `,
        color: '#F5F5F5',
        fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 16px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes lmFadeInUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes lmGlowPulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.05);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .lm-animated-hero,
          .lm-ambient-halo {
            animation: none !important;
            transition: none !important;
          }
        }

        .lm-btn-primary {
          background-color: #FFC21A;
          color: #050505;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lm-btn-primary:hover {
          background-color: #FBC324;
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(255, 194, 26, 0.28);
        }
        .lm-btn-primary:active {
          transform: translateY(0);
        }
        .lm-btn-primary:focus-visible {
          outline: 2px solid #FFC21A;
          outline-offset: 3px;
        }

        .lm-btn-secondary {
          background-color: #111111;
          color: #F5F5F5;
          border: 1px solid #242424;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lm-btn-secondary:hover {
          background-color: #181818;
          border-color: #FFC21A;
          color: #FFC21A;
          transform: translateY(-2px);
        }
        .lm-btn-secondary:active {
          transform: translateY(0);
        }
        .lm-btn-secondary:focus-visible {
          outline: 2px solid #FFC21A;
          outline-offset: 3px;
        }
      `}</style>

      {/* Brand Header */}
      <header
        style={{
          width: '100%',
          maxWidth: '960px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 0 24px 0',
        }}
      >
        <button
          onClick={handleHomeClick}
          aria-label="Little Monkey Café Home"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <img
            src="/branding/little-monkey-logo-transparent.png"
            alt="Little Monkey Café"
            style={{
              height: '42px',
              width: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
            }}
          />
          <div style={{ textAlign: 'left' }}>
            <span
              style={{
                display: 'block',
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: '#F5F5F5',
                lineHeight: 1.1,
              }}
            >
              Little Monkey Café
            </span>
            <span
              style={{
                display: 'inline-block',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#FFC21A',
                marginTop: '3px',
              }}
            >
              Fine Dining & Artisanal Brews
            </span>
          </div>
        </button>
      </header>

      {/* Main 404 Hero Card */}
      <main
        className="lm-animated-hero"
        style={{
          width: '100%',
          maxWidth: '620px',
          backgroundColor: '#111111',
          border: '1px solid #242424',
          borderRadius: '24px',
          padding: '48px 32px',
          boxSizing: 'border-box',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
          position: 'relative',
          animation: 'lmFadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* Subtle Ambient Halo behind 404 */}
        <div
          className="lm-ambient-halo"
          style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '260px',
            height: '260px',
            background: 'radial-gradient(circle, rgba(255, 194, 26, 0.12) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 0,
            animation: 'lmGlowPulse 4s ease-in-out infinite',
          }}
        />

        {/* Minimal Café Detail / Cup Line Art */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            padding: '10px',
            borderRadius: '50%',
            backgroundColor: '#080808',
            border: '1px solid #242424',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#FFC21A' }}
            aria-hidden="true"
          >
            {/* Minimal coffee cup with rising steam */}
            <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
            <line x1="6" y1="1" x2="6" y2="4" stroke="#F5F5F5" strokeOpacity="0.5" />
            <line x1="10" y1="1" x2="10" y2="4" stroke="#FFC21A" />
            <line x1="14" y1="1" x2="14" y2="4" stroke="#F5F5F5" strokeOpacity="0.5" />
          </svg>
        </div>

        {/* 404 Hero Display */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(5.2rem, 15vw, 9.5rem)',
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
            margin: '0 auto 18px auto',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <span style={{ color: '#F5F5F5' }}>4</span>
          <span
            style={{
              color: '#FFC21A',
              textShadow: '0 0 30px rgba(255, 194, 26, 0.35)',
              position: 'relative',
              display: 'inline-block',
            }}
          >
            0
          </span>
          <span style={{ color: '#F5F5F5' }}>4</span>
        </div>

        {/* Supporting Headline */}
        <h1
          style={{
            position: 'relative',
            zIndex: 1,
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(1.75rem, 4.5vw, 2.5rem)',
            fontWeight: 700,
            color: '#F5F5F5',
            margin: '0 0 12px 0',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}
        >
          Oops! Wrong Turn.
        </h1>

        {/* Supporting Description */}
        <p
          style={{
            position: 'relative',
            zIndex: 1,
            color: '#A3A3A3',
            fontSize: 'clamp(0.95rem, 2vw, 1.05rem)',
            fontWeight: 400,
            lineHeight: 1.6,
            margin: '0 auto 32px auto',
            maxWidth: '440px',
          }}
        >
          Looks like this page isn't on our menu. Let's get you back to something delicious.
        </p>

        {/* Action Buttons: Primary & Secondary */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
          }}
        >
          {/* Primary Button */}
          <button
            onClick={handleHomeClick}
            className="lm-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '9px',
              padding: '14px 28px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.01em',
              minWidth: '160px',
            }}
          >
            <Home size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>Back to Home</span>
          </button>

          {/* Secondary Button */}
          <button
            onClick={handleBackClick}
            className="lm-btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '9px',
              padding: '14px 26px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.01em',
              minWidth: '140px',
            }}
          >
            <ArrowLeft size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>Go Back</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          width: '100%',
          maxWidth: '960px',
          textAlign: 'center',
          padding: '24px 0 12px 0',
          fontSize: '12px',
          color: '#A3A3A3',
          opacity: 0.65,
        }}
      >
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} Little Monkey Café. Artisanal In-Café Dining.
        </p>
      </footer>
    </div>
  );
};

export default NotFoundPage;
