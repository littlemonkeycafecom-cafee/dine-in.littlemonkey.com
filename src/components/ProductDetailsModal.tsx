import React, { useState, useEffect, useCallback } from 'react';
import { Product, ProductVariant, ProductAddon } from '../types';
import { useDineIn } from '../contexts/DineInContext';
import { X, Plus, Minus, Check, Sparkles } from 'lucide-react';

interface ProductDetailsModalProps {
  product: Product | null;
  onClose: () => void;
}

const DEFAULT_ADDONS: ProductAddon[] = [
  { id: 'extra-cheese', name: 'Extra Mozzarella Cheese', price: 49 },
  { id: 'garlic-dip', name: 'Signature Garlic Mayo Dip', price: 30 },
  { id: 'peri-peri-seasoning', name: 'Extra Peri Peri Sprinkle', price: 20 },
];

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  product,
  onClose,
}) => {
  const { addToCart } = useDineIn();

  // Dual state for exit animation: keeps component mounted while playing exit transition
  const [activeProduct, setActiveProduct] = useState<Product | null>(product);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<ProductAddon[]>([]);
  const [instructions, setInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Trigger smooth closing animation
  const triggerClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);
    const timer = setTimeout(() => {
      setIsClosing(false);
      setActiveProduct(null);
      onClose();
    }, 280);
    return () => clearTimeout(timer);
  }, [isClosing, onClose]);

  // Handle incoming product changes
  useEffect(() => {
    if (product) {
      setActiveProduct(product);
      setIsClosing(false);
      setSelectedVariant(product.variants[0] || { name: 'Regular', price_paise: 19900 });
      setSelectedAddons([]);
      setInstructions('');
      setQuantity(1);

      // Trigger entrance transition on next animation frame
      const frame = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(frame);
    } else if (activeProduct && !isClosing) {
      triggerClose();
    }
  }, [product]);

  // Escape key listener for accessible dismissal with animation
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
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const unitPrice = basePrice + addonsTotal;
  const grandTotal = unitPrice * quantity;

  const toggleAddon = (addon: ProductAddon) => {
    setSelectedAddons((prev) =>
      prev.some((a) => a.id === addon.id)
        ? prev.filter((a) => a.id !== addon.id)
        : [...prev, addon]
    );
  };

  const handleAdd = () => {
    if (isClosing) return;
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
        backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.82)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: isVisible ? 'blur(8px)' : 'blur(0px)',
        WebkitBackdropFilter: isVisible ? 'blur(8px)' : 'blur(0px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        transition: 'background-color 0.28s ease, backdrop-filter 0.28s ease, -webkit-backdrop-filter 0.28s ease',
        opacity: isVisible ? 1 : 0,
      }}
      onClick={triggerClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '88vh',
          backgroundColor: '#12100E',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          border: '1px solid ' + (isVisible ? 'rgba(251, 195, 36, 0.45)' : 'rgba(251, 195, 36, 0.1)'),
          borderBottom: 'none',
          boxShadow: isVisible
            ? '0 -12px 48px rgba(0, 0, 0, 0.95), 0 -2px 28px rgba(251, 195, 36, 0.24)'
            : '0 0 0 rgba(0, 0, 0, 0)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: isVisible ? 'translateY(0%) scale(1)' : 'translateY(100%) scale(0.97)',
          transition:
            'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease, border-color 0.28s ease, box-shadow 0.28s ease',
          willChange: 'transform, opacity',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Surface with Yellow Accent Glow */}
        <div
          style={{
            height: '150px',
            backgroundColor: '#191816',
            backgroundImage:
              'radial-gradient(circle at 50% 30%, rgba(251, 195, 36, 0.12) 0%, transparent 70%), linear-gradient(180deg, rgba(25, 24, 22, 0.6) 0%, rgba(18, 16, 14, 0.95) 100%)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Close button with yellow hover feedback */}
          <button
            onClick={triggerClose}
            aria-label="Close details"
            className="lm-interactive-btn"
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#FAF7F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              transition: 'border-color 0.15s ease, transform 0.15s ease',
            }}
          >
            <X size={16} />
          </button>

          {/* Plate Silhouette Header Brand Ornament */}
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              backgroundColor: '#100F0E',
              border: '1.5px solid rgba(251, 195, 36, 0.35)',
              boxShadow: '0 0 20px rgba(251, 195, 36, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              color: '#FBC324',
              userSelect: 'none',
            }}
          >
            <Sparkles size={16} style={{ color: '#FBC324' }} />
            <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.08em', color: '#FAF7F2' }}>
              LM CAFÉ
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* Title & Dietary Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div
              style={{
                width: '14px',
                height: '14px',
                border: `1.5px solid ${currentProduct.dietary_classification === 'VEG' ? '#22C55E' : '#EF4444'}`,
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: currentProduct.dietary_classification === 'VEG' ? '#22C55E' : '#EF4444',
                }}
              />
            </div>
            <h2
              id="modal-product-title"
              style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: '22px',
                fontWeight: 700,
                color: '#FAF7F2',
                margin: 0,
              }}
            >
              {currentProduct.name}
            </h2>
          </div>

          <p style={{ fontSize: '13px', color: '#9C8C7E', lineHeight: 1.5, margin: '0 0 18px 0' }}>
            {currentProduct.description}
          </p>

          {/* Variants Selector if more than 1 */}
          {currentProduct.variants.length > 1 && (
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#FAF7F2', marginBottom: '8px' }}>
                Select Size / Portion:
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {currentProduct.variants.map((v) => {
                  const isSelected = selectedVariant?.name === v.name;
                  const vPrice = Math.round(v.price_paise / 100);
                  return (
                    <button
                      key={v.name}
                      onClick={() => setSelectedVariant(v)}
                      className="lm-interactive-btn"
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? 'rgba(251, 195, 36, 0.15)' : '#191816',
                        border: '1px solid ' + (isSelected ? '#FBC324' : 'rgba(255, 255, 255, 0.1)'),
                        color: isSelected ? '#FBC324' : '#FAF7F2',
                        fontSize: '12px',
                        fontWeight: isSelected ? 800 : 500,
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 0 12px rgba(251, 195, 36, 0.2)' : 'none',
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
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#FAF7F2', marginBottom: '8px' }}>
              Optional Add-Ons:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {DEFAULT_ADDONS.map((addon) => {
                const isChecked = selectedAddons.some((a) => a.id === addon.id);
                return (
                  <div
                    key={addon.id}
                    onClick={() => toggleAddon(addon)}
                    className="lm-interactive-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#191816',
                      border: '1px solid ' + (isChecked ? 'rgba(251, 195, 36, 0.45)' : 'rgba(255, 255, 255, 0.06)'),
                      borderRadius: '8px',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      boxShadow: isChecked ? '0 0 10px rgba(251, 195, 36, 0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                          backgroundColor: isChecked ? '#FBC324' : 'transparent',
                          border: '1.5px solid ' + (isChecked ? '#FBC324' : '#9C8C7E'),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#080808',
                        }}
                      >
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: '13px', color: '#FAF7F2' }}>{addon.name}</span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#FBC324' }}>
                      +₹{addon.price}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kitchen Instructions */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#FAF7F2', marginBottom: '6px' }}>
              Kitchen Instructions (Optional):
            </label>
            <textarea
              placeholder="e.g. Less spicy, dressing on the side, extra hot..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              style={{
                width: '100%',
                backgroundColor: '#191816',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#FAF7F2',
                fontSize: '12px',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#191816',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          {/* Quantity Stepper */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#12100E',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '6px 10px',
              gap: '12px',
            }}
          >
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              style={{
                background: 'none',
                border: 'none',
                color: quantity <= 1 ? '#4A423B' : '#FAF7F2',
                cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                padding: 0,
              }}
            >
              <Minus size={15} />
            </button>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#FAF7F2', minWidth: '18px', textAlign: 'center' }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              style={{
                background: 'none',
                border: 'none',
                color: '#FAF7F2',
                cursor: 'pointer',
                display: 'flex',
                padding: 0,
              }}
            >
              <Plus size={15} />
            </button>
          </div>

          {/* Add to Order Button */}
          <button
            onClick={handleAdd}
            className="lm-interactive-btn"
            style={{
              flex: 1,
              backgroundColor: '#FBC324',
              color: '#080808',
              border: 'none',
              borderRadius: '8px',
              padding: '13px 20px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(251, 195, 36, 0.28)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>ADD TO ORDER</span>
            <span>₹{grandTotal}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
