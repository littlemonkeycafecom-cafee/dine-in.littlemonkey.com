import React from 'react';

/**
 * SkeletonCard
 *
 * Polished Little Monkey Café menu skeleton loader with subtle golden shimmer animation.
 * Replaces generic browser loading spinners with a tactile preview of the card layout.
 * Adapted to the luxury dark charcoal theme (#191816) with brand lemon-yellow accents.
 */
export const SkeletonCard: React.FC = () => {
  return (
    <div
      className="rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 select-none"
      style={{
        backgroundColor: '#191816',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        minHeight: '220px',
      }}
      aria-hidden="true"
    >
      <div className="flex gap-4" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        {/* Left: Info Skeletons */}
        <div className="flex-1 space-y-2.5" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Badge skeleton */}
          <div
            className="w-16 h-4 rounded-md animate-shimmer"
            style={{ width: '64px', height: '16px', borderRadius: '6px' }}
          />

          {/* Title skeleton */}
          <div
            className="w-3/4 h-5 rounded-lg animate-shimmer"
            style={{ width: '75%', height: '20px', borderRadius: '8px' }}
          />

          {/* Price skeleton */}
          <div
            className="w-20 h-5 rounded-lg animate-shimmer"
            style={{ width: '80px', height: '20px', borderRadius: '8px' }}
          />

          {/* Description skeleton */}
          <div className="space-y-1.5 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
            <div
              className="w-full h-3 rounded-md animate-shimmer"
              style={{ width: '100%', height: '12px', borderRadius: '4px' }}
            />
            <div
              className="w-4/5 h-3 rounded-md animate-shimmer"
              style={{ width: '80%', height: '12px', borderRadius: '4px' }}
            />
          </div>
        </div>

        {/* Right: Food Image Skeleton */}
        <div
          className="w-24 sm:w-28 h-24 sm:h-28 shrink-0 rounded-2xl animate-shimmer"
          style={{
            width: '96px',
            height: '96px',
            flexShrink: 0,
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        />
      </div>

      {/* Action Row Skeleton */}
      <div
        className="pt-3 flex items-center justify-between gap-2"
        style={{
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div
          className="w-24 h-3 rounded-md animate-shimmer"
          style={{ width: '88px', height: '12px', borderRadius: '4px' }}
        />
        <div
          className="w-28 h-10 rounded-xl animate-shimmer"
          style={{ width: '104px', height: '36px', borderRadius: '10px' }}
        />
      </div>
    </div>
  );
};
