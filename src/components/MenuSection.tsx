import React, { useState, useEffect } from 'react';
import { Product, MenuCategoryGroup } from '../types';
import { CATEGORY_GROUPS, filterProducts, getBasePrice } from '../services/catalog';
import { useDineIn } from '../contexts/DineInContext';
import { Plus, Minus, Search } from 'lucide-react';

interface MenuSectionProps {
  onProductClick: (product: Product) => void;
  searchQuery: string;
  onClearSearch: () => void;
  selectedCategoryId?: string;
  onSelectCategory?: (id: string) => void;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  onProductClick,
  searchQuery,
  onClearSearch,
  selectedCategoryId,
  onSelectCategory,
}) => {
  const { cart, addToCart, updateQuantity, isVegOnly, setIsVegOnly } = useDineIn();
  const [activeGroupId, setActiveGroupId] = useState(selectedCategoryId || 'all');
  const [dietFilter, setDietFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');

  useEffect(() => {
    if (selectedCategoryId && selectedCategoryId !== activeGroupId) {
      setActiveGroupId(selectedCategoryId);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    if (isVegOnly) {
      setDietFilter('VEG');
    } else if (dietFilter === 'VEG') {
      setDietFilter('ALL');
    }
  }, [isVegOnly]);

  const handleCategorySelect = (id: string) => {
    setActiveGroupId(id);
    onSelectCategory?.(id);
  };

  const handleDietFilterChange = (filter: 'ALL' | 'VEG' | 'NON_VEG') => {
    setDietFilter(filter);
    if (filter === 'VEG') {
      setIsVegOnly(true);
    } else if (filter === 'ALL') {
      setIsVegOnly(false);
    }
  };

  const effectiveDietFilter = isVegOnly ? 'VEG' : dietFilter;
  const products = filterProducts(activeGroupId, effectiveDietFilter, searchQuery);
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
              onClick={() => handleCategorySelect(group.id)}
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
            onClick={() => handleDietFilterChange('ALL')}
            className="lm-interactive-btn"
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              border: 'none',
              backgroundColor: effectiveDietFilter === 'ALL' ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
              color: effectiveDietFilter === 'ALL' ? '#FAF7F2' : '#9C8C7E',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All
          </button>

          <button
            onClick={() => handleDietFilterChange('VEG')}
            className="lm-interactive-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              border: effectiveDietFilter === 'VEG' ? '1px solid rgba(34, 197, 94, 0.5)' : 'none',
              backgroundColor: effectiveDietFilter === 'VEG' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
              color: effectiveDietFilter === 'VEG' ? '#22C55E' : '#9C8C7E',
              boxShadow: effectiveDietFilter === 'VEG' ? '0 0 10px rgba(34, 197, 94, 0.25)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
            <span>Veg</span>
          </button>

          <button
            onClick={() => handleDietFilterChange('NON_VEG')}
            className="lm-interactive-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              border: effectiveDietFilter === 'NON_VEG' ? '1px solid rgba(239, 68, 68, 0.5)' : 'none',
              backgroundColor: effectiveDietFilter === 'NON_VEG' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              color: effectiveDietFilter === 'NON_VEG' ? '#EF4444' : '#9C8C7E',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <span>Non-Veg</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {products.length === 0 ? (
        effectiveDietFilter === 'VEG' ? (
          <div
            style={{
              padding: '52px 24px',
              textAlign: 'center',
              backgroundColor: '#12100E',
              borderRadius: '16px',
              border: '1px solid rgba(251, 195, 36, 0.25)',
              color: '#9C8C7E',
              maxWidth: '520px',
              margin: '24px auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px auto',
              }}
            >
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
            </div>
            <h3
              style={{
                fontSize: '17px',
                color: '#FAF7F2',
                margin: '0 0 8px 0',
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: 700,
              }}
            >
              No Vegetarian Items in {activeGroup.label}
            </h3>
            <p style={{ fontSize: '12.5px', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              This section is dedicated to non-vegetarian selections. You can browse all vegetarian dishes or clear the filter.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveGroupId('all')}
                className="lm-interactive-btn"
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#FBC324',
                  color: '#080808',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Browse All Veg Items
              </button>
              <button
                onClick={() => {
                  setIsVegOnly(false);
                  setDietFilter('ALL');
                }}
                className="lm-interactive-btn"
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#191816',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#FAF7F2',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Show All in {activeGroup.label}
              </button>
            </div>
          </div>
        ) : (
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
                setIsVegOnly(false);
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
        )
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
                className={product.is_must_try ? 'lm-surface-reflection lm-reflection-delay-2' : ''}
                style={{
                  backgroundColor: '#191816',
                  border: inCartItem
                    ? '1.5px solid #FBC324'
                    : product.is_must_try
                    ? '1px solid rgba(251, 195, 36, 0.32)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
                  boxShadow: product.is_must_try
                    ? '0 4px 18px rgba(0, 0, 0, 0.45), 0 0 10px rgba(251, 195, 36, 0.08)'
                    : '0 4px 16px rgba(0, 0, 0, 0.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(251, 195, 36, 0.65)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 14px rgba(251, 195, 36, 0.16)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = inCartItem
                    ? '#FBC324'
                    : product.is_must_try
                    ? 'rgba(251, 195, 36, 0.32)'
                    : 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = product.is_must_try
                    ? '0 4px 18px rgba(0, 0, 0, 0.45), 0 0 10px rgba(251, 195, 36, 0.08)'
                    : '0 4px 16px rgba(0, 0, 0, 0.4)';
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
                    zIndex: 3,
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
                        width: '13px',
                        height: '13px',
                        border: `1.5px solid ${product.dietary_classification === 'VEG' ? '#22C55E' : '#EF4444'}`,
                        borderRadius: '2.5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(8, 8, 8, 0.65)',
                      }}
                    >
                      <div
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: product.dietary_classification === 'VEG' ? '#22C55E' : '#EF4444',
                        }}
                      />
                    </div>
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

                  {/* Dish Plate Silhouette Artwork */}
                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '50%',
                      backgroundColor: '#141312',
                      backgroundImage:
                        'radial-gradient(circle at 45% 40%, rgba(251, 195, 36, 0.16) 0%, transparent 70%), linear-gradient(180deg, #181715 0%, #0D0C0B 100%)',
                      border: '1px solid rgba(251, 195, 36, 0.32)',
                      boxShadow: 'inset 0 1px 6px rgba(0, 0, 0, 0.8), 0 0 12px rgba(251, 195, 36, 0.12)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px',
                      color: '#FBC324',
                    }}
                  >
                    <span style={{ fontSize: '14px', lineHeight: 1 }}>✨</span>
                    <span style={{ fontSize: '7px', fontWeight: 800, color: '#FAF7F2', letterSpacing: '0.06em' }}>
                      LM
                    </span>
                  </div>
                </div>

                {/* Product Info */}
                <div style={{ position: 'relative', zIndex: 3, padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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
                    {price !== null ? (
                      <span style={{ fontSize: '16px', fontWeight: 800, color: '#FBC324' }}>
                        ₹{price}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: '#F59E0B',
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}
                      >
                        Price Unclear
                      </span>
                    )}

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
