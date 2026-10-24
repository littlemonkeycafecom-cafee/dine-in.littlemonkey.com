import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Product } from '../types';
import { Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface HeroItem {
  id: string;
  label: string;
  category: string;
  tagline: string;
  accent: string;
  slug: string;
  price: number;
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
  },
  {
    id: 'pizza',
    label: 'Farmhouse Pizza',
    category: 'Thin Crust Pizza',
    tagline: 'Signature Thin Crust',
    accent: '#FFC21A',
    slug: 'thin-crust-pizza-peri-peri-italio-pizza',
    price: 449,
  },
  {
    id: 'burger',
    label: 'Crispy Chicken Burger',
    category: 'Burgers',
    tagline: 'Handcrafted Gourmet',
    accent: '#FFC21A',
    slug: 'burgers-crispy-chicken-cheese-burger',
    price: 199,
  },
  {
    id: 'pasta',
    label: 'Red Sauce Pasta',
    category: 'Pasta',
    tagline: 'Stone-Ground Al Dente',
    accent: '#D4AF37',
    slug: 'pasta-pasta-veg',
    price: 249,
  },
  {
    id: 'chicken',
    label: 'Chicken Wings',
    category: 'Crispy Chicken',
    tagline: 'Golden Crispy',
    accent: '#FFC21A',
    slug: 'crispy-chicken-chicken-wings',
    price: 179,
  },
  {
    id: 'fries',
    label: 'Peri Peri Fries',
    category: 'Fries',
    tagline: 'Flame-Seasoned',
    accent: '#FFC21A',
    slug: 'fries-peri-peri-fries',
    price: 139,
  },
  {
    id: 'coffee',
    label: 'Cappuccino',
    category: 'Hot Coffee',
    tagline: 'Specialty Espresso',
    accent: '#D4AF37',
    slug: 'hot-coffee-caf-latte',
    price: 169,
  },
  {
    id: 'shakes',
    label: 'Oreo Shake',
    category: 'Milkshakes',
    tagline: 'Premium Thick Shake',
    accent: '#FFC21A',
    slug: 'milkshakes-red-velvet',
    price: 229,
  },
];

