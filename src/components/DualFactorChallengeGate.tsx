import React, { useState } from 'react';
import { useDineIn } from '../contexts/DineInContext';
import {
  ShieldCheck,
  AlertCircle,
  QrCode,
  ArrowRight,
  HelpCircle,
  Check,
  RefreshCw,
} from 'lucide-react';

const TABLE_SYMBOLS = [
  { symbol: '◈', label: 'White Diamond', shortCode: 'T01' },
  { symbol: '✦', label: 'Four-Point Star', shortCode: 'T02' },
  { symbol: '⬡', label: 'White Hexagon', shortCode: 'T03' },
  { symbol: '◆', label: 'Black Diamond', shortCode: 'T04' },
  { symbol: '✧', label: 'Sparkle Star', shortCode: 'T05' },
  { symbol: '⬢', label: 'Black Hexagon', shortCode: 'T06' },
  { symbol: '✺', label: 'Sunburst Asterisk', shortCode: 'T07' },
  { symbol: '⌘', label: 'Command Emblem', shortCode: 'T08' },
  { symbol: '⬟', label: 'Pentagon Crest', shortCode: 'T09' },
  { symbol: '❖', label: 'Diamond Quatrefoil', shortCode: 'T10' },
];

export const DualFactorChallengeGate: React.FC = () => {
  const {
    tableNumber,
    tableShortCode,
    submitDualFactor,
    cancelDualFactor,
  } = useDineIn();

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    if (!selectedSymbol || !codeInput.trim() || codeInput.trim().length !== 4) {
      setErrorMessage('Please select your table symbol and enter the 4-character code printed on your table stand.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await submitDualFactor(
        selectedSymbol,
        codeInput.trim().toUpperCase()
      );

      if (!res.success) {
        setErrorMessage(
          res.message || 'Table verification failed. Please check the symbol and code printed on your table stand.'
        );
      }
    } catch {
      setErrorMessage('Verification service is temporarily unavailable. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#080706',
        backgroundImage:
          'radial-gradient(circle at 50% 16%, rgba(255, 194, 26, 0.07) 0%, transparent 60%), radial-gradient(ellipse at 50% 96%, rgba(255, 194, 26, 0.12) 0%, rgba(120, 75, 0, 0.05) 45%, transparent 70%)',
        color: '#FAF7F2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(24px, 4vw, 48px) 16px',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#121110',
          border: '1.5px solid rgba(255, 194, 26, 0.28)',
          borderRadius: '24px',
          padding: 'clamp(24px, 5vw, 36px) clamp(20px, 4vw, 28px)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 194, 26, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Brand Logo */}
        <div style={{ marginBottom: '16px' }}>
          <img
            src="/branding/little-monkey-logo-transparent.png"
            alt="Little Monkey Café"
            style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Security Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(255, 194, 26, 0.1)',
            border: '1px solid rgba(255, 194, 26, 0.35)',
            borderRadius: '999px',
            padding: '4px 14px',
            color: '#FFC21A',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '14px',
          }}
        >
          <ShieldCheck size={14} style={{ color: '#FFC21A' }} />
          <span>Confirm Physical Presence</span>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: 'clamp(20px, 5vw, 24px)',
            fontWeight: 900,
            color: '#FAF7F2',
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
          }}
        >
          {tableNumber || 'Table'} Verification
        </h1>

        <p
          style={{
            fontSize: '13px',
            color: '#9C8C7E',
            lineHeight: 1.5,
            margin: '0 0 16px 0',
            maxWidth: '360px',
          }}
        >
          To confirm your physical presence at this table, complete both verification factors displayed on your table stand.
        </p>

        {/* Factor 1 Verified Indicator */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '7px 12px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
            color: '#34D399',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '18px',
            boxSizing: 'border-box',
          }}
        >
          <Check size={13} style={{ strokeWidth: 3 }} />
          <span>Factor 1 Verified: Table QR Credential</span>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '12px',
              padding: '10px 14px',
              color: '#FCA5A5',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              textAlign: 'left',
              boxSizing: 'border-box',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, color: '#EF4444' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          {/* Factor 2A: Table Symbol Selector */}
          <div style={{ marginBottom: '18px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#FFC21A',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                Factor 2A: Select Table Symbol
              </label>
              <span style={{ fontSize: '10.5px', color: selectedSymbol ? '#FFC21A' : '#786E63', fontWeight: 600 }}>
                {selectedSymbol ? `Selected: ${selectedSymbol}` : 'Required'}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '8px',
              }}
            >
              {TABLE_SYMBOLS.map((item) => {
                const isSelected = selectedSymbol === item.symbol;
                return (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => {
                      setSelectedSymbol(isSelected ? null : item.symbol);
                      setErrorMessage(null);
                    }}
                    style={{
                      height: '50px',
                      backgroundColor: isSelected ? 'rgba(255, 194, 26, 0.2)' : '#1A1815',
                      border: isSelected
                        ? '2px solid #FFC21A'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: isSelected ? '#FFC21A' : '#FAF7F2',
                      fontSize: '22px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      transform: isSelected ? 'scale(1.05)' : 'none',
                      boxShadow: isSelected ? '0 0 14px rgba(255, 194, 26, 0.3)' : 'none',
                    }}
                    title={item.label}
                  >
                    <span>{item.symbol}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Factor 2B: Table Secret Code Input */}
          <div style={{ marginBottom: '22px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label
                htmlFor="table-code-input"
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#FFC21A',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                Factor 2B: Enter 4-Character Table Code
              </label>
              <span style={{ fontSize: '10.5px', color: codeInput.trim().length === 4 ? '#34D399' : '#786E63', fontWeight: 600 }}>
                {codeInput.trim().length === 4 ? '4 / 4 entered' : 'Printed on stand'}
              </span>
            </div>
            <input
              id="table-code-input"
              type="text"
              maxLength={4}
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value.toUpperCase());
                setErrorMessage(null);
              }}
              placeholder="e.g. K7M2"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              style={{
                width: '100%',
                backgroundColor: '#1A1815',
                border: codeInput.trim().length === 4
                  ? '1.5px solid #FFC21A'
                  : '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '12px',
                padding: '12px 16px',
                color: '#FAF7F2',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '0.25em',
                textAlign: 'center',
                textTransform: 'uppercase',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !selectedSymbol || codeInput.trim().length !== 4}
            style={{
              width: '100%',
              backgroundColor: '#FFC21A',
              color: '#080808',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 20px',
              fontSize: '13.5px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: isSubmitting || !selectedSymbol || codeInput.trim().length !== 4 ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || !selectedSymbol || codeInput.trim().length !== 4 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'opacity 0.2s, transform 0.1s',
            }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Verifying Factors...</span>
              </>
            ) : (
              <>
                <span>Confirm Presence & Enter Dining</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer actions */}
        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            fontSize: '12px',
            color: '#9C8C7E',
          }}
        >
          <button
            type="button"
            onClick={cancelDualFactor}
            style={{
              background: 'none',
              border: 'none',
              color: '#9C8C7E',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
            }}
          >
            <QrCode size={13} />
            <span>Re-scan QR</span>
          </button>

          <span style={{ fontSize: '11px', opacity: 0.8 }}>
            Assigned Table: {tableShortCode || 'T01'}
          </span>
        </div>
      </div>
    </div>
  );
};
