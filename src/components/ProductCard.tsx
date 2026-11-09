import React, { useState } from 'react';
import { Product } from '../types';
import { getBasePrice, getOriginalPrice, getDiscountPercentage } from '../services/catalog';
import { resolveProductImage } from '../services/productImageMap';
import { getImagePresentation } from '../services/imagePresentation';
import { Sparkles, ChevronRight } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const price = getBasePrice(product);
  const originalPrice = getOriginalPrice(product);
  const discountPercent = getDiscountPercentage(product);
  const isAvailable = product.is_available !== false;
  const isVeg = product.dietary_classification === 'VEG';
  const displayImage = product.image_url || resolveProductImage(product);
  const imgConfig = getImagePresentation(displayImage, product.category, product.slug);

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
        border: product.is_must_try
          ? '1px solid rgba(255, 194, 26, 0.35)'
          : '1px solid #242424',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        opacity: isAvailable ? 1 : 0.88,
        position: 'relative',
        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        boxShadow: product.is_must_try
          ? '0 4px 16px rgba(0, 0, 0, 0.6), 0 0 10px rgba(255, 194, 26, 0.08)'
          : '0 4px 12px rgba(0, 0, 0, 0.4)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#FFC21A';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.8), 0 0 14px rgba(255, 194, 26, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = product.is_must_try
          ? 'rgba(255, 194, 26, 0.35)'
          : '#242424';
        e.currentTarget.style.boxShadow = product.is_must_try
          ? '0 4px 16px rgba(0, 0, 0, 0.6), 0 0 10px rgba(255, 194, 26, 0.08)'
          : '0 4px 12px rgba(0, 0, 0, 0.4)';
      }}
    >
      {/* 1. Image Container with Fixed Aspect Ratio & Adaptive Centering */}
      <div
        className="lm-product-card-img-wrap"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 3',
          backgroundColor: '#080808',
          background: 'radial-gradient(circle at center, #161616 0%, #080808 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
                fontWeight: 700,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#FCA5A5',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '4px',
                padding: '2px 6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            >
              Unavailable
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
          ) : null}
        </div>

        {/* Product Photograph with Proportional Subject Framing */}
        {displayImage && !imgError ? (
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
                  inset: '-16px',
                  width: 'calc(100% + 32px)',
                  height: 'calc(100% + 32px)',
                  objectFit: 'cover',
                  objectPosition: imgConfig.position,
                  filter: 'blur(28px) brightness(0.5) saturate(1.3)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  zIndex: 1,
                  transform: 'translate3d(0, 0, 0)',
                  opacity: 0.85,
                }}
              />
            )}

            <img
              src={displayImage}
              alt={product.name}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className="lm-product-card-img"
              style={{
                position: 'relative',
                zIndex: 2,
                width: '100%',
                height: '100%',
                objectFit: imgConfig.fit,
                objectPosition: imgConfig.position,
                display: 'block',
                padding: imgConfig.fit === 'contain' ? (imgConfig.padding || '10px') : '0',
                boxSizing: 'border-box',
                opacity: imgLoaded ? 1 : 0.4,
                transition: 'opacity 0.2s ease, transform 320ms cubic-bezier(0.25, 0.1, 0.25, 1)',
                filter: imgConfig.fit === 'contain'
                  ? 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.85))'
                  : 'none',
              }}
            />
          </>
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
      </div>

      {/* 2. Product Information Surface */}
      <div
        className="lm-product-card-info"
        style={{
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
            <span className="lm-product-card-price-value" style={{ fontSize: '15px', fontWeight: 800, color: '#FFC21A' }}>
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

          {/* Read-Only Details Trigger */}
          {isAvailable ? (
            <span
              style={{
                fontSize: '11.5px',
                color: '#9C8C7E',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              <span>View</span>
              <ChevronRight size={13} style={{ color: '#FBC324' }} />
            </span>
          ) : (
            <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: 700 }}>Unavailable</span>
          )}
        </div>
      </div>
    </div>
  );
};
