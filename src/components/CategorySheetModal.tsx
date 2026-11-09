import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Product } from '../types';
import { ProductCard } from './ProductCard';
import { useDineIn } from '../contexts/DineInContext';
import { filterProducts } from '../services/catalog';
import { X, ChevronRight, Sparkles } from 'lucide-react';
import { LiquidWaveTransition } from './LiquidWaveTransition';
import { CustomScrollbarContainer } from './CustomScrollbarContainer';

export interface CategoryItem {
  id: string;
  label: string;
  subtitle: string;
  image: string;
}

export const CATEGORY_SHEET_CATEGORIES: CategoryItem[] = [
  {
    id: 'thin-crust-pizza',
    label: 'Pizzas',
    subtitle: '11" Thin Crust • 8 Slices',
    image: '/images/categories/thin-crust-pizza.jpg',
  },
  {
    id: 'pizza-combos',
    label: 'Pizza Combos',
    subtitle: 'Signature Pizza + Sides Combos',
    image: '/images/categories/pizza-combos.jpg',
  },
  {
    id: 'burgers',
    label: 'Burgers',
    subtitle: 'Gourmet Handcrafted Patties',
    image: '/images/categories/burgers.jpg',
  },
  {
    id: 'burger-combos',
    label: 'Burger Combos',
    subtitle: 'Gourmet Burger + Sides Combos',
    image: '/images/categories/burger-combos.jpg',
  },
  {
    id: 'pasta',
    label: 'Pasta',
    subtitle: 'Stone-Ground Al Dente Pastas',
    image: '/images/categories/pasta.jpg',
  },
  {
    id: 'sandwiches',
    label: 'Sandwiches',
    subtitle: 'Fresh Grilled Artisan Breads',
    image: '/images/categories/sandwiches.jpg',
  },
  {
    id: 'shawarma',
    label: 'Shawarma',
    subtitle: 'Authentic Toum Rolls',
    image: '/images/categories/shawarma.jpg',
  },
  {
    id: 'fries',
    label: 'Fries',
    subtitle: 'Handcut & Flame Seasoned Fries',
    image: '/images/categories/fries.jpg',
  },
  {
    id: 'garlic-bread',
    label: 'Garlic Bread',
    subtitle: 'Warm Herb Butter Breads',
    image: '/images/categories/garlic-bread.jpg',
  },
  {
    id: 'sides-quick-bites',
    label: 'Sides Quick Bites',
    subtitle: 'Crispy Starters & Quick Bites',
    image: '/images/categories/sides-quick-bites.jpg',
  },
  {
    id: 'desserts',
    label: 'Desserts',
    subtitle: 'Warm Artisanal Brownies & Sweets',
    image: '/images/categories/desserts.jpg',
  },
  {
    id: 'crispy-chicken',
    label: 'Crispy Chicken',
    subtitle: 'Golden Wings, Nuggets & Popcorn',
    image: '/images/categories/crispy-chicken.jpg',
  },
  {
    id: 'crispy-fish',
    label: 'Crispy Fish',
    subtitle: 'Golden Fingers & Butterfly Prawns',
    image: '/images/categories/crispy-fish.jpg',
  },
  {
    id: 'combos',
    label: 'Combos',
    subtitle: 'Value Café Pairings & Platters',
    image: '/images/categories/combos.jpg',
  },
  {
    id: 'healthy-bowls',
    label: 'Healthy Bowls',
    subtitle: 'Wholesome Grain & Quinoa Bowls',
    image: '/images/categories/healthy-bowls.jpg',
  },
  {
    id: 'salads',
    label: 'Salads',
    subtitle: 'Fresh Crisp Garden Bowls',
    image: '/images/categories/salads.jpg',
  },
  {
    id: 'extra-dips',
    label: 'Extra Dips',
    subtitle: 'House-Crafted Gourmet Dips',
    image: '/images/categories/extra-dips.jpg',
  },
  {
    id: 'grills',
    label: 'Grills',
    subtitle: 'Herb Olive Oil Grills',
    image: '/images/categories/grills.jpg',
  },
  {
    id: 'add-ons',
    label: 'Add Ons',
    subtitle: 'Extra Toppings & Accompaniments',
    image: '/images/categories/add-ons.jpg',
  },
  {
    id: 'milkshakes',
    label: 'Milkshakes',
    subtitle: 'Classic Chilled Shakes',
    image: '/images/categories/milkshakes.jpg',
  },
  {
    id: 'cold-coffee',
    label: 'Cold Coffee',
    subtitle: 'Frappes & Chilled Brews',
    image: '/images/categories/cold-coffee.jpg',
  },
  {
    id: 'mojito',
    label: 'Mojito',
    subtitle: 'Sparkling Mint Refreshers',
    image: '/images/categories/mojito.jpg',
  },
  {
    id: 'thick-shakes',
    label: 'Thick Shakes',
    subtitle: 'Gourmet Rich Thickshakes',
    image: '/images/categories/thick-shakes.jpg',
  },
  {
    id: 'boba-tea-coffee',
    label: 'Boba Tea Coffee',
    subtitle: 'Authentic Boba Pearls & Brews',
    image: '/images/categories/boba-tea-coffee.jpg',
  },
  {
    id: 'momos',
    label: 'Momos',
    subtitle: 'Steamed & Savory Dumplings',
    image: '/images/categories/momos.jpg',
  },
  {
    id: 'ice-creams',
    label: 'Ice Creams',
    subtitle: 'Rich Creamy Chilled Scoops',
    image: '/images/categories/ice-creams.jpg',
  },
  {
    id: 'hot-coffee',
    label: 'Hot Coffee',
    subtitle: 'Artisanal Fresh Espresso Brews',
    image: '/images/categories/hot-coffee.jpg',
  },
  {
    id: 'signature-coffee',
    label: 'Signature Coffee',
    subtitle: 'House Signature Café Brews',
    image: '/images/categories/signature-coffee.jpg',
  },
  {
    id: 'iced-coffee',
    label: 'Iced Coffee',
    subtitle: 'Refreshing Chilled Espresso',
    image: '/images/categories/iced-coffee.jpg',
  },
  {
    id: 'iced-tea',
    label: 'Iced Tea',
    subtitle: 'Cold Brew Teas & Infusions',
    image: '/images/categories/iced-tea.jpg',
  },
  {
    id: 'green-tea',
    label: 'Green Tea',
    subtitle: 'Soothing Leaf Infusions',
    image: '/images/categories/green-tea.jpg',
  },
  {
    id: 'special-green-tea-pot',
    label: 'Special Green Tea Pot',
    subtitle: 'Wellness Tea Pots (Serves 2-3)',
    image: '/images/categories/special-green-tea-pot.jpg',
  },
];

