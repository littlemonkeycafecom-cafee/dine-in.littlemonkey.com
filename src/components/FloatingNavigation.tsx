import React from 'react';
import { useDineIn } from '../contexts/DineInContext';
import { Utensils, ShoppingBag, User } from 'lucide-react';

interface FloatingNavigationProps {
  onMenuClick: () => void;
}

export const FloatingNavigation: React.FC<FloatingNavigationProps> = ({ onMenuClick }) => {
  const { cartCount, openCart, openAuthModal, customer } = useDineIn();

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
        gap: '12px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.9), 0 0 16px rgba(255, 194, 26, 0.08)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Menu Tab */}
      <button
        onClick={onMenuClick}
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

      <div style={{ width: '1px', height: '18px', backgroundColor: '#242424' }} />

      {/* Cart Tab with Badge */}
      <button
        onClick={openCart}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          background: 'none',
          border: 'none',
          color: cartCount > 0 ? '#F5F5F5' : '#888888',
          cursor: 'pointer',
          padding: '4px 12px',
          position: 'relative',
        }}
      >
        <div style={{ position: 'relative' }}>
          <ShoppingBag size={17} />
          {cartCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-8px',
                backgroundColor: '#FFC21A',
                color: '#080808',
                borderRadius: '999px',
                fontSize: '9px',
                fontWeight: 900,
                minWidth: '15px',
                height: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
              }}
            >
              {cartCount}
            </span>
          )}
        </div>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>
          Cart
        </span>
      </button>

      <div style={{ width: '1px', height: '18px', backgroundColor: '#242424' }} />

      {/* Account Tab */}
      <button
        onClick={openAuthModal}
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
