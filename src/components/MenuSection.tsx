import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import {
  REGULAR_CATEGORIES,
  filterProducts,
} from '../services/catalog';
import { useDineIn } from '../contexts/DineInContext';
import { ProductCard } from './ProductCard';
import { SkeletonCard } from './SkeletonCard';

interface MenuSectionProps {
  onProductClick: (product: Product) => void;
  searchQuery: string;
  onClearSearch: () => void;
  selectedCategoryId?: string;
  onSelectCategory?: (id: string) => void;
  onOpenCategorySheet?: (id: string) => void;
  isLoading?: boolean;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  onProductClick,
  searchQuery,
  onClearSearch,
  selectedCategoryId,
  onSelectCategory,
  onOpenCategorySheet,
  isLoading = false,
}) => {
  const { isVegOnly, setIsVegOnly, products: liveProducts } = useDineIn();
  const [activeCategoryId, setActiveCategoryId] = useState(selectedCategoryId || 'all');
  const [dietFilter, setDietFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (selectedCategoryId && selectedCategoryId !== activeCategoryId) {
      setIsTransitioning(true);
      setActiveCategoryId(selectedCategoryId);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 160);
      return () => clearTimeout(timer);
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
    setIsTransitioning(true);
    setActiveCategoryId(id);
    onSelectCategory?.(id);
    if (id !== 'all') {
      onOpenCategorySheet?.(id);
    }
    setTimeout(() => {
      setIsTransitioning(false);
    }, 160);
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
  const filteredProducts = filterProducts(activeCategoryId, effectiveDietFilter, searchQuery, liveProducts);
  const activeCategory = REGULAR_CATEGORIES.find((c) => c.id === activeCategoryId) || REGULAR_CATEGORIES[0];

  return (
    <section
      id="main-menu-catalog"
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '16px 18px 80px 18px',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. All 32 Regular Categories Horizontal Pill Navigation */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <div
          role="tablist"
          aria-label="Menu categories"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '8px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {REGULAR_CATEGORIES.map((cat) => {
            const isActive = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleCategorySelect(cat.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '999px',
                  backgroundColor: isActive ? '#FFC21A' : '#111111',
                  color: isActive ? '#080808' : '#A3A3A3',
                  border: '1px solid ' + (isActive ? '#FFC21A' : '#242424'),
                  fontSize: '12px',
                  fontWeight: isActive ? 800 : 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease',
                  boxShadow: isActive ? '0 2px 10px rgba(255, 194, 26, 0.25)' : 'none',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Sub-Header: Active Category Title, Subtitle, Count & Diet Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '14px',
          borderBottom: '1px solid #1E1E1E',
          marginBottom: '18px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h2
              style={{
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                fontSize: '20px',
                fontWeight: 700,
                color: '#F5F5F5',
                margin: 0,
              }}
            >
              {activeCategory.label}
            </h2>
            <span style={{ fontSize: '12px', color: '#666666', fontWeight: 600 }}>
              ({filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'})
            </span>
            {activeCategoryId !== 'all' && onOpenCategorySheet && (
              <button
                type="button"
                onClick={() => onOpenCategorySheet(activeCategoryId)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(255, 194, 26, 0.12)',
                  border: '1px solid rgba(255, 194, 26, 0.4)',
                  color: '#FFC21A',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  marginLeft: '4px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                Category Modal
              </button>
            )}
            {searchQuery && (
              <span style={{ fontSize: '11px', color: '#FFC21A', marginLeft: '4px' }}>
                matching "{searchQuery}"
              </span>
            )}
          </div>
          {activeCategory.subtitle && (
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#888888' }}>
              {activeCategory.subtitle}
            </p>
          )}
        </div>

        {/* Veg / Non-Veg Filters */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#111111',
            border: '1px solid #242424',
            borderRadius: '6px',
            padding: '3px',
            gap: '2px',
          }}
        >
          <button
            onClick={() => handleDietFilterChange('ALL')}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              border: 'none',
              backgroundColor: effectiveDietFilter === 'ALL' ? '#1E1E1E' : 'transparent',
              color: effectiveDietFilter === 'ALL' ? '#F5F5F5' : '#888888',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All
          </button>

          <button
            onClick={() => handleDietFilterChange('VEG')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              border: 'none',
              backgroundColor: effectiveDietFilter === 'VEG' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
              color: effectiveDietFilter === 'VEG' ? '#22C55E' : '#888888',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
            <span>Veg</span>
          </button>

          <button
            onClick={() => handleDietFilterChange('NON_VEG')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              border: 'none',
              backgroundColor: effectiveDietFilter === 'NON_VEG' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              color: effectiveDietFilter === 'NON_VEG' ? '#EF4444' : '#888888',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <span>Non-Veg</span>
          </button>
        </div>
      </div>

      {/* 3. Product Grid or States */}
      {isLoading || isTransitioning ? (
        <div className="lm-product-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: '#080808',
            borderRadius: '10px',
            border: '1px solid #1E1E1E',
            color: '#A3A3A3',
            maxWidth: '480px',
            margin: '24px auto',
          }}
        >
          <p style={{ fontSize: '15px', color: '#F5F5F5', margin: '0 0 6px 0', fontWeight: 600 }}>
            No products found in {activeCategory.label}
          </p>
          <p style={{ fontSize: '12px', margin: '0 0 16px 0' }}>
            {effectiveDietFilter !== 'ALL'
              ? `There are no ${effectiveDietFilter === 'VEG' ? 'vegetarian' : 'non-vegetarian'} dishes in this category.`
              : 'Try selecting another category or clearing your search filter.'}
          </p>
          <button
            onClick={() => {
              setActiveCategoryId('all');
              setDietFilter('ALL');
              setIsVegOnly(false);
              onClearSearch();
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: '#FFC21A',
              border: 'none',
              color: '#080808',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Reset Filters & View All
          </button>
        </div>
      ) : (
        /* Responsive Product Grid: Mobile 2-col, Tablet 3-col, Desktop 4-col */
        <div className="lm-product-grid">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.slug}
              product={product}
              onClick={onProductClick}
            />
          ))}
        </div>
      )}
    </section>
  );
};
