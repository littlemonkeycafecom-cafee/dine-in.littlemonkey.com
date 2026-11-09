import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '../types';
import {
  SPECIALTY_COLD_BREW_PRODUCTS,
  getBasePrice,
  getOriginalPrice,
  getDiscountPercentage,
} from '../services/catalog';
import {
  X,
  Sparkles,
  Droplets,
  Coffee,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Flame,
  Snowflake,
} from 'lucide-react';

interface CoffeeCinematicExperienceProps {
  isOpen: boolean;
  onClose: () => void;
  onProductSelect?: (product: Product) => void;
}

export const CoffeeCinematicExperience: React.FC<CoffeeCinematicExperienceProps> = ({
  isOpen,
  onClose,
  onProductSelect,
}) => {
  // DOM Rendering lifecycle state
  const [isRendered, setIsRendered] = useState(isOpen);

  // Staged Animation States
  const [backdropActive, setBackdropActive] = useState(false);
  const [cardCentered, setCardCentered] = useState(false);
  const [borderProgress, setBorderProgress] = useState(0);
  const [isBorderComplete, setIsBorderComplete] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // View state within the experience
  const [activeTab, setActiveTab] = useState<'collection' | 'comparison'>('collection');
  const [activeDrink, setActiveDrink] = useState<Product | null>(null);

  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Track viewport width for responsive layout
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  // Reference management for clean lifecycle and rapid-click protection
  const entranceTimersRef = useRef<number[]>([]);
  const exitTimersRef = useRef<number[]>([]);
  const rafIdsRef = useRef<number[]>([]);
  const isClosingRef = useRef(false);
  const originalOverflowRef = useRef<string>('');

  const clearEntranceTimers = useCallback(() => {
    entranceTimersRef.current.forEach((id) => window.clearTimeout(id));
    entranceTimersRef.current = [];
    rafIdsRef.current.forEach((id) => window.cancelAnimationFrame(id));
    rafIdsRef.current = [];
  }, []);

  const clearExitTimers = useCallback(() => {
    exitTimersRef.current.forEach((id) => window.clearTimeout(id));
    exitTimersRef.current = [];
  }, []);

  const safeEntranceTimeout = useCallback((fn: () => void, delayMs: number) => {
    const id = window.setTimeout(fn, delayMs);
    entranceTimersRef.current.push(id);
    return id;
  }, []);

  const safeExitTimeout = useCallback((fn: () => void, delayMs: number) => {
    const id = window.setTimeout(fn, delayMs);
    exitTimersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Choreographed Reverse Animation
  const triggerClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);

    clearEntranceTimers();
    clearExitTimers();

    if (prefersReducedMotion) {
      setBackdropActive(false);
      setCardCentered(false);
      setBorderProgress(0);
      setIsBorderComplete(false);
      setShowContent(false);
      setIsRendered(false);
      setActiveDrink(null);
      setActiveTab('collection');
      isClosingRef.current = false;
      setIsClosing(false);
      document.body.style.overflow = '';
      onClose();
      return;
    }

    // Reverse Sequence:
    // 1. Animate product content out smoothly
    setShowContent(false);

    // 2. Retract / fade golden border
    safeExitTimeout(() => {
      setIsBorderComplete(false);
      setBorderProgress(0);
    }, 140);

    // 3. Move black card downward out of view
    safeExitTimeout(() => {
      setCardCentered(false);
    }, 240);

    // 4. Restore original menu brightness and blur
    safeExitTimeout(() => {
      setBackdropActive(false);
    }, 380);

    // 5. Unmount, restore scrolling, reset all animation states cleanly
    safeExitTimeout(() => {
      setIsRendered(false);
      setActiveDrink(null);
      setActiveTab('collection');
      isClosingRef.current = false;
      setIsClosing(false);
      document.body.style.overflow = '';
      onClose();
    }, 620);
  }, [clearEntranceTimers, clearExitTimers, safeExitTimeout, prefersReducedMotion, onClose]);

  // Previous isOpen tracker to strictly isolate parent transitions from internal state updates
  const prevIsOpenRef = useRef(isOpen);

  // Staged Opening Choreography
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (!wasOpen && isOpen) {
      clearExitTimers();
      isClosingRef.current = false;
      setIsClosing(false);
      clearEntranceTimers();

      // Mount into DOM
      setIsRendered(true);

      // Lock scrolling safely
      document.body.style.overflow = 'hidden';

      if (prefersReducedMotion) {
        setBackdropActive(true);
        setCardCentered(true);
        setBorderProgress(100);
        setIsBorderComplete(true);
        setShowContent(true);
      } else {
        // Reset states to entrance baseline
        setBackdropActive(false);
        setCardCentered(false);
        setBorderProgress(0);
        setIsBorderComplete(false);
        setShowContent(false);

        // Stage 1 & 2: Darken page smoothly and animate black card upward from bottom
        const rafId = window.requestAnimationFrame(() => {
          setBackdropActive(true);
          setCardCentered(true);
        });
        rafIdsRef.current.push(rafId);

        // Stage 3: Draw progressive golden border as card settles in center of viewport
        safeEntranceTimeout(() => {
          setBorderProgress(100);
        }, 450);

        // Stage 4 & 5: Golden border completes loop, settles into metallic edge, and reveals showcase
        safeEntranceTimeout(() => {
          setIsBorderComplete(true);
          setShowContent(true);
        }, 1200);
      }
    } else if (wasOpen && !isOpen && isRendered && !isClosingRef.current) {
      triggerClose();
    }
  }, [isOpen, prefersReducedMotion, clearEntranceTimers, clearExitTimers, safeEntranceTimeout, isRendered, triggerClose]);

  // General unmount cleanup
  useEffect(() => {
    return () => {
      clearEntranceTimers();
      clearExitTimers();
      document.body.style.overflow = '';
    };
  }, [clearEntranceTimers, clearExitTimers]);

  // Escape key dismiss handler with capture phase
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRendered) {
        e.preventDefault();
        e.stopPropagation();
        if (activeDrink) {
          setActiveDrink(null);
        } else if (!isClosingRef.current) {
          triggerClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isRendered, activeDrink, triggerClose]);

  if (!isRendered) return null;

  return (
    <>
      <style>{`
        @keyframes lmFloatBean1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(12deg); }
        }
        @keyframes lmFloatBean2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(-15deg); }
        }
        @keyframes lmFloatBean3 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(8deg); }
        }
        @keyframes lmCardContentFadeIn {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes lmDrinkGridItem {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes lmSwirlSlow {
          0% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.02) rotate(1.5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .lm-coffee-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .lm-coffee-scroll::-webkit-scrollbar-track {
          background: #080808;
        }
        .lm-coffee-scroll::-webkit-scrollbar-thumb {
          background: #2A2A2A;
          border-radius: 4px;
        }
        .lm-coffee-scroll::-webkit-scrollbar-thumb:hover {
          background: #FFC21A;
        }
      `}</style>

      {/* Surrounding Page Darkening & Backdrop Blur Overlay */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coffee-experience-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9995,
          backgroundColor: backdropActive ? 'rgba(4, 4, 4, 0.92)' : 'rgba(0, 0, 0, 0)',
          backdropFilter: backdropActive ? 'blur(12px)' : 'blur(0px)',
          WebkitBackdropFilter: backdropActive ? 'blur(12px)' : 'blur(0px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '8px' : '20px',
          boxSizing: 'border-box',
          transition: prefersReducedMotion
            ? 'none'
            : 'background-color 0.35s ease, backdrop-filter 0.35s ease, -webkit-backdrop-filter 0.35s ease, opacity 0.35s ease',
          opacity: backdropActive ? 1 : 0,
          pointerEvents: isClosing ? 'none' : 'auto',
          perspective: '1200px',
        }}
        onClick={() => {
          if (!isClosingRef.current) {
            triggerClose();
          }
        }}
      >
        {/* Cinematic Black Card Container */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '1020px',
            maxHeight: isMobile ? '96vh' : '90vh',
            height: isMobile ? '96vh' : '860px',
            backgroundColor: '#080808',
            backgroundImage:
              'radial-gradient(ellipse at 50% 0%, rgba(251, 195, 36, 0.08) 0%, rgba(8, 8, 8, 0.98) 70%)',
            borderRadius: '16px',
            boxShadow: cardCentered
              ? '0 24px 64px rgba(0, 0, 0, 0.95), 0 0 36px rgba(255, 194, 26, 0.14)'
              : '0 0 0 rgba(0, 0, 0, 0)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transform: cardCentered ? 'translateY(0%) scale(1)' : 'translateY(100%) scale(0.96)',
            transition: prefersReducedMotion
              ? 'none'
              : 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
            willChange: 'transform, opacity',
          }}
        >
          {/* Animated Progressive Golden Border SVG Overlay */}
          <svg
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 40,
              borderRadius: 'inherit',
              overflow: 'hidden',
            }}
          >
            <rect
              x="1.5"
              y="1.5"
              rx="15"
              ry="15"
              fill="none"
              stroke={isBorderComplete ? '#FFC21A' : '#FBC324'}
              strokeWidth={isBorderComplete ? 1.5 : 2}
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - borderProgress}
              style={{
                width: 'calc(100% - 3px)',
                height: 'calc(100% - 3px)',
                transition: prefersReducedMotion
                  ? 'none'
                  : 'stroke-dashoffset 0.75s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease, filter 0.3s ease, opacity 0.2s ease',
                filter: isBorderComplete
                  ? 'drop-shadow(0 0 6px rgba(255, 194, 26, 0.45))'
                  : 'drop-shadow(0 0 8px rgba(255, 194, 26, 0.65))',
                opacity: isClosing ? 0 : 1,
              }}
            />
          </svg>

          {/* Ambient Floating Decorative Coffee Bean Accents */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '40px',
              left: '5%',
              width: '18px',
              height: '11px',
              borderRadius: '50%',
              backgroundColor: '#261A12',
              border: '1px solid #4A3322',
              opacity: 0.35,
              pointerEvents: 'none',
              animation: 'lmFloatBean1 6s ease-in-out infinite',
              zIndex: 2,
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: '80px',
              right: '6%',
              width: '16px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#261A12',
              border: '1px solid #4A3322',
              opacity: 0.3,
              pointerEvents: 'none',
              animation: 'lmFloatBean2 8s ease-in-out infinite',
              zIndex: 2,
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '120px',
              right: '12%',
              width: '14px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: '#261A12',
              border: '1px solid #4A3322',
              opacity: 0.25,
              pointerEvents: 'none',
              animation: 'lmFloatBean3 7s ease-in-out infinite',
              zIndex: 2,
            }}
          />

          {/* Modal Header — Revealed Sequentially After Card Transition & Border Draw */}
          <div
            style={{
              padding: isMobile ? '12px 14px' : '16px 24px',
              backgroundColor: '#0D0D0D',
              borderBottom: '1px solid #1E1E1E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              position: 'relative',
              zIndex: 10,
              flexShrink: 0,
              opacity: showContent ? 1 : 0,
              transform: showContent ? 'translateY(0)' : 'translateY(-8px)',
              transition: prefersReducedMotion
                ? 'none'
                : 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: isMobile ? '9.5px' : '11px',
                  fontWeight: 800,
                  color: '#FFC21A',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '2px',
                }}
              >
                <Sparkles size={12} style={{ color: '#FFC21A' }} />
                <span>CRAFT MEETS COLD</span>
                <span style={{ color: '#555555' }}>•</span>
                <span style={{ color: '#E5E5E5' }}>THE ICE SIDE OF COFFEE</span>
              </div>
              <h2
                id="coffee-experience-title"
                style={{
                  margin: 0,
                  fontSize: isMobile ? '17px' : '22px',
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                }}
              >
                Signature Cold Brew Experience
              </h2>
            </div>

            {/* Close Action Button */}
            <button
              type="button"
              onClick={triggerClose}
              aria-label="Close Coffee Experience"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#161616',
                border: '1px solid #282828',
                color: '#FAF7F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#FFC21A';
                e.currentTarget.style.color = '#FFC21A';
                e.currentTarget.style.backgroundColor = '#202020';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#282828';
                e.currentTarget.style.color = '#FAF7F2';
                e.currentTarget.style.backgroundColor = '#161616';
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Sub-Header / Tab Switcher */}
          <div
            style={{
              padding: isMobile ? '8px 14px' : '10px 24px',
              backgroundColor: '#090909',
              borderBottom: '1px solid #1A1A1A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
              position: 'relative',
              zIndex: 10,
              flexShrink: 0,
              opacity: showContent ? 1 : 0,
              transform: showContent ? 'translateY(0)' : 'translateY(-6px)',
              transition: prefersReducedMotion
                ? 'none'
                : 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('collection');
                  setActiveDrink(null);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: activeTab === 'collection' ? '#FFC21A' : '#141414',
                  color: activeTab === 'collection' ? '#080808' : '#A3A3A3',
                  border: activeTab === 'collection' ? '1px solid #FFC21A' : '1px solid #252525',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
              >
                10 HANDCRAFTED BREWS
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('comparison');
                  setActiveDrink(null);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: activeTab === 'comparison' ? '#FFC21A' : '#141414',
                  color: activeTab === 'comparison' ? '#080808' : '#A3A3A3',
                  border: activeTab === 'comparison' ? '1px solid #FFC21A' : '1px solid #252525',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
              >
                ICED COFFEE VS COLD BREW
              </button>
            </div>

            {activeDrink && activeTab === 'collection' && (
              <button
                type="button"
                onClick={() => setActiveDrink(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#161616',
                  color: '#FFC21A',
                  border: '1px solid rgba(255, 194, 26, 0.4)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={13} />
                <span>Back to Collection</span>
              </button>
            )}
          </div>

          {/* Scrollable Content Body — Revealed Smoothly */}
          <div
            className="lm-coffee-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: isMobile ? '14px' : '20px 24px',
              position: 'relative',
              zIndex: 5,
              opacity: showContent ? 1 : 0,
              transform: showContent ? 'translateY(0)' : 'translateY(12px)',
              transition: prefersReducedMotion
                ? 'none'
                : 'opacity 0.38s ease, transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* VIEW A: Single Drink Prominent View */}
            {activeDrink && activeTab === 'collection' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? '16px' : '28px',
                  alignItems: isMobile ? 'center' : 'flex-start',
                  backgroundColor: '#0F0F0F',
                  border: '1px solid rgba(255, 194, 26, 0.35)',
                  borderRadius: '12px',
                  padding: isMobile ? '16px' : '24px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.75)',
                  animation: prefersReducedMotion ? 'none' : 'lmCardContentFadeIn 0.3s ease-out forwards',
                }}
              >
                {/* Large Product Glass Photo — Preserving Aspect Ratio */}
                <div
                  style={{
                    width: isMobile ? '100%' : '320px',
                    maxWidth: '360px',
                    aspectRatio: '1 / 1',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: '#050505',
                    border: '1px solid #222222',
                    position: 'relative',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {activeDrink.image_url ? (
                    <img
                      src={activeDrink.image_url}
                      alt={activeDrink.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        padding: '12px',
                        boxSizing: 'border-box',
                        animation: prefersReducedMotion ? 'none' : 'lmSwirlSlow 10s ease-in-out infinite',
                      }}
                    />
                  ) : (
                    <Coffee size={48} style={{ color: '#FFC21A' }} />
                  )}

                  {activeDrink.badge && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        backgroundColor: 'rgba(8, 8, 8, 0.92)',
                        color: '#FFC21A',
                        border: '1px solid rgba(255, 194, 26, 0.5)',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {activeDrink.badge}
                    </span>
                  )}
                </div>

                {/* Drink Details & Ingredients */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#FFC21A',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        marginBottom: '4px',
                      }}
                    >
                      {activeDrink.tagline || 'SIGNATURE CRAFT COLD BREW'}
                    </div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: isMobile ? '20px' : '26px',
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontWeight: 700,
                        color: '#FAF7F2',
                        lineHeight: 1.2,
                      }}
                    >
                      {activeDrink.name}
                    </h3>

                    {/* Price Row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '8px',
                        marginTop: '8px',
                      }}
                    >
                      <span style={{ fontSize: '20px', fontWeight: 800, color: '#FFC21A' }}>
                        ₹{getBasePrice(activeDrink)}
                      </span>
                      {getOriginalPrice(activeDrink) && (
                        <span
                          style={{
                            fontSize: '13px',
                            color: '#666666',
                            textDecoration: 'line-through',
                          }}
                        >
                          ₹{getOriginalPrice(activeDrink)}
                        </span>
                      )}
                      {getDiscountPercentage(activeDrink) && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            color: '#22C55E',
                            backgroundColor: 'rgba(34, 197, 94, 0.15)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {getDiscountPercentage(activeDrink)}% OFF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13.5px',
                      color: '#C5C5C5',
                      lineHeight: 1.5,
                    }}
                  >
                    {activeDrink.description}
                  </p>

                  {/* Ingredients */}
                  {activeDrink.ingredients && activeDrink.ingredients.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#A3A3A3',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          marginBottom: '6px',
                        }}
                      >
                        Handcrafted Ingredients
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {activeDrink.ingredients.map((ing, idx) => (
                          <div
                            key={idx}
                            style={{
                              backgroundColor: '#181818',
                              border: '1px solid #282828',
                              borderRadius: '6px',
                              padding: '5px 9px',
                              fontSize: '11.5px',
                              color: '#FAF7F2',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: '#FFC21A' }}>{ing.name}</span>
                            {ing.detail && <span style={{ color: '#888888' }}>: {ing.detail}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Process Steps */}
                  {activeDrink.process_steps && activeDrink.process_steps.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#A3A3A3',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          marginBottom: '6px',
                        }}
                      >
                        Artisanal Cold Extraction Process
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {activeDrink.process_steps.map((step, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              color: '#D4D4D4',
                            }}
                          >
                            <CheckCircle2 size={13} style={{ color: '#FFC21A', flexShrink: 0 }} />
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Return Button */}
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setActiveDrink(null)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 18px',
                        borderRadius: '8px',
                        backgroundColor: '#FFC21A',
                        color: '#080808',
                        border: 'none',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      <ArrowLeft size={14} />
                      <span>Back to Collection</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW B: 10 Handcrafted Cold Brews Grid */}
            {!activeDrink && activeTab === 'collection' && (
              <div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile
                      ? 'repeat(2, 1fr)'
                      : 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: isMobile ? '10px' : '14px',
                  }}
                >
                  {SPECIALTY_COLD_BREW_PRODUCTS.map((brew, brewIdx) => {
                    const price = getBasePrice(brew);
                    const originalPrice = getOriginalPrice(brew);

                    return (
                      <div
                        key={brew.slug}
                        onClick={() => setActiveDrink(brew)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Inspect ${brew.name}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setActiveDrink(brew);
                          }
                        }}
                        style={{
                          backgroundColor: '#111111',
                          border: '1px solid #222222',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.6)',
                          animation: prefersReducedMotion
                            ? 'none'
                            : `lmDrinkGridItem 0.35s ease backwards ${brewIdx * 0.03}s`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.borderColor = '#FFC21A';
                          e.currentTarget.style.boxShadow =
                            '0 8px 24px rgba(0, 0, 0, 0.8), 0 0 16px rgba(255, 194, 26, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.borderColor = '#222222';
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.6)';
                        }}
                      >
                        {/* Thumbnail Container — Preserving Proportions */}
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '1 / 1',
                            backgroundColor: '#070707',
                            overflow: 'hidden',
                            borderBottom: '1px solid #1A1A1A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {brew.image_url ? (
                            <img
                              src={brew.image_url}
                              alt={brew.name}
                              loading="lazy"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                padding: '8px',
                                boxSizing: 'border-box',
                              }}
                            />
                          ) : (
                            <Coffee size={24} style={{ color: '#FFC21A' }} />
                          )}

                          {brew.badge && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                fontSize: '8px',
                                fontWeight: 800,
                                backgroundColor: 'rgba(8, 8, 8, 0.9)',
                                color: '#FFC21A',
                                border: '1px solid rgba(255, 194, 26, 0.4)',
                                borderRadius: '3px',
                                padding: '2px 5px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {brew.badge}
                            </span>
                          )}
                        </div>

                        {/* Drink Info */}
                        <div
                          style={{
                            padding: isMobile ? '8px 10px' : '10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            flex: 1,
                            gap: '6px',
                          }}
                        >
                          <div>
                            <h4
                              style={{
                                margin: '0 0 2px 0',
                                fontSize: isMobile ? '12px' : '13.5px',
                                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                                fontWeight: 700,
                                color: '#FAF7F2',
                                lineHeight: 1.25,
                              }}
                            >
                              {brew.name}
                            </h4>
                            <p
                              style={{
                                margin: 0,
                                fontSize: isMobile ? '10px' : '11px',
                                color: '#888888',
                                lineHeight: 1.3,
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {brew.tagline || brew.description}
                            </p>
                          </div>

                          {/* Price & Action Row */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: '6px',
                              borderTop: '1px solid #1A1A1A',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                              <span
                                style={{
                                  fontSize: isMobile ? '13px' : '14.5px',
                                  fontWeight: 800,
                                  color: '#FFC21A',
                                }}
                              >
                                ₹{price}
                              </span>
                              {originalPrice && originalPrice > (price || 0) && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#666666',
                                    textDecoration: 'line-through',
                                  }}
                                >
                                  ₹{originalPrice}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDrink(brew);
                              }}
                              aria-label={`View ${brew.name}`}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '4px',
                                backgroundColor: '#1A1A1A',
                                border: '1px solid #2A2A2A',
                                color: '#FFC21A',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW C: Iced Coffee vs Cold Brew Comparison */}
            {activeTab === 'comparison' && (
              <div
                style={{
                  backgroundColor: '#0D0D0D',
                  border: '1px solid rgba(255, 194, 26, 0.3)',
                  borderRadius: '12px',
                  padding: isMobile ? '14px 12px' : '24px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
                  animation: prefersReducedMotion ? 'none' : 'lmCardContentFadeIn 0.3s ease-out forwards',
                }}
              >
                {/* Desktop 3-Part Layout */}
                {!isMobile ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 1fr',
                      gap: '24px',
                      alignItems: 'center',
                    }}
                  >
                    {/* LEFT: Iced Coffee Column */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        padding: '16px',
                        backgroundColor: '#111111',
                        borderRadius: '10px',
                        border: '1px solid #222222',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#EF4444',
                          }}
                        >
                          <Flame size={16} />
                        </div>
                        <div>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: '18px',
                              fontFamily: '"Playfair Display", Georgia, serif',
                              fontWeight: 700,
                              color: '#FAF7F2',
                            }}
                          >
                            ICED COFFEE
                          </h3>
                          <span style={{ fontSize: '11px', color: '#888888' }}>
                            Rapid Flash Brew Method
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <CheckCircle2 size={14} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FAF7F2' }}>
                              Brewed hot, then chilled
                            </span>
                            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#999999' }}>
                              Hot water (93°C) rapidly extracts aromatic oils and bright fruit acidity before chilling over ice.
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <Clock size={14} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FAF7F2' }}>
                              Ready faster
                            </span>
                            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#999999' }}>
                              Prepared fresh in ~5 minutes via espresso or filter extraction straight into a chilled glass.
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <Coffee size={14} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FAF7F2' }}>
                              Bright, bold flavor
                            </span>
                            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#999999' }}>
                              Sharp citrus notes, light refreshing body, with lively aromatic acidity.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CENTER: Visual Cold Brew Graphic */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '200px',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          width: '180px',
                          height: '240px',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src="/images/cold-brew/cold-brew-glass-cutout.png"
                          alt="Specialty Cold Brew Artisanal Glass"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.9))',
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#FFC21A',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          marginTop: '8px',
                        }}
                      >
                        VS
                      </span>
                    </div>

                    {/* RIGHT: Cold Brew Column */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        padding: '16px',
                        backgroundColor: '#111111',
                        borderRadius: '10px',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(56, 189, 248, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#38BDF8',
                          }}
                        >
                          <Snowflake size={16} />
                        </div>
                        <div>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: '18px',
                              fontFamily: '"Playfair Display", Georgia, serif',
                              fontWeight: 700,
                              color: '#FAF7F2',
                            }}
                          >
                            COLD BREW
                          </h3>
                          <span style={{ fontSize: '11px', color: '#888888' }}>
                            24-Hour Cold Immersion
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <CheckCircle2 size={14} style={{ color: '#38BDF8', flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FAF7F2' }}>
                              Brewed with cold water
                            </span>
                            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#999999' }}>
                              Coarse grounds steep slowly in filtered cold water at 4°C, avoiding harsh bitter extraction.
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <Clock size={14} style={{ color: '#38BDF8', flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FAF7F2' }}>
                              Steeped for 12–24 hours
                            </span>
                            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#999999' }}>
                              Full day extraction unlocks delicate caramel and cocoa notes with zero bitterness.
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <Droplets size={14} style={{ color: '#38BDF8', flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FAF7F2' }}>
                              Smooth, mellow flavor
                            </span>
                            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#999999' }}>
                              67% less acid than hot coffee, gentle on stomach, naturally sweet velvet finish.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Mobile Comparison Stack */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '140px',
                      }}
                    >
                      <img
                        src="/images/cold-brew/cold-brew-glass-cutout.png"
                        alt="Specialty Cold Brew Artisanal Glass"
                        style={{
                          maxHeight: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {/* Left Details: Iced Coffee */}
                      <div
                        style={{
                          backgroundColor: '#111111',
                          borderRadius: '8px',
                          border: '1px solid #222222',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#FAF7F2' }}>
                          Brewed hot, then chilled
                        </div>
                        <div style={{ fontSize: '10px', color: '#999999' }}>
                          Ready faster (~5m). Bright, bold flavor with sharp citrus acidity.
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#EF4444', fontWeight: 800 }}>
                          High Acidity • 93°C Brew
                        </div>
                      </div>

                      {/* Right Details: Cold Brew */}
                      <div
                        style={{
                          backgroundColor: '#111111',
                          borderRadius: '8px',
                          border: '1px solid #222222',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#38BDF8' }}>
                          Brewed with cold water
                        </div>
                        <div style={{ fontSize: '10px', color: '#999999' }}>
                          Steeped for 12–24h at 4°C. Smooth, mellow flavor with velvety finish.
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#38BDF8', fontWeight: 800 }}>
                          67% Less Acid • 4°C Steep
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: isMobile ? '10px 14px' : '12px 24px',
              backgroundColor: '#0D0D0D',
              borderTop: '1px solid #1E1E1E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexShrink: 0,
              position: 'relative',
              zIndex: 10,
              opacity: showContent ? 1 : 0,
              transform: showContent ? 'translateY(0)' : 'translateY(8px)',
              transition: prefersReducedMotion
                ? 'none'
                : 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <span style={{ fontSize: isMobile ? '10px' : '11.5px', color: '#888888' }}>
              Handcrafted in-house with 100% Chikmagalur Estate Arabica
            </span>
            <button
              type="button"
              onClick={triggerClose}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: '#161616',
                border: '1px solid #282828',
                color: '#FAF7F2',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#FFC21A')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#282828')}
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
