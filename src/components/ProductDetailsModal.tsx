import React, { useState, useEffect, useCallback } from 'react';
import { Product, ProductVariant } from '../types';
// useDineIn removed for read-only digital menu
import { resolveProductImage } from '../services/productImageMap';
import { getApplicableAddons } from '../services/catalog';
import { getImagePresentation } from '../services/imagePresentation';
import { X, Sparkles, Coffee, Plus, Check } from 'lucide-react';
import { LiquidWaveTransition } from './LiquidWaveTransition';
import { CustomScrollbarContainer } from './CustomScrollbarContainer';

interface ProductDetailsModalProps {
  product: Product | null;
  onClose: () => void;
}


export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  product,
  onClose,
}) => {


  const [activeProduct, setActiveProduct] = useState<Product | null>(product);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [modalImgLoaded, setModalImgLoaded] = useState(false);

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedAddonNames, setSelectedAddonNames] = useState<string[]>([]);

  // Toggle selection of an add-on (prevents duplicate charges, reverses price on deselect)
  const toggleAddon = useCallback((addonName: string) => {
    setSelectedAddonNames((prev) =>
      prev.includes(addonName) ? prev.filter((name) => name !== addonName) : [...prev, addonName]
    );
  }, []);
  // Read-only modal: order customization states removed

  // Smooth dismiss with slide-down exit animation
  const triggerClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);
    const timer = setTimeout(() => {
      setIsClosing(false);
      setActiveProduct(null);
      onClose();
    }, 240);
    return () => clearTimeout(timer);
  }, [isClosing, onClose]);

  // Handle incoming product changes and entrance transition
  useEffect(() => {
    if (product) {
      setActiveProduct(product);
      setIsClosing(false);
      setImageError(false);
      setModalImgLoaded(false);
      setSelectedVariant(product.variants[0] || { name: 'Regular', price_paise: 19900 });
      setSelectedAddonNames([]);


      // Lock body scroll while modal is active
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const frame = requestAnimationFrame(() => {
        setIsVisible(true);
      });

      return () => {
        cancelAnimationFrame(frame);
        document.body.style.overflow = originalOverflow;
      };
    } else if (activeProduct && !isClosing) {
      triggerClose();
    }
  }, [product]);

  // Accessible Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeProduct && !isClosing) {
        triggerClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProduct, isClosing, triggerClose]);

  if (!activeProduct) return null;

  const currentProduct = activeProduct;
  const basePrice = selectedVariant ? Math.round(selectedVariant.price_paise / 100) : 0;
  const originalPrice = currentProduct.original_price
    ? currentProduct.original_price
    : selectedVariant?.original_price_paise
    ? Math.round(selectedVariant.original_price_paise / 100)
    : null;

  const discountPercent = currentProduct.discount_percent
    ? currentProduct.discount_percent
    : originalPrice && originalPrice > basePrice
    ? Math.round(((originalPrice - basePrice) / originalPrice) * 100)
    : null;

  const isAvailable = currentProduct.is_available !== false;
  const isVeg = currentProduct.dietary_classification === 'VEG';
  const displayImage = currentProduct.image_url || resolveProductImage(currentProduct);
  const imgConfig = getImagePresentation(displayImage, currentProduct.category, currentProduct.slug);
  const applicableAddons = getApplicableAddons(currentProduct);

  // Calculate total price of selected add-ons
  const selectedAddonsCost = selectedAddonNames.reduce((total, addonName) => {
    const addon = applicableAddons?.addons.find((a) => a.name === addonName);
    return total + (addon ? Math.round(addon.price_paise / 100) : 0);
  }, 0);

  // Selected item total = base product price + sum of selected add-on prices
  const displayedTotal = basePrice + selectedAddonsCost;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-product-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.88)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: isVisible ? 'blur(6px)' : 'blur(0px)',
        WebkitBackdropFilter: isVisible ? 'blur(6px)' : 'blur(0px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        transition: 'background-color 0.24s ease, backdrop-filter 0.24s ease',
        opacity: isVisible ? 1 : 0,
      }}
      onClick={triggerClose}
    >
      {/* Bottom Sliding Card Drawer with Sharp Clean Edges */}
      <div
        className={`lm-product-details-modal ${isVisible ? 'is-visible' : ''}`}
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          backgroundColor: '#080808',
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px',
          border: '1px solid #242424',
          borderBottom: 'none',
          boxShadow: isVisible
            ? '0 -16px 48px rgba(0, 0, 0, 0.95), 0 -2px 20px rgba(255, 194, 26, 0.12)'
            : '0 0 0 rgba(0, 0, 0, 0)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          transform: isVisible ? 'translateY(0%)' : 'translateY(100%)',
          transition: 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease',
          willChange: 'transform',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Organic Liquid Wave Reveal Animation (1023.mp4) */}
        <LiquidWaveTransition isActive={isVisible && !isClosing} />

        {/* Visual Drag Indicator Handle */}
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
              backgroundColor: '#262626',
            }}
          />
        </div>

        {/* Dedicated Top Navigation Header: Read-Only "Product Details", Category & Close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            borderBottom: '1px solid #1A1A1A',
            backgroundColor: '#0A0A0A',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span
              style={{
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                fontSize: '12.5px',
                fontWeight: 800,
                color: '#FFC21A',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Product Details
            </span>
            <span style={{ color: '#333333' }}>•</span>
            {/* Dietary Badge */}
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '2.5px',
                border: `1.5px solid ${isVeg ? '#22C55E' : '#EF4444'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(5, 5, 5, 0.9)',
                flexShrink: 0,
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

            {/* Category Tag */}
            <span
              style={{
                fontSize: '11px',
                color: '#A3A3A3',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentProduct.category.replace(/-/g, ' ')}
            </span>
          </div>

          {/* Close Button: Accessible name, clearly visible outside image stage */}
          <button
            onClick={triggerClose}
            aria-label="Close product details"
            title="Close (Esc)"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#141414',
              border: '1px solid #282828',
              color: '#F5F5F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#FFC21A';
              e.currentTarget.style.color = '#FFC21A';
              e.currentTarget.style.backgroundColor = '#1C1808';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#282828';
              e.currentTarget.style.color = '#F5F5F5';
              e.currentTarget.style.backgroundColor = '#141414';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Dedicated Product Showcase Frame (Image Region) */}
        <div
          className="lm-detail-img-wrap"
          style={{
            position: 'relative',
            width: '100%',
            height: 'clamp(240px, 34vh, 320px)',
            flexShrink: 0,
            backgroundColor: '#050505',
            background: displayImage && displayImage.includes('/cold-brew/')
              ? 'radial-gradient(ellipse at 50% 68%, rgba(255, 194, 26, 0.12) 0%, rgba(255, 194, 26, 0.02) 55%, rgba(5, 5, 5, 0) 80%), #050505'
              : '#080808',
            borderBottom: '1px solid #1E1E1E',
            overflow: 'hidden',
          }}
        >
          {displayImage && !imageError ? (
            <>
              {/* Ambient Backdrop Layer for drinks / cutouts */}
              {imgConfig.useBackdrop && (
                <img
                  src={displayImage}
                  alt=""
                  aria-hidden="true"
                  className="lm-img-ambient-backdrop"
                  style={{
                    position: 'absolute',
                    inset: '-20px',
                    width: 'calc(100% + 40px)',
                    height: 'calc(100% + 40px)',
                    objectFit: 'cover',
                    objectPosition: imgConfig.position,
                    filter: 'blur(32px) brightness(0.55) saturate(1.35)',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    zIndex: 1,
                    transform: 'translate3d(0, 0, 0)',
                    opacity: 0.85,
                  }}
                />
              )}

              {/* Master Subject Foreground Image */}
              <img
                src={displayImage}
                alt={currentProduct.name}
                onLoad={() => setModalImgLoaded(true)}
                onError={() => setImageError(true)}
                className="lm-detail-img"
                style={{
                  position: 'relative',
                  zIndex: 2,
                  width: '100%',
                  height: '100%',
                  objectFit: imgConfig.fit,
                  objectPosition: imgConfig.position,
                  display: 'block',
                  padding: imgConfig.fit === 'contain' ? (imgConfig.padding || '14px') : '0',
                  boxSizing: 'border-box',
                  opacity: modalImgLoaded ? 1 : 0.4,
                  transition: 'opacity 0.2s ease, transform 350ms cubic-bezier(0.25, 0.1, 0.25, 1)',
                  filter: imgConfig.fit === 'contain'
                    ? 'drop-shadow(0 14px 28px rgba(0, 0, 0, 0.9))'
                    : 'none',
                }}
              />
            </>
          ) : (
            /* Branded Architectural Placeholder for products without imagery */
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '16px',
                gap: '8px',
                backgroundColor: '#0D0D0D',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  backgroundColor: '#141414',
                  border: '1px solid #242424',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFC21A',
                }}
              >
                <Coffee size={24} />
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#FFC21A',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Little Monkey Café
              </div>
              <div style={{ fontSize: '11px', color: '#777777', maxWidth: '220px' }}>
                Handcrafted Specialty Recipe
              </div>
            </div>
          )}

          {/* Badges Overlay */}
          {currentProduct.badge ? (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '14px',
                zIndex: 3,
                backgroundColor: 'rgba(8, 8, 8, 0.85)',
                border: '1px solid rgba(255, 194, 26, 0.5)',
                borderRadius: '4px',
                padding: '3px 8px',
                color: '#FFC21A',
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            >
              <Sparkles size={11} />
              <span>{currentProduct.badge}</span>
            </div>
          ) : null}
        </div>

        {/* Synchronized Custom Scrollbar Content Body */}
        <CustomScrollbarContainer
          style={{ flex: 1, minHeight: 0 }}
          contentStyle={{
            padding: '12px 16px 16px 16px',
            backgroundColor: '#080808',
          }}
        >
          {/* Title & Tagline */}
          <div style={{ marginBottom: '8px' }}>
            <h2
              id="modal-product-title"
              style={{
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                fontSize: '19px',
                fontWeight: 700,
                color: '#F5F5F5',
                margin: '0 0 4px 0',
                lineHeight: 1.3,
              }}
            >
              {currentProduct.name}
            </h2>
            {currentProduct.tagline && (
              <div
                style={{
                  color: '#FFC21A',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {currentProduct.tagline}
              </div>
            )}
          </div>

          {/* Pricing Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '10px',
              paddingBottom: '12px',
              borderBottom: '1px solid #1E1E1E',
              marginBottom: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#FFC21A' }}>
              ₹{displayedTotal}
            </span>
            {selectedAddonsCost > 0 ? (
              <span style={{ fontSize: '11.5px', color: '#9C8C7E', fontWeight: 600 }}>
                (Base ₹{basePrice} + Extras ₹{selectedAddonsCost})
              </span>
            ) : (
              <>
                {originalPrice && originalPrice > basePrice && (
                  <span
                    style={{
                      fontSize: '15px',
                      color: '#666666',
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
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#22C55E',
                      backgroundColor: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid rgba(34, 197, 94, 0.4)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                    }}
                  >
                    {discountPercent}% OFF
                  </span>
                )}
              </>
            )}
          </div>

          {/* Product Description */}
          {currentProduct.description && (
            <p
              style={{
                fontSize: '12.5px',
                color: '#A3A3A3',
                lineHeight: 1.55,
                margin: '0 0 14px 0',
              }}
            >
              {currentProduct.description}
            </p>
          )}

          {/* Verified Ingredients & Craft Layers (if present) */}
          {currentProduct.ingredients && currentProduct.ingredients.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#FFC21A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '8px',
                }}
              >
                <Sparkles size={12} />
                <span>Craft Layers & Ingredients</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '6px',
                }}
              >
                {currentProduct.ingredients.map((ing, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#111111',
                      border: '1px solid #242424',
                      borderRadius: '6px',
                      padding: '8px 10px',
                    }}
                  >
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#F5F5F5' }}>
                      {typeof ing === 'string' ? ing : ing.name}
                    </div>
                    {typeof ing !== 'string' && ing.detail && (
                      <div style={{ fontSize: '10.5px', color: '#888888', marginTop: '2px' }}>
                        {ing.detail}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variants Selector */}
          {currentProduct.variants.length > 1 && (
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#F5F5F5',
                  marginBottom: '8px',
                }}
              >
                Select Option / Portion:
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {currentProduct.variants.map((v) => {
                  const isSelected = selectedVariant?.name === v.name;
                  const vPrice = Math.round(v.price_paise / 100);
                  return (
                    <button
                      key={v.name}
                      onClick={() => setSelectedVariant(v)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '6px',
                        backgroundColor: isSelected ? 'rgba(255, 194, 26, 0.12)' : '#111111',
                        border: '1px solid ' + (isSelected ? '#FFC21A' : '#242424'),
                        color: isSelected ? '#FFC21A' : '#F5F5F5',
                        fontSize: '11.5px',
                        fontWeight: isSelected ? 800 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {v.name} (₹{vPrice})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          

          {/* Authoritative Add-ons & Extras from reconciled-menu.json (Read-Only Discovery) */}
          {applicableAddons && applicableAddons.addons.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                  gap: '4px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#FFC21A',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <Plus size={12} />
                  <span>Available Add-ons & Extras</span>
                </div>
                <span style={{ fontSize: '10.5px', color: '#888888' }}>
                  {applicableAddons.groupName}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '6px',
                }}
              >
                {applicableAddons.addons.map((addon, idx) => {
                  const isAddonVeg = addon.dietary_classification === 'VEG';
                  const addonPrice = Math.round(addon.price_paise / 100);
                  const isSelected = selectedAddonNames.includes(addon.name);
                  return (
                    <button
                      key={idx}
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`${addon.name}, ${addonPrice} rupees, ${isAddonVeg ? 'Vegetarian' : 'Non-Vegetarian'}`}
                      onClick={() => toggleAddon(addon.name)}
                      className="lm-addon-item"
                      style={{
                        backgroundColor: isSelected ? 'rgba(255, 194, 26, 0.12)' : '#111111',
                        border: '1px solid ' + (isSelected ? '#FFC21A' : '#222222'),
                        borderRadius: '6px',
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isAddonVeg ? '#22C55E' : '#EF4444',
                            flexShrink: 0,
                          }}
                          title={isAddonVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                        />
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: isSelected ? 700 : 600,
                            color: isSelected ? '#FFC21A' : '#E5E5E5',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {addon.name}
                        </span>
                        {isSelected && (
                          <Check size={12} style={{ color: '#FFC21A', flexShrink: 0, marginLeft: '2px' }} />
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 800,
                          color: '#FFC21A',
                          flexShrink: 0,
                        }}
                      >
                        +₹{addonPrice}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          </CustomScrollbarContainer>

        {/* Sticky Bottom Actions Bar (Read-Only Informational) */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#0A0A0A',
            borderTop: '1px solid #1E1E1E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexShrink: 0,
          }}
        >
          {/* Price & Offer Display */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#FFC21A' }}>
              ₹{displayedTotal}
            </span>
            {selectedAddonsCost > 0 ? (
              <span style={{ fontSize: '11px', color: '#9C8C7E', fontWeight: 600 }}>
                (Base ₹{basePrice} + Extras ₹{selectedAddonsCost})
              </span>
            ) : (
              <>
                {originalPrice && originalPrice > basePrice && (
                  <span
                    style={{
                      fontSize: '13px',
                      color: '#666666',
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
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#22C55E',
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                    }}
                  >
                    {discountPercent}% OFF
                  </span>
                )}
              </>
            )}
            <span style={{ fontSize: '11px', color: '#9C8C7E', marginLeft: '4px' }}>
              • In-Café Dining
            </span>
          </div>

          {/* Dismiss / Close Action */}
          <button
            onClick={triggerClose}
            aria-label="Close product details"
            className="lm-interactive-btn"
            style={{
              backgroundColor: '#FFC21A',
              color: '#080808',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '0.04em',
              transition: 'background-color 0.15s ease',
              boxShadow: '0 4px 14px rgba(255, 194, 26, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
