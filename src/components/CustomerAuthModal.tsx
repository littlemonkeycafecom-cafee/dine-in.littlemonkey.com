import React, { useState } from 'react';
import { useDineIn } from '../contexts/DineInContext';
import {
  submitCustomerRecord,
  normalizeIndianMobile,
  isValidIndianMobile,
  AUTH_STORAGE_KEYS,
} from '../services/auth';
import { User, Phone, X, ArrowRight, ShieldCheck, LogOut, Loader2, Utensils, AlertTriangle, CheckCircle2 } from 'lucide-react';

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
  const { customer, signIn, signOut, tableNumber, qrProofToken } = useDineIn();
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictData, setConflictData] = useState<{
    customerId: string;
    storedName: string;
    submittedName: string;
    mobile: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent, confirmedExistingName = false) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    setError('');

    const cleanName = confirmedExistingName && conflictData ? conflictData.storedName : name.trim();
    const cleanMobile = normalizeIndianMobile(mobile);

    // Validation
    if (!cleanName || cleanName.length < 1) {
      setError('Please enter your full name');
      return;
    }

    if (cleanName.length > 60) {
      setError('Full name must be 60 characters or fewer');
      return;
    }

    if (!isValidIndianMobile(cleanMobile)) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9');
      return;
    }

    const effectiveProof =
      qrProofToken ||
      (typeof window !== 'undefined' ? sessionStorage.getItem(AUTH_STORAGE_KEYS.QR_PROOF) : '') ||
      '';

    if (!effectiveProof) {
      setError('Table QR code verification is missing or expired. Please re-scan your table QR code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitCustomerRecord(cleanName, cleanMobile, effectiveProof, confirmedExistingName);

      if (!res.success) {
        setError(res.message || res.error || 'Failed to process customer registration.');
        setIsSubmitting(false);
        return;
      }

      // Name Conflict Resolution
      if (res.status === 'EXISTING_CUSTOMER_NAME_MISMATCH' && res.customer) {
        setConflictData({
          customerId: res.customer.customerId,
          storedName: res.customer.name,
          submittedName: res.customer.submittedName || cleanName,
          mobile: res.customer.mobile,
        });
        setIsSubmitting(false);
        return;
      }

      // Successful verification
      if (res.customer) {
        await signIn(
          res.customer.mobile,
          res.customer.name,
          res.sessionToken,
          res.customer.customerId,
          'customer'
        );
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error. Please try again.');
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
              {customer.id && (
                <p style={{ fontSize: '11px', color: '#6B6258', margin: '4px 0 0 0' }}>
                  Customer ID: {customer.id}
                </p>
              )}
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
                Your customer record is stored in our private Google Sheets customer database and linked to your table session.
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="lm-interactive-btn"
              style={{
                width: '100%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <LogOut size={16} />
              <span>Leave Dining Table / Sign Out</span>
            </button>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <h2
                style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#FAF7F2',
                  margin: '0 0 6px 0',
                }}
              >
                Customer Registration
              </h2>
              <p style={{ fontSize: '12.5px', color: '#9C8C7E', margin: 0 }}>
                Enter your details to view today's digital dining menu at {tableNumber}.
              </p>
            </div>

            {/* Conflicting Name Resolution State */}
            {conflictData ? (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(251, 195, 36, 0.12)',
                    border: '1px solid rgba(251, 195, 36, 0.35)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    marginBottom: '16px',
                  }}
                >
                  <CheckCircle2 size={18} style={{ color: '#FBC324', flexShrink: 0 }} />
                  <div style={{ fontSize: '12.5px', color: '#FAF7F2', lineHeight: 1.4 }}>
                    <span>Existing record found for </span>
                    <strong style={{ color: '#FBC324' }}>+91 {conflictData.mobile}</strong>
                    <span>.</span>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#191816',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '18px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#9C8C7E', textTransform: 'uppercase', marginBottom: '3px' }}>
                    Registered Name on File
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#FAF7F2', marginBottom: '8px' }}>
                    {conflictData.storedName}
                  </div>
                  <p style={{ fontSize: '12px', color: '#9C8C7E', margin: 0, lineHeight: 1.4 }}>
                    Stored names are never silently overwritten. Would you like to continue as <strong>{conflictData.storedName}</strong>?
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSubmit(undefined, true)}
                    className="lm-interactive-btn"
                    style={{
                      width: '100%',
                      backgroundColor: isSubmitting ? '#d4a319' : '#FBC324',
                      color: '#080808',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    {isSubmitting ? <Loader2 size={16} className="lm-spin" /> : <span>CONTINUE AS {conflictData.storedName.toUpperCase()}</span>}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setConflictData(null)}
                    style={{
                      width: '100%',
                      backgroundColor: 'transparent',
                      color: '#9C8C7E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Edit Details
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Error Banner */}
                {error && (
                  <div
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid #EF4444',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#FCA5A5',
                      fontSize: '12px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AlertTriangle size={15} style={{ color: '#EF4444', flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={(e) => handleSubmit(e, false)}>
                  {/* Full Name */}
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
                      <User size={13} style={{ color: '#FBC324' }} />
                      <span>Full Name *</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      placeholder="e.g. Aarav Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isSubmitting}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        backgroundColor: '#191816',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        color: '#FAF7F2',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* 10-Digit Mobile */}
                  <div style={{ marginBottom: '20px' }}>
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
                      }}
                    >
                      <span
                        style={{
                          padding: '12px 14px',
                          color: '#FBC324',
                          fontWeight: 800,
                          fontSize: '13px',
                          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                          backgroundColor: 'rgba(251, 195, 36, 0.05)',
                        }}
                      >
                        +91
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        inputMode="numeric"
                        placeholder="9876543210"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                        disabled={isSubmitting}
                        style={{
                          flex: 1,
                          padding: '12px 14px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#FAF7F2',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

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
                      fontSize: '13.5px',
                      fontWeight: 800,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="lm-spin" />
                        <span>VERIFYING RECORD...</span>
                      </>
                    ) : (
                      <>
                        <span>VIEW DINING MENU</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
