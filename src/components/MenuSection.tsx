import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import {
  REGULAR_CATEGORIES,
  filterProducts,
} from '../services/catalog';
import { useDineIn } from '../contexts/DineInContext';
import { ProductCard } from './ProductCard';
import { SkeletonCard } from './SkeletonCard';
import { Search, X, Grid, LayoutGrid, ChevronRight, ChevronLeft } from 'lucide-react';
import { CATEGORY_SHEET_CATEGORIES } from './CategorySheetModal';

interface MenuSectionProps {
  onProductClick: (product: Product) => void;
  searchQuery: string;
  onSearchChange?: (q: string) => void;
  onClearSearch: () => void;
  selectedCategoryId?: string;
  onSelectCategory?: (id: string) => void;
  onOpenCategorySheet?: (id: string) => void;
  isLoading?: boolean;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  onProductClick,
  searchQuery,
  onSearchChange,
  onClearSearch,
  selectedCategoryId,
  onSelectCategory,
  isLoading = false,
}) => {
  const { isVegOnly, setIsVegOnly, products: liveProducts } = useDineIn();
  const [activeCategoryId, setActiveCategoryId] = useState(selectedCategoryId || 'all');
  const [dietFilter, setDietFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [allViewMode, setAllViewMode] = useState<'categories' | 'dishes'>('categories');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(Boolean(searchQuery));
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryTrackRef = useRef<HTMLDivElement>(null);
  const categoryBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (selectedCategoryId && selectedCategoryId !== activeCategoryId) {
      setIsTransitioning(true);
      setActiveCategoryId(selectedCategoryId);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    const activeBtn = categoryBtnRefs.current.get(activeCategoryId);
    if (activeBtn && categoryTrackRef.current) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeCategoryId]);

  useEffect(() => {
    if (isVegOnly) {
      setDietFilter('VEG');
    } else if (dietFilter === 'VEG') {
      setDietFilter('ALL');
    }
  }, [isVegOnly]);

  useEffect(() => {
    if (isSearchActive) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
    }
  }, [isSearchActive]);

  const handleCategorySelect = (id: string, shouldScroll = true) => {
    setIsTransitioning(true);
    setActiveCategoryId(id);
    onSelectCategory?.(id);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 100);

    if (shouldScroll) {
      const el = document.getElementById('main-menu-catalog');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleDietFilterChange = (filter: 'ALL' | 'VEG' | 'NON_VEG') => {
    setDietFilter(filter);
    if (filter === 'VEG') {
      setIsVegOnly(true);
    } else if (filter === 'ALL') {
      setIsVegOnly(false);
    }
  };

  const isCategoryOverview = activeCategoryId === 'all' && !searchQuery;
  const effectiveDietFilter = isVegOnly ? 'VEG' : dietFilter;
  const filteredProducts = filterProducts(activeCategoryId, effectiveDietFilter, searchQuery, liveProducts);
  const activeCategory = CATEGORY_SHEET_CATEGORIES.find((c) => c.id === activeCategoryId) ||
    REGULAR_CATEGORIES.find((c) => c.id === activeCategoryId) ||
    { id: activeCategoryId, label: activeCategoryId.replace(/-/g, ' '), subtitle: '' };

  return (
    <section
      id="main-menu-catalog"
      className="main-menu-catalog-section"
      style={{
        width: '100%',
        maxWidth: '1280px',
        minWidth: 0,
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Centered Menu Heading with Gold Decorative Accent */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '22px',
          paddingTop: '6px',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: '#FFC21A',
              textTransform: 'uppercase',
            }}
          >
            LITTLE MONKEY CAFÉ
          </span>
        </div>
        <h2
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(24px, 4.5vw, 32px)',
            fontWeight: 700,
            color: '#FAF7F2',
            margin: '0 0 10px 0',
            letterSpacing: '0.01em',
            lineHeight: 1.2,
          }}
        >
          Dine-In Menu
        </h2>
        {/* Subtle Gold Decorative Accent */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            maxWidth: '220px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              flex: 1,
              height: '1px',
              background: 'linear-gradient(90deg, transparent, #FFC21A)',
              opacity: 0.85,
            }}
          />
          <div
            style={{
              width: '5px',
              height: '5px',
              transform: 'rotate(45deg)',
              backgroundColor: '#FFC21A',
              boxShadow: '0 0 8px rgba(255, 194, 26, 0.7)',
            }}
          />
          <div
            style={{
              flex: 1,
              height: '1px',
              background: 'linear-gradient(90deg, #FFC21A, transparent)',
              opacity: 0.85,
            }}
          />
        </div>
        <p
          style={{
            fontSize: '13px',
            color: '#9C8C7E',
            margin: '8px 0 0 0',
            fontWeight: 400,
          }}
        >
          Handcrafted culinary delights & artisanal coffees served fresh at your table
        </p>
      </div>

      {/* 2. Category Navigation & Dedicated Search Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        {/* Dedicated Single Search Button (Uniform 38px height) */}
        <button
          type="button"
          onClick={() => {
            const next = !isSearchActive;
            setIsSearchActive(next);
            if (!next) {
              onClearSearch();
            }
          }}
          aria-expanded={isSearchActive}
          aria-label={isSearchActive ? 'Close search' : 'Search menu items'}
          className="lm-menu-search-btn lm-interactive-btn"
          style={{
            height: '38px',
            minHeight: '38px',
            boxSizing: 'border-box',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '0 16px',
            borderRadius: '999px',
            backgroundColor: isSearchActive || searchQuery ? '#FFC21A' : '#111111',
            color: isSearchActive || searchQuery ? '#080808' : '#FAF7F2',
            border: '1px solid ' + (isSearchActive || searchQuery ? '#FFC21A' : '#2A2A2A'),
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
            boxShadow: isSearchActive || searchQuery ? '0 2px 10px rgba(255, 194, 26, 0.25)' : 'none',
          }}
        >
          <Search size={14} />
          <span>Search</span>
        </button>

        {/* Scrollable Category Track with Smooth Edge Fades */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {/* Left Fade Overlay */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '20px',
              background: 'linear-gradient(90deg, #080808 20%, transparent)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />

          {/* Category Tabs Track */}
          <div
            ref={categoryTrackRef}
            role="tablist"
            aria-label="Menu categories"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorX: 'contain',
              width: '100%',
              padding: '2px 8px',
              boxSizing: 'border-box',
            }}
          >
            {REGULAR_CATEGORIES.map((cat) => {
              const isActive = activeCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  ref={(el) => {
                    if (el) categoryBtnRefs.current.set(cat.id, el);
                    else categoryBtnRefs.current.delete(cat.id);
                  }}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`lm-menu-cat-btn ${isActive ? 'active' : ''}`}
                  style={{
                    height: '38px',
                    minHeight: '38px',
                    boxSizing: 'border-box',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 16px',
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

          {/* Right Fade Overlay */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '24px',
              background: 'linear-gradient(270deg, #080808 20%, transparent)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        </div>
      </div>

      {/* 3. Integrated Search Bar (when Search is active) */}
      {isSearchActive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#111111',
            border: '1.5px solid #FFC21A',
            borderRadius: '12px',
            padding: '8px 14px',
            marginBottom: '16px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6), 0 0 12px rgba(255, 194, 26, 0.12)',
          }}
        >
          <Search size={16} style={{ color: '#FFC21A', flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={
              activeCategoryId === 'all'
                ? 'Search all dishes (pizza, burger, cold brew, pasta...)'
                : `Search in ${activeCategory.label}...`
            }
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsSearchActive(false);
                onClearSearch();
              }
            }}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#FAF7F2',
              fontSize: '13.5px',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={onClearSearch}
              aria-label="Clear search input"
              style={{
                background: 'none',
                border: 'none',
                color: '#9C8C7E',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsSearchActive(false);
              onClearSearch();
            }}
            aria-label="Close search"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#FAF7F2',
              backgroundColor: '#1E1E1E',
              border: '1px solid #333333',
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* 4. Mutually Exclusive Content Views */}
      {isCategoryOverview ? (
        /* ====================================================================
           STATE A: CATEGORY DISCOVERY (Overview)
           Renders ONLY the 32 Category Cards Grid.
           No product grid underneath.
           ==================================================================== */
        <div className="lm-category-overview-wrap" style={{ marginBottom: '32px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              paddingBottom: '12px',
              borderBottom: '1px solid #1E1E1E',
              marginBottom: '16px',
            }}
          >
            <div>
              <h3
                style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  margin: 0,
                  letterSpacing: '0.01em',
                }}
              >
                Explore Menu Categories
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#888888' }}>
                Select any handcrafted category to browse signature creations
              </p>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#FFC21A',
                backgroundColor: 'rgba(255, 194, 26, 0.1)',
                border: '1px solid rgba(255, 194, 26, 0.3)',
                borderRadius: '6px',
                padding: '4px 10px',
              }}
            >
              32 Categories
            </span>
          </div>

          {/* 32 Category Cards Grid */}
          <div className="menu-categories-32-grid-wrap" style={{ margin: '0 0 24px 0' }}>
            <div className="menu-categories-32-grid">
              {CATEGORY_SHEET_CATEGORIES.map((cat, idx) => (
                <div
                  key={cat.id}
                  className="menu-category-grid-card lm-category-card-enter"
                  style={{ '--cat-index': idx } as React.CSSProperties}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCategorySelect(cat.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCategorySelect(cat.id);
                    }
                  }}
                  aria-label={`Explore ${cat.label} category`}
                >
                  <div className="menu-category-card-img-wrap">
                    <img
                      src={cat.image}
                      alt={cat.label}
                      className="menu-category-card-img"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/images/categories/thin-crust-pizza.jpg';
                      }}
                    />
                  </div>
                  <div className="menu-category-card-info">
                    <h4 className="menu-category-card-name">{cat.label}</h4>
                    {cat.subtitle && (
                      <span style={{ fontSize: '11px', color: '#9C8C7E', marginTop: '3px', lineHeight: 1.25 }}>
                        {cat.subtitle}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ====================================================================
           STATE B: CATEGORY SELECTED / SEARCH RESULTS
           Renders ONLY the products of the selected category (or search results).
           Includes back button to return to categories, category heading,
           diet filters, and filtered product grid.
           ==================================================================== */
        <div className="lm-category-view-wrap">
          {/* Category View Header with Back Navigation & Breadcrumb */}
          <div
            className="lm-category-view-header"
            style={{
              paddingBottom: '14px',
              borderBottom: '1px solid #1E1E1E',
              marginBottom: '18px',
            }}
          >
            {/* Top Breadcrumb & Back Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => handleCategorySelect('all')}
                className="lm-back-to-categories-btn lm-interactive-btn"
                aria-label="Back to all categories"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#161412',
                  border: '1px solid #2E2924',
                  borderRadius: '999px',
                  padding: '6px 14px',
                  color: '#FFC21A',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronLeft size={14} />
                <span>All Categories</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#777777' }}>
                <span>Menu</span>
                <span>/</span>
                <span style={{ color: '#FAF7F2', fontWeight: 600 }}>
                  {searchQuery ? `Search` : activeCategory.label}
                </span>
              </div>
            </div>

            {/* Category Title & Controls Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3
                    style={{
                      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                      fontSize: '19px',
                      fontWeight: 700,
                      color: '#F5F5F5',
                      margin: 0,
                    }}
                  >
                    {searchQuery ? `Search Results` : activeCategory.label}
                  </h3>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#FFC21A',
                      backgroundColor: 'rgba(255, 194, 26, 0.1)',
                      border: '1px solid rgba(255, 194, 26, 0.3)',
                      borderRadius: '6px',
                      padding: '2px 8px',
                    }}
                  >
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'Dish' : 'Dishes'}
                  </span>
                </div>

                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#888888' }}>
                  {searchQuery
                    ? `Dishes matching "${searchQuery}"`
                    : activeCategory.subtitle || 'Handcrafted café creations'}
                </p>
              </div>

              {/* Veg / Non-Veg Diet Filter Pills */}
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
                  type="button"
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
                  type="button"
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
                  type="button"
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
          </div>

          {/* Product Grid or Empty State */}
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
                No dishes found in {searchQuery ? `"${searchQuery}"` : activeCategory.label}
              </p>
              <p style={{ fontSize: '12px', margin: '0 0 16px 0' }}>
                {searchQuery
                  ? `No dishes matched "${searchQuery}".`
                  : effectiveDietFilter !== 'ALL'
                  ? `There are no ${effectiveDietFilter === 'VEG' ? 'vegetarian' : 'non-vegetarian'} dishes in this category.`
                  : 'Try selecting another category or resetting your diet filters.'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {effectiveDietFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDietFilter('ALL');
                      setIsVegOnly(false);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      backgroundColor: '#1E1E1E',
                      border: '1px solid #333333',
                      color: '#FAF7F2',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Clear Diet Filter
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleCategorySelect('all');
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
                  Return to All Categories
                </button>
              </div>
            </div>
          ) : (
            /* Responsive Product Grid: Mobile 2-col, Tablet 3-col, Desktop 4-col */
            <div className="lm-product-grid lm-category-products-enter">
              {filteredProducts.map((product, pIdx) => (
                <div
                  key={product.slug}
                  className="lm-product-card-enter-wrap"
                  style={{ '--prod-index': pIdx } as React.CSSProperties}
                >
                  <ProductCard
                    product={product}
                    onClick={onProductClick}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
