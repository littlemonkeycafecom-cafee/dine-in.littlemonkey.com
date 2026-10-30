import React from 'react';
import { useDineIn } from '../contexts/DineInContext';
import { AdminQrManagementModal } from './AdminQrManagementModal';
import { QrCode, Clock, Shield, AlertTriangle, Smartphone, Sparkles, RefreshCw, MapPin } from 'lucide-react';

export const TableQrRequiredGate: React.FC = () => {
  const {
    qrError,
    tableNumber,
    openAdminModal,
    isAdminModalOpen,
    closeAdminModal,
    resetSessionState,
  } = useDineIn();

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#080808',
        backgroundImage: 'radial-gradient(circle at 50% 25%, rgba(251, 195, 36, 0.09) 0%, transparent 65%)',
        color: '#FAF7F2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 18px',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Yellow Ambient Blur */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'clamp(280px, 60vw, 540px)',
          height: 'clamp(200px, 40vw, 340px)',
          background: 'radial-gradient(ellipse at center, rgba(251, 195, 36, 0.14) 0%, rgba(255, 194, 26, 0.04) 50%, transparent 75%)',
          filter: 'blur(52px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Brand Logo */}
        <div className="lm-logo-ambient-wrap" style={{ marginBottom: '16px' }}>
          <img
            src="/branding/little-monkey-logo-transparent.png"
            alt="Little Monkey Café"
            style={{
              height: '58px',
              width: 'auto',
              objectFit: 'contain',
              position: 'relative',
              zIndex: 1,
            }}
          />
        </div>

        {/* Security Access Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(251, 195, 36, 0.1)',
            border: '1px solid rgba(251, 195, 36, 0.35)',
            borderRadius: '999px',
            padding: '4px 14px',
            color: '#FBC324',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '14px',
          }}
        >
          <QrCode size={12} />
          <span>IN-CAFÉ QR ACCESS REQUIRED</span>
        </div>

        {/* Main Heading */}
        <h1
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(24px, 5vw, 28px)',
            fontWeight: 700,
            color: '#FAF7F2',
            margin: '0 0 10px 0',
            lineHeight: 1.25,
          }}
        >
          Table QR Scan Required
        </h1>

        <p
          style={{
            fontSize: '13.5px',
            color: '#9C8C7E',
            margin: '0 0 22px 0',
            lineHeight: 1.55,
            maxWidth: '380px',
          }}
        >
          To access the Little Monkey Café dining menu, please scan the physical QR code located directly on your café table.
        </p>

        {/* Error Alert Banner if QR verification failed or was revoked */}
        {qrError && (
          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '20px',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              boxSizing: 'border-box',
            }}
          >
            <AlertTriangle size={17} style={{ color: '#F87171', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ color: '#F87171', fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>
                QR Authorization Error
              </div>
              <div style={{ color: '#FCA5A5', fontSize: '12px', lineHeight: 1.4 }}>
                {qrError}
              </div>
            </div>
          </div>
        )}

        {/* Guidance Card */}
        <div
          className="lm-border-beam lm-surface-reflection"
          style={{
            width: '100%',
            backgroundColor: '#12100E',
            border: '1px solid rgba(251, 195, 36, 0.28)',
            borderRadius: '20px',
            padding: '24px 20px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.95), 0 0 28px rgba(251, 195, 36, 0.1)',
            textAlign: 'left',
            boxSizing: 'border-box',
            marginBottom: '20px',
          }}
        >
          <div style={{ color: '#FAF7F2', fontSize: '14px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={15} style={{ color: '#FBC324' }} />
            <span>How to Access the Dining Menu</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(251, 195, 36, 0.15)',
                  border: '1px solid rgba(251, 195, 36, 0.4)',
                  color: '#FBC324',
                  fontSize: '11px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <div style={{ color: '#D4CEB8', fontSize: '12.5px', lineHeight: 1.45 }}>
                <strong style={{ color: '#FAF7F2' }}>Locate your table card:</strong> Find the wooden or acrylic QR card placed at your table (Tables 01 to 06).
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(251, 195, 36, 0.15)',
                  border: '1px solid rgba(251, 195, 36, 0.4)',
                  color: '#FBC324',
                  fontSize: '11px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <div style={{ color: '#D4CEB8', fontSize: '12.5px', lineHeight: 1.45 }}>
                <strong style={{ color: '#FAF7F2' }}>Scan with camera:</strong> Use your smartphone camera or any QR scanner app to scan the code.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(251, 195, 36, 0.15)',
                  border: '1px solid rgba(251, 195, 36, 0.4)',
                  color: '#FBC324',
                  fontSize: '11px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                3
              </div>
              <div style={{ color: '#D4CEB8', fontSize: '12.5px', lineHeight: 1.45 }}>
                <strong style={{ color: '#FAF7F2' }}>Browse digital menu:</strong> Enjoy 30 minutes of secure, server-authorized access to our full digital menu.
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#9C8C7E',
            }}
          >
            <span>Tables 01 – 06 Supported</span>
            <span>30-Min Session Expiry</span>
          </div>
        </div>

        {/* Administration and Staff Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={openAdminModal}
            className="lm-interactive-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#191816',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '999px',
              padding: '8px 16px',
              color: '#B8B3A8',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Shield size={13} style={{ color: '#FBC324' }} />
            <span>Staff QR Administration</span>
          </button>

          {qrError && (
            <button
              type="button"
              onClick={resetSessionState}
              className="lm-interactive-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(251, 195, 36, 0.1)',
                border: '1px solid rgba(251, 195, 36, 0.3)',
                borderRadius: '999px',
                padding: '8px 16px',
                color: '#FBC324',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin QR Management Modal */}
      <AdminQrManagementModal isOpen={isAdminModalOpen} onClose={closeAdminModal} />
    </div>
  );
};

