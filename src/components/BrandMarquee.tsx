import React, { useMemo } from 'react';

/**
 * BrandMarquee
 *
 * Continuous horizontal scrolling brand announcement strip.
 * Displays: ✦ LITTLE MONKEY CAFÉ · COFFEE AND MORE · HANAMKONDA ✦
 * Seamless, gapless looping across mobile, tablet, and desktop viewports.
 */
export const BrandMarquee: React.FC = () => {
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const marqueeText = (
    <>
      <span style={{ color: '#FBC324', marginRight: '6px' }}>✦</span>
      <span>LITTLE MONKEY CAFÉ</span>
      <span style={{ color: '#FBC324', margin: '0 8px' }}>·</span>
      <span>COFFEE AND MORE</span>
      <span style={{ color: '#FBC324', margin: '0 8px' }}>·</span>
      <span>HANAMKONDA</span>
      <span style={{ color: '#FBC324', marginLeft: '6px' }}>✦</span>
    </>
  );

  return (
    <div
      className="scrolling-brand-strip"
      role="region"
      aria-label="Little Monkey Café brand announcement"
    >
      <div className={`marquee-track-container ${reducedMotion ? 'reduced-motion' : ''}`}>
        <div className="marquee-content-stream">
          {/* Half 1 */}
          <div className="marquee-half" aria-hidden={false}>
            <span className="marquee-item">{marqueeText}</span>
            <span className="marquee-item">{marqueeText}</span>
            <span className="marquee-item">{marqueeText}</span>
            <span className="marquee-item">{marqueeText}</span>
          </div>

          {/* Half 2 (Duplicate for 100% seamless infinite loop) */}
          <div className="marquee-half" aria-hidden="true">
            <span className="marquee-item">{marqueeText}</span>
            <span className="marquee-item">{marqueeText}</span>
            <span className="marquee-item">{marqueeText}</span>
            <span className="marquee-item">{marqueeText}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
