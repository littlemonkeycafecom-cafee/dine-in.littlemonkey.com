import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Product } from '../types';
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Check, Search, Sparkles } from 'lucide-react';
import { CATEGORY_GROUPS } from '../services/catalog';
import { useDineIn } from '../contexts/DineInContext';

export interface HeroItem {
  id: string;
  label: string;
  category: string;
  tagline: string;
  accent: string;
  slug: string;
  price: number;
  dietary: 'VEG' | 'NON_VEG';
}

export const HERO_ITEMS: HeroItem[] = [
  {
    id: 'dessert',
    label: 'Churros & Dip',
    category: 'Desserts',
    tagline: 'Artisanal Sweet Finish',
    accent: '#FFC21A',
    slug: 'desserts-sizzling-brownie',
    price: 275,
    dietary: 'VEG',
  },
  {
    id: 'pizza',
    label: 'Farmhouse Pizza',
    category: 'Thin Crust Pizza',
    tagline: 'Signature Thin Crust',
    accent: '#FFC21A',
    slug: 'thin-crust-pizza-farmhouse',
    price: 399,
    dietary: 'VEG',
  },
  {
    id: 'burger',
    label: 'Crispy Chicken Burger',
    category: 'Burgers',
    tagline: 'Handcrafted Gourmet',
    accent: '#FFC21A',
    slug: 'burgers-crispy-chicken-burger',
    price: 185,
    dietary: 'NON_VEG',
  },
  {
    id: 'pasta',
    label: 'Red Sauce Pasta',
    category: 'Pasta',
    tagline: 'Stone-Ground Al Dente',
    accent: '#D4AF37',
    slug: 'pasta-pasta-veg',
    price: 249,
    dietary: 'VEG',
  },
  {
    id: 'chicken',
    label: 'Chicken Wings',
    category: 'Crispy Chicken',
    tagline: 'Golden Crispy',
    accent: '#FFC21A',
    slug: 'crispy-chicken-chicken-wings',
    price: 179,
    dietary: 'NON_VEG',
  },
  {
    id: 'fries',
    label: 'Peri Peri Fries',
    category: 'Fries',
    tagline: 'Flame-Seasoned',
    accent: '#FFC21A',
    slug: 'fries-masala-french-fries',
    price: 140,
    dietary: 'VEG',
  },
  {
    id: 'coffee',
    label: 'Cappuccino',
    category: 'Hot Coffee',
    tagline: 'Specialty Espresso',
    accent: '#D4AF37',
    slug: 'hot-coffee-cappuccino',
    price: 169,
    dietary: 'VEG',
  },
  {
    id: 'shakes',
    label: 'Oreo Shake',
    category: 'Thick Shakes',
    tagline: 'Premium Thick Shake',
    accent: '#FFC21A',
    slug: 'thick-shakes-oreo',
    price: 259,
    dietary: 'VEG',
  },
];

const ROTATION_INTERVAL = 3200; // ~3.0s - 3.2s smooth dwell time per requirement
const RESUME_DELAY = 6000; // 6s pause after customer interaction

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function TypewriterTitle({ text, reducedMotion }: { text: string; reducedMotion: boolean }) {
  const [displayText, setDisplayText] = useState(reducedMotion ? text : '');
  const [caretVisible, setCaretVisible] = useState(true);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayText(text);
      setCaretVisible(false);
      return;
    }

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setDisplayText('');
    setCaretVisible(true);

    const totalChars = text.length;
    const charDelay = 38;

    for (let i = 1; i <= totalChars; i++) {
      const t = setTimeout(() => {
        setDisplayText(text.slice(0, i));
        if (i === totalChars) {
          const hideTimer = setTimeout(() => {
            setCaretVisible(false);
          }, 400);
          timersRef.current.push(hideTimer);
        }
      }, 30 + i * charDelay);
      timersRef.current.push(t);
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, [text, reducedMotion]);

  return (
    <h1
      style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: 'clamp(28px, 4.8vw, 48px)',
        fontWeight: 700,
        color: '#FAF7F2',
        margin: '4px 0 0 0',
        lineHeight: 1.15,
        letterSpacing: '-0.01em',
        minHeight: '1.25em',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span>{displayText}</span>
      {caretVisible && (
        <span
          style={{
            display: 'inline-block',
            width: '2.5px',
            height: '0.88em',
            backgroundColor: '#FBC324',
            marginLeft: '4px',
            borderRadius: '1px',
            animation: 'lm-caret-blink 0.8s infinite',
          }}
        />
      )}
    </h1>
  );
}

