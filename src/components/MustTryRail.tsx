import React, { useMemo } from 'react';
import { Product } from '../types';
import { getBasePrice, getOriginalPrice, getDiscountPercentage } from '../services/catalog';
import { resolveProductImage } from '../services/productImageMap';
import { getImagePresentation } from '../services/imagePresentation';
import { useDineIn } from '../contexts/DineInContext';
import { Sparkles, ArrowRight } from 'lucide-react';

interface MustTryRailProps {
  products: Product[];
  onProductClick: (product: Product) => void;
}

/**
 * AUTHORITATIVE MASTER ITEMS
 * 1. Tiger Bomb Cold Brew (slug: 'cold-brew-tiger-bomb', badge: 'Café Signature')
 * 2. Mont Blanc Cold Brew (slug: 'cold-brew-mont-blanc', badge: 'Alpine Reserve')
 *
 * Exactly two existing master items are displayed in this refined editorial section.
 * No extra cards, no horizontal scroll overflow, and zero ordering/cart controls.
 */
const TARGET_MASTER_SLUGS = ['cold-brew-tiger-bomb', 'cold-brew-mont-blanc'];

export const MustTryRail: React.FC<MustTryRailProps> = ({ products, onProductClick }) => {
  const { isVegOnly } = useDineIn();

  const displayProducts = useMemo(() => {
    // Locate the two designated master signature items in the provided product catalog
    const targetItems = TARGET_MASTER_SLUGS
      .map((slug) => products.find((p) => p.slug === slug))
      .filter((p): p is Product => Boolean(p));

    const candidates = targetItems.length === 2 ? targetItems : products.filter((p) => p.is_must_try);

    // Apply global vegetarian filter if active (both master cold brews are VEG)
    const filtered = isVegOnly
      ? candidates.filter((p) => p.dietary_classification === 'VEG')
      : candidates;

    // Strictly limit to the two authoritative master items
    return filtered.slice(0, 2);
  }, [products, isVegOnly]);

  if (!displayProducts || displayProducts.length === 0) return null;

  return (
    <section
      aria-label="Chef's Curated Recommendations"
      className="lm-must-try-editorial-section lm-featured-master-section"
      style={{
        width: '100%',
        maxWidth: '1240px',
        margin: '0 auto 36px',
        padding: '0 clamp(12px, 3vw, 24px)',
        boxSizing: 'border-box',
      }}
    >
      {/* Editorial Section Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          marginBottom: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Sparkles size={14} style={{ color: '#FBC324' }} />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: '#FBC324',
              textTransform: 'uppercase',
            }}
          >
            Curated Recommendations
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
          <h2
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 'clamp(20px, 2.8vw, 26px)',
              fontWeight: 700,
              color: '#FAF7F2',
              margin: 0,
              letterSpacing: '0.01em',
            }}
          >
            Must-Try Specialties
          </h2>
          <span
            style={{
              fontSize: '12.5px',
              color: '#8A857D',
              fontWeight: 400,
              letterSpacing: '0.02em',
            }}
          >
            Artisanal single-origin cold brews
          </span>
        </div>
      </div>

      {/* Editorial 2-Card Grid */}
      <div
        className="lm-must-try-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 'clamp(14px, 2vw, 22px)',
        }}
      >
        {displayProducts.map((product) => {
          const price = getBasePrice(product);
          const originalPrice = getOriginalPrice(product);
          const discountPercent = getDiscountPercentage(product);
          const isVeg = product.dietary_classification === 'VEG';
          const displayImage = product.image_url || resolveProductImage(product);
          const isAvailable = product.is_available !== false;
          const imgConfig = getImagePresentation(displayImage, product.category, product.slug);

          return (
            <article
              key={product.slug}
              className="lm-must-try-card"
              onClick={() => onProductClick(product)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onProductClick(product);
                }
              }}
              aria-label={`View details for ${product.name}`}
              style={{
                backgroundColor: '#0E0D0B',
                border: '1px solid rgba(251, 195, 36, 0.22)',
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxSizing: 'border-box',
                minWidth: 0,
                position: 'relative',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55), 0 0 16px rgba(251, 195, 36, 0.05)',
                transition: 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.24s ease, box-shadow 0.24s ease',
              }}
            >
              {/* Product Photograph Container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 10',
                  backgroundColor: '#070605',
                  overflow: 'hidden',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Diet Classification Indicator (Top Left) */}
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    zIndex: 4,
                    width: '14px',
                    height: '14px',
                    borderRadius: '2.5px',
                    border: `1.5px solid ${isVeg ? '#22C55E' : '#EF4444'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(5, 5, 5, 0.88)',
                    backdropFilter: 'blur(4px)',
                  }}
                  title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                >
                  <div
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: isVeg ? '#22C55E' : '#EF4444',
                    }}
                  />
                </div>

                {/* Refined Master Signature Badge (Top Right) */}
                {product.badge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      zIndex: 4,
                      fontSize: '9.5px',
                      fontWeight: 800,
                      backgroundColor: 'rgba(14, 13, 11, 0.88)',
                      color: '#FBC324',
                      border: '1px solid rgba(251, 195, 36, 0.35)',
                      borderRadius: '999px',
                      padding: '3px 8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                    }}
                  >
                    {product.badge}
                  </span>
                )}

                {/* Product Photograph with Subtle Ambient Glow */}
                {displayImage ? (
                  <>
                    {imgConfig.useBackdrop && (
                      <img
                        src={displayImage}
                        alt=""
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          inset: '-12px',
                          width: 'calc(100% + 24px)',
                          height: 'calc(100% + 24px)',
                          objectFit: 'cover',
                          objectPosition: imgConfig.position,
                          filter: 'blur(24px) brightness(0.4) saturate(1.2)',
                          pointerEvents: 'none',
                          userSelect: 'none',
                          zIndex: 1,
                          opacity: 0.75,
                        }}
                      />
                    )}
                    <img
                      src={displayImage}
                      alt={product.name}
                      loading="lazy"
                      className="lm-must-try-img"
                      style={{
                        position: 'relative',
                        zIndex: 2,
                        width: '100%',
                        height: '100%',
                        objectFit: imgConfig.fit,
                        objectPosition: imgConfig.position,
                        padding: imgConfig.fit === 'contain' ? (imgConfig.padding || '8px') : '0',
                        filter: imgConfig.fit === 'contain'
                          ? 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.8))'
                          : 'none',
                        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
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
                      backgroundColor: '#0D0D0D',
                      color: '#FBC324',
                    }}
                  >
                    <Sparkles size={20} />
                  </div>
                )}
              </div>

              {/* Product Editorial Details */}
              <div
                style={{
                  padding: '14px 16px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  flex: 1,
                  gap: '12px',
                  backgroundColor: '#0E0D0B',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontFamily: '"Playfair Display", Georgia, serif',
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#FAF7F2',
                      margin: '0 0 5px 0',
                      lineHeight: 1.3,
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                    title={product.name}
                  >
                    {product.name}
                  </h3>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#9C8C7E',
                      margin: 0,
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {product.description || product.tagline}
                  </p>
                </div>

                {/* Price Presentation & Refined View Action */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    gap: '8px',
                  }}
                >
                  {/* Price Block */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#FBC324', letterSpacing: '-0.01em' }}>
                      ₹{price !== null ? price : '—'}
                    </span>
                    {originalPrice && originalPrice > (price || 0) && (
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#6B6258',
                          textDecoration: 'line-through',
                          fontWeight: 500,
                        }}
                      >
                        ₹{originalPrice}
                      </span>
                    )}
                    {discountPercent && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: '#22C55E',
                          backgroundColor: 'rgba(34, 197, 94, 0.12)',
                          borderRadius: '4px',
                          padding: '1px 5px',
                        }}
                      >
                        {discountPercent}% OFF
                      </span>
                    )}
                  </div>

                  {/* Refined View Action Button (Opens Detail Modal) */}
                  <button
                    type="button"
                    className="lm-interactive-btn lm-must-try-view-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProductClick(product);
                    }}
                    disabled={!isAvailable}
                    aria-label={`View details of ${product.name}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 14px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(251, 195, 36, 0.08)',
                      border: '1px solid rgba(251, 195, 36, 0.35)',
                      color: '#FBC324',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span>View</span>
                    <ArrowRight size={13} style={{ color: '#FBC324' }} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
