import React from 'react';
import { useDineIn } from '../contexts/DineInContext';
import { Utensils, Search, User } from 'lucide-react';

interface FloatingNavigationProps {
  onMenuClick: () => void;
  onSearchClick?: () => void;
}

export const FloatingNavigation: React.FC<FloatingNavigationProps> = ({
  onMenuClick,
  onSearchClick,
}) => {
  const { openAuthModal, customer } = useDineIn();

  return (
    <nav
      aria-label="Dining Navigation"
      style={{
        position: 'fixed',
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 80,
        backgroundColor: 'rgba(10, 10, 10, 0.94)',
        border: '1px solid #242424',
        borderRadius: '999px',
        padding: '5px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.9), 0 0 16px rgba(255, 194, 26, 0.08)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Menu Tab */}
      <button
        onClick={onMenuClick}
        aria-label="Browse Menu"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          background: 'none',
          border: 'none',
          color: '#FFC21A',
          cursor: 'pointer',
          padding: '4px 12px',
        }}
      >
        <Utensils size={17} />
        <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em' }}>
          Menu
        </span>
      </button>

      {onSearchClick && (
        <>
          <div style={{ width: '1px', height: '18px', backgroundColor: '#242424' }} />
          {/* Search Tab */}
          <button
            onClick={onSearchClick}
            aria-label="Search Dishes"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              background: 'none',
              border: 'none',
              color: '#FAF7F2',
              cursor: 'pointer',
              padding: '4px 12px',
            }}
          >
            <Search size={17} />
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>
              Search
            </span>
          </button>
        </>
      )}

      <div style={{ width: '1px', height: '18px', backgroundColor: '#242424' }} />

      {/* Account Tab */}
      <button
        onClick={openAuthModal}
        aria-label="Customer Account"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          background: 'none',
          border: 'none',
          color: customer ? '#FFC21A' : '#888888',
          cursor: 'pointer',
          padding: '4px 12px',
        }}
      >
        <User size={17} />
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>
          {customer ? 'Account' : 'Sign In'}
        </span>
      </button>
    </nav>
  );
};
