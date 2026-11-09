import React, { useState, useEffect } from 'react';
import { useDineIn } from '../contexts/DineInContext';
import { AdminQrManagementModal } from './AdminQrManagementModal';
import { QRCodeView } from '../lib/qrCode';
import {
  QrCode,
  Clock,
  Shield,
  AlertTriangle,
  Smartphone,
  Sparkles,
  RefreshCw,
  MapPin,
  Camera,
  Lock,
  CheckCircle2,
  X,
  ExternalLink,
  Download,
  Coffee,
  Utensils,
  BookOpen,
  ChevronRight,
  Info,
  Users,
  Compass,
  Store,
  Copy,
  Check,
  Eye,
  FileDown,
} from 'lucide-react';

interface DevTableItem {
  tableNumber: string;
  shortCode: string;
  zone: string;
  capacity: number;
  credentialId: string | null;
  isActive: boolean;
  entryUrl: string | null;
  productionUrl: string | null;
}

const DevTableLauncher: React.FC = () => {
  const [tables, setTables] = useState<DevTableItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>(() => {
    if (typeof window === 'undefined') return '9999';
    return (
      sessionStorage.getItem('lm_dev_pin') ||
      new URLSearchParams(window.location.search).get('pin') ||
      '9999'
    );
  });
  const [selectedQrTable, setSelectedQrTable] = useState<DevTableItem | null>(null);
  const [previewTab, setPreviewTab] = useState<'stand' | 'qr'>('stand');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const loadDevTables = async (pinToUse?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const pin =
        pinToUse ||
        pinInput ||
        sessionStorage.getItem('lm_dev_pin') ||
        new URLSearchParams(window.location.search).get('pin') ||
        '9999';

      const res = await fetch(`/api/dev/tables?pin=${encodeURIComponent(pin)}`, {
        headers: {
          'x-operational-pin': pin,
        },
      });
      const data = await res.json().catch(() => ({}));

      if (data.success && Array.isArray(data.tables)) {
        setTables(data.tables);
        const authorized = Boolean(data.isStaffAuthorized);
        setIsAuthorized(authorized);
        if (authorized) {
          sessionStorage.setItem('lm_dev_pin', pin);
        } else {
          setError('Operational PIN required to unlock table entry URLs.');
        }
      } else {
        setError(data.message || 'Failed to retrieve authoritative table credentials.');
      }
    } catch (err: any) {
      setError(err?.message || 'Connection error retrieving developer tables.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevTables();
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;
    loadDevTables(pinInput.trim());
  };

  const handleLaunchTable = (entryUrl: string | null) => {
    if (!entryUrl) return;
    window.location.href = entryUrl;
  };

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#0F0E0D',
        border: '1.5px dashed rgba(251, 195, 36, 0.65)',
        borderRadius: '16px',
        padding: '16px 18px',
        marginBottom: '22px',
        textAlign: 'left',
        boxSizing: 'border-box',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.9), 0 0 20px rgba(251, 195, 36, 0.12)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 900,
              color: '#080808',
              backgroundColor: '#FFC21A',
              padding: '3px 8px',
              borderRadius: '4px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            DEVELOPER TESTING — LOCAL ONLY
          </span>
          {isAuthorized && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                color: '#34D399',
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={12} />
              <span>UNLOCKED</span>
            </span>
          )}
        </div>
        <span style={{ fontSize: '11px', color: '#9C8C7E', fontWeight: 600 }}>
          10 Physical Tables
        </span>
      </div>

      <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#B8B3A8', lineHeight: 1.45 }}>
        Select any physical table to launch its authentic dining session, or tap the QR icon to inspect its scannable code:
      </p>

      {isLoading ? (
        <div style={{ padding: '16px', textAlign: 'center', color: '#9C8C7E', fontSize: '12px' }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', color: '#FFC21A' }} />
          <div>Loading authoritative table QR credentials...</div>
        </div>
      ) : !isAuthorized ? (
        <form onSubmit={handlePinSubmit} style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '12px', color: '#FCA5A5', marginBottom: '8px' }}>
            {error || 'Staff operational PIN required to generate live table entry URLs:'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter PIN (e.g. 9999)"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#1E1D1A',
                border: '1px solid rgba(251, 195, 36, 0.4)',
                color: '#FAF7F2',
                fontSize: '12px',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: '#FFC21A',
                color: '#080808',
                fontWeight: 700,
                fontSize: '12px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Unlock Tables
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {tables.map((tbl) => (
            <div
              key={tbl.tableNumber}
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#191816',
                border: '1px solid rgba(251, 195, 36, 0.35)',
                borderRadius: '8px',
                overflow: 'hidden',
                transition: 'all 0.15s ease',
              }}
            >
              <button
                type="button"
                onClick={() => handleLaunchTable(tbl.entryUrl)}
                disabled={!tbl.entryUrl}
                title={`${tbl.tableNumber} (${tbl.zone}) — Click to simulate scanning this table QR`}
                style={{
                  padding: '8px 4px 4px 4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#FFC21A',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: tbl.entryUrl ? 'pointer' : 'not-allowed',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <span>{tbl.shortCode}</span>
                <span style={{ fontSize: '8.5px', opacity: 0.75, fontWeight: 600 }}>{tbl.tableNumber}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedQrTable(tbl)}
                title={`Inspect Table Stand Artwork for ${tbl.tableNumber}`}
                style={{
                  backgroundColor: 'rgba(255, 194, 26, 0.08)',
                  borderTop: '1px solid rgba(251, 195, 36, 0.2)',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  color: '#FAF7F2',
                  fontSize: '9.5px',
                  fontWeight: 600,
                  padding: '4px 0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                }}
              >
                <Eye size={10} style={{ color: '#FFC21A' }} />
                <span>Artwork</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Selected Table QR & Tabletop Stand Artwork Preview Modal */}
      {selectedQrTable && selectedQrTable.entryUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setSelectedQrTable(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              maxHeight: '92vh',
              overflowY: 'auto',
              backgroundColor: '#141311',
              border: '1.5px solid #FFC21A',
              borderRadius: '20px',
              padding: '20px',
              textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.95), 0 0 30px rgba(255, 194, 26, 0.15)',
              color: '#FAF7F2',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0, fontSize: '17px', color: '#FAF7F2', fontWeight: 800 }}>
                  {selectedQrTable.tableNumber} ({selectedQrTable.shortCode})
                </h3>
                <span style={{ fontSize: '11px', color: '#9C8C7E' }}>{selectedQrTable.zone} • Capacity: {selectedQrTable.capacity} Diners</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQrTable(null)}
                aria-label="Close Preview"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9C8C7E',
                  cursor: 'pointer',
                  padding: '6px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Segmented Control: Stand Artwork vs QR Module Only */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#1C1A17',
                borderRadius: '10px',
                padding: '3px',
                marginBottom: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                onClick={() => setPreviewTab('stand')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: previewTab === 'stand' ? '#FFC21A' : 'transparent',
                  color: previewTab === 'stand' ? '#080808' : '#A89F93',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Eye size={13} />
                <span>Complete Stand Artwork</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('qr')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: previewTab === 'qr' ? '#FFC21A' : 'transparent',
                  color: previewTab === 'qr' ? '#080808' : '#A89F93',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <QrCode size={13} />
                <span>QR Module Only</span>
              </button>
            </div>

            {/* Content Area Based on Active Tab */}
            {previewTab === 'stand' ? (
              <div>
                {/* Full Vector SVG Tabletop Stand Artwork */}
                <div
                  style={{
                    backgroundColor: '#0A0908',
                    borderRadius: '14px',
                    padding: '8px',
                    border: '1px solid rgba(255, 194, 26, 0.3)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={`/api/admin/qr/artwork?table=${selectedQrTable.shortCode}&format=svg&pin=${encodeURIComponent(pinInput || '9999')}&inline=1`}
                    alt={`${selectedQrTable.tableNumber} Tabletop Stand Artwork`}
                    style={{
                      width: '100%',
                      maxHeight: '380px',
                      objectFit: 'contain',
                      borderRadius: '8px',
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#FFD875',
                    backgroundColor: 'rgba(255, 194, 26, 0.08)',
                    border: '1px solid rgba(255, 194, 26, 0.2)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    marginBottom: '14px',
                    textAlign: 'center',
                  }}
                >
                  ✓ Complete Tabletop Stand Artwork: Includes Table Symbol &amp; Secret Code
                </div>
              </div>
            ) : (
              <div>
                {/* Pure Vector Scannable QR Code Module */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: '16px',
                    borderRadius: '14px',
                    display: 'inline-block',
                    margin: '0 auto 12px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                  }}
                >
                  <QRCodeView value={selectedQrTable.entryUrl} size={210} />
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#9C8C7E',
                    marginBottom: '12px',
                    lineHeight: 1.4,
                  }}
                >
                  Pure QR Code Module • For custom manufacturing or digital kiosks
                </div>
                {/* Copy URL Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#1E1D1A',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    marginBottom: '14px',
                  }}
                >
                  <span style={{ fontSize: '10px', color: '#A89F93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                    {selectedQrTable.entryUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedQrTable.entryUrl) {
                        navigator.clipboard.writeText(selectedQrTable.entryUrl);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedUrl ? '#34D399' : '#FFC21A',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                    }}
                  >
                    {copiedUrl ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Artwork Download Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <a
                href={`/api/admin/qr/artwork?table=${selectedQrTable.shortCode}&format=svg&pin=${encodeURIComponent(pinInput || '9999')}`}
                target="_blank"
                rel="noopener noreferrer"
                download={`table-${selectedQrTable.shortCode.toLowerCase()}.svg`}
                style={{
                  padding: '8px 6px',
                  borderRadius: '8px',
                  backgroundColor: '#1E1D1A',
                  border: '1px solid rgba(251, 195, 36, 0.35)',
                  color: '#FBC324',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <FileDown size={12} />
                <span>Stand SVG</span>
              </a>
              <a
                href={`/api/admin/qr/artwork?table=${selectedQrTable.shortCode}&format=png&pin=${encodeURIComponent(pinInput || '9999')}`}
                target="_blank"
                rel="noopener noreferrer"
                download={`table-${selectedQrTable.shortCode.toLowerCase()}.png`}
                style={{
                  padding: '8px 6px',
                  borderRadius: '8px',
                  backgroundColor: '#1E1D1A',
                  border: '1px solid rgba(251, 195, 36, 0.35)',
                  color: '#FBC324',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <FileDown size={12} />
                <span>Stand PNG</span>
              </a>
              <a
                href={`/api/admin/qr/artwork?file=pdf&pin=${encodeURIComponent(pinInput || '9999')}`}
                target="_blank"
                rel="noopener noreferrer"
                download="little-monkey-table-qrs.pdf"
                style={{
                  padding: '8px 6px',
                  borderRadius: '8px',
                  backgroundColor: '#1E1D1A',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#FAF7F2',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <FileDown size={12} />
                <span>All PDF</span>
              </a>
            </div>

            {/* Launch Table Action */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleLaunchTable(selectedQrTable.entryUrl)}
                style={{
                  flex: 1,
                  padding: '11px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#FFC21A',
                  color: '#080808',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <ExternalLink size={14} />
                <span>Launch Table Session</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedQrTable(null)}
                style={{
                  padding: '11px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#1E1D1A',
                  color: '#FAF7F2',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface TableQrRequiredGateProps {
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

  const [isSpringing, setIsSpringing] = useState(false);

  const handleOpenScanner = () => {
    if (onOpenScanner) {
      onOpenScanner();
    }
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/scanner');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleScannerClick = () => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      handleOpenScanner();
      return;
    }

    setIsSpringing(true);
    // Allow spring physics release before transitioning into full-screen scanner
    setTimeout(() => {
      setIsSpringing(false);
      handleOpenScanner();
    }, 180);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#080706',
        backgroundImage:
          'radial-gradient(circle at 50% 16%, rgba(255, 194, 26, 0.05) 0%, transparent 60%), radial-gradient(ellipse at 50% 96%, rgba(255, 194, 26, 0.16) 0%, rgba(120, 75, 0, 0.06) 45%, transparent 70%)',
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
          background: 'radial-gradient(ellipse at center, rgba(255, 194, 26, 0.08) 0%, rgba(255, 194, 26, 0.02) 50%, transparent 75%)',
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

      {/* RECREATED PREMIUM YELLOW BOTTOM SCANNER DOCK (Matching Reference Image) */}
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
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)',
          paddingLeft: '16px',
          paddingRight: '16px',
          boxSizing: 'border-box',
        }}
      >
        <div
          className={`lm-scanner-dock-wrap ${isSpringing ? 'lm-dock-springing' : ''}`}
          style={{
            pointerEvents: 'auto',
            position: 'relative',
            width: '100%',
            maxWidth: '360px',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: 'drop-shadow(0 16px 36px rgba(0, 0, 0, 0.9)) drop-shadow(0 4px 18px rgba(255, 194, 26, 0.25))',
          }}
        >
          {/* Subtle warm ambient glow right behind the dock */}
          <div
            style={{
              position: 'absolute',
              inset: '-30px -15px -20px -15px',
              background: 'radial-gradient(ellipse at 50% 60%, rgba(255, 194, 26, 0.20) 0%, rgba(120, 75, 0, 0.07) 50%, transparent 75%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* Yellow Scoop SVG Surface */}
          <svg
            viewBox="0 0 360 64"
            preserveAspectRatio="none"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <defs>
              <linearGradient id="lmDockGrad" x1="180" y1="0" x2="180" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFD34D" />
                <stop offset="14%" stopColor="#FFC21A" />
                <stop offset="85%" stopColor="#F5AE00" />
                <stop offset="100%" stopColor="#DF9800" />
              </linearGradient>
              <linearGradient id="lmHighlightGrad" x1="0" y1="0" x2="360" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                <stop offset="35%" stopColor="rgba(255,255,255,0.75)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.15)" />
                <stop offset="65%" stopColor="rgba(255,255,255,0.75)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.4)" />
              </linearGradient>
            </defs>
            {/* Main Yellow Pill Body with contoured notch */}
            <path
              d="M 32,0 L 126,0 C 146,0 148,46 180,46 C 212,46 214,0 234,0 L 328,0 A 32,32 0 0,1 360,32 A 32,32 0 0,1 328,64 L 32,64 A 32,32 0 0,1 0,32 A 32,32 0 0,1 32,0 Z"
              fill="url(#lmDockGrad)"
            />
            {/* Highlight Rim along the upper contours */}
            <path
              d="M 32,1.2 L 126,1.2 C 145,1.2 147,46 180,46 C 213,46 215,1.2 234,1.2 L 328,1.2"
              stroke="url(#lmHighlightGrad)"
              strokeWidth="1.5"
              fill="none"
              opacity="0.65"
            />
            {/* Subtle Dark Notch Rim / Inset depth */}
            <path
              d="M 136,3 C 148,10 150,47 180,47 C 210,47 212,10 224,3"
              stroke="rgba(0,0,0,0.28)"
              strokeWidth="2.5"
              fill="none"
            />
          </svg>

          {/* Elevated Dark Circular Scanner Button in Center Notch */}
          <button
            type="button"
            onClick={handleScannerClick}
            aria-label="Scan Table QR Code"
            className={`lm-scanner-dock-btn ${isSpringing ? 'lm-btn-springing' : ''}`}
            style={{
              position: 'absolute',
              top: '-23px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '66px',
              height: '66px',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 50% 35%, #242220 0%, #151413 70%, #0d0c0b 100%)',
              border: '3.5px solid #FFC21A',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.6), 0 0 18px rgba(255, 194, 26, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.2), inset 0 -2px 4px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              zIndex: 2,
              boxSizing: 'border-box',
            }}
          >
            {/* Custom Scanning Reticle Icon Matching Reference */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 8.5V6C4 4.89543 4.89543 4 6 4H8.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15.5 4H18C19.1046 4 20 4.89543 20 6V8.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 15.5V18C4 19.1046 4.89543 20 6 20H8.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15.5 20H18C19.1046 20 20 19.1046 20 18V15.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </nav>

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
          <span>15-MINUTE DINING SESSION EXPIRED</span>
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
          Your 15-minute dining session for <strong style={{ color: '#FAF7F2' }}>{tableNumber}</strong> has ended. Digital dining sessions are time-bounded to maintain security and table availability.
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
            Simply scan the physical QR code on your table again to initiate a fresh 15-minute dining session.
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
