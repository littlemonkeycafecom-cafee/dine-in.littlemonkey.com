import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Product } from '../types';
import { ChevronDown, LayoutGrid, Check, Search, Sparkles } from 'lucide-react';
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
  image: string;
}

export const HERO_ITEMS: HeroItem[] = [
  {
    id: 'dessert',
    label: 'Churros & Dip',
    category: 'Desserts',
    tagline: 'Artisanal Sweet Finish',
    accent: '#FFC21A',
    slug: 'desserts-churros',
    price: 275,
    dietary: 'VEG',
    image: '/images/products/desserts-churros.jpg',
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
    image: '/images/products/thin-crust-pizza-farmhouse.jpg',
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
    image: '/images/products/chicken_burger_1.jpg',
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
    image: '/images/products/pasta-pasta-veg.jpg',
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
    image: '/images/products/crispy-chicken-chicken-wings.jpg',
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
    image: '/images/products/fries-masala-french-fries.jpg',
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
    image: '/images/products/hot-coffee-cappuccino.jpg',
  },
  {
    id: 'shakes',
    label: 'Oreo Shake',
    category: 'Thick Shakes',
    tagline: 'Premium Thick Shake',
    accent: '#FFC21A',
    slug: 'milkshakes-oreo-shake',
    price: 259,
    dietary: 'VEG',
    image: '/images/products/milkshakes-oreo-shake.jpg',
  },
];

const ROTATION_INTERVAL = 3000; // 3000 ms per specification
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
        }, reducedMotion ? 50 : 650);
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
    !reducedMotion && !isHovered && !isInteracting && !isTabHidden;

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
            className="lm-logo-ambient-img"
            style={{
              height: 'clamp(52px, 7vw, 72px)',
              width: 'auto',
              maxWidth: '240px',
              objectFit: 'contain',
              display: 'block',
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

        {/* Primary Hero Control: Explore Menu (All Items & Veg Only removed from hero) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '4px',
          }}
        >
          <button
            type="button"
            onClick={onExploreClick}
            className="lm-interactive-btn lm-hero-explore-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '44px',
              padding: '0 28px',
              borderRadius: '999px',
              backgroundColor: '#FBC324',
              color: '#080808',
              fontSize: '13.5px',
              fontWeight: 800,
              letterSpacing: '0.03em',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(251, 195, 36, 0.32), 0 0 16px rgba(251, 195, 36, 0.18)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <span>Explore Menu</span>
            <ChevronDown size={16} />
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
                  transition: 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.55s ease',
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
                    backgroundColor: '#141414',
                    border: isActive ? '1.5px solid #FFC21A' : '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: isActive
                      ? '0 20px 48px rgba(0, 0, 0, 0.95), 0 0 28px rgba(251, 195, 36, 0.35)'
                      : '0 8px 24px rgba(0, 0, 0, 0.7)',
                    boxSizing: 'border-box',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  {/* Dish Photography Fill */}
                  <img
                    src={item.image}
                    alt={item.label}
                    loading="lazy"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center',
                      zIndex: 0,
                      transition: 'transform 0.4s ease',
                      transform: isActive ? 'scale(1.04)' : 'scale(1)',
                    }}
                  />

                  {/* Gradient Vignette Overlay for Crisp Readability */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(180deg, rgba(8, 8, 8, 0.75) 0%, rgba(8, 8, 8, 0.08) 40%, rgba(8, 8, 8, 0.88) 100%)',
                      zIndex: 1,
                      pointerEvents: 'none',
                    }}
                  />

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
                        backgroundColor: 'rgba(8, 8, 8, 0.85)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(4px)',
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
                        backgroundColor: 'rgba(8, 8, 8, 0.88)',
                        border: '1px solid rgba(251, 195, 36, 0.5)',
                        borderRadius: '999px',
                        padding: '3px 10px',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        color: '#FBC324',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      ₹{item.price}
                    </span>
                  </div>

                  {/* Card Bottom: Dish Name & Category Badge Pill */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 10,
                      padding: '14px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#FAF7F2',
                        lineHeight: 1.2,
                        textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                      }}
                    >
                      {item.label}
                    </div>

                    <span
                      style={{
                        backgroundColor: isActive ? '#FBC324' : 'rgba(18, 16, 14, 0.88)',
                        color: isActive ? '#080808' : '#FAF7F2',
                        border: '1px solid ' + (isActive ? '#FBC324' : 'rgba(255, 255, 255, 0.16)'),
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        boxShadow: isActive ? '0 2px 12px rgba(251, 195, 36, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.5)',
                        backdropFilter: 'blur(4px)',
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

      {/* Slide Indicator Dots (Previous/Next arrow buttons removed per requirement) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          marginTop: '16px',
          zIndex: 3,
        }}
      >
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
                transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          );
        })}
      </div>
    </section>
  );
};
