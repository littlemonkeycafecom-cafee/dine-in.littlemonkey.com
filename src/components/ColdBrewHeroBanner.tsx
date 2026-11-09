import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { SPECIALTY_COLD_BREW_PRODUCTS, getBasePrice } from '../services/catalog';
import {
  ChevronDown,
  Sparkles,
  Layers,
  Coffee,
  Droplets,
  CheckCircle2,
  ChevronRight,
  Flame,
  Snowflake,
} from 'lucide-react';
import { CoffeeCinematicExperience } from './CoffeeCinematicExperience';

interface ColdBrewHeroBannerProps {
  onProductClick?: (product: Product) => void;
}

export const ColdBrewHeroBanner: React.FC<ColdBrewHeroBannerProps> = ({
  onProductClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCinematicOpen, setIsCinematicOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'drinks' | 'comparison'>('drinks');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const showcaseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  const handleProductSelect = (product: Product) => {
    onProductClick?.(product);
  };

  return (
    <>
      <section
        aria-label="Specialty Coffee Feature"
        className="lm-coffee-banner-section"
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '12px 16px',
          boxSizing: 'border-box',
        }}
      >
        {/* Compact, Premium Coffee Banner Card */}
        <div
          className="lm-compact-coffee-card"
          style={{
            maxWidth: '820px',
            width: '100%',
            margin: '0 auto',
            backgroundColor: '#0E0E0E',
            border: isExpanded
              ? '1px solid #FFC21A'
              : '1px solid rgba(255, 194, 26, 0.35)',
            borderRadius: '12px',
            padding: '10px 14px',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            transition: 'border-color 0.22s ease, box-shadow 0.22s ease',
            boxShadow: isExpanded
              ? '0 6px 24px rgba(0, 0, 0, 0.7), 0 0 16px rgba(255, 194, 26, 0.16)'
              : '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 10px rgba(255, 194, 26, 0.08)',
          }}
        >
          {/* Left: Thumbnail & Minimal Branding */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: 0,
            }}
          >
            {/* Carefully Cropped Coffee Image (Natural Aspect Ratio Preserved) */}
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#080808',
                border: '1px solid rgba(255, 194, 26, 0.3)',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <img
                src="/images/cold-brew/cold-brew-campaign-menu.png"
                alt="Specialty Cold Brew"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>

            {/* Restrained Branding & Text */}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: 800,
                  color: '#FFC21A',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  lineHeight: 1.2,
                }}
              >
                CRAFT MEETS COLD
              </div>
              <h3
                style={{
                  fontSize: '15px',
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  margin: '1px 0',
                  lineHeight: 1.25,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Specialty Cold Brew
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '11px',
                  color: '#8E8E93',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                18-hour slow steep • 10 Signature Recipes
              </p>
            </div>
          </div>

          {/* Right: Simple, Elegant "Menu" Control with Rotating Downward Arrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={toggleExpand}
              aria-expanded={isExpanded}
              aria-controls="specialty-coffee-showcase"
              aria-label={isExpanded ? 'Collapse coffee showcase' : 'Open coffee showcase menu'}
              className="lm-coffee-menu-control"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: isExpanded ? '#FFC21A' : 'rgba(255, 194, 26, 0.12)',
                color: isExpanded ? '#080808' : '#FFC21A',
                border: '1px solid rgba(255, 194, 26, 0.45)',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.03em',
                cursor: 'pointer',
                transition: prefersReducedMotion
                  ? 'none'
                  : 'background-color 0.18s ease, color 0.18s ease, transform 0.18s ease',
              }}
              onMouseEnter={(e) => {
                if (!isExpanded) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 194, 26, 0.22)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isExpanded) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 194, 26, 0.12)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <span>Menu</span>
              <ChevronDown
                size={14}
                style={{
                  color: isExpanded ? '#080808' : '#FFC21A',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: prefersReducedMotion
                    ? 'none'
                    : 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </button>
          </div>
        </div>

        {/* Jelly-Like Expanding Coffee Showcase Panel */}
        <div
          id="specialty-coffee-showcase"
          ref={showcaseRef}
          role="region"
          aria-label="Specialty Cold Brew Collection Showcase"
          aria-hidden={!isExpanded}
          style={{
            maxWidth: '820px',
            width: '100%',
            margin: '0 auto',
            overflow: 'hidden',
            maxHeight: isExpanded ? '1800px' : '0px',
            opacity: isExpanded ? 1 : 0,
            transform: isExpanded
              ? 'translateY(0) scale(1)'
              : 'translateY(-8px) scale(0.98)',
            transformOrigin: 'top center',
            transition: prefersReducedMotion
              ? 'opacity 0.15s ease'
              : isExpanded
              ? 'max-height 0.48s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.32s ease, transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)'
              : 'max-height 0.32s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.22s ease, transform 0.25s ease',
            pointerEvents: isExpanded ? 'auto' : 'none',
          }}
        >
          <div
            style={{
              marginTop: '10px',
              backgroundColor: '#0B0B0B',
              border: '1px solid rgba(255, 194, 26, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              boxSizing: 'border-box',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8), 0 0 16px rgba(255, 194, 26, 0.1)',
            }}
          >
            {/* Sub-Header & Segmented Control */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                paddingBottom: '12px',
                borderBottom: '1px solid #1E1E1E',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={15} style={{ color: '#FFC21A' }} />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#FAF7F2',
                    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                  }}
                >
                  The Ice Side of Coffee
                </span>
              </div>

              {/* View Switcher: Drinks Collection vs Comparison */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#141414',
                  border: '1px solid #242424',
                  borderRadius: '6px',
                  padding: '2px',
                  gap: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('drinks')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: activeTab === 'drinks' ? '#FFC21A' : 'transparent',
                    color: activeTab === 'drinks' ? '#080808' : '#888888',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Drinks (10)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('comparison')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: activeTab === 'comparison' ? '#FFC21A' : 'transparent',
                    color: activeTab === 'comparison' ? '#080808' : '#888888',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Cold Brew vs Iced
                </button>
              </div>
            </div>

            {/* TAB 1: Signature Drinks Grid */}
            {activeTab === 'drinks' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
                  gap: '12px',
                }}
              >
                {SPECIALTY_COLD_BREW_PRODUCTS.map((drink, idx) => {
                  const price = getBasePrice(drink) || 249;
                  return (
                    <div
                      key={drink.slug}
                      onClick={() => handleProductSelect(drink)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleProductSelect(drink);
                        }
                      }}
                      style={{
                        backgroundColor: '#121212',
                        border: drink.is_must_try
                          ? '1px solid rgba(255, 194, 26, 0.35)'
                          : '1px solid #222222',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        opacity: isExpanded ? 1 : 0,
                        transform: isExpanded ? 'translateY(0)' : 'translateY(12px)',
                        transition: prefersReducedMotion
                          ? 'none'
                          : 'opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1), transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s ease, box-shadow 0.18s ease',
                        transitionDelay: isExpanded ? `${idx * 28}ms` : '0ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#FFC21A';
                        e.currentTarget.style.transform = isExpanded ? 'translateY(-2px)' : 'translateY(12px)';
                        e.currentTarget.style.boxShadow =
                          '0 6px 18px rgba(0, 0, 0, 0.7), 0 0 12px rgba(255, 194, 26, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = drink.is_must_try
                          ? 'rgba(255, 194, 26, 0.35)'
                          : '#222222';
                        e.currentTarget.style.transform = isExpanded ? 'translateY(0)' : 'translateY(12px)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Image Thumbnail with Aspect Ratio */}
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '16 / 10',
                          backgroundColor: '#080808',
                          position: 'relative',
                          overflow: 'hidden',
                          borderBottom: '1px solid #1A1A1A',
                        }}
                      >
                        {drink.image_url ? (
                          <>
                            <img
                              src={drink.image_url}
                              alt=""
                              aria-hidden="true"
                              className="lm-img-ambient-backdrop"
                              style={{
                                position: 'absolute',
                                inset: '-16px',
                                width: 'calc(100% + 32px)',
                                height: 'calc(100% + 32px)',
                                objectFit: 'cover',
                                filter: 'blur(28px) brightness(0.5) saturate(1.3)',
                                pointerEvents: 'none',
                                userSelect: 'none',
                                zIndex: 1,
                                transform: 'translate3d(0, 0, 0)',
                                opacity: 0.85,
                              }}
                            />
                            <img
                              src={drink.image_url}
                              alt={drink.name}
                              loading="lazy"
                              style={{
                                position: 'relative',
                                zIndex: 2,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center 40%',
                                display: 'block',
                                filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.85))',
                              }}
                            />
                          </>
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#FFC21A',
                            }}
                          >
                            <Coffee size={20} />
                          </div>
                        )}

                        {drink.badge && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '6px',
                              right: '6px',
                              fontSize: '8.5px',
                              fontWeight: 800,
                              backgroundColor: 'rgba(8, 8, 8, 0.85)',
                              color: '#FFC21A',
                              border: '1px solid rgba(255, 194, 26, 0.45)',
                              borderRadius: '3px',
                              padding: '2px 5px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {drink.badge}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div
                        style={{
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          flex: 1,
                          gap: '6px',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 700,
                              color: '#FAF7F2',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={drink.name}
                          >
                            {drink.name}
                          </div>
                          {drink.tagline && (
                            <div
                              style={{
                                fontSize: '10px',
                                color: '#888888',
                                marginTop: '2px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {drink.tagline}
                            </div>
                          )}
                        </div>

                        {/* Price and Details Trigger */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: '6px',
                            borderTop: '1px solid #1E1E1E',
                          }}
                        >
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFC21A' }}>
                            ₹{price}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#9C8C7E',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontWeight: 600,
                            }}
                          >
                            <span>Inspect</span>
                            <ChevronRight size={12} style={{ color: '#FFC21A' }} />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: Cold Brew vs Iced Coffee Comparison */}
            {activeTab === 'comparison' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
                  gap: '12px',
                }}
              >
                {/* Cold Brew Column */}
                <div
                  style={{
                    backgroundColor: '#121212',
                    border: '1px solid rgba(255, 194, 26, 0.45)',
                    borderRadius: '10px',
                    padding: '14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#FFC21A',
                      fontWeight: 800,
                      fontSize: '13px',
                      marginBottom: '10px',
                    }}
                  >
                    <Snowflake size={16} />
                    <span>Craft Cold Brew (18h Immersion)</span>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '18px',
                      fontSize: '11.5px',
                      color: '#D4D4D4',
                      lineHeight: 1.6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <li>
                      <strong style={{ color: '#FAF7F2' }}>Slow Ambient Steeping:</strong> 18-hour continuous extraction at 4°C preserving delicate aromatics.
                    </li>
                    <li>
                      <strong style={{ color: '#FAF7F2' }}>67% Less Acidic:</strong> Gentle on sensitive stomachs; zero scorched oils or tannic bitterness.
                    </li>
                    <li>
                      <strong style={{ color: '#FAF7F2' }}>Velvety Natural Sweetness:</strong> Rich dark chocolate, toasted hazelnut, and caramel undertones.
                    </li>
                    <li>
                      <strong style={{ color: '#FAF7F2' }}>Sustained Energy:</strong> Smooth release of pure caffeine without jittery spikes or sudden crashes.
                    </li>
                  </ul>
                </div>

                {/* Iced Coffee Column */}
                <div
                  style={{
                    backgroundColor: '#121212',
                    border: '1px solid #242424',
                    borderRadius: '10px',
                    padding: '14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#9C8C7E',
                      fontWeight: 700,
                      fontSize: '13px',
                      marginBottom: '10px',
                    }}
                  >
                    <Flame size={16} />
                    <span>Traditional Iced Coffee</span>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '18px',
                      fontSize: '11.5px',
                      color: '#9C8C7E',
                      lineHeight: 1.6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <li>
                      <strong style={{ color: '#D4D4D4' }}>Rapid Hot Extraction:</strong> Hot coffee brewed in 2–3 minutes and flash-poured over melting ice cubes.
                    </li>
                    <li>
                      <strong style={{ color: '#D4D4D4' }}>Higher Acidity:</strong> Heat accelerates extraction of chlorogenic acids, yielding sharp bitter notes.
                    </li>
                    <li>
                      <strong style={{ color: '#D4D4D4' }}>Melting Dilution:</strong> Rapidly melts ice, resulting in thinner mouthfeel and watered-down flavor.
                    </li>
                    <li>
                      <strong style={{ color: '#D4D4D4' }}>Fast Peak & Crash:</strong> Quick caffeine absorption with standard quick peaks.
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Cinematic Modal Experience (Preserved for full-screen immersive view if opened) */}
      <CoffeeCinematicExperience
        isOpen={isCinematicOpen}
        onClose={() => setIsCinematicOpen(false)}
        onProductSelect={handleProductSelect}
      />
    </>
  );
};
