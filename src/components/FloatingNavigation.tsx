import React from 'react';
import { useDineIn } from '../contexts/DineInContext';
import { Utensils, ShoppingBag, User } from 'lucide-react';

interface FloatingNavigationProps {
  onMenuClick: () => void;
}

export const FloatingNavigation: React.FC<FloatingNavigationProps> = ({ onMenuClick }) => {
  const { cartCount, cartSubtotal, openCart, openAuthModal, customer } = useDineIn();

  const gst = Math.round(cartSubtotal * 0.05);
  const grandTotal = cartSubtotal + gst;

  return (
    <>
      {/* Floating Centered Bottom Navigation Bar */}
      <nav
        aria-label="Dining Navigation"
        className="lm-border-beam"
        style={{
          position: 'fixed',
          bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 80,
          backgroundColor: 'rgba(18, 16, 14, 0.92)',
          border: '1px solid rgba(251, 195, 36, 0.28)',
          borderRadius: '999px',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.85), 0 0 16px rgba(251, 195, 36, 0.08)',
          backdropFilter: 'blur(16px)',
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
            color: '#FBC324',
            cursor: 'pointer',
            padding: '4px 12px',
          }}
        >
          <Utensils size={18} />
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em' }}>
            Menu
          </span>
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

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
            color: cartCount > 0 ? '#FAF7F2' : '#9C8C7E',
            cursor: 'pointer',
            padding: '4px 12px',
            position: 'relative',
          }}
        >
          <div style={{ position: 'relative' }}>
            <ShoppingBag size={18} />
            {cartCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-8px',
                  backgroundColor: '#FBC324',
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

        <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

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
            color: customer ? '#FBC324' : '#9C8C7E',
            cursor: 'pointer',
            padding: '4px 12px',
          }}
        >
          <User size={18} />
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>
            {customer ? 'Account' : 'Sign In'}
          </span>
        </button>
      </nav>

      {/* Floating Bottom-Right View Cart Action Pill (Visible when items in cart) */}
      {cartCount > 0 && (
        <aside
          aria-label="Cart Quick Action"
          style={{
            position: 'fixed',
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            right: '20px',
            zIndex: 85,
          }}
        >
          <button
            onClick={openCart}
            className="lm-interactive-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#FBC324',
              color: '#080808',
              border: 'none',
              borderRadius: '999px',
              padding: '10px 18px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 16px rgba(251, 195, 36, 0.35)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.02em',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 900 }}>₹{grandTotal}</span>
            <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(0, 0, 0, 0.2)' }} />
            <span style={{ textTransform: 'uppercase', fontSize: '11.5px', letterSpacing: '0.04em' }}>
              VIEW CART
            </span>
            <ShoppingBag size={15} />
          </button>
        </aside>
      )}
    </>
  );
};
