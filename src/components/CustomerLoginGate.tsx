import React, { useState } from 'react';
import { useDineIn } from '../contexts/DineInContext';
import { customerSignIn, customerSignUp, createGuestSession } from '../services/auth';
import { Eye, EyeOff, ArrowRight, Utensils, Sparkles, ShieldCheck, Loader2 } from 'lucide-react';

export const CustomerLoginGate: React.FC = () => {
  const { signIn, tableNumber } = useDineIn();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    if (tab === 'signup' && !name.trim()) {
      setError('Please enter your full name');
      return;
    }

    setIsSubmitting(true);
    try {
      if (tab === 'signin') {
        const result = await customerSignIn(cleanMobile, password);
        if (!result.success) {
          setError(result.error || 'Authentication failed. Please check your credentials.');
          setIsSubmitting(false);
          return;
        }

        const user = result.user || result.session?.user;
        const customerName =
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.name ||
          'Diner ' + cleanMobile.slice(-4);

        signIn(cleanMobile, customerName, result.token, user?.id);
      } else {
        const result = await customerSignUp(name.trim(), cleanMobile, password);
        if (!result.success) {
          setError(result.error || 'Failed to create account.');
          setIsSubmitting(false);
          return;
        }

        const user = result.user || result.session?.user;
        signIn(cleanMobile, name.trim(), result.token, user?.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestEntry = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const guest = await createGuestSession(tableNumber);
      signIn('9999999999', guest.user.name || 'Table Guest', guest.token, guest.user.id);
    } catch {
      signIn('9999999999', 'Table Guest');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#080808',
        backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(251, 195, 36, 0.08) 0%, transparent 60%)',
        color: '#FAF7F2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Yellow Ambient Blur */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'clamp(280px, 60vw, 560px)',
          height: 'clamp(200px, 40vw, 360px)',
          background: 'radial-gradient(ellipse at center, rgba(251, 195, 36, 0.15) 0%, rgba(255, 194, 26, 0.05) 50%, transparent 75%)',
          filter: 'blur(48px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Main Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Brand Header with Ambient Aura */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div className="lm-logo-ambient-wrap" style={{ marginBottom: '14px' }}>
            <img
              src="/branding/little-monkey-logo-transparent.png"
              alt="Little Monkey Café"
              style={{
                height: '56px',
                width: 'auto',
                objectFit: 'contain',
                position: 'relative',
                zIndex: 1,
              }}
            />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(251, 195, 36, 0.1)',
              border: '1px solid rgba(251, 195, 36, 0.35)',
              borderRadius: '999px',
              padding: '4px 12px',
              color: '#FBC324',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            <Utensils size={12} />
            <span>DINE-IN ACCESS</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.4)', margin: '0 2px' }}>•</span>
            <span style={{ color: '#FAF7F2' }}>{tableNumber}</span>
          </div>

          <h1
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '26px',
              fontWeight: 700,
              color: '#FAF7F2',
              margin: '0 0 6px 0',
              lineHeight: 1.2,
            }}
          >
            {tab === 'signin' ? 'Sign In to Dine' : 'Create Diner Account'}
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: '#9C8C7E',
              margin: 0,
            }}
          >
            Authenticate to unlock the digital menu, order dishes, and track your table.
          </p>
        </div>

        {/* Card with Traveling Yellow Border Beam & Reflection */}
        <div
          className="lm-border-beam lm-surface-reflection"
          style={{
            width: '100%',
            backgroundColor: '#12100E',
            border: '1px solid rgba(251, 195, 36, 0.28)',
            borderRadius: '20px',
            padding: '28px 24px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.95), 0 0 28px rgba(251, 195, 36, 0.12)',
            position: 'relative',
            boxSizing: 'border-box',
          }}
        >
          {/* Tab Switcher */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#191816',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setError('');
              }}
              className="lm-interactive-btn"
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                backgroundColor: tab === 'signin' ? '#FBC324' : 'transparent',
                color: tab === 'signin' ? '#080808' : '#9C8C7E',
                cursor: 'pointer',
              }}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setError('');
              }}
              className="lm-interactive-btn"
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                backgroundColor: tab === 'signup' ? '#FBC324' : 'transparent',
                color: tab === 'signup' ? '#080808' : '#9C8C7E',
                cursor: 'pointer',
              }}
            >
              Create Account
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid #EF4444',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#FCA5A5',
                fontSize: '12.5px',
                marginBottom: '18px',
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {tab === 'signup' && (
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    color: '#9C8C7E',
                    marginBottom: '6px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: '#191816',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#FAF7F2',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Mobile Number */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#9C8C7E',
                  marginBottom: '6px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Mobile Number *
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#191816',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    padding: '12px 14px',
                    color: '#FBC324',
                    fontWeight: 800,
                    fontSize: '13.5px',
                    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#FAF7F2',
                    fontSize: '13.5px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '22px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#9C8C7E',
                  marginBottom: '6px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Password *
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#191816',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  paddingRight: '12px',
                }}
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#FAF7F2',
                    fontSize: '13.5px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9C8C7E',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="lm-interactive-btn"
              style={{
                width: '100%',
                backgroundColor: isSubmitting ? '#d4a319' : '#FBC324',
                color: '#080808',
                border: 'none',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '14px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(251, 195, 36, 0.3)',
                opacity: isSubmitting ? 0.8 : 1,
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={17} className="lm-spin" />
                  <span>VERIFYING ACCOUNT...</span>
                </>
              ) : (
                <>
                  <span>{tab === 'signin' ? 'ENTER MENU' : 'CREATE ACCOUNT & ENTER'}</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Quick Table Guest Entry */}
          <div
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              textAlign: 'center',
            }}
          >
            <button
              onClick={handleGuestEntry}
              className="lm-interactive-btn"
              style={{
                background: 'none',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '999px',
                padding: '7px 18px',
                color: '#FAF7F2',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Sparkles size={13} style={{ color: '#FBC324' }} />
              <span>Continue as Table Guest</span>
            </button>
          </div>
        </div>

        {/* Security / Privacy Trust Pill */}
        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: '#9C8C7E',
          }}
        >
          <ShieldCheck size={14} style={{ color: '#FBC324' }} />
          <span>Little Monkey In-Café Dining Session</span>
        </div>
      </div>
    </div>
  );
};
