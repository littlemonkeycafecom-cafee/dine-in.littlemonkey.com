import fs from 'node:fs';

const filePath = 'src/components/QrAccessGates.tsx';
const content = fs.readFileSync(filePath, 'utf-8');

const startMarker = 'interface TableQrRequiredGateProps {';
const endMarker = 'export const DiningSessionExpiredGate: React.FC = () => {';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not locate markers in QrAccessGates.tsx');
  process.exit(1);
}

const newTableQrRequiredGate = `interface TableQrRequiredGateProps {
  onOpenScanner?: () => void;
}

export const TableQrRequiredGate: React.FC<TableQrRequiredGateProps> = ({ onOpenScanner }) => {
  const {
    qrError,
    tableNumber,
    openAdminModal,
    isAdminModalOpen,
    closeAdminModal,
    resetSessionState,
  } = useDineIn();

  // Allow staff with operational PIN to open admin modal via ?staff=true or ?admin=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('staff') === 'true' || params.get('admin') === 'true') {
        openAdminModal();
      }
    }
  }, [openAdminModal]);

  const handleOpenScanner = () => {
    if (onOpenScanner) {
      onOpenScanner();
    }
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/scanner');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0A0A0A',
        backgroundImage: 'radial-gradient(circle at 50% 18%, rgba(251, 195, 36, 0.08) 0%, transparent 65%)',
        color: '#FAF7F2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 'clamp(32px, 5vw, 64px) clamp(16px, 4vw, 40px) 140px',
        position: 'relative',
        overflowX: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Ambient Warm Glow */}
      <div
        style={{
          position: 'absolute',
          top: '22%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'clamp(320px, 60vw, 680px)',
          height: 'clamp(240px, 40vw, 420px)',
          background: 'radial-gradient(ellipse at center, rgba(251, 195, 36, 0.12) 0%, rgba(255, 194, 26, 0.03) 50%, transparent 75%)',
          filter: 'blur(64px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '24px',
        }}
      >
        {/* Top Minimal Brand Presentation */}
        <header
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '4px',
          }}
        >
          <div className="lm-logo-ambient-wrap">
            <img
              src="/branding/little-monkey-logo-transparent.png"
              alt="Little Monkey Dining"
              style={{
                height: 'clamp(54px, 7vw, 68px)',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '11px',
              color: '#9C8C7E',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Little Monkey Dining
          </span>
        </header>

        {/* Error Alert Banner (if QR verification failed or was revoked) */}
        {qrError && (
          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '16px',
              padding: '16px 20px',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              boxSizing: 'border-box',
            }}
          >
            <AlertTriangle size={20} style={{ color: '#F87171', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#F87171', fontSize: '13.5px', fontWeight: 700, marginBottom: '2px' }}>
                QR Authorization Error
              </div>
              <div style={{ color: '#FCA5A5', fontSize: '12.5px', lineHeight: 1.45, marginBottom: '10px' }}>
                {qrError}
              </div>
              <button
                type="button"
                onClick={resetSessionState}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  color: '#FECACA',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={12} />
                <span>Retry Scan</span>
              </button>
            </div>
          </div>
        )}

        {/* Customer-Facing Clean Welcome Statement */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px',
            maxWidth: '640px',
            margin: '0 auto',
          }}
        >
          {/* Security Access Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(251, 195, 36, 0.1)',
              border: '1px solid rgba(251, 195, 36, 0.35)',
              borderRadius: '999px',
              padding: '5px 16px',
              color: '#FFC21A',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            <QrCode size={13} />
            <span>Table QR Scan Required</span>
          </div>

          {/* Exact Welcome Heading */}
          <h1
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 'clamp(28px, 4.5vw, 42px)',
              fontWeight: 700,
              color: '#FAF7F2',
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            Welcome to Little Monkey Dining
          </h1>

          {/* Single Clear Non-Ordering Explanation */}
          <p
            style={{
              fontSize: 'clamp(14px, 1.25vw, 16px)',
              color: '#9C8C7E',
              margin: '0 auto',
              lineHeight: 1.6,
              maxWidth: '520px',
            }}
          >
            Please scan the physical QR code located on your dining table to access the menu.
          </p>
        </section>

        {/* Developer Testing Access Panel (Local Development Only - Completely Stripped in Production) */}
        {import.meta.env.DEV && <DevTableLauncher />}
      </div>

      {/* RECREATED YELLOW BOTTOM SCANNER DOCK (Matching Reference Image) */}
      <nav
        aria-label="Dining Primary Scanner Navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          paddingLeft: '16px',
          paddingRight: '16px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            position: 'relative',
            width: '100%',
            maxWidth: '380px',
            height: '62px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Yellow Scoop SVG Surface */}
          <svg
            viewBox="0 0 360 62"
            preserveAspectRatio="none"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              filter: 'drop-shadow(0 10px 28px rgba(0, 0, 0, 0.6)) drop-shadow(0 2px 10px rgba(245, 189, 37, 0.3))',
            }}
          >
            <path
              d="M 28,0 L 134,0 C 156,0 158,34 180,34 C 202,34 204,0 226,0 L 332,0 A 28,28 0 0,1 360,28 L 360,34 A 28,28 0 0,1 332,62 L 28,62 A 28,28 0 0,1 0,34 L 0,28 A 28,28 0 0,1 28,0 Z"
              fill="#F5BD25"
            />
          </svg>

          {/* Elevated Dark Circular Scanner Button in Center Notch */}
          <button
            type="button"
            onClick={handleOpenScanner}
            aria-label="Scan Table QR Code"
            className="lm-scanner-dock-btn"
            style={{
              position: 'absolute',
              top: '-15px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '58px',
              height: '58px',
              borderRadius: '50%',
              backgroundColor: '#181614',
              border: '3px solid #F5BD25',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.75), 0 0 16px rgba(245, 189, 37, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              zIndex: 2,
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            {/* Custom Scanning Reticle Icon Matching Reference */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 9V6C5 5.44772 5.44772 5 6 5H9" stroke="#FAF7F2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 5H18C18.5523 5 19 5.44772 19 6V9" stroke="#FAF7F2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 12H20" stroke="#F5BD25" strokeWidth="2.4" strokeLinecap="round"/>
              <path d="M5 15V18C5 18.5523 5.44772 19 6 19H9" stroke="#FAF7F2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 19H18C18.5523 19 19 18.5523 19 18V15" stroke="#FAF7F2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* Admin QR Management Modal */}
      <AdminQrManagementModal isOpen={isAdminModalOpen} onClose={closeAdminModal} />
    </div>
  );
};
\n\n`;

const updatedContent = content.slice(0, startIndex) + newTableQrRequiredGate + content.slice(endIndex);
fs.writeFileSync(filePath, updatedContent, 'utf-8');
console.log('Successfully updated QrAccessGates.tsx for final landing cleanup!');
