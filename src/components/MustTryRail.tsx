import React, { useRef } from 'react';
import { Product } from '../types';
import { getBasePrice, getOriginalPrice, getDiscountPercentage } from '../services/catalog';
import { useDineIn } from '../contexts/DineInContext';
import { Plus, Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface MustTryRailProps {
  products: Product[];
  onProductClick: (product: Product) => void;
}

export const MustTryRail: React.FC<MustTryRailProps> = ({ products, onProductClick }) => {
  const { cart, addToCart, isVegOnly } = useDineIn();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  const displayProducts = isVegOnly
    ? products.filter((p) => p.dietary_classification === 'VEG')
    : products;

  if (!displayProducts || displayProducts.length === 0) return null;

  return (
    <section
      aria-label="Chef's Must-Try Recommendations"
      className="must-try-section"
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '16px 24px 24px 24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={17} style={{ color: '#FFC21A' }} />
            <h2
              style={{
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                fontSize: '18px',
                fontWeight: 700,
                color: '#F5F5F5',
                margin: 0,
              }}
            >
              Must-Try Specialities
            </h2>
          </div>
          <p style={{ margin: '2px 0 0 25px', fontSize: '11.5px', color: '#888888' }}>
            Chef's signature handcrafted recommendations
          </p>
        </div>

        {/* Scroll Arrows */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={scrollLeft}
            aria-label="Scroll left"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              backgroundColor: '#111111',
              border: '1px solid #242424',
              color: '#F5F5F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#FFC21A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#242424';
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={scrollRight}
            aria-label="Scroll right"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              backgroundColor: '#111111',
              border: '1px solid #242424',
              color: '#F5F5F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#FFC21A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#242424';
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          paddingBottom: '10px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {displayProducts.map((product) => {
          const inCartItem = cart.find((item) => item.product.slug === product.slug);
          const price = getBasePrice(product);
          const originalPrice = getOriginalPrice(product);
          const discountPercent = getDiscountPercentage(product);
          const isVeg = product.dietary_classification === 'VEG';

          return (
            <div
              key={product.slug}
              onClick={() => onProductClick(product)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onProductClick(product);
                }
              }}
              style={{
                width: '220px',
                minWidth: '220px',
                backgroundColor: '#111111',
                border: inCartItem
                  ? '1.5px solid #FFC21A'
                  : '1px solid rgba(255, 194, 26, 0.35)',
                borderRadius: '10px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 10px rgba(255, 194, 26, 0.08)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = '#FFC21A';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 16px rgba(255, 194, 26, 0.18)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = inCartItem
                  ? '#FFC21A'
                  : 'rgba(255, 194, 26, 0.35)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 10px rgba(255, 194, 26, 0.08)';
              }}
            >
              {/* Product Photograph Container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 10',
                  backgroundColor: '#080808',
                  overflow: 'hidden',
                  borderBottom: '1px solid #1E1E1E',
                }}
              >
                {/* Diet Indicator (Top Left) */}
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    zIndex: 4,
                    width: '14px',
                    height: '14px',
                    borderRadius: '2.5px',
                    border: `1.5px solid ${isVeg ? '#22C55E' : '#EF4444'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(5, 5, 5, 0.85)',
                  }}
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

                {/* Must Try Pill (Top Right) */}
                <span
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    zIndex: 4,
                    fontSize: '9px',
                    fontWeight: 800,
                    backgroundColor: 'rgba(255, 194, 26, 0.15)',
                    color: '#FFC21A',
                    border: '1px solid rgba(255, 194, 26, 0.45)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                  }}
                >
                  Must Try
                </span>

                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#0D0D0D',
                      color: '#FFC21A',
                    }}
                  >
                    <Sparkles size={18} />
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  flex: 1,
                  gap: '6px',
                  backgroundColor: '#111111',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#F5F5F5',
                      margin: '0 0 2px 0',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={product.name}
                  >
                    {product.name}
                  </h3>
                  <p
                    style={{
                      fontSize: '11px',
                      color: '#888888',
                      margin: 0,
                      lineHeight: 1.3,
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {product.tagline || product.description}
                  </p>
                </div>

                {/* Price and Add button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '4px',
                    borderTop: '1px solid #1E1E1E',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFC21A' }}>
                      ₹{price !== null ? price : '—'}
                    </span>
                    {originalPrice && originalPrice > (price || 0) && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#666666',
                          textDecoration: 'line-through',
                          fontWeight: 500,
                        }}
                      >
                        ₹{originalPrice}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onProductClick(product);
                    }}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '5px',
                      backgroundColor: inCartItem ? '#FFC21A' : '#1A1A1A',
                      border: '1px solid ' + (inCartItem ? '#FFC21A' : '#2A2A2A'),
                      color: inCartItem ? '#080808' : '#F5F5F5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    {inCartItem ? <Check size={13} strokeWidth={3} /> : <Plus size={13} strokeWidth={2.5} />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
