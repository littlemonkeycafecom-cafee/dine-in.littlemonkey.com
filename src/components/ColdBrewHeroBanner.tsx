import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface ColdBrewHeroBannerProps {
  onExploreColdBrew: () => void;
}

export const ColdBrewHeroBanner: React.FC<ColdBrewHeroBannerProps> = ({
  onExploreColdBrew,
}) => {
  return (
    <section
      aria-label="Specialty Cold Brew Promotion"
      style={{
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '12px 18px 24px 18px',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={onExploreColdBrew}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onExploreColdBrew();
          }
        }}
        className="lm-interactive-card"
        style={{
          position: 'relative',
          borderRadius: '20px',
          overflow: 'hidden',
          backgroundColor: '#0A0A0A',
          border: '1px solid rgba(251, 195, 36, 0.35)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.75), 0 0 24px rgba(251, 195, 36, 0.12)',
          cursor: 'pointer',
          transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s ease, border-color 0.25s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.borderColor = 'rgba(251, 195, 36, 0.65)';
          e.currentTarget.style.boxShadow =
            '0 18px 48px rgba(0, 0, 0, 0.85), 0 0 32px rgba(251, 195, 36, 0.22)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = 'rgba(251, 195, 36, 0.35)';
          e.currentTarget.style.boxShadow =
            '0 12px 40px rgba(0, 0, 0, 0.75), 0 0 24px rgba(251, 195, 36, 0.12)';
        }}
      >
        {/* Aspect Ratio Container for Responsive Artwork */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 8.5',
            maxHeight: '440px',
            minHeight: '220px',
            overflow: 'hidden',
            backgroundColor: '#080808',
          }}
        >
          <img
            src="/images/cold-brew/cold-brew-hero-wide.png"
            alt="Little Monkey Specialty Cold Brew Experience - Craft Meets Cold"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 38%',
              display: 'block',
              transition: 'transform 0.4s ease',
            }}
          />

          {/* Cinematic Vignette Overlays for Maximum Contrast & Readability */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(5, 5, 5, 0.55) 0%, rgba(5, 5, 5, 0.1) 40%, rgba(5, 5, 5, 0.85) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Top Promotional Badges */}
          <div
            style={{
              position: 'absolute',
              top: '14px',
              left: '16px',
              right: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
              zIndex: 3,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(8, 8, 8, 0.85)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(251, 195, 36, 0.45)',
                borderRadius: '999px',
                padding: '5px 12px',
                color: '#FBC324',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              }}
            >
              <Sparkles size={13} style={{ color: '#FBC324' }} />
              <span>CRAFT MEETS COLD</span>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(34, 197, 94, 0.45)',
                borderRadius: '999px',
                padding: '4px 11px',
                color: '#4ADE80',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.04em',
              }}
            >
              <span>SPECIAL PROMOTION • UP TO 17% OFF</span>
            </div>
          </div>

          {/* Bottom Bar with Headline & CTA */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '16px',
              zIndex: 3,
              background:
                'linear-gradient(0deg, rgba(8, 8, 8, 0.95) 0%, rgba(8, 8, 8, 0.75) 60%, transparent 100%)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#FBC324',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '4px',
                }}
              >
                SPECIALTY COFFEE EXPERIENCE
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 'clamp(18px, 4vw, 28px)',
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  lineHeight: 1.15,
                  textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
                }}
              >
                Craft Cold Brew Collection
              </h2>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: 'clamp(11px, 2.5vw, 13px)',
                  color: '#D4C9BC',
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                Espresso Orange • Tiger Bomb • Passion Fruit — Starting at ₹249
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onExploreColdBrew();
              }}
              className="lm-interactive-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#FBC324',
                color: '#080808',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 16px rgba(251, 195, 36, 0.35)',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <span>Explore Menu</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
