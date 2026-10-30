import React, { useState, useEffect } from 'react';

interface LiquidWaveTransitionProps {
  /**
   * Triggers the wave reveal animation when true.
   */
  isActive: boolean;
  /**
   * Optional callback when the fluid reveal animation finishes.
   */
  onComplete?: () => void;
  /**
   * Primary brand yellow fill (default Little Monkey yellow #FBC324).
   */
  primaryColor?: string;
  /**
   * Accent contour wave color (default translucent solar yellow).
   */
  contourColor?: string;
  /**
   * Custom style overrides for the sweep layer.
   */
  style?: React.CSSProperties;
}

/**
 * LiquidWaveTransition
 *
 * Reproduces the authentic Little Monkey Café organic two-tone liquid wave reveal
 * as demonstrated in reference video 1023.mp4:
 *
 * 1. An organic double-crested wave of brand yellow (#FBC324) sweeps upward
 *    across the modal card surface upon opening.
 * 2. At peak flood (~280ms-360ms), the modal card is bathed in Little Monkey yellow.
 * 3. The wave layer then smoothly dissolves/fades out (360ms-560ms), seamlessly
 *    revealing the high-contrast dark menu/product details underneath.
 * 4. Respects `prefers-reduced-motion`: cleanly renders without animation if reduced
 *    motion is requested.
 * 5. Strictly non-blocking: `pointer-events: none` ensures zero interaction delay.
 */
export const LiquidWaveTransition: React.FC<LiquidWaveTransitionProps> = ({
  isActive,
  onComplete,
  primaryColor = '#FBC324',
  contourColor = 'rgba(251, 195, 36, 0.38)',
  style,
}) => {
  const [shouldRender, setShouldRender] = useState(isActive);
  const [animStage, setAnimStage] = useState<'idle' | 'sweeping' | 'done'>('idle');

  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!isActive) {
      setShouldRender(false);
      setAnimStage('idle');
      return;
    }

    if (prefersReducedMotion) {
      setShouldRender(false);
      onComplete?.();
      return;
    }

    setShouldRender(true);
    setAnimStage('sweeping');

    const timer = setTimeout(() => {
      setAnimStage('done');
      setShouldRender(false);
      onComplete?.();
    }, 720);

    return () => clearTimeout(timer);
  }, [isActive, prefersReducedMotion, onComplete]);

  if (!shouldRender || animStage === 'done' || prefersReducedMotion) {
    return null;
  }

  return (
    <div
      className="lm-liquid-wave-sweep-container"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 60,
        overflow: 'hidden',
        borderRadius: 'inherit',
        ...style,
      }}
    >
      {/* Surrounding Ambient Warm Reveal Glow */}
      <div
        className="lm-wave-ambient-glow"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 90%, rgba(251, 195, 36, 0.22) 0%, rgba(251, 195, 36, 0.05) 50%, transparent 75%)',
          pointerEvents: 'none',
          animation: 'lmGlowFadeOut 0.68s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      />

      {/* The Two-Tone Organic Liquid Wave Sweep Layer */}
      <div
        className="lm-wave-rising-sheet"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '100%',
          pointerEvents: 'none',
          animation: 'lmLiquidWaveSweep 0.68s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          willChange: 'transform, opacity',
        }}
      >
        {/* Double-crested wave SVG leading edge */}
        <svg
          viewBox="0 0 1000 240"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            width: '100%',
            height: '130px',
            pointerEvents: 'none',
            display: 'block',
          }}
          aria-hidden="true"
        >
          {/* Outer Solar Yellow Accent Contour Wave */}
          <path
            d="M 0,90 C 120,40 240,10 330,10 C 460,10 560,100 660,150 C 740,185 850,195 1000,200 L 1000,240 L 0,240 Z"
            fill={contourColor}
          />
          {/* Vibrant Brand Yellow Body Wave */}
          <path
            d="M 0,120 C 120,70 240,40 330,40 C 460,40 560,130 660,180 C 740,215 850,225 1000,230 L 1000,240 L 0,240 Z"
            fill={primaryColor}
          />
        </svg>

        {/* Solid Brand Yellow Liquid Body */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: primaryColor,
          }}
        />
      </div>
    </div>
  );
};