interface HeroCarouselProps {
  products: Product[];
  onProductClick: (product: Product) => void;
  onExploreClick: () => void;
  selectedCategoryId?: string;
  onSelectCategory?: (categoryId: string) => void;
  onSearchClick?: () => void;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  products,
  onProductClick,
  onExploreClick,
  selectedCategoryId = 'all',
  onSelectCategory,
  onSearchClick,
}) => {
  const { isVegOnly, toggleVegOnly } = useDineIn();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  const heroItems = useMemo(() => {
    if (!isVegOnly) return HERO_ITEMS;
    return HERO_ITEMS.filter((item) => item.dietary === 'VEG');
  }, [isVegOnly]);

  const total = heroItems.length;
  const safeActiveIndex = activeIndex >= total ? 0 : activeIndex;

  useEffect(() => {
    if (activeIndex >= total) {
      setActiveIndex(0);
    }
  }, [total, activeIndex]);

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const transitionLockRef = useRef(false);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoRotateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Drag & click discrimination refs
  const dragStartPosRef = useRef({ x: 0, y: 0, time: 0 });
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Outside-click and Escape key handler for Category Popover
  useEffect(() => {
    if (!isCategoryOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCategoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCategoryOpen]);

  const pauseAutoRotateTemporarily = useCallback(() => {
    setIsInteracting(true);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, RESUME_DELAY);
  }, []);

  const goTo = useCallback(
    (target: number | ((prev: number) => number)) => {
      if (transitionLockRef.current) return;

      setActiveIndex((current) => {
        const next = typeof target === 'function' ? target(current) : target;
        if (next === current) return current;
        transitionLockRef.current = true;
        setTimeout(() => {
          transitionLockRef.current = false;
        }, reducedMotion ? 50 : 450);
        return next;
      });
    },
    [reducedMotion]
  );

  const handlePrev = useCallback(() => {
    pauseAutoRotateTemporarily();
    goTo((prev) => mod(prev - 1, total));
  }, [goTo, pauseAutoRotateTemporarily, total]);

  const handleNext = useCallback(() => {
    pauseAutoRotateTemporarily();
    goTo((prev) => mod(prev + 1, total));
  }, [goTo, pauseAutoRotateTemporarily, total]);

  const handleSelectCategory = (catId: string) => {
    setIsCategoryOpen(false);
    if (onSelectCategory) {
      onSelectCategory(catId);
    } else {
      onExploreClick();
    }
  };

  const activeCategoryGroup = useMemo(() => {
    return CATEGORY_GROUPS.find((g) => g.id === selectedCategoryId) || CATEGORY_GROUPS[0];
  }, [selectedCategoryId]);

  // Autonomous rotation with pause guards (reduced motion, hover, user interaction, dropdown open, hidden tab)
  const isAutoRotateAllowed =
    !reducedMotion && !isHovered && !isInteracting && !isCategoryOpen && !isTabHidden;

  useEffect(() => {
    if (!isAutoRotateAllowed || total === 0) {
      if (autoRotateTimerRef.current) clearInterval(autoRotateTimerRef.current);
      return;
    }

    autoRotateTimerRef.current = setInterval(() => {
      if (!transitionLockRef.current) {
        goTo((prev) => mod(prev + 1, total));
      }
    }, ROTATION_INTERVAL);

    return () => {
      if (autoRotateTimerRef.current) clearInterval(autoRotateTimerRef.current);
    };
  }, [isAutoRotateAllowed, goTo, total]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePrev, handleNext]);

  // Touch & pointer gesture handlers
  const onPointerDown = (clientX: number, clientY: number) => {
    dragStartPosRef.current = { x: clientX, y: clientY, time: Date.now() };
    hasDraggedRef.current = false;
    pauseAutoRotateTemporarily();
  };

  const onPointerMove = (clientX: number) => {
    const deltaX = Math.abs(clientX - dragStartPosRef.current.x);
    if (deltaX > 8) {
      hasDraggedRef.current = true;
    }
  };

  const onPointerUp = (clientX: number) => {
    const deltaX = clientX - dragStartPosRef.current.x;
    const duration = Date.now() - dragStartPosRef.current.time;

    if (Math.abs(deltaX) > 35 || (Math.abs(deltaX) > 20 && duration < 250)) {
      if (deltaX < 0) {
        goTo(mod(safeActiveIndex + 1, total));
      } else {
        goTo(mod(safeActiveIndex - 1, total));
      }
    }

    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 60);
  };

  const handleCardClick = (index: number) => {
    if (hasDraggedRef.current) return;
    pauseAutoRotateTemporarily();

    if (index === safeActiveIndex) {
      const heroItem = heroItems[safeActiveIndex];
      if (!heroItem) return;
      const matched = products.find((p) => p.slug === heroItem.slug) ||
        products.find((p) => p.name.toLowerCase().includes(heroItem.label.toLowerCase())) ||
        products.find((p) => p.category.toLowerCase().includes(heroItem.category.toLowerCase())) ||
        products[0];
      if (matched) {
        onProductClick(matched);
      }
    } else {
      goTo(index);
    }
  };

  const activeItem = heroItems[safeActiveIndex] || heroItems[0] || HERO_ITEMS[0];

  // Responsive 3D transform computation
  const getCardStyle = (index: number) => {
    const offset = mod(index - safeActiveIndex + Math.floor(total / 2), total) - Math.floor(total / 2);
    const absOff = Math.abs(offset);

    if (reducedMotion) {
      return {
        transform: `translateX(${offset * 120}px)`,
        opacity: absOff === 0 ? 1 : absOff === 1 ? 0.6 : 0,
        zIndex: 10 - absOff,
        pointerEvents: (absOff <= 1 ? 'auto' : 'none') as 'auto' | 'none',
      };
    }

    const isMobile = windowWidth < 640;
    const isTablet = windowWidth >= 640 && windowWidth < 1024;

    let translateX = 0;
    let scale = 1;
    let rotateY = 0;
    let opacity = 1;

    if (isMobile) {
      switch (absOff) {
        case 0:
          translateX = 0;
          scale = 1;
          rotateY = 0;
          opacity = 1;
          break;
        case 1:
          translateX = offset > 0 ? 115 : -115;
          scale = 0.82;
          rotateY = offset > 0 ? -12 : 12;
          opacity = 0.82;
          break;
        case 2:
          translateX = offset > 0 ? 185 : -185;
          scale = 0.65;
          rotateY = offset > 0 ? -20 : 20;
          opacity = 0.18;
          break;
        default:
          translateX = offset > 0 ? 240 : -240;
          scale = 0.45;
          rotateY = offset > 0 ? -25 : 25;
          opacity = 0;
          break;
      }
    } else if (isTablet) {
      switch (absOff) {
        case 0:
          translateX = 0;
          scale = 1;
          rotateY = 0;
          opacity = 1;
          break;
        case 1:
          translateX = offset > 0 ? 190 : -190;
          scale = 0.84;
          rotateY = offset > 0 ? -15 : 15;
          opacity = 0.88;
          break;
        case 2:
          translateX = offset > 0 ? 330 : -330;
          scale = 0.68;
          rotateY = offset > 0 ? -25 : 25;
          opacity = 0.50;
          break;
        default:
          translateX = offset > 0 ? 440 : -440;
          scale = 0.50;
          rotateY = offset > 0 ? -32 : 32;
          opacity = 0;
          break;
      }
    } else {
      // Desktop
      switch (absOff) {
        case 0:
          translateX = 0;
          scale = 1;
          rotateY = 0;
          opacity = 1;
          break;
        case 1:
          translateX = offset > 0 ? 260 : -260;
          scale = 0.85;
          rotateY = offset > 0 ? -16 : 16;
          opacity = 0.90;
          break;
        case 2:
          translateX = offset > 0 ? 460 : -460;
          scale = 0.68;
          rotateY = offset > 0 ? -26 : 26;
          opacity = 0.60;
          break;
        case 3:
          translateX = offset > 0 ? 610 : -610;
          scale = 0.52;
          rotateY = offset > 0 ? -34 : 34;
          opacity = 0.28;
          break;
        default:
          translateX = offset > 0 ? 720 : -720;
          scale = 0.38;
          rotateY = offset > 0 ? -40 : 40;
          opacity = 0;
          break;
      }
    }

    return {
      transform: `translateX(${translateX}px) scale(${scale}) rotateY(${rotateY}deg)`,
      opacity,
      zIndex: 10 - absOff,
      pointerEvents: (absOff <= (isMobile ? 1 : 2) ? 'auto' : 'none') as 'auto' | 'none',
    };
  };

  return (
    <section
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        pauseAutoRotateTemporarily();
      }}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '24px 16px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'clamp(320px, 50vw, 600px)',
          height: 'clamp(240px, 35vw, 420px)',
          background: 'radial-gradient(ellipse at center, rgba(251, 195, 36, 0.12) 0%, rgba(214, 165, 36, 0.04) 50%, transparent 75%)',
          filter: 'blur(36px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Brand Header: Authentic Little Monkey Logo & Tagline */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        {/* Authentic Little Monkey Café Logo with Ambient Aura */}
        <div
          className="lm-logo-ambient-wrap"
          style={{
            marginBottom: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/branding/little-monkey-logo-transparent.png"
            alt="Little Monkey Café"
            style={{
              height: 'clamp(52px, 7vw, 72px)',
              width: 'auto',
              maxWidth: '240px',
              objectFit: 'contain',
              display: 'block',
              filter: 'drop-shadow(0 6px 20px rgba(251, 195, 36, 0.28))',
              userSelect: 'none',
            }}
          />
        </div>

        {/* Coffee and More. */}
        <p
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(15px, 2vw, 18px)',
            fontWeight: 600,
            fontStyle: 'italic',
            color: '#C8C1B2',
            letterSpacing: '0.02em',
            margin: '0 0 16px 0',
          }}
        >
          Coffee and More.
        </p>

        {/* Action Controls Row: Explore Menu Button + Category Popover Button (Search removed) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Explore Full Menu Button */}
          <button
            type="button"
            onClick={onExploreClick}
            className="lm-interactive-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '42px',
              padding: '0 24px',
              borderRadius: '999px',
              backgroundColor: '#FBC324',
              color: '#080808',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.02em',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(251, 195, 36, 0.28)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Explore Menu</span>
            <ChevronDown size={15} />
          </button>

          {/* Clean Category Dropdown Button (Replacing Search Input) */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                pauseAutoRotateTemporarily();
                setIsCategoryOpen((prev) => !prev);
              }}
              aria-expanded={isCategoryOpen}
              aria-haspopup="listbox"
              aria-label="Browse Menu Categories"
              className="lm-interactive-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '42px',
                padding: '0 20px',
                borderRadius: '999px',
                backgroundColor: isCategoryOpen ? 'rgba(251, 195, 36, 0.15)' : '#191816',
                border: '1px solid ' + (isCategoryOpen ? '#FBC324' : 'rgba(251, 195, 36, 0.35)'),
                color: isCategoryOpen ? '#FBC324' : '#FAF7F2',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: isCategoryOpen
                  ? '0 0 16px rgba(251, 195, 36, 0.25)'
                  : '0 4px 14px rgba(0, 0, 0, 0.45)',
                transition: 'all 0.18s ease',
              }}
            >
              <LayoutGrid size={15} style={{ color: '#FBC324' }} />
              <span>{activeCategoryGroup ? activeCategoryGroup.label : 'Categories'}</span>
              <ChevronDown
                size={15}
                style={{
                  color: '#FBC324',
                  transform: isCategoryOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
            </button>

            {/* Category Dropdown Popover Panel */}
            {isCategoryOpen && (
              <div
                role="listbox"
                aria-label="Menu Categories"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 'clamp(280px, 92vw, 360px)',
                  maxHeight: '380px',
                  overflowY: 'auto',
                  backgroundColor: 'rgba(18, 16, 14, 0.97)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(251, 195, 36, 0.35)',
                  borderRadius: '16px',
                  boxShadow: '0 20px 48px rgba(0, 0, 0, 0.88), 0 0 24px rgba(251, 195, 36, 0.15)',
                  padding: '8px',
                  zIndex: 100,
                  boxSizing: 'border-box',
                  scrollbarWidth: 'thin',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px 6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    marginBottom: '6px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      color: '#9C8C7E',
                      textTransform: 'uppercase',
                    }}
                  >
                    Select Menu Category
                  </span>
                  <span style={{ fontSize: '10px', color: '#FBC324', fontWeight: 700 }}>
                    {CATEGORY_GROUPS.length} Categories
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {CATEGORY_GROUPS.map((group) => {
                    const isSelected = selectedCategoryId === group.id;
                    return (
                      <button
                        key={group.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectCategory(group.id)}
                        className="lm-interactive-btn"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 12px',
                          borderRadius: '10px',
                          backgroundColor: isSelected ? 'rgba(251, 195, 36, 0.16)' : 'transparent',
                          border: isSelected ? '1px solid rgba(251, 195, 36, 0.45)' : '1px solid transparent',
                          color: isSelected ? '#FBC324' : '#FAF7F2',
                          fontSize: '13px',
                          fontWeight: isSelected ? 700 : 500,
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: isSelected ? '#FBC324' : 'rgba(255, 255, 255, 0.25)',
                              transition: 'background-color 0.15s ease',
                            }}
                          />
                          <span>{group.label}</span>
                        </div>
                        {isSelected && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FBC324' }}>
                            <Check size={14} />
                            <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                              Active
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Search Control Button */}
          {onSearchClick && (
            <button
              type="button"
              onClick={onSearchClick}
              aria-label="Search Menu"
              className="lm-interactive-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                height: '42px',
                padding: '0 18px',
                borderRadius: '999px',
                backgroundColor: '#191816',
                border: '1px solid rgba(251, 195, 36, 0.35)',
                color: '#FAF7F2',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
                transition: 'all 0.18s ease',
              }}
            >
              <Search size={15} style={{ color: '#FBC324' }} />
              <span>Search</span>
            </button>
          )}

          {/* Veg Only Toggle Switch */}
          <button
            type="button"
            onClick={toggleVegOnly}
            aria-pressed={isVegOnly}
            aria-label={isVegOnly ? 'Show all items' : 'Filter vegetarian items only'}
            className="lm-interactive-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '42px',
              padding: '0 16px',
              borderRadius: '999px',
              backgroundColor: isVegOnly ? 'rgba(34, 197, 94, 0.16)' : '#191816',
              border: isVegOnly ? '1.5px solid #22C55E' : '1px solid rgba(255, 255, 255, 0.14)',
              boxShadow: isVegOnly
                ? '0 0 16px rgba(34, 197, 94, 0.32), 0 0 8px rgba(251, 195, 36, 0.2)'
                : '0 4px 14px rgba(0, 0, 0, 0.45)',
              color: isVegOnly ? '#22C55E' : '#9C8C7E',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
              userSelect: 'none',
            }}
          >
            <span
              style={{
                width: '13px',
                height: '13px',
                border: `1.5px solid ${isVegOnly ? '#22C55E' : '#6B6258'}`,
                borderRadius: '2.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: isVegOnly ? '#22C55E' : '#6B6258',
                  transition: 'background-color 0.2s ease',
                }}
              />
            </span>
            <span style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Veg Only</span>
            <span
              style={{
                width: '26px',
                height: '14px',
                borderRadius: '999px',
                backgroundColor: isVegOnly ? '#22C55E' : 'rgba(255, 255, 255, 0.16)',
                position: 'relative',
                display: 'inline-block',
                transition: 'background-color 0.2s ease',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '1.5px',
                  left: isVegOnly ? '13px' : '1.5px',
                  width: '11px',
                  height: '11px',
                  borderRadius: '50%',
                  backgroundColor: isVegOnly ? '#080808' : '#FAF7F2',
                  transition: 'left 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Featured Item Tagline & Title */}
      <div style={{ position: 'relative', zIndex: 2, marginBottom: '18px' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: '#FBC324',
            textTransform: 'uppercase',
            display: 'block',
          }}
        >
          {activeItem.tagline}
        </span>

        <TypewriterTitle text={activeItem.label} reducedMotion={reducedMotion} />
      </div>

      {/* 3D Card Stage with Gesture Listeners */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '1200px',
          height: 'clamp(260px, 36vw, 360px)',
          perspective: '1000px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'pan-y',
          zIndex: 2,
        }}
        onMouseDown={(e) => onPointerDown(e.clientX, e.clientY)}
        onMouseMove={(e) => onPointerMove(e.clientX)}
        onMouseUp={(e) => onPointerUp(e.clientX)}
        onTouchStart={(e) => onPointerDown(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => onPointerMove(e.touches[0].clientX)}
        onTouchEnd={(e) => onPointerUp(e.changedTouches[0].clientX)}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {heroItems.map((item, index) => {
            const isActive = index === safeActiveIndex;
            const style3D = getCardStyle(index);

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(index)}
                style={{
                  position: 'absolute',
                  width: 'clamp(195px, 26vw, 280px)',
                  height: 'clamp(245px, 33vw, 335px)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'transform 0.45s cubic-bezier(0.2, 0.8, 0.25, 1), opacity 0.45s ease',
                  transformOrigin: 'center center',
                  ...style3D,
                }}
              >
                {/* Outer Glow & Under-Glow Shelf for Active Card */}
                {isActive && (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        inset: '-12px',
                        borderRadius: '32px',
                        background:
                          'radial-gradient(ellipse at center, rgba(251, 195, 36, 0.48) 0%, rgba(251, 195, 36, 0.16) 45%, transparent 72%)',
                        filter: 'blur(16px)',
                        pointerEvents: 'none',
                        zIndex: 0,
                        animation: 'lmActivePulse 2.8s ease-in-out infinite',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '-14px',
                        left: '10%',
                        right: '10%',
                        height: '24px',
                        borderRadius: '50%',
                        background:
                          'radial-gradient(ellipse at center, rgba(251, 195, 36, 0.6) 0%, rgba(245, 158, 11, 0.25) 50%, transparent 80%)',
                        filter: 'blur(10px)',
                        pointerEvents: 'none',
                        zIndex: 0,
                      }}
                    />
                  </>
                )}

                {/* Card Surface */}
                <div
                  className={isActive ? 'lm-border-beam lm-surface-reflection' : ''}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    backgroundColor: '#191816',
                    border: isActive ? '1px solid rgba(251, 195, 36, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: isActive
                      ? '0 18px 40px rgba(0, 0, 0, 0.9), 0 0 24px rgba(251, 195, 36, 0.28)'
                      : '0 8px 20px rgba(0, 0, 0, 0.6)',
                    boxSizing: 'border-box',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  {/* Top Badges: Veg/Non-Veg & Price */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 10,
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        border: `1.5px solid ${item.dietary === 'VEG' ? '#22C55E' : '#EF4444'}`,
                        borderRadius: '3px',
                        backgroundColor: 'rgba(8, 8, 8, 0.75)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: item.dietary === 'VEG' ? '#22C55E' : '#EF4444',
                        }}
                      />
                    </span>

                    <span
                      style={{
                        backgroundColor: 'rgba(8, 8, 8, 0.85)',
                        border: '1px solid rgba(251, 195, 36, 0.45)',
                        borderRadius: '999px',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#FBC324',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
                      }}
                    >
                      ₹{item.price}
                    </span>
                  </div>

                  {/* Center Dish Presentation with Ambient Gold Aura */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 12px',
                    }}
                  >
                    <div
                      style={{
                        width: '94px',
                        height: '94px',
                        borderRadius: '50%',
                        backgroundColor: '#121110',
                        backgroundImage:
                          'radial-gradient(circle at 45% 40%, rgba(251, 195, 36, 0.16) 0%, transparent 70%), linear-gradient(180deg, #181715 0%, #0D0C0B 100%)',
                        border: '1.5px solid rgba(251, 195, 36, 0.35)',
                        boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.8), 0 0 22px rgba(251, 195, 36, 0.18)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        marginBottom: '8px',
                      }}
                    >
                      <Sparkles size={18} style={{ color: '#FBC324' }} />
                      <span
                        style={{
                          fontSize: '8px',
                          fontWeight: 800,
                          letterSpacing: '0.1em',
                          color: '#FAF7F2',
                          textTransform: 'uppercase',
                        }}
                      >
                        LM SPECIAL
                      </span>
                    </div>

                    <div
                      style={{
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#FAF7F2',
                        textAlign: 'center',
                        lineHeight: 1.2,
                        marginBottom: '2px',
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: '#9C8C7E',
                        textAlign: 'center',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {item.tagline}
                    </div>
                  </div>

                  {/* Card Bottom Category Badge Pill */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 10,
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: isActive ? '#FBC324' : 'rgba(25, 24, 22, 0.85)',
                        color: isActive ? '#080808' : '#FAF7F2',
                        border: '1px solid ' + (isActive ? '#FBC324' : 'rgba(255, 255, 255, 0.1)'),
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        boxShadow: isActive ? '0 2px 12px rgba(251, 195, 36, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.4)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {item.category}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual Prev / Next Controls + Slide Indicator Dots */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          marginTop: '16px',
          zIndex: 3,
        }}
      >
        <button
          onClick={handlePrev}
          aria-label="Previous Slide"
          className="lm-interactive-btn"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: '#191816',
            border: '1px solid rgba(251, 195, 36, 0.25)',
            color: '#FAF7F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Slide Indicator Dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {heroItems.map((item, idx) => {
            const isCurrent = idx === safeActiveIndex;
            return (
              <button
                key={item.id}
                onClick={() => {
                  pauseAutoRotateTemporarily();
                  goTo(idx);
                }}
                aria-label={`Go to ${item.label}`}
                style={{
                  width: isCurrent ? '22px' : '7px',
                  height: '7px',
                  borderRadius: '3.5px',
                  backgroundColor: isCurrent ? '#FBC324' : 'rgba(255, 255, 255, 0.22)',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.25, 1)',
                }}
              />
            );
          })}
        </div>

        <button
          onClick={handleNext}
          aria-label="Next Slide"
          className="lm-interactive-btn"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: '#191816',
            border: '1px solid rgba(251, 195, 36, 0.25)',
            color: '#FAF7F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
};
