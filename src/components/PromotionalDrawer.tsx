import React, { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { SPECIALTY_COLD_BREW_PRODUCTS, getBasePrice, getOriginalPrice, getDiscountPercentage } from '../services/catalog';
// DineInContext removed for read-only digital menu
import { X, Sparkles, ChevronRight } from 'lucide-react';
import { LiquidWaveTransition } from './LiquidWaveTransition';
import { CustomScrollbarContainer } from './CustomScrollbarContainer';

interface PromotionalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onProductSelect: (product: Product) => void;
}

export const PromotionalDrawer: React.FC<PromotionalDrawerProps> = ({
  isOpen,
  onClose,
  onProductSelect,
}) => {
  // Cart removed for read-only digital menu
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(isOpen);

  // Smooth dismiss with slide-down exit animation
  const triggerClose = useCallback(() => {
    setIsVisible(false);
    const timer = setTimeout(() => {
      setIsRendered(false);
      onClose();
    }, 240);
    return () => clearTimeout(timer);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const frame = requestAnimationFrame(() => {
        setIsVisible(true);
      });

      return () => {
        cancelAnimationFrame(frame);
        document.body.style.overflow = originalOverflow;
      };
    } else if (isRendered) {
      triggerClose();
    }
  }, [isOpen]);

  // Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRendered) {
        triggerClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRendered, triggerClose]);

  if (!isRendered) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotional-drawer-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.88)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: isVisible ? 'blur(8px)' : 'blur(0px)',
        WebkitBackdropFilter: isVisible ? 'blur(8px)' : 'blur(0px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        transition: 'background-color 0.24s ease, backdrop-filter 0.24s ease',
        opacity: isVisible ? 1 : 0,
      }}
      onClick={triggerClose}
    >
      {/* Sliding Drawer Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '88vh',
          backgroundColor: '#080808',
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px',
          border: '1px solid rgba(255, 194, 26, 0.4)',
          borderBottom: 'none',
          boxShadow: isVisible
            ? '0 -16px 48px rgba(0, 0, 0, 0.95), 0 -2px 24px rgba(255, 194, 26, 0.16)'
            : '0 0 0 rgba(0, 0, 0, 0)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          transform: isVisible ? 'translateY(0%)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease',
          willChange: 'transform',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Organic Liquid Wave Reveal Animation (1023.mp4) */}
        <LiquidWaveTransition isActive={isVisible} />

        {/* Drag Handle Indicator */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0 2px 0',
            backgroundColor: '#080808',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: '#2A2A2A',
            }}
          />
        </div>

        {/* Drawer Editorial Header */}
        <div
          style={{
            padding: '14px 18px 12px 18px',
            backgroundColor: '#0D0D0D',
            borderBottom: '1px solid #1E1E1E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '10.5px',
                fontWeight: 800,
                color: '#FFC21A',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '2px',
              }}
            >
              <Sparkles size={12} style={{ color: '#FFC21A' }} />
              <span>SPECIALTY COFFEE RESERVE</span>
            </div>
            <h2
              id="promotional-drawer-title"
              style={{
                margin: 0,
                fontSize: 'clamp(18px, 4vw, 22px)',
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: 700,
                color: '#F5F5F5',
                lineHeight: 1.2,
              }}
            >
              Craft Meets Cold Collection
            </h2>
            <p
              style={{
                margin: '3px 0 0 0',
                fontSize: '11.5px',
                color: '#888888',
                lineHeight: 1.3,
              }}
            >
              10 Signature Handcrafted Cold Brews • Low-Acidity • 18-Hour Slow Steeped at 4°C
            </p>
          </div>

          <button
            onClick={triggerClose}
            aria-label="Close promotional drawer"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#161616',
              border: '1px solid #282828',
              color: '#F5F5F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#FFC21A';
              e.currentTarget.style.color = '#FFC21A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#282828';
              e.currentTarget.style.color = '#F5F5F5';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Products Area with Synchronized Custom Scrollbar */}
        <CustomScrollbarContainer
          style={{ flex: 1, minHeight: 0 }}
          contentStyle={{
            padding: '16px',
            backgroundColor: '#080808',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '12px',
            }}
          >
            {SPECIALTY_COLD_BREW_PRODUCTS.map((brew) => {
              const inCartItem = null;
              const price = getBasePrice(brew);
              const originalPrice = getOriginalPrice(brew);
              const discountPercent = getDiscountPercentage(brew);
              const isAvailable = brew.is_available !== false;

              return (
                <div
                  key={brew.slug}
                  onClick={() => onProductSelect(brew)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onProductSelect(brew);
                    }
                  }}
                  style={{
                    backgroundColor: '#111111',
                    border: inCartItem
                      ? '1.5px solid #FFC21A'
                      : '1px solid #242424',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = '#FFC21A';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 14px rgba(255, 194, 26, 0.18)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = inCartItem ? '#FFC21A' : '#242424';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.5)';
                  }}
                >
                  {/* Photo Container */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '4 / 3',
                      backgroundColor: '#050505',
                      overflow: 'hidden',
                      borderBottom: '1px solid #1E1E1E',
                    }}
                  >
                    {/* Veg Badge */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        zIndex: 4,
                        width: '13px',
                        height: '13px',
                        borderRadius: '2.5px',
                        border: '1.5px solid #22C55E',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(5, 5, 5, 0.85)',
                      }}
                      title="Vegetarian"
                    >
                      <div
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: '#22C55E',
                        }}
                      />
                    </div>

                    {/* Badge */}
                    {brew.badge && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          zIndex: 4,
                          fontSize: '8.5px',
                          fontWeight: 800,
                          backgroundColor: 'rgba(8, 8, 8, 0.88)',
                          color: '#FFC21A',
                          border: '1px solid rgba(255, 194, 26, 0.4)',
                          borderRadius: '3px',
                          padding: '2px 5px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          backdropFilter: 'blur(4px)',
                          WebkitBackdropFilter: 'blur(4px)',
                        }}
                      >
                        {brew.badge}
                      </span>
                    )}

                    {brew.image_url ? (
                      <img
                        src={brew.image_url}
                        alt={brew.name}
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
                        <Sparkles size={20} />
                      </div>
                    )}

                  </div>

                  {/* Info Surface */}
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
                        }}
                      >
                        {brew.name}
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
                        {brew.tagline || brew.description}
                      </p>
                    </div>

                    {/* Pricing & Add Row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '6px',
                        borderTop: '1px solid #1E1E1E',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                        <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#FFC21A' }}>
                          ₹{price}
                        </span>
                        {originalPrice && originalPrice > (price || 0) && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#666666',
                              textDecoration: 'line-through',
                            }}
                          >
                            ₹{originalPrice}
                          </span>
                        )}
                        {discountPercent && (
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 800,
                              color: '#22C55E',
                            }}
                          >
                            {discountPercent}% OFF
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onProductSelect(brew);
                        }}
                        aria-label={`View details of ${brew.name}`}
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
                        <ChevronRight size={14} style={{ color: "#FFC21A" }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CustomScrollbarContainer>

        {/* Drawer Bottom Bar */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#0D0D0D',
            borderTop: '1px solid #1E1E1E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '11.5px', color: '#888888' }}>
            Tap any cold brew to view brewing craft & customize
          </span>
          <button
            onClick={triggerClose}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              backgroundColor: '#161616',
              border: '1px solid #282828',
              color: '#F5F5F5',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};
