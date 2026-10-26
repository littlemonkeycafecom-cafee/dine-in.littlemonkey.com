import React, { useState } from 'react';
import { useDineIn } from '../contexts/DineInContext';
import { customerSignIn, customerSignUp } from '../services/auth';
import { User, Eye, EyeOff, X, ArrowRight, ShieldCheck, LogOut, Loader2, Utensils } from 'lucide-react';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mandatory?: boolean;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  mandatory = false,
}) => {
  const { customer, signIn, signOut, tableNumber } = useDineIn();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    // Validation
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
        const res = await customerSignIn(cleanMobile, password);
        if (!res.success) {
          setError(res.error || 'Authentication failed. Please check your credentials.');
          setIsSubmitting(false);
          return;
        }

        const user = res.user || res.session?.user;
        const customerName =
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.name ||
          'Diner ' + cleanMobile.slice(-4);

        signIn(cleanMobile, customerName, res.token, user?.id);
        onClose();
      } else {
        const res = await customerSignUp(name.trim(), cleanMobile, password);
        if (!res.success) {
          setError(res.error || 'Failed to create account.');
          setIsSubmitting(false);
          return;
        }

        const user = res.user || res.session?.user;
        signIn(cleanMobile, name.trim(), res.token, user?.id);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={() => {
        if (!mandatory) onClose();
      }}
    >
      <div
        className="lm-border-beam lm-surface-reflection"
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#12100E',
          border: '1px solid rgba(251, 195, 36, 0.28)',
          borderRadius: '20px',
          padding: '28px 24px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.95), 0 0 24px rgba(251, 195, 36, 0.12)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button if not strictly mandatory */}
        {!mandatory && (
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9C8C7E',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        )}

        {/* Signed In Profile Card View */}
        {customer ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#191816',
                  border: '2px solid #FBC324',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px auto',
                  color: '#FBC324',
                  boxShadow: '0 0 20px rgba(251, 195, 36, 0.2)',
                }}
              >
                <User size={32} />
              </div>

              <h2
                style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  margin: '0 0 6px 0',
                }}
              >
                {customer.name}
              </h2>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(251, 195, 36, 0.12)',
                  border: '1px solid rgba(251, 195, 36, 0.35)',
                  borderRadius: '999px',
                  padding: '4px 12px',
                  color: '#FBC324',
                  fontSize: '11px',
                  fontWeight: 700,
                  marginBottom: '10px',
                }}
              >
                <Utensils size={12} />
                <span>Active at {tableNumber}</span>
              </div>

              <p style={{ fontSize: '12.5px', color: '#9C8C7E', margin: 0 }}>
                Mobile: +91 {customer.mobile}
              </p>
            </div>

            <div
              style={{
                backgroundColor: '#191816',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <ShieldCheck size={20} style={{ color: '#FBC324', flexShrink: 0 }} />
              <div style={{ fontSize: '11.5px', color: '#9C8C7E', lineHeight: 1.4 }}>
                <span style={{ color: '#FAF7F2', fontWeight: 600 }}>Verified Customer Account</span>
                <br />
                Authenticated across Little Monkey Café dining services.
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="lm-interactive-btn"
              style={{
                width: '100%',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid #EF4444',
                color: '#FCA5A5',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <LogOut size={16} />
              <span>Sign Out of Dining</span>
            </button>
          </div>
        ) : (
          /* Sign In / Sign Up Form */
          <div>
            {/* Top Header */}
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#191816',
                  border: '1.5px solid #FBC324',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px auto',
                  color: '#FBC324',
                }}
              >
                <User size={28} />
              </div>

              <h2
                style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  margin: '0 0 6px 0',
                }}
              >
                {tab === 'signin' ? 'Sign In to Little Monkey' : 'Create Diner Account'}
              </h2>

              <p style={{ fontSize: '12px', color: '#9C8C7E', margin: 0 }}>
                {tableNumber} • Access order history, favorites & live tracking.
              </p>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#191816',
                borderRadius: '10px',
                padding: '4px',
                marginBottom: '20px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <button
                type="button"
                className="lm-interactive-btn"
                onClick={() => {
                  setTab('signin');
                  setError('');
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  backgroundColor: tab === 'signin' ? '#FBC324' : 'transparent',
                  color: tab === 'signin' ? '#080808' : '#9C8C7E',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Sign In
              </button>

              <button
                type="button"
                className="lm-interactive-btn"
                onClick={() => {
                  setTab('signup');
                  setError('');
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  backgroundColor: tab === 'signup' ? '#FBC324' : 'transparent',
                  color: tab === 'signup' ? '#080808' : '#9C8C7E',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid #EF4444',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#FCA5A5',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {tab === 'signup' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#9C8C7E', marginBottom: '6px', fontWeight: 600 }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      backgroundColor: '#191816',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#FAF7F2',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {/* Mobile Number */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#9C8C7E', marginBottom: '6px', fontWeight: 600 }}>
                  Mobile Number *
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#191816',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      padding: '11px 12px',
                      color: '#FBC324',
                      fontWeight: 800,
                      fontSize: '13px',
                      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
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
                      padding: '11px 14px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#FAF7F2',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#9C8C7E', marginBottom: '6px', fontWeight: 600 }}>
                  Password *
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#191816',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    paddingRight: '12px',
                  }}
                >
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '11px 14px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#FAF7F2',
                      fontSize: '13px',
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
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                  padding: '13px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background-color 0.15s ease',
                  opacity: isSubmitting ? 0.8 : 1,
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="lm-spin" />
                    <span>AUTHENTICATING...</span>
                  </>
                ) : (
                  <>
                    <span>{tab === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