const TOTAL = HERO_ITEMS.length; // 8
const ROTATION_INTERVAL = 5500; // 5.5s comfortable dwell time
const RESUME_DELAY = 7000; // 7s pause after customer interaction

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
  onSearchClick: () => void;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  products,
  onProductClick,
  onExploreClick,
  onSearchClick,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
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

  const pauseAutoRotateTemporarily = useCallback(() => {
    setIsPaused(true);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      setIsPaused(false);
    }, RESUME_DELAY);
  }, []);

  const goTo = useCallback(
    (newIndex: number) => {
      if (transitionLockRef.current) return;
      if (newIndex === activeIndex) return;

      transitionLockRef.current = true;
      setActiveIndex(newIndex);

      setTimeout(() => {
        transitionLockRef.current = false;
      }, reducedMotion ? 50 : 450);
    },
    [activeIndex, reducedMotion]
  );

  const handlePrev = useCallback(() => {
    pauseAutoRotateTemporarily();
    goTo(mod(activeIndex - 1, TOTAL));
  }, [activeIndex, goTo, pauseAutoRotateTemporarily]);

  const handleNext = useCallback(() => {
    pauseAutoRotateTemporarily();
    goTo(mod(activeIndex + 1, TOTAL));
  }, [activeIndex, goTo, pauseAutoRotateTemporarily]);

  // Autonomous rotation
  useEffect(() => {
    if (reducedMotion || isPaused) return;

    autoRotateTimerRef.current = setInterval(() => {
      if (!transitionLockRef.current) {
        goTo(mod(activeIndex + 1, TOTAL));
      }
    }, ROTATION_INTERVAL);

    return () => {
      if (autoRotateTimerRef.current) clearInterval(autoRotateTimerRef.current);
    };
  }, [activeIndex, isPaused, reducedMotion, goTo]);

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
        goTo(mod(activeIndex + 1, TOTAL));
      } else {
        goTo(mod(activeIndex - 1, TOTAL));
      }
    }

    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 60);
  };

  const handleCardClick = (index: number) => {
    if (hasDraggedRef.current) return;
    pauseAutoRotateTemporarily();

    if (index === activeIndex) {
      const heroItem = HERO_ITEMS[activeIndex];
      const matched = products.find((p) => p.name.toLowerCase().includes(heroItem.label.toLowerCase())) ||
        products.find((p) => p.category.toLowerCase().includes(heroItem.category.toLowerCase())) ||
        products[0];
      if (matched) {
        onProductClick(matched);
      }
    } else {
      goTo(index);
    }
  };

  const activeItem = HERO_ITEMS[activeIndex];

  // Responsive 3D transform computation
  const getCardStyle = (index: number) => {
    const offset = mod(index - activeIndex + Math.floor(TOTAL / 2), TOTAL) - Math.floor(TOTAL / 2);
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
      onMouseEnter={pauseAutoRotateTemporarily}
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

      {/* Brand Tagline */}
      <div style={{ position: 'relative', zIndex: 2, marginBottom: '14px' }}>
        <p
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(15px, 2vw, 18px)',
            fontWeight: 600,
            fontStyle: 'italic',
            color: '#C8C1B2',
            letterSpacing: '0.02em',
            margin: '0 0 14px 0',
          }}
        >
          Coffee and More.
        </p>

        {/* Action Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onExploreClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '40px',
              padding: '0 22px',
              borderRadius: '999px',
              backgroundColor: '#FBC324',
              color: '#080808',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.02em',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(251, 195, 36, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Menu</span>
            <ChevronDown size={15} />
          </button>

          <button
            type="button"
            onClick={onSearchClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '40px',
              padding: '0 18px',
              borderRadius: '999px',
              backgroundColor: '#191816',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#9C8C7E',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              transition: 'border-color 0.15s ease',
            }}
          >
            <Search size={14} style={{ color: '#FBC324' }} />
            <span>Search pizza, burger, frappe...</span>
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
          {HERO_ITEMS.map((item, index) => {
            const isActive = index === activeIndex;
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
                {/* Outer Glow for Active Card */}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-6px',
                      borderRadius: '26px',
                      background: 'radial-gradient(ellipse at center, rgba(251, 195, 36, 0.4) 0%, rgba(251, 195, 36, 0.1) 50%, transparent 75%)',
                      filter: 'blur(12px)',
                      pointerEvents: 'none',
                      zIndex: 0,
                    }}
                  />
                )}

                {/* Card Surface */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    backgroundColor: '#191816',
                    border: isActive ? '2px solid #FBC324' : '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: isActive
                      ? '0 16px 36px rgba(0, 0, 0, 0.85), 0 0 16px rgba(251, 195, 36, 0.25)'
                      : '0 8px 20px rgba(0, 0, 0, 0.6)',
                    boxSizing: 'border-box',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                  }}
                >
                  {/* Image Container Structure (Configurable placeholder ready for photographs) */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: '#141312',
                      backgroundImage: `radial-gradient(circle at 50% 40%, rgba(251, 195, 36, 0.08) 0%, transparent 70%), linear-gradient(180deg, rgba(25, 24, 22, 0.4) 0%, rgba(8, 8, 8, 0.85) 100%)`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '20px',
                    }}
                  >
                    {/* Dark Proportioned Plate Silhouette Placeholder */}
                    <div
                      style={{
                        width: '75%',
                        height: '55%',
                        borderRadius: '16px',
                        backgroundColor: '#100F0E',
                        border: '1px dashed rgba(251, 195, 36, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        color: '#9C8C7E',
                        marginBottom: '32px',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2' }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: '9px', color: '#FBC324', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        ₹{item.price} • {item.category}
                      </span>
                    </div>
                  </div>

                  {/* Card Bottom Category Badge Pill */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: isActive ? 'rgba(251, 195, 36, 0.95)' : 'rgba(25, 24, 22, 0.85)',
                        color: isActive ? '#080808' : '#FAF7F2',
                        border: '1px solid ' + (isActive ? '#FBC324' : 'rgba(255, 255, 255, 0.1)'),
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
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

      {/* Manual Prev / Next Controls for Accessibility */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginTop: '12px',
          zIndex: 3,
        }}
      >
        <button
          onClick={handlePrev}
          aria-label="Previous Slide"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#191816',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#FAF7F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={16} />
        </button>

        <span style={{ fontSize: '11px', color: '#9C8C7E', fontWeight: 600 }}>
          <span style={{ color: '#FBC324' }}>{activeIndex + 1}</span> / {TOTAL}
        </span>

        <button
          onClick={handleNext}
          aria-label="Next Slide"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#191816',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#FAF7F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
};
