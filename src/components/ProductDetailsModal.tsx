import React, { useState, useEffect } from 'react';
import { Product, ProductVariant, ProductAddon } from '../types';
import { useDineIn } from '../contexts/DineInContext';
import { X, Plus, Minus, Check } from 'lucide-react';

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
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<ProductAddon[]>([]);
  const [instructions, setInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product) {
      setSelectedVariant(product.variants[0] || { name: 'Regular', price_paise: 19900 });
      setSelectedAddons([]);
      setInstructions('');
      setQuantity(1);
    }
  }, [product]);

  if (!product) return null;

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
    addToCart(product, selectedVariant || undefined, selectedAddons, instructions, quantity);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '88vh',
          backgroundColor: '#12100E',
          borderTopLeftRadius: '22px',
          borderTopRightRadius: '22px',
          border: '1px solid rgba(251, 195, 36, 0.25)',
          borderBottom: 'none',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header / Image Placeholder */}
        <div
          style={{
            height: '160px',
            backgroundColor: '#191816',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#FAF7F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
            }}
          >
            <X size={16} />
          </button>

          {/* Plate Silhouette placeholder */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#12100E',
              border: '1.5px dashed rgba(251, 195, 36, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FBC324',
              fontWeight: 800,
              fontSize: '12px',
            }}
          >
            <span>LM CAFÉ</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* Title & Dietary Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: product.dietary_classification === 'VEG' ? '#22C55E' : '#EF4444',
                boxShadow: '0 0 6px rgba(0,0,0,0.6)',
              }}
            />
            <h2
              style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: '22px',
                fontWeight: 700,
                color: '#FAF7F2',
                margin: 0,
              }}
            >
              {product.name}
            </h2>
          </div>

          <p style={{ fontSize: '13px', color: '#9C8C7E', lineHeight: 1.5, margin: '0 0 18px 0' }}>
            {product.description}
          </p>

          {/* Variants Selector if more than 1 */}
          {product.variants.length > 1 && (
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#FAF7F2', marginBottom: '8px' }}>
                Select Size / Portion:
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {product.variants.map((v) => {
                  const isSelected = selectedVariant?.name === v.name;
                  const vPrice = Math.round(v.price_paise / 100);
                  return (
                    <button
                      key={v.name}
                      onClick={() => setSelectedVariant(v)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? 'rgba(251, 195, 36, 0.15)' : '#191816',
                        border: '1px solid ' + (isSelected ? '#FBC324' : 'rgba(255, 255, 255, 0.1)'),
                        color: isSelected ? '#FBC324' : '#FAF7F2',
                        fontSize: '12px',
                        fontWeight: isSelected ? 800 : 500,
                        cursor: 'pointer',
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#191816',
                      border: '1px solid ' + (isChecked ? 'rgba(251, 195, 36, 0.4)' : 'rgba(255, 255, 255, 0.06)'),
                      borderRadius: '8px',
                      padding: '10px 12px',
                      cursor: 'pointer',
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
              boxShadow: '0 4px 16px rgba(251, 195, 36, 0.25)',
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