export const DiningSessionExpiredGate: React.FC = () => {
  const {
    tableNumber,
    resetSessionState,
    openAdminModal,
    isAdminModalOpen,
    closeAdminModal,
  } = useDineIn();

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#080808',
        backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(239, 68, 68, 0.08) 0%, transparent 65%)',
        color: '#FAF7F2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 18px',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Brand Logo */}
        <div className="lm-logo-ambient-wrap" style={{ marginBottom: '16px' }}>
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

        {/* Expired Session Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '999px',
            padding: '4px 14px',
            color: '#F87171',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '14px',
          }}
        >
          <Clock size={12} />
          <span>30-MINUTE DINING SESSION EXPIRED</span>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(24px, 5vw, 28px)',
            fontWeight: 700,
            color: '#FAF7F2',
            margin: '0 0 10px 0',
            lineHeight: 1.25,
          }}
        >
          Session Concluded
        </h1>

        <p
          style={{
            fontSize: '13.5px',
            color: '#9C8C7E',
            margin: '0 0 24px 0',
            lineHeight: 1.55,
            maxWidth: '380px',
          }}
        >
          Your 30-minute dining session for <strong style={{ color: '#FAF7F2' }}>{tableNumber}</strong> has ended. Digital dining sessions are time-bounded to maintain security and table availability.
        </p>

        {/* Detail Card */}
        <div
          className="lm-border-beam"
          style={{
            width: '100%',
            backgroundColor: '#12100E',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '20px',
            padding: '24px 20px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.95), 0 0 28px rgba(239, 68, 68, 0.1)',
            textAlign: 'left',
            boxSizing: 'border-box',
            marginBottom: '24px',
          }}
        >
          <div style={{ color: '#FAF7F2', fontSize: '13.5px', fontWeight: 700, marginBottom: '8px' }}>
            Need to continue browsing?
          </div>
          <p style={{ color: '#B8B3A8', fontSize: '12.5px', lineHeight: 1.5, margin: '0 0 16px 0' }}>
            Simply scan the physical QR code on your table again to initiate a fresh 30-minute dining session.
          </p>

          <button
            type="button"
            onClick={resetSessionState}
            className="lm-interactive-btn"
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: '12px',
              backgroundColor: '#FBC324',
              color: '#080808',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(251, 195, 36, 0.3)',
            }}
          >
            <RefreshCw size={14} />
            <span>Scan QR Code Again</span>
          </button>
        </div>

        {/* Staff Administration */}
        <button
          type="button"
          onClick={openAdminModal}
          className="lm-interactive-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#7C7267',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 12px',
          }}
        >
          <Shield size={13} style={{ color: '#9C8C7E' }} />
          <span>Staff QR Administration</span>
        </button>
      </div>

      {/* Admin QR Management Modal */}
      <AdminQrManagementModal isOpen={isAdminModalOpen} onClose={closeAdminModal} />
    </div>
  );
};
