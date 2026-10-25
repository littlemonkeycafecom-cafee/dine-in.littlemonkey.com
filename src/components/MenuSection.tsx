import React, { useState } from 'react';
import { Product, MenuCategoryGroup } from '../types';
import { CATEGORY_GROUPS, filterProducts, getBasePrice } from '../services/catalog';
import { useDineIn } from '../contexts/DineInContext';
import { Plus, Minus, Search } from 'lucide-react';

interface MenuSectionProps {
  onProductClick: (product: Product) => void;
  searchQuery: string;
  onClearSearch: () => void;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  onProductClick,
  searchQuery,
  onClearSearch,
}) => {
  const { cart, addToCart, updateQuantity } = useDineIn();
  const [activeGroupId, setActiveGroupId] = useState('all');
  const [dietFilter, setDietFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');

  const products = filterProducts(activeGroupId, dietFilter, searchQuery);
  const activeGroup = CATEGORY_GROUPS.find((g) => g.id === activeGroupId) || CATEGORY_GROUPS[0];

  return (
    <section
      id="main-menu-catalog"
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '16px 18px 80px 18px',
      }}
    >
      {/* Category Pill Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '16px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {CATEGORY_GROUPS.map((group) => {
          const isActive = activeGroupId === group.id;
          return (
            <button
              key={group.id}
              onClick={() => setActiveGroupId(group.id)}
              className="lm-interactive-btn"
              style={{
                padding: '8px 16px',
                borderRadius: '999px',
                backgroundColor: isActive ? '#FBC324' : '#191816',
                color: isActive ? '#080808' : '#FAF7F2',
                border: '1px solid ' + (isActive ? '#FBC324' : 'rgba(255, 255, 255, 0.08)'),
                fontSize: '12.5px',
                fontWeight: isActive ? 800 : 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {/* Sub-Header: Active Group Name + Item Count + Diet Filter Toggles */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          paddingBottom: '14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h2
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '22px',
              fontWeight: 700,
              color: '#FAF7F2',
              margin: 0,
            }}
          >
            {activeGroup.label}
          </h2>
          <span style={{ fontSize: '12px', color: '#9C8C7E' }}>
            ({products.length} {products.length === 1 ? 'dish' : 'dishes'})
          </span>
          {searchQuery && (
            <span style={{ fontSize: '11px', color: '#FBC324', marginLeft: '6px' }}>
              Matching "{searchQuery}"
            </span>
          )}
        </div>

        {/* Veg / Non-Veg Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setDietFilter('ALL')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              border: 'none',
              backgroundColor: dietFilter === 'ALL' ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
              color: dietFilter === 'ALL' ? '#FAF7F2' : '#9C8C7E',
              cursor: 'pointer',
            }}
          >
            All
          </button>

          <button
            onClick={() => setDietFilter('VEG')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              border: 'none',
              backgroundColor: dietFilter === 'VEG' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
              color: dietFilter === 'VEG' ? '#22C55E' : '#9C8C7E',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
            <span>Veg</span>
          </button>

          <button
            onClick={() => setDietFilter('NON_VEG')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              border: 'none',
              backgroundColor: dietFilter === 'NON_VEG' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              color: dietFilter === 'NON_VEG' ? '#EF4444' : '#9C8C7E',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <span>Non-Veg</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {products.length === 0 ? (
        <div
          style={{
            padding: '48px 20px',
            textAlign: 'center',
            backgroundColor: '#12100E',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            color: '#9C8C7E',
          }}
        >
          <p style={{ fontSize: '15px', color: '#FAF7F2', margin: '0 0 8px 0', fontWeight: 600 }}>
            No menu items found
          </p>
          <p style={{ fontSize: '12px', margin: '0 0 16px 0' }}>
            Try adjusting your search or category filter.
          </p>
          <button
            onClick={() => {
              setActiveGroupId('all');
              setDietFilter('ALL');
              onClearSearch();
            }}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              backgroundColor: '#191816',
              border: '1px solid #FBC324',
              color: '#FBC324',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Product Grid (Mobile: 2 cols, Desktop: 3-4 cols) */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '16px',
          }}
        >
          {products.map((product) => {
            const inCartItem = cart.find((ci) => ci.product.slug === product.slug);
            const price = getBasePrice(product);

            return (
              <div
                key={product.slug}
                onClick={() => onProductClick(product)}
                style={{
                  backgroundColor: '#191816',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease, transform 0.15s ease',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(251, 195, 36, 0.4)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Image Placeholder Surface */}
                <div
                  style={{
                    height: '140px',
                    width: '100%',
                    backgroundColor: '#12100E',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px',
                    position: 'relative',
                  }}
                >
                  {/* Dietary & Bestseller Badges */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      right: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div
                      style={{
                        width: '9px',
                        height: '9px',
                        borderRadius: '50%',
                        backgroundColor: product.dietary_classification === 'VEG' ? '#22C55E' : '#EF4444',
                        boxShadow: '0 0 6px rgba(0,0,0,0.6)',
                      }}
                    />
                    {product.is_must_try && (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 800,
                          backgroundColor: 'rgba(251, 195, 36, 0.18)',
                          color: '#FBC324',
                          border: '1px solid rgba(251, 195, 36, 0.4)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Must Try
                      </span>
                    )}
                  </div>

                  {/* Dark Silhouette Box */}
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: '#161514',
                      border: '1px dashed rgba(251, 195, 36, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9C8C7E',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    LM
                  </div>
                </div>

                {/* Product Info */}
                <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#FAF7F2',
                        margin: '0 0 6px 0',
                        lineHeight: 1.25,
                      }}
                    >
                      {product.name}
                    </h3>

                    <p
                      style={{
                        fontSize: '11.5px',
                        color: '#9C8C7E',
                        lineHeight: 1.4,
                        margin: '0 0 14px 0',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {product.description}
                    </p>
                  </div>

                  {/* Price & Action */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#FBC324' }}>
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
                          padding: '2px 8px',
                          gap: '8px',
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
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#080808' }}>
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
                          padding: '6px 14px',
                          borderRadius: '6px',
                          backgroundColor: '#191816',
                          border: '1px solid #FBC324',
                          color: '#FBC324',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Plus size={13} />
                        <span>ADD</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
