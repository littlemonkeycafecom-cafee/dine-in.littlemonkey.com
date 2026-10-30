import React, { useState, useEffect, useCallback } from 'react';
import { Product, ProductVariant, ProductAddon } from '../types';
import { useDineIn } from '../contexts/DineInContext';
import { resolveProductImage } from '../services/productImageMap';
import { X, Plus, Minus, Check, Sparkles, Coffee } from 'lucide-react';
import { LiquidWaveTransition } from './LiquidWaveTransition';
import { CustomScrollbarContainer } from './CustomScrollbarContainer';

interface ProductDetailsModalProps {
  product: Product | null;
  onClose: () => void;
}

const DEFAULT_ADDONS: ProductAddon[] = [
  { id: 'extra-cheese', name: 'Extra Mozzarella Cheese', price: 49 },
  { id: 'garlic-dip', name: 'Signature Garlic Mayo Dip', price: 30 },
  { id: 'peri-peri-seasoning', name: 'Extra Peri Peri Sprinkle', price: 20 },
];

const BEVERAGE_ADDONS: ProductAddon[] = [
  { id: 'extra-espresso-shot', name: 'Extra Shot Espresso', price: 40 },
  { id: 'sweet-cream-float', name: 'Velvety Sweet Cream Float', price: 35 },
  { id: 'vanilla-bean-syrup', name: 'Artisanal Vanilla Syrup', price: 25 },
];

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  product,
  onClose,
}) => {
  const { addToCart } = useDineIn();

  const [activeProduct, setActiveProduct] = useState<Product | null>(product);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [imageError, setImageError] = useState(false);

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<ProductAddon[]>([]);
  const [instructions, setInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);

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
      setSelectedVariant(product.variants[0] || { name: 'Regular', price_paise: 19900 });
      setSelectedAddons([]);
      setInstructions('');
      setQuantity(1);

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

  const isBeverage =
    currentProduct.category === 'cold-brew' ||
    currentProduct.category.includes('coffee') ||
    currentProduct.category.includes('tea') ||
    currentProduct.category.includes('shake') ||
    currentProduct.category.includes('mojito');

  const availableAddons = isBeverage ? BEVERAGE_ADDONS : DEFAULT_ADDONS;
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const unitPrice = basePrice + addonsTotal;
  const grandTotal = unitPrice * quantity;
  const isAvailable = currentProduct.is_available !== false;
  const isVeg = currentProduct.dietary_classification === 'VEG';

  // Resolved authoritative photograph
  const displayImage = currentProduct.image_url || resolveProductImage(currentProduct);

  const toggleAddon = (addon: ProductAddon) => {
    setSelectedAddons((prev) =>
      prev.some((a) => a.id === addon.id)
        ? prev.filter((a) => a.id !== addon.id)
        : [...prev, addon]
    );
  };

  const handleAdd = () => {
    if (isClosing || !isAvailable) return;
    addToCart(currentProduct, selectedVariant || undefined, selectedAddons, instructions, quantity);
    triggerClose();
  };

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

        {/* Dedicated Top Navigation Header: Category, Badges & Close Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 16px 8px 16px',
            borderBottom: '1px solid #1A1A1A',
            backgroundColor: '#080808',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Dietary Badge */}
            <div
              style={{
                width: '15px',
                height: '15px',
                borderRadius: '2.5px',
                border: `1.5px solid ${isVeg ? '#22C55E' : '#EF4444'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(5, 5, 5, 0.9)',
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
              }}
            >
              {currentProduct.category.replace(/-/g, ' ')}
            </span>

            {/* Signature or Must-Try Badges */}
            {currentProduct.badge ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(255, 194, 26, 0.12)',
                  border: '1px solid rgba(255, 194, 26, 0.45)',
                  borderRadius: '4px',
                  padding: '2px 7px',
                  color: '#FFC21A',
                  fontSize: '9.5px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                <Sparkles size={10} />
                <span>{currentProduct.badge}</span>
              </span>
            ) : currentProduct.is_must_try ? (
              <span
                style={{
                  backgroundColor: 'rgba(255, 194, 26, 0.12)',
                  border: '1px solid rgba(255, 194, 26, 0.45)',
                  borderRadius: '4px',
                  padding: '2px 7px',
                  color: '#FFC21A',
                  fontSize: '9.5px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Must Try
              </span>
            ) : null}
          </div>

          {/* Close Button: Clearly visible, completely outside and above the image stage */}
          <button
            onClick={triggerClose}
            aria-label="Close product details"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '7px',
              backgroundColor: '#121212',
              border: '1px solid #282828',
              color: '#F5F5F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#FFC21A';
              e.currentTarget.style.color = '#FFC21A';
              e.currentTarget.style.backgroundColor = '#1C1808';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#282828';
              e.currentTarget.style.color = '#F5F5F5';
              e.currentTarget.style.backgroundColor = '#121212';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Dedicated Product Showcase Frame (Image Region) */}
        <div
          style={{
            margin: '10px 16px 6px 16px',
            height: '200px',
            flexShrink: 0,
            backgroundColor: '#050505',
            background:
              'radial-gradient(ellipse at 50% 68%, rgba(255, 194, 26, 0.08) 0%, rgba(255, 194, 26, 0.015) 50%, rgba(5, 5, 5, 0) 75%), #050505',
            border: '1px solid #202020',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            padding: '12px 16px',
            boxSizing: 'border-box',
          }}
        >
          {displayImage && !imageError ? (
            <img
              src={displayImage}
              alt={currentProduct.name}
              onError={() => setImageError(true)}
              style={{
                maxHeight: '100%',
                maxWidth: '85%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
                margin: '0 auto',
                filter: 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.8))',
                transition: 'transform 0.25s ease',
              }}
            />
          ) : (
            /* Branded Architectural Placeholder for products without imagery */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '16px',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  backgroundColor: '#111111',
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
            }}
          >
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#FFC21A' }}>
              ₹{basePrice}
            </span>
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

          {/* Add-ons List */}
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
              Optional Add-Ons:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {availableAddons.map((addon) => {
                const isChecked = selectedAddons.some((a) => a.id === addon.id);
                return (
                  <div
                    key={addon.id}
                    onClick={() => toggleAddon(addon)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#111111',
                      border: '1px solid ' + (isChecked ? 'rgba(255, 194, 26, 0.5)' : '#242424'),
                      borderRadius: '6px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '15px',
                          height: '15px',
                          borderRadius: '3px',
                          backgroundColor: isChecked ? '#FFC21A' : 'transparent',
                          border: '1.5px solid ' + (isChecked ? '#FFC21A' : '#555555'),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#080808',
                        }}
                      >
                        {isChecked && <Check size={11} strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: '12px', color: '#F5F5F5' }}>{addon.name}</span>
                    </div>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#FFC21A' }}>
                      +₹{addon.price}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kitchen Instructions */}
          <div style={{ marginBottom: '14px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#F5F5F5',
                marginBottom: '6px',
              }}
            >
              Kitchen Instructions (Optional):
            </label>
            <textarea
              placeholder="e.g. Less spicy, dressing on side..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              style={{
                width: '100%',
                backgroundColor: '#111111',
                border: '1px solid #242424',
                borderRadius: '6px',
                padding: '8px 10px',
                color: '#F5F5F5',
                fontSize: '11.5px',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </CustomScrollbarContainer>

        {/* Sticky Bottom Actions Bar */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#080808',
            borderTop: '1px solid #1E1E1E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Quantity Stepper */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#111111',
              border: '1px solid #242424',
              borderRadius: '6px',
              padding: '5px 8px',
              gap: '10px',
            }}
          >
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              style={{
                background: 'none',
                border: 'none',
                color: quantity <= 1 ? '#444444' : '#F5F5F5',
                cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                padding: 0,
              }}
            >
              <Minus size={14} />
            </button>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: '#F5F5F5',
                minWidth: '16px',
                textAlign: 'center',
              }}
            >
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              style={{
                background: 'none',
                border: 'none',
                color: '#F5F5F5',
                cursor: 'pointer',
                display: 'flex',
                padding: 0,
              }}
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Add to Order Button */}
          {!isAvailable ? (
            <button
              disabled
              style={{
                flex: 1,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '6px',
                padding: '11px 16px',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '0.04em',
              }}
            >
              CURRENTLY SOLD OUT
            </button>
          ) : (
            <button
              onClick={handleAdd}
              style={{
                flex: 1,
                backgroundColor: '#FFC21A',
                color: '#080808',
                border: 'none',
                borderRadius: '6px',
                padding: '11px 16px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 14px rgba(255, 194, 26, 0.25)',
                transition: 'background-color 0.15s ease, transform 0.1s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FBC324';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFC21A';
              }}
            >
              <span>ADD TO ORDER</span>
              <span>₹{grandTotal}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
