import React, { useState } from 'react';
import { useDineIn } from '../contexts/DineInContext';
import { Search, User, LogOut, Utensils, Clock, Shield } from 'lucide-react';

interface CompactHeaderProps {
  onSearchClick: () => void;
}

export const CompactHeader: React.FC<CompactHeaderProps> = ({ onSearchClick }) => {
  const {
    customer,
    tableNumber,
    openAuthModal,
    signOut,
    isVegOnly,
    toggleVegOnly,
    diningSessionRemainingMs,
    openAdminModal,
  } = useDineIn();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isGuest = Boolean(customer?.isGuest || customer?.role === 'guest' || customer?.mobile === '9999999999');

  const mins = Math.floor(diningSessionRemainingMs / 60000);
  const secs = Math.floor((diningSessionRemainingMs % 60000) / 1000);
  const countdownFormatted = `${mins}:${String(secs).padStart(2, '0')}`;

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

        {/* DINING Badge with Table & 30-min Countdown */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(251, 195, 36, 0.1)',
            border: '1px solid rgba(251, 195, 36, 0.35)',
            borderRadius: '999px',
            padding: '3px 10px',
            color: '#FBC324',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          <Utensils size={11} />
          <span>{tableNumber || 'Table 01'}</span>
          {diningSessionRemainingMs > 0 && (
            <>
              <span style={{ color: 'rgba(255, 255, 255, 0.4)', margin: '0 2px' }}>•</span>
              <Clock size={11} style={{ color: mins < 5 ? '#F87171' : '#FBC324' }} />
              <span style={{ color: mins < 5 ? '#F87171' : '#FAF7F2' }}>
                {countdownFormatted}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right Controls: Veg Only Toggle, Search, Admin QR, Account Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Admin QR Management Button */}
        <button
          onClick={openAdminModal}
          aria-label="Table QR Administration"
          className="lm-interactive-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 8px',
            borderRadius: '8px',
            backgroundColor: '#161616',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#A8A196',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Shield size={13} style={{ color: '#FBC324' }} />
          <span style={{ display: 'none' }}>Admin QR</span>
        </button>

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
              {isGuest && (
                <span
                  style={{
                    backgroundColor: 'rgba(251, 195, 36, 0.15)',
                    color: '#FBC324',
                    border: '1px solid rgba(251, 195, 36, 0.35)',
                    borderRadius: '4px',
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '2px 5px',
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                  }}
                >
                  GUEST PREVIEW
                </span>
              )}
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
                {isGuest ? 'Guest Preview Session' : `+91 ${customer.mobile}`}
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
      </div>
    </header>
  );
};
