import React, { useRef } from 'react';
import { Product } from '../types';
import { useDineIn } from '../contexts/DineInContext';
import { Plus, Minus, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface MustTryRailProps {
  products: Product[];
  onProductClick: (product: Product) => void;
}

export const MustTryRail: React.FC<MustTryRailProps> = ({ products, onProductClick }) => {
  const { cart, addToCart, updateQuantity } = useDineIn();
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

  if (!products || products.length === 0) return null;

  return (
    <section className="must-try-section">
      {/* Header */}
      <div className="must-try-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} style={{ color: '#FBC324' }} />
          <h2 className="must-try-editorial-heading">Must Try Specialities</h2>
        </div>

        {/* Scroll Arrows */}
        <div className="must-try-nav-arrows">
          <button
            onClick={scrollLeft}
            aria-label="Scroll left"
            className="must-try-arrow-btn"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={scrollRight}
            aria-label="Scroll right"
            className="must-try-arrow-btn"
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
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '12px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {products.map((product) => {
          const inCartItem = cart.find((item) => item.product.slug === product.slug);
          const price = Math.round(product.variants[0]?.price_paise / 100);

          return (
            <div
              key={product.slug}
              className={`must-try-editorial-card ${inCartItem ? 'in-cart' : ''}`}
              onClick={() => onProductClick(product)}
            >
              {/* Image Container Placeholder */}
              <div className="must-try-photo-container">
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#12100E',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: product.dietary_classification === 'VEG' ? '#22C55E' : '#EF4444',
                      marginBottom: '6px',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#FBC324',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Must Try
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <div
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: product.dietary_classification === 'VEG' ? '#22C55E' : '#EF4444',
                        flexShrink: 0,
                      }}
                    />
                    <h3
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#FAF7F2',
                        margin: 0,
                        lineHeight: 1.25,
                      }}
                    >
                      {product.name}
                    </h3>
                  </div>

                  <p
                    style={{
                      fontSize: '11px',
                      color: '#9C8C7E',
                      margin: '0 0 8px 0',
                      lineHeight: 1.35,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {product.description}
                  </p>
                </div>

                {/* Price & Add Action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#FBC324' }}>
                    ₹{price}
                  </span>

                  {inCartItem ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#FBC324',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        gap: '6px',
                      }}
                    >
                      <button
                        onClick={() => updateQuantity(inCartItem.id, inCartItem.quantity - 1)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#080808',
                          padding: '2px',
                          display: 'flex',
                          cursor: 'pointer',
                        }}
                      >
                        <Minus size={13} />
                      </button>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#080808' }}>
                        {inCartItem.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(inCartItem.id, inCartItem.quantity + 1)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#080808',
                          padding: '2px',
                          display: 'flex',
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="lm-interactive-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#191816',
                        border: '1px solid #FBC324',
                        color: '#FBC324',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Plus size={12} />
                      <span>ADD</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
