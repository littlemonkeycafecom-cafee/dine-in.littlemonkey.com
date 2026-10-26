import React, { useState } from 'react';
import { useDineIn } from '../contexts/DineInContext';
import { ShoppingBag, Search, User, LogOut, Utensils } from 'lucide-react';

interface CompactHeaderProps {
  onSearchClick: () => void;
}

export const CompactHeader: React.FC<CompactHeaderProps> = ({ onSearchClick }) => {
  const { customer, tableNumber, cartCount, openAuthModal, signOut, openCart, isVegOnly, toggleVegOnly } = useDineIn();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: '#080808',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Left: Brand Logo + Wordmark + Dining Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <a
          href="/"
          aria-label="Little Monkey Café Home"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
          }}
        >
          <img
            src="/branding/little-monkey-logo-transparent.png"
            alt="Little Monkey Café"
            style={{
              height: '28px',
              width: 'auto',
              maxWidth: '68px',
              objectFit: 'contain',
              display: 'block',
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
            }}
          />
          <span
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '16px',
              fontWeight: 700,
              color: '#FAF7F2',
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            Little Monkey Café
          </span>
        </a>

        {/* DINING Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'rgba(251, 195, 36, 0.1)',
            border: '1px solid rgba(251, 195, 36, 0.35)',
            borderRadius: '999px',
            padding: '3px 10px',
            color: '#FBC324',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          <Utensils size={11} />
          <span>DINE-IN</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.4)', margin: '0 2px' }}>•</span>
          <span style={{ color: '#FAF7F2' }}>{tableNumber}</span>
        </div>
      </div>

      {/* Right Controls: Veg Only Toggle, Search, Account Pill, Cart Icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Veg Only Toggle */}
        <button
          onClick={toggleVegOnly}
          aria-pressed={isVegOnly}
          aria-label={isVegOnly ? 'Show all items' : 'Filter vegetarian only'}
          className="lm-interactive-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px clamp(6px, 1.5vw, 10px)',
            borderRadius: '999px',
            backgroundColor: isVegOnly ? 'rgba(251, 195, 36, 0.16)' : '#191816',
            border: isVegOnly ? '1px solid #FBC324' : '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: isVegOnly ? '0 0 12px rgba(251, 195, 36, 0.35)' : 'none',
            color: isVegOnly ? '#FBC324' : '#9C8C7E',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
            userSelect: 'none',
          }}
        >
          <span
            style={{
              width: '12px',
              height: '12px',
              border: `1.5px solid ${isVegOnly ? '#22C55E' : '#6B6258'}`,
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: isVegOnly ? '#22C55E' : '#6B6258',
                transition: 'background-color 0.2s ease',
              }}
            />
          </span>
          <span style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Veg
          </span>
          <span
            style={{
              width: '24px',
              height: '13px',
              borderRadius: '999px',
              backgroundColor: isVegOnly ? '#FBC324' : 'rgba(255, 255, 255, 0.15)',
              position: 'relative',
              display: 'inline-block',
              transition: 'background-color 0.25s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '1.5px',
                left: isVegOnly ? '12px' : '1.5px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isVegOnly ? '#080808' : '#FAF7F2',
                transition: 'left 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </span>
        </button>

        {/* Search Icon */}
        <button
          onClick={onSearchClick}
          aria-label="Search Menu"
          className="lm-interactive-btn"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#191816',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FAF7F2',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease',
          }}
        >
          <Search size={16} />
        </button>

        {/* User Account Pill */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {customer ? (
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-label={`Account of ${customer.name}`}
              className="lm-interactive-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#191816',
                border: '1px solid rgba(251, 195, 36, 0.35)',
                borderRadius: '999px',
                padding: '4px clamp(6px, 1.5vw, 12px)',
                color: '#FAF7F2',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: '34px',
              }}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: '#FBC324',
                  color: '#080808',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 800,
                }}
              >
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {customer.name}
              </span>
            </button>
          ) : (
            <button
              onClick={openAuthModal}
              aria-label="Customer Sign In / Account"
              className="lm-interactive-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#191816',
                border: '1px solid rgba(251, 195, 36, 0.3)',
                borderRadius: '999px',
                padding: '5px clamp(8px, 1.8vw, 12px)',
                color: '#FAF7F2',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: '34px',
              }}
            >
              <User size={15} style={{ color: '#FBC324' }} />
              <span>Sign In</span>
            </button>
          )}

          {/* User Menu Dropdown */}
          {isUserMenuOpen && customer && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                backgroundColor: '#191816',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '8px',
                minWidth: '150px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                zIndex: 110,
              }}
            >
              <div style={{ padding: '6px 8px', fontSize: '11px', color: '#9C8C7E', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                +91 {customer.mobile}
              </div>
              <button
                onClick={() => {
                  signOut();
                  setIsUserMenuOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Cart Icon with Live Badge */}
        <button
          onClick={openCart}
          aria-label={`Cart with ${cartCount} items`}
          className="lm-interactive-btn"
          style={{
            position: 'relative',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            backgroundColor: cartCount > 0 ? '#FBC324' : '#191816',
            border: '1px solid ' + (cartCount > 0 ? '#FBC324' : 'rgba(255, 255, 255, 0.1)'),
            color: cartCount > 0 ? '#080808' : '#FAF7F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <ShoppingBag size={17} />
          {cartCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                borderRadius: '999px',
                fontSize: '10px',
                fontWeight: 800,
                minWidth: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                border: '1.5px solid #080808',
              }}
            >
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
