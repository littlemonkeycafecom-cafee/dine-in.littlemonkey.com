import React, { useState } from 'react';
import { useDineIn } from '../contexts/DineInContext';
import {
  lookupCustomer,
  continueExistingCustomer,
  submitCustomerRecord,
  normalizeIndianMobile,
  isValidIndianMobile,
  AUTH_STORAGE_KEYS,
} from '../services/auth';
import { AdminQrManagementModal } from './AdminQrManagementModal';
import {
  ArrowRight,
  Utensils,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Shield,
  User,
  Phone,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const CustomerLoginGate: React.FC = () => {
  const {
    signIn,
    tableNumber,
    isTableRevoked,
    tableRevocationReason,
    isQrAuthorized,
    qrProofToken,
    openAdminModal,
    isAdminModalOpen,
    closeAdminModal,
  } = useDineIn();

  // Three-step password-free customer access state machine
  const [step, setStep] = useState<'mobile_entry' | 'existing_customer' | 'new_customer'>('mobile_entry');
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState<{
    customerId: string;
    name: string;
    mobile: string;
  } | null>(null);

  const getEffectiveProof = (): string => {
    return (
      qrProofToken ||
      (typeof window !== 'undefined' ? sessionStorage.getItem(AUTH_STORAGE_KEYS.QR_PROOF) : '') ||
      ''
    );
  };

  // Step A: Verify 10-Digit Mobile Number (Lookup)
  const handleVerifyMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    const cleanMobile = normalizeIndianMobile(mobile);
    if (!isValidIndianMobile(cleanMobile)) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    const effectiveProof = getEffectiveProof();
    if (!effectiveProof) {
      setError('Table QR code verification is missing or expired. Please re-scan your table QR code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await lookupCustomer(cleanMobile, effectiveProof);
      if (!res.success) {
        setError(res.message || res.error || 'Failed to verify mobile number. Please try again.');
        return;
      }

      if (res.exists && res.customer) {
        // Step B: Existing Registered Customer Found
        setExistingCustomer(res.customer);
        setStep('existing_customer');
      } else {
        // Step C: New Customer Registration
        setExistingCustomer(null);
        setStep('new_customer');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to connect to customer verification service. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step B: Existing Customer Continuation (Never asks for password, preserves stored name)
  const handleContinueExisting = async () => {
    if (isSubmitting || !existingCustomer) return;
    setError('');

    const effectiveProof = getEffectiveProof();
    if (!effectiveProof) {
      setError('Table QR code verification is missing or expired. Please re-scan your table QR code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await continueExistingCustomer(existingCustomer.mobile, effectiveProof);
      if (!res.success || !res.customer || !res.sessionToken) {
        setError(res.message || res.error || 'Failed to initialize your dining session. Please try again.');
        return;
      }

      await signIn(
        res.customer.mobile,
        res.customer.name,
        res.sessionToken,
        res.customer.customerId,
        'customer'
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to continue to menu. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step C: New Customer Registration
  const handleRegisterNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    const cleanName = name.trim();
    const cleanMobile = normalizeIndianMobile(mobile);

    if (!cleanName || cleanName.length < 1) {
      setError('Please enter your full name.');
      return;
    }

    if (cleanName.length > 60) {
      setError('Full name must be 60 characters or fewer.');
      return;
    }

    if (!isValidIndianMobile(cleanMobile)) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    const effectiveProof = getEffectiveProof();
    if (!effectiveProof) {
      setError('Table QR code verification is missing or expired. Please re-scan your table QR code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitCustomerRecord(cleanName, cleanMobile, effectiveProof);
      if (!res.success || !res.customer || !res.sessionToken) {
        setError(res.message || res.error || 'Failed to complete customer registration.');
        return;
      }

      await signIn(
        res.customer.mobile,
        res.customer.name,
        res.sessionToken,
        res.customer.customerId,
        'customer'
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to connect to customer registration service. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToMobile = () => {
    setError('');
    setStep('mobile_entry');
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
              backgroundColor: isQrAuthorized ? 'rgba(16, 185, 129, 0.12)' : 'rgba(251, 195, 36, 0.1)',
              border: isQrAuthorized ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(251, 195, 36, 0.35)',
              borderRadius: '999px',
              padding: '4px 12px',
              color: isQrAuthorized ? '#10B981' : '#FBC324',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            {isQrAuthorized ? <ShieldCheck size={12} /> : <Utensils size={12} />}
            <span>DINE-IN ACCESS</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.4)', margin: '0 2px' }}>•</span>
            <span style={{ color: '#FAF7F2' }}>{tableNumber}</span>
            {isQrAuthorized && (
              <>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)', margin: '0 2px' }}>•</span>
                <span style={{ color: '#10B981' }}>QR VERIFIED</span>
              </>
            )}
          </div>

          {isTableRevoked && (
            <div
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#F87171',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textAlign: 'left',
              }}
            >
              <AlertTriangle size={15} style={{ color: '#F87171', flexShrink: 0 }} />
              <span style={{ lineHeight: 1.4 }}>
                {tableRevocationReason || `Table ${tableNumber} QR has been deactivated by café staff. Ordering is disabled.`}
              </span>
            </div>
          )}

          {step === 'mobile_entry' && (
            <>
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
                Welcome to Little Monkey Café
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  color: '#9C8C7E',
                  margin: 0,
                }}
              >
                Enter your mobile number to continue.
              </p>
            </>
          )}

          {step === 'existing_customer' && (
            <>
              <h1
                style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  margin: '0 0 6px 0',
                  lineHeight: 1.2,
                }}
              >
                Welcome back, {existingCustomer?.name || 'Valued Diner'}
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  color: '#9C8C7E',
                  margin: 0,
                }}
              >
                We found your registered account. You can continue directly to the menu.
              </p>
            </>
          )}

          {step === 'new_customer' && (
            <>
              <h1
                style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  margin: '0 0 6px 0',
                  lineHeight: 1.2,
                }}
              >
                Welcome! Let's get you started.
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  color: '#9C8C7E',
                  margin: 0,
                }}
              >
                Please enter your full name to start your dining session.
              </p>
            </>
          )}
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
          {/* Error Message Banner */}
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
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={15} style={{ color: '#EF4444', flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* STEP A: Mobile Entry */}
          {step === 'mobile_entry' && (
            <form onSubmit={handleVerifyMobile}>
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="customer-mobile"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    color: '#9C8C7E',
                    marginBottom: '6px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <Phone size={13} style={{ color: '#FBC324' }} />
                  <span>Mobile Number (10 Digits) *</span>
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#191816',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    transition: 'border-color 0.18s ease',
                  }}
                >
                  <span
                    style={{
                      padding: '12px 14px',
                      color: '#FBC324',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: 'rgba(251, 195, 36, 0.05)',
                      userSelect: 'none',
                    }}
                  >
                    +91
                  </span>
                  <input
                    id="customer-mobile"
                    type="tel"
                    required
                    maxLength={10}
                    inputMode="numeric"
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    disabled={isSubmitting}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#FAF7F2',
                      fontSize: '13.5px',
                      outline: 'none',
                      letterSpacing: '0.04em',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || mobile.replace(/\D/g, '').length !== 10}
                className="lm-interactive-btn"
                style={{
                  width: '100%',
                  backgroundColor: isSubmitting || mobile.replace(/\D/g, '').length !== 10 ? '#786016' : '#FBC324',
                  color: '#080808',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  cursor: isSubmitting || mobile.replace(/\D/g, '').length !== 10 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(251, 195, 36, 0.25)',
                  opacity: isSubmitting ? 0.8 : 1,
                  transition: 'all 0.18s ease',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={17} className="lm-spin" />
                    <span>VERIFYING MOBILE...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Mobile Number</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP B: Existing Registered Customer */}
          {step === 'existing_customer' && existingCustomer && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                }}
              >
                <CheckCircle2 size={18} style={{ color: '#10B981', flexShrink: 0 }} />
                <div style={{ fontSize: '12.5px', color: '#FAF7F2', lineHeight: 1.4 }}>
                  <span>Registered account found for </span>
                  <strong style={{ color: '#10B981' }}>+91 {existingCustomer.mobile}</strong>
                </div>
              </div>

              {/* Read-Only Customer Profile Display */}
              <div
                style={{
                  backgroundColor: '#191816',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: '#9C8C7E',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '4px',
                  }}
                >
                  Registered Diner Name
                </div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#FAF7F2',
                    marginBottom: '12px',
                  }}
                >
                  {existingCustomer.name}
                </div>

                <div
                  style={{
                    fontSize: '11px',
                    color: '#9C8C7E',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '4px',
                  }}
                >
                  Mobile Number
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#FBC324',
                    marginBottom: '10px',
                  }}
                >
                  +91 {existingCustomer.mobile}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11.5px',
                    color: '#A3A3A3',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <Lock size={12} style={{ color: '#FBC324' }} />
                  <span>Trusted identity record • Preserved without modification</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleContinueExisting}
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
                    transition: 'all 0.18s ease',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={17} className="lm-spin" />
                      <span>STARTING SESSION...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Menu</span>
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleBackToMobile}
                  className="lm-interactive-btn"
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    color: '#9C8C7E',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: '11px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Change mobile number
                </button>
              </div>
            </div>
          )}

          {/* STEP C: New Customer Registration */}
          {step === 'new_customer' && (
            <form onSubmit={handleRegisterNew}>
              {/* Pre-populated Read-Only Mobile Number */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    color: '#9C8C7E',
                    marginBottom: '6px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <Lock size={12} style={{ color: '#FBC324' }} />
                  <span>Verified Mobile Number</span>
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(251, 195, 36, 0.05)',
                    border: '1px solid rgba(251, 195, 36, 0.25)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                  }}
                >
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#FBC324' }}>
                    +91 {mobile}
                  </span>
                  <button
                    type="button"
                    onClick={handleBackToMobile}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9C8C7E',
                      fontSize: '11.5px',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: '2px 4px',
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Full Name Input */}
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="customer-name"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    color: '#9C8C7E',
                    marginBottom: '6px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <User size={13} style={{ color: '#FBC324' }} />
                  <span>Full Name *</span>
                </label>
                <input
                  id="customer-name"
                  type="text"
                  required
                  maxLength={60}
                  placeholder="e.g. Aarav Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
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
                    transition: 'border-color 0.18s ease',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#FBC324')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)')}
                />
              </div>

              {/* Submit Button */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="lm-interactive-btn"
                  style={{
                    width: '100%',
                    backgroundColor: isSubmitting || !name.trim() ? '#786016' : '#FBC324',
                    color: '#080808',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '14px',
                    fontSize: '14px',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    cursor: isSubmitting || !name.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 16px rgba(251, 195, 36, 0.3)',
                    opacity: isSubmitting ? 0.8 : 1,
                    transition: 'all 0.18s ease',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={17} className="lm-spin" />
                      <span>REGISTERING CUSTOMER...</span>
                    </>
                  ) : (
                    <>
                      <span>Register &amp; Continue</span>
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleBackToMobile}
                  className="lm-interactive-btn"
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    color: '#9C8C7E',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: '11px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Change mobile number
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security / Privacy Trust Pill & Staff Link */}
        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
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

          <button
            type="button"
            onClick={openAdminModal}
            className="lm-interactive-btn"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6B6258',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
            }}
          >
            <Shield size={12} />
            <span>Staff QR Administration</span>
          </button>
        </div>
      </div>

      {/* Admin QR Management Modal */}
      <AdminQrManagementModal isOpen={isAdminModalOpen} onClose={closeAdminModal} />
    </div>
  );
};
