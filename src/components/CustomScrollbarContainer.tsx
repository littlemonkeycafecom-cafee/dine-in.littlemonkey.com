import React, { useRef, useState, useEffect, useCallback } from 'react';

interface CustomScrollbarContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  /**
   * Refined thumb accent color when active or scrolling (default #FBC324).
   */
  accentColor?: string;
  /**
   * Subtle resting thumb color (default #333333).
   */
  thumbColor?: string;
  /**
   * Optional custom ref pass-through for the scrollable viewport.
   */
  viewportRef?: React.RefObject<HTMLDivElement>;
  /**
   * Optional onScroll listener pass-through.
   */
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

/**
 * CustomScrollbarContainer
 *
 * Implements a high-precision, brand-aligned custom scrollbar system for Little Monkey Café:
 *
 * 1. Deep-black background & subtle charcoal track.
 * 2. Restrained thumb styling (#333333) with vibrant Little Monkey gold (#FBC324) highlight
 *    during active scrolling, mouse hover, or drag interactions.
 * 3. 100% synchronized with actual scroll position and scroll metrics (scrollHeight vs clientHeight).
 * 4. Full support for track clicks and mouse dragging with active window bounds tracking.
 * 5. Full support for native mobile touch, trackpad, and mouse wheel scrolling without lag or obstruction.
 * 6. Responsive: automatically resizes and updates with dynamic content via ResizeObserver.
 * 7. Automatically hides when content fits within the viewport.
 * 8. Never causes horizontal overflow and never competes with native scrollbars.
 */
export const CustomScrollbarContainer: React.FC<CustomScrollbarContainerProps> = ({
  children,
  className = '',
  style,
  contentStyle,
  accentColor = '#FBC324',
  thumbColor = '#333333',
  viewportRef: externalRef,
  onScroll: externalOnScroll,
}) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalRef || internalRef;
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  const [isScrollable, setIsScrollable] = useState(false);
  const [thumbHeight, setThumbHeight] = useState(36);
  const [thumbTop, setThumbTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Drag state
  const dragStartYRef = useRef(0);
  const dragStartScrollTopRef = useRef(0);

  // Measure and synchronize thumb geometry
  const updateScrollMetrics = useCallback(() => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el) return;

    const { clientHeight, scrollHeight, scrollTop } = el;
    const canScroll = scrollHeight > clientHeight + 2;
    setIsScrollable(canScroll);

    if (!canScroll) return;

    const trackHeight = track ? track.clientHeight : clientHeight - 8;
    // Calculate proportional thumb height (min 32px, max trackHeight * 0.8)
    const ratio = clientHeight / scrollHeight;
    const calculatedHeight = Math.max(32, Math.min(trackHeight * ratio, trackHeight * 0.8));
    setThumbHeight(calculatedHeight);

    // Calculate thumb offset
    const maxScroll = scrollHeight - clientHeight;
    const scrollPercent = maxScroll > 0 ? scrollTop / maxScroll : 0;
    const maxThumbTop = trackHeight - calculatedHeight;
    setThumbTop(Math.max(0, Math.min(scrollPercent * maxThumbTop, maxThumbTop)));
  }, [scrollRef]);

  // Handle scroll events with 60fps requestAnimationFrame
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      externalOnScroll?.(e);

      requestAnimationFrame(() => {
        updateScrollMetrics();
      });

      setIsScrolling(true);
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        setIsScrolling(false);
      }, 700);
    },
    [externalOnScroll, updateScrollMetrics]
  );

  // Track click to jump
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      const el = scrollRef.current;
      if (!track || !el) return;

      const rect = track.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const trackHeight = rect.height;
      const clickRatio = Math.max(0, Math.min(clickY / trackHeight, 1));

      const maxScroll = el.scrollHeight - el.clientHeight;
      el.scrollTo({
        top: clickRatio * maxScroll,
        behavior: 'smooth',
      });
    },
    [scrollRef]
  );

  // Thumb drag initiation
  const handleThumbMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();

      const el = scrollRef.current;
      if (!el) return;

      setIsDragging(true);
      dragStartYRef.current = e.clientY;
      dragStartScrollTopRef.current = el.scrollTop;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const track = trackRef.current;
        if (!track || !el) return;

        const deltaY = moveEvent.clientY - dragStartYRef.current;
        const trackHeight = track.clientHeight;
        const maxScroll = el.scrollHeight - el.clientHeight;
        const maxThumbTravel = trackHeight - thumbHeight;

        if (maxThumbTravel > 0) {
          const scrollPerPixel = maxScroll / maxThumbTravel;
          el.scrollTop = dragStartScrollTopRef.current + deltaY * scrollPerPixel;
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [scrollRef, thumbHeight]
  );

  // ResizeObserver for dynamic content & window resize
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollMetrics();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateScrollMetrics();
      });
      resizeObserver.observe(el);
      if (el.firstElementChild) {
        resizeObserver.observe(el.firstElementChild);
      }
    }

    const handleWindowResize = () => {
      updateScrollMetrics();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      resizeObserver?.disconnect();
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollRef, updateScrollMetrics]);

  const isThumbActive = isScrolling || isDragging || isHovering;

  return (
    <div
      className={`lm-custom-scrollbar-wrapper ${className}`}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Scrollable Viewport */}
      <div
        ref={scrollRef}
        className="lm-custom-scrollbar-viewport no-scrollbar"
        onScroll={handleScroll}
        style={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          boxSizing: 'border-box',
          ...contentStyle,
        }}
      >
        {children}
      </div>

      {/* Synchronized Luxury Scrollbar Track */}
      {isScrollable && (
        <div
          ref={trackRef}
          className="lm-custom-scrollbar-track"
          onClick={handleTrackClick}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '6px',
            bottom: '6px',
            right: '4px',
            width: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '4px',
            zIndex: 35,
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'opacity 0.25s ease, background-color 0.2s ease',
            opacity: isThumbActive ? 1 : 0.45,
          }}
        >
          {/* Animated Little Monkey Gold Thumb */}
          <div
            className="lm-custom-scrollbar-thumb"
            onMouseDown={handleThumbMouseDown}
            style={{
              position: 'absolute',
              top: `${thumbTop}px`,
              left: 0,
              width: '100%',
              height: `${thumbHeight}px`,
              borderRadius: '4px',
              backgroundColor: isThumbActive ? accentColor : thumbColor,
              border: isThumbActive
                ? `1px solid ${accentColor}`
                : '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: isThumbActive
                ? `0 0 8px rgba(251, 195, 36, 0.55), inset 0 0 3px rgba(255, 255, 255, 0.3)`
                : 'none',
              transition: isDragging
                ? 'background-color 0.12s ease, box-shadow 0.12s ease'
                : 'top 0.04s linear, background-color 0.2s ease, box-shadow 0.2s ease, height 0.15s ease',
              cursor: isDragging ? 'grabbing' : 'grab',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}
    </div>
  );
};
