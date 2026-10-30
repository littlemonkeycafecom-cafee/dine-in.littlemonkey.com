import React, { useState } from 'react';
import { Product } from '../types';
import { ArrowRight, Sparkles, Layers } from 'lucide-react';
import { PromotionalDrawer } from './PromotionalDrawer';

interface ColdBrewHeroBannerProps {
  onProductClick: (product: Product) => void;
}

export const ColdBrewHeroBanner: React.FC<ColdBrewHeroBannerProps> = ({
  onProductClick,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleOpenDrawer = () => {
    setIsDrawerOpen(true);
  };

  const handleProductSelect = (product: Product) => {
    onProductClick(product);
  };

  return (
    <>
      <section
        aria-label="Promotional Specialty Coffee Banner"
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '12px 16px 20px 16px',
          boxSizing: 'border-box',
        }}
      >
        {/* Floating Interactive Promotional Banner */}
        <div
          onClick={handleOpenDrawer}
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-expanded={isDrawerOpen}
          aria-label="Open Craft Meets Cold Specialty Cold Brew Menu Drawer"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenDrawer();
            }
          }}
          className="lm-floating-banner"
          style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#050505',
            border: '1px solid rgba(255, 194, 26, 0.4)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85), 0 0 24px rgba(255, 194, 26, 0.12)',
            cursor: 'pointer',
            transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
            minHeight: '270px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#FFC21A';
            e.currentTarget.style.boxShadow =
              '0 20px 48px rgba(0, 0, 0, 0.95), 0 0 32px rgba(255, 194, 26, 0.24)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 194, 26, 0.4)';
            e.currentTarget.style.boxShadow =
              '0 16px 40px rgba(0, 0, 0, 0.85), 0 0 24px rgba(255, 194, 26, 0.12)';
          }}
        >
          {/* Background Photography Asset */}
          <img
            src="/images/cold-brew/cold-brew-hero-wide.png"
            alt="Little Monkey Café Specialty Cold Brew — Craft Meets Cold"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 38%',
              display: 'block',
              zIndex: 1,
            }}
          />

          {/* Controlled Contrast Vignette Overlays */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(5, 5, 5, 0.8) 0%, rgba(5, 5, 5, 0.3) 45%, rgba(5, 5, 5, 0.96) 100%)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />

          {/* Top Promotional Badges Container */}
          <div
            style={{
              position: 'relative',
              zIndex: 3,
              padding: '14px 16px 0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(8, 8, 8, 0.92)',
                border: '1px solid rgba(255, 194, 26, 0.5)',
                borderRadius: '999px',
                padding: '4px 11px',
                color: '#FFC21A',
                fontSize: '10.5px',
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
            >
              <Sparkles size={12} style={{ color: '#FFC21A' }} />
              <span>CRAFT MEETS COLD</span>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'rgba(34, 197, 94, 0.22)',
                border: '1px solid rgba(34, 197, 94, 0.5)',
                borderRadius: '999px',
                padding: '4px 10px',
                color: '#4ADE80',
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
            >
              <span>SPECIALTY COFFEE RESERVE • 18-HR STEEPED</span>
            </div>
          </div>

          {/* Bottom Editorial Content & Interactive Action */}
          <div
            style={{
              position: 'relative',
              zIndex: 3,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
              }}
            >
              <div style={{ maxWidth: '440px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#FFC21A',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: '3px',
                  }}
                >
                  THE ICE SIDE OF COFFEE
                </div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 'clamp(20px, 4.2vw, 28px)',
                    fontFamily: '"Playfair Display", Georgia, serif',
                    fontWeight: 700,
                    color: '#F5F5F5',
                    lineHeight: 1.15,
                    textShadow: '0 2px 8px rgba(0, 0, 0, 0.85)',
                  }}
                >
                  Craft Cold Brew Collection
                </h2>
                <p
                  style={{
                    margin: '4px 0 0 0',
                    fontSize: 'clamp(11px, 2.2vw, 12.5px)',
                    color: '#A3A3A3',
                    lineHeight: 1.35,
                  }}
                >
                  Single-Origin Arabica • 10 Signature Handcrafted Brews • Starting at ₹199
                </p>
              </div>

              {/* Drawer Affordance Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDrawer();
                }}
                aria-label="Open Cold Brew Collection Drawer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#FFC21A',
                  color: '#080808',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 15px',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 16px rgba(255, 194, 26, 0.35)',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease, transform 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FBC324';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFC21A';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <Layers size={14} />
                <span>EXPLORE DRAWER</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Promotional Menu Drawer */}
      <PromotionalDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onProductSelect={handleProductSelect}
      />
    </>
  );
};
