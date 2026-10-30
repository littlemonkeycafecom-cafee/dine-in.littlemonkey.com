import React, { useState } from 'react';
import { Product } from '../types';
import { getBasePrice, getOriginalPrice, getDiscountPercentage } from '../services/catalog';
import { resolveProductImage } from '../services/productImageMap';
import { useDineIn } from '../contexts/DineInContext';
import { Plus, Check, Sparkles } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const { cart, addToCart } = useDineIn();
  const [imgError, setImgError] = useState(false);
  const inCartItem = cart.find((item) => item.product.slug === product.slug);

  const price = getBasePrice(product);
  const originalPrice = getOriginalPrice(product);
  const discountPercent = getDiscountPercentage(product);
  const isAvailable = product.is_available !== false;
  const isVeg = product.dietary_classification === 'VEG';
  const displayImage = product.image_url || resolveProductImage(product);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAvailable) return;
    // If product has complex customization, open modal instead
    if (product.variants.length > 1 || (product.ingredients && product.ingredients.length > 0)) {
      onClick(product);
      return;
    }
    const defaultVariant = product.variants[0] || { name: 'Regular', price_paise: (price || 199) * 100 };
    addToCart(product, defaultVariant, [], '', 1);
  };

  return (
    <div
      onClick={() => onClick(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(product);
        }
      }}
      className="lm-product-card"
      style={{
        backgroundColor: '#111111',
        border: inCartItem
          ? '1.5px solid #FFC21A'
          : product.is_must_try
          ? '1px solid rgba(255, 194, 26, 0.35)'
          : '1px solid #242424',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: isAvailable ? 'pointer' : 'default',
        opacity: isAvailable ? 1 : 0.65,
        position: 'relative',
        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        boxShadow: inCartItem
          ? '0 0 16px rgba(255, 194, 26, 0.18)'
          : product.is_must_try
          ? '0 4px 16px rgba(0, 0, 0, 0.6), 0 0 10px rgba(255, 194, 26, 0.08)'
          : '0 4px 12px rgba(0, 0, 0, 0.4)',
      }}
      onMouseEnter={(e) => {
        if (isAvailable) {
          e.currentTarget.style.borderColor = '#FFC21A';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.8), 0 0 14px rgba(255, 194, 26, 0.2)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = inCartItem
          ? '#FFC21A'
          : product.is_must_try
          ? 'rgba(255, 194, 26, 0.35)'
          : '#242424';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = inCartItem
          ? '0 0 16px rgba(255, 194, 26, 0.18)'
          : product.is_must_try
          ? '0 4px 16px rgba(0, 0, 0, 0.6), 0 0 10px rgba(255, 194, 26, 0.08)'
          : '0 4px 12px rgba(0, 0, 0, 0.4)';
      }}
    >
      {/* 1. Image Container with Fixed Aspect Ratio */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 3',
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
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.6)',
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

        {/* Badges (Top Right) */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 4,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {!isAvailable ? (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 800,
                backgroundColor: 'rgba(239, 68, 68, 0.9)',
                color: '#FFFFFF',
                borderRadius: '4px',
                padding: '2px 6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.6)',
              }}
            >
              Sold Out
            </span>
          ) : product.badge ? (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 800,
                backgroundColor: 'rgba(8, 8, 8, 0.85)',
                color: '#FFC21A',
                border: '1px solid rgba(255, 194, 26, 0.5)',
                borderRadius: '4px',
                padding: '2px 6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            >
              {product.badge}
            </span>
          ) : product.is_must_try ? (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 800,
                backgroundColor: 'rgba(255, 194, 26, 0.15)',
                color: '#FFC21A',
                border: '1px solid rgba(255, 194, 26, 0.4)',
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
          ) : null}
        </div>

        {/* Product Photograph */}
        {displayImage && !imgError ? (
          <img
            src={displayImage}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
              transition: 'transform 0.3s ease',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              backgroundColor: '#0D0D0D',
              color: '#FFC21A',
            }}
          >
            <Sparkles size={20} style={{ opacity: 0.6 }} />
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#A3A3A3', letterSpacing: '0.06em' }}>
              LM CAFÉ
            </span>
          </div>
        )}

        {/* In-Cart Pill on Image */}
        {inCartItem && (
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              left: '8px',
              backgroundColor: '#FFC21A',
              color: '#080808',
              fontSize: '10px',
              fontWeight: 800,
              borderRadius: '999px',
              padding: '2px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              zIndex: 4,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
            }}
          >
            <Check size={11} strokeWidth={3} />
            <span>{inCartItem.quantity} IN ORDER</span>
          </div>
        )}
      </div>

      {/* 2. Product Information Surface */}
      <div
        style={{
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          gap: '8px',
          backgroundColor: '#111111',
        }}
      >
        <div>
          {/* Category Tag */}
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#A3A3A3',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '3px',
            }}
          >
            {product.category.replace(/-/g, ' ')}
          </div>

          {/* Product Name */}
          <h3
            style={{
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              fontSize: '13.5px',
              fontWeight: 700,
              color: '#F5F5F5',
              margin: '0 0 4px 0',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Optional Tagline or One-line Description */}
          {product.tagline ? (
            <p
              style={{
                fontSize: '11px',
                color: '#FFC21A',
                fontWeight: 600,
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {product.tagline}
            </p>
          ) : product.description ? (
            <p
              style={{
                fontSize: '11px',
                color: '#A3A3A3',
                margin: 0,
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {product.description}
            </p>
          ) : null}
        </div>

        {/* 3. Pricing and Add Trigger Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '6px',
            borderTop: '1px solid #1E1E1E',
          }}
        >
          {/* Price Block */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#FFC21A' }}>
              ₹{price !== null ? price : '—'}
            </span>
            {originalPrice && originalPrice > (price || 0) && (
              <span
                style={{
                  fontSize: '11.5px',
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
                  fontSize: '9.5px',
                  fontWeight: 800,
                  color: '#22C55E',
                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                  borderRadius: '3px',
                  padding: '1px 4px',
                }}
              >
                {discountPercent}%
              </span>
            )}
          </div>

          {/* Action Trigger Button */}
          {isAvailable ? (
            <button
              onClick={handleQuickAdd}
              aria-label={`Add ${product.name} to order`}
              className="lm-interactive-btn"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: inCartItem ? '#FFC21A' : '#1A1A1A',
                border: '1px solid ' + (inCartItem ? '#FFC21A' : '#2E2E2E'),
                color: inCartItem ? '#080808' : '#F5F5F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FFC21A';
                e.currentTarget.style.color = '#080808';
                e.currentTarget.style.borderColor = '#FFC21A';
              }}
              onMouseLeave={(e) => {
                if (!inCartItem) {
                  e.currentTarget.style.backgroundColor = '#1A1A1A';
                  e.currentTarget.style.color = '#F5F5F5';
                  e.currentTarget.style.borderColor = '#2E2E2E';
                }
              }}
            >
              {inCartItem ? <Check size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={2.5} />}
            </button>
          ) : (
            <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: 700 }}>Unavailable</span>
          )}
        </div>
      </div>
    </div>
  );
};