interface CategorySheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCategoryId: string;
  onSelectCategory?: (id: string) => void;
  onProductClick: (product: Product) => void;
}

export const CategorySheetModal: React.FC<CategorySheetModalProps> = ({
  isOpen,
  onClose,
  activeCategoryId,
  onSelectCategory,
  onProductClick,
}) => {
  const { products, isVegOnly } = useDineIn();
  const [currentCatId, setCurrentCatId] = useState(activeCategoryId || 'thin-crust-pizza');
  const [dietFilter, setDietFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>(isVegOnly ? 'VEG' : 'ALL');
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const categoryRailRef = useRef<HTMLDivElement>(null);

  // Sync category when prop changes or modal opens
  useEffect(() => {
    if (activeCategoryId && activeCategoryId !== 'all') {
      setCurrentCatId(activeCategoryId);
    } else if (!activeCategoryId || activeCategoryId === 'all') {
      setCurrentCatId('thin-crust-pizza');
    }
  }, [activeCategoryId, isOpen]);

  // Sync veg filter
  useEffect(() => {
    if (isVegOnly) {
      setDietFilter('VEG');
    }
  }, [isVegOnly]);

  // Entrance and exit animation handling
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const frame = requestAnimationFrame(() => {
        setIsVisible(true);
      });

      return () => {
        cancelAnimationFrame(frame);
        document.body.style.overflow = originalOverflow;
      };
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Scroll active category pill into view in the ribbon
  useEffect(() => {
    if (!isVisible) return;
    const rail = categoryRailRef.current;
    if (!rail) return;
    const activePill = rail.querySelector('[aria-selected="true"]') as HTMLElement | null;
    if (activePill) {
      activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentCatId, isVisible]);

  // Smooth dismiss handler
  const triggerClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);
    const timer = setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
    return () => clearTimeout(timer);
  }, [isClosing, onClose]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isClosing) {
        triggerClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isClosing, triggerClose]);

  // Resolve current active category definition
  const activeCategory = useMemo(() => {
    return (
      CATEGORY_SHEET_CATEGORIES.find((c) => c.id === currentCatId) ||
      CATEGORY_SHEET_CATEGORIES[0]
    );
  }, [currentCatId]);

  // Filter products for active category and dietary preference
  const effectiveDiet = isVegOnly ? 'VEG' : dietFilter;
  const filteredProducts = useMemo(() => {
    return filterProducts(currentCatId, effectiveDiet, '', products);
  }, [currentCatId, effectiveDiet, products]);

  // Handle switching category inside the modal
  const handleSwitchCategory = (catId: string) => {
    if (catId === currentCatId) return;
    setCurrentCatId(catId);
    onSelectCategory?.(catId);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-sheet-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.88)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: isVisible ? 'blur(8px)' : 'blur(0px)',
        WebkitBackdropFilter: isVisible ? 'blur(8px)' : 'blur(0px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        transition: 'background-color 0.24s ease, backdrop-filter 0.24s ease',
        opacity: isVisible ? 1 : 0,
      }}
      onClick={triggerClose}
    >
      {/* Sheet Container: Bottom Sheet on Mobile, Centered Modal on Tablet/Desktop */}
      <div
        className="lm-category-sheet-modal"
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          height: '88vh',
          backgroundColor: '#0A0A0A',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          border: '1px solid #242424',
          borderBottom: 'none',
          boxShadow: isVisible
            ? '0 -16px 48px rgba(0, 0, 0, 0.95), 0 -2px 24px rgba(255, 194, 26, 0.14)'
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
        {/* Organic Liquid Wave Reveal Animation */}
        <LiquidWaveTransition isActive={isVisible && !isClosing} />

        {/* Visual Drag Indicator Handle (Mobile UX) */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0 2px 0',
            backgroundColor: '#0A0A0A',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: '#2A2A2A',
            }}
          />
        </div>

        {/* 1. Category Header Banner with Thumbnail, Title, Subtitle & Close Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: '1px solid #1A1A1A',
            backgroundColor: '#0F0F0F',
            flexShrink: 0,
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            {/* Category Image Thumbnail */}
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1.5px solid #FFC21A',
                backgroundColor: '#1E1E1E',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
              }}
            >
              <img
                src={activeCategory.image}
                alt={activeCategory.label}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/images/categories/thin-crust-pizza.jpg';
                }}
              />
            </div>

            {/* Category Title & Subtitle */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <h2
                  id="category-sheet-title"
                  style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 800,
                    color: '#FAF7F2',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {activeCategory.label}
                </h2>
                
              </div>
              {activeCategory.subtitle && (
                <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#9C8C7E' }}>
                  {activeCategory.subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Close Action Button */}
          <button
            type="button"
            onClick={triggerClose}
            aria-label="Close category"
            title="Close (Esc)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: '#1A1A1A',
              border: '1px solid #333333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#FAF7F2',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#262626';
              e.currentTarget.style.borderColor = '#FFC21A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1A1A1A';
              e.currentTarget.style.borderColor = '#333333';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 2. Horizontally Scrollable Category Pill Ribbon */}
        <div
          ref={categoryRailRef}
          role="tablist"
          aria-label="Switch category"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            padding: '10px 18px',
            backgroundColor: '#0A0A0A',
            borderBottom: '1px solid #1A1A1A',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            flexShrink: 0,
          }}
        >
          {CATEGORY_SHEET_CATEGORIES.map((cat) => {
            const isActive = cat.id === currentCatId;
            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSwitchCategory(cat.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '999px',
                  backgroundColor: isActive ? '#FFC21A' : '#141414',
                  color: isActive ? '#080808' : '#A3A3A3',
                  border: '1px solid ' + (isActive ? '#FFC21A' : '#262626'),
                  fontSize: '11.5px',
                  fontWeight: isActive ? 800 : 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(255, 194, 26, 0.25)' : 'none',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* 3. Category Dietary Preference Filter Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 18px',
            backgroundColor: '#0F0F0F',
            borderBottom: '1px solid #1A1A1A',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '11px', color: '#888888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Dietary Filter
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#141414',
              border: '1px solid #242424',
              borderRadius: '6px',
              padding: '2px',
              gap: '2px',
            }}
          >
            <button
              onClick={() => setDietFilter('ALL')}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '10.5px',
                fontWeight: 700,
                border: 'none',
                backgroundColor: effectiveDiet === 'ALL' ? '#262626' : 'transparent',
                color: effectiveDiet === 'ALL' ? '#FAF7F2' : '#888888',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              All
            </button>

            <button
              onClick={() => setDietFilter('VEG')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '10.5px',
                fontWeight: 700,
                border: 'none',
                backgroundColor: effectiveDiet === 'VEG' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                color: effectiveDiet === 'VEG' ? '#22C55E' : '#888888',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
              <span>Veg</span>
            </button>

            <button
              onClick={() => setDietFilter('NON_VEG')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '10.5px',
                fontWeight: 700,
                border: 'none',
                backgroundColor: effectiveDiet === 'NON_VEG' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: effectiveDiet === 'NON_VEG' ? '#EF4444' : '#888888',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
              <span>Non-Veg</span>
            </button>
          </div>
        </div>

        {/* 4. Scrollable Vertical Product Grid Container */}
        <CustomScrollbarContainer
          style={{
            flex: 1,
            padding: '16px 18px 32px 18px',
            overflowY: 'auto',
          }}
        >
          {filteredProducts.length === 0 ? (
            <div
              style={{
                padding: '48px 20px',
                textAlign: 'center',
                backgroundColor: '#111111',
                borderRadius: '10px',
                border: '1px solid #1E1E1E',
                color: '#888888',
                maxWidth: '440px',
                margin: '24px auto',
              }}
            >
              <p style={{ fontSize: '14px', color: '#FAF7F2', margin: '0 0 6px 0', fontWeight: 600 }}>
                No dishes found in {activeCategory.label}
              </p>
              <p style={{ fontSize: '11.5px', margin: '0 0 16px 0' }}>
                {effectiveDiet !== 'ALL'
                  ? `There are no ${effectiveDiet === 'VEG' ? 'vegetarian' : 'non-vegetarian'} dishes in this category.`
                  : 'Select another category from the ribbon above.'}
              </p>
              <button
                onClick={() => setDietFilter('ALL')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#FFC21A',
                  border: 'none',
                  color: '#080808',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Show All in {activeCategory.label}
              </button>
            </div>
          ) : (
            <div className="lm-product-grid">
              {filteredProducts.map((prod) => (
                <ProductCard
                  key={prod.slug || prod.id}
                  product={prod}
                  onClick={() => onProductClick(prod)}
                />
              ))}
            </div>
          )}
        </CustomScrollbarContainer>
      </div>
    </div>
  );
};
