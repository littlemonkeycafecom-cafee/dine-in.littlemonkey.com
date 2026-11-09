import React, { useState, useEffect } from 'react';
import { X, Shield, RefreshCw, AlertTriangle, FileDown, CheckCircle2, Lock, ExternalLink, Eye, Copy, Check, QrCode } from 'lucide-react';
import { QRCodeView } from '../lib/qrCode';

interface TableOverview {
  tableNumber: string;
  shortCode: string;
  zone: string;
  capacity: number;
  credentialId: string | null;
  isActive: boolean;
  createdAt: string | null;
  rotatedAt: string | null;
  revokedAt: string | null;
  rotationCount: number;
  activeSessionsCount: number;
  entryUrl?: string | null;
}

interface AdminQrManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminQrManagementModal: React.FC<AdminQrManagementModalProps> = ({ isOpen, onClose }) => {
  const [pinInput, setPinInput] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [tables, setTables] = useState<TableOverview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedTableQr, setSelectedTableQr] = useState<{ table: string; url: string } | null>(null);
  const [previewTable, setPreviewTable] = useState<TableOverview | null>(null);
  const [previewTab, setPreviewTab] = useState<'stand' | 'qr'>('stand');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const fetchTables = async (pin: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/qr/tables', {
        headers: { 'X-Operational-PIN': pin },
      });
      const data = await res.json();
      if (res.ok && data.tables) {
        setTables(data.tables);
        setIsAuthorized(true);
        setPinError(null);
      } else {
        setIsAuthorized(false);
        setPinError(data.message || 'Invalid administrator operational PIN.');
      }
    } catch {
      setPinError('Failed to communicate with QR administration service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;
    fetchTables(pinInput.trim());
  };

  const handleRotate = async (tableNumber: string) => {
    if (!confirm(`Rotate QR credential for ${tableNumber}? Any diners currently seated with the old QR code will be required to scan the new code.`)) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/qr/rotate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operational-PIN': pinInput,
        },
        body: JSON.stringify({ tableNumber }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccess(`Rotated ${tableNumber} credential successfully.`);
        if (data.entryUrl) {
          setSelectedTableQr({ table: tableNumber, url: data.entryUrl });
        }
        await fetchTables(pinInput);
      } else {
        alert(data.error || 'Failed to rotate credential.');
      }
    } catch {
      alert('Failed to rotate credential.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (tableNumber: string) => {
    if (!confirm(`Revoke QR credential for ${tableNumber}? This will immediately terminate all active dining sessions at this table.`)) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/qr/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operational-PIN': pinInput,
        },
        body: JSON.stringify({ tableNumber }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccess(`Revoked ${tableNumber} QR credential.`);
        setSelectedTableQr(null);
        await fetchTables(pinInput);
      } else {
        alert(data.error || 'Failed to revoke credential.');
      }
    } catch {
      alert('Failed to revoke credential.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = (mode: 'staging' | 'production') => {
    handleSecureDownload(`/api/admin/qr/export-pdf?mode=${mode}`, `little-monkey-tables-qr-${mode}.pdf`);
  };

  const handleSecureDownload = async (endpoint: string, filename: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(endpoint, {
        headers: { 'X-Operational-PIN': pinInput },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Download authorization failed.');
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      alert('Network error downloading artwork.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

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
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          backgroundColor: '#121212',
          border: '1px solid rgba(251, 195, 36, 0.35)',
          borderRadius: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)',
          color: '#FAF7F2',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#161616',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(251, 195, 36, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FBC324',
              }}
            >
              <Shield size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, letterSpacing: '0.04em' }}>
                ADMINISTRATIVE TABLE QR MANAGEMENT
              </h2>
              <span style={{ fontSize: '11px', color: '#9C8C7E' }}>
                Physical Tables 01 – 10 • Server-Authorized 15-Min Access Protocol
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Admin Modal"
            style={{
              background: 'none',
              border: 'none',
              color: '#A8A196',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '22px' }}>
          {!isAuthorized ? (
            /* PIN Gate */
            <form onSubmit={handlePinSubmit} style={{ maxWidth: '340px', margin: '30px auto', textAlign: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(251, 195, 36, 0.1)',
                  border: '1px solid rgba(251, 195, 36, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#FBC324',
                }}
              >
                <Lock size={22} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>
                Enter Operational Admin PIN
              </h3>
              <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#9C8C7E' }}>
                Only authorized café administrators may view, rotate, or export table QR credentials.
              </p>

              <input
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter PIN (e.g. 9999)"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#1E1E1E',
                  border: '1px solid rgba(251, 195, 36, 0.3)',
                  color: '#FAF7F2',
                  fontSize: '15px',
                  textAlign: 'center',
                  letterSpacing: '0.2em',
                  marginBottom: '14px',
                  boxSizing: 'border-box',
                }}
              />

              {pinError && (
                <div style={{ color: '#F87171', fontSize: '12px', marginBottom: '14px' }}>
                  {pinError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#FBC324',
                  color: '#080808',
                  fontWeight: 700,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {isLoading ? 'Verifying...' : 'VERIFY & ACCESS QR MANAGER'}
              </button>
            </form>
          ) : (
            /* Tables Grid & Management */
            <div>
              {actionSuccess && (
                <div
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34D399',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '18px',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {/* Single Table QR Preview Card if rotated */}
              {selectedTableQr && (
                <div
                  style={{
                    backgroundColor: '#1A1A1A',
                    border: '1px solid #FBC324',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                  }}
                >
                  <div style={{ backgroundColor: '#FFFFFF', padding: '8px', borderRadius: '8px', flexShrink: 0 }}>
                    <QRCodeView value={selectedTableQr.url} size={110} />
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#FBC324', fontWeight: 800, textTransform: 'uppercase' }}>
                      NEW QR GENERATED FOR {selectedTableQr.table}
                    </span>
                    <p style={{ margin: '6px 0', fontSize: '11px', color: '#C5BCB3', wordBreak: 'break-all' }}>
                      {selectedTableQr.url}
                    </p>
                    <span style={{ fontSize: '10px', color: '#9C8C7E' }}>
                      This scannable QR payload has been activated on the server. Old QR codes for this table are now void.
                    </span>
                  </div>
                </div>
              )}

              {/* Tables Overview Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', marginBottom: '22px' }}>
                {tables.map((t) => (
                  <div
                    key={t.tableNumber}
                    style={{
                      backgroundColor: '#181818',
                      border: t.isActive ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '10px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: '#FAF7F2' }}>
                          {t.tableNumber} ({t.shortCode})
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '999px',
                            backgroundColor: t.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: t.isActive ? '#34D399' : '#F87171',
                            border: t.isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                          }}
                        >
                          {t.isActive ? 'ACTIVE' : 'REVOKED'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#9C8C7E', marginBottom: '4px' }}>
                        {t.zone} • {t.capacity} Seats
                      </div>
                      <div style={{ fontSize: '10px', color: '#786C60', marginBottom: '12px' }}>
                        Cred: {t.credentialId ? `${t.credentialId.slice(0, 14)}...` : 'None'} • Active Diners: {t.activeSessionsCount}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleRotate(t.tableNumber)}
                        disabled={isLoading}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(251, 195, 36, 0.12)',
                          border: '1px solid rgba(251, 195, 36, 0.35)',
                          color: '#FBC324',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                        }}
                      >
                        <RefreshCw size={12} />
                        <span>Rotate</span>
                      </button>
                      {t.isActive && (
                        <button
                          onClick={() => handleRevoke(t.tableNumber)}
                          disabled={isLoading}
                          style={{
                            padding: '7px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#F87171',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </div>

                    {/* Table Artwork Assets (PNG & SVG via Secure Header Auth) */}
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewTable(t);
                        setPreviewTab('stand');
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(251, 195, 36, 0.1)',
                        border: '1px solid rgba(251, 195, 36, 0.35)',
                        color: '#FBC324',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        marginTop: '8px',
                      }}
                    >
                      <Eye size={12} />
                      <span>Preview Tabletop Stand</span>
                    </button>

                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        marginTop: '6px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.07)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSecureDownload(`/api/admin/qr/artwork?table=${t.shortCode}&format=png`, `table-${t.shortCode.toLowerCase()}.png`)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#201F1D',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#FAF7F2',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <FileDown size={11} />
                        <span>PNG</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSecureDownload(`/api/admin/qr/artwork?table=${t.shortCode}&format=svg`, `table-${t.shortCode.toLowerCase()}.svg`)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#201F1D',
                          border: '1px solid rgba(251, 195, 36, 0.25)',
                          color: '#FBC324',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <FileDown size={11} />
                        <span>SVG</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Table Stand Artwork Preview Modal */}
              {previewTable && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10001,
                    backgroundColor: 'rgba(0, 0, 0, 0.88)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                  }}
                  onClick={() => setPreviewTable(null)}
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
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div style={{ textAlign: 'left' }}>
                        <h3 style={{ margin: 0, fontSize: '17px', color: '#FAF7F2', fontWeight: 800 }}>
                          {previewTable.tableNumber} ({previewTable.shortCode}) Stand Artwork
                        </h3>
                        <span style={{ fontSize: '11px', color: '#9C8C7E' }}>{previewTable.zone} • Capacity: {previewTable.capacity} Diners</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewTable(null)}
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

                    {/* Segmented Control */}
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

                    {/* Active Tab View */}
                    {previewTab === 'stand' ? (
                      <div>
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
                            src={`/api/admin/qr/artwork?table=${previewTable.shortCode}&format=svg&pin=${encodeURIComponent(pinInput)}&inline=1`}
                            alt={`${previewTable.tableNumber} Tabletop Stand Artwork`}
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
                          <QRCodeView
                            value={previewTable.entryUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/?t=${previewTable.shortCode}`}
                            size={210}
                          />
                        </div>
                        <div style={{ fontSize: '11px', color: '#9C8C7E', marginBottom: '12px' }}>
                          Pure QR Code Module • For custom manufacturing or digital kiosks
                        </div>
                      </div>
                    )}

                    {/* Download Actions */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <button
                        type="button"
                        onClick={() => handleSecureDownload(`/api/admin/qr/artwork?table=${previewTable.shortCode}&format=svg`, `table-${previewTable.shortCode.toLowerCase()}.svg`)}
                        style={{
                          padding: '8px 6px',
                          borderRadius: '8px',
                          backgroundColor: '#1E1D1A',
                          border: '1px solid rgba(251, 195, 36, 0.35)',
                          color: '#FBC324',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <FileDown size={12} />
                        <span>Stand SVG</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSecureDownload(`/api/admin/qr/artwork?table=${previewTable.shortCode}&format=png`, `table-${previewTable.shortCode.toLowerCase()}.png`)}
                        style={{
                          padding: '8px 6px',
                          borderRadius: '8px',
                          backgroundColor: '#1E1D1A',
                          border: '1px solid rgba(251, 195, 36, 0.35)',
                          color: '#FBC324',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <FileDown size={12} />
                        <span>Stand PNG</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSecureDownload('/api/admin/qr/artwork?file=pdf', 'little-monkey-table-qrs.pdf')}
                        style={{
                          padding: '8px 6px',
                          borderRadius: '8px',
                          backgroundColor: '#1E1D1A',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#FAF7F2',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <FileDown size={12} />
                        <span>All PDF</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPreviewTable(null)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        backgroundColor: '#1E1D1A',
                        color: '#FAF7F2',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        cursor: 'pointer',
                      }}
                    >
                      Close Preview
                    </button>
                  </div>
                </div>
              )}

              {/* Artwork & Printable Documents Management */}
              <div
                style={{
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingTop: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#FAF7F2', marginBottom: '2px' }}>
                      Authoritative Café QR Artwork & Print Files
                    </div>
                    <div style={{ fontSize: '11px', color: '#9C8C7E' }}>
                      Pre-generated vector SVGs, high-res PNGs, printable A4 PDF, and the full design studio preview in <code>storage/qr-codes/</code>.
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <a
                      href={`/api/admin/qr/artwork?file=html&pin=${encodeURIComponent(pinInput)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#22201D',
                        border: '1px solid rgba(251, 195, 36, 0.3)',
                        color: '#FBC324',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ExternalLink size={13} />
                      <span>Open Preview Studio</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleSecureDownload('/api/admin/qr/artwork?file=pdf', 'little-monkey-table-qrs.pdf')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#FBC324',
                        color: '#080808',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <FileDown size={13} />
                      <span>Download Printable PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSecureDownload('/api/admin/qr/artwork?file=manifest', 'little-monkey-qr-manifest.json')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#1E1E1E',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#FAF7F2',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <FileDown size={13} />
                      <span>Download Manifest JSON</span>
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#161514',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '11px', color: '#9C8C7E' }}>
                    Generate fresh dynamic vector marker sheets:
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleDownloadPdf('staging')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#262626',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#FAF7F2',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <FileDown size={12} />
                      <span>Export Staging Sheet</span>
                    </button>
                    <button
                      onClick={() => handleDownloadPdf('production')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(251, 195, 36, 0.15)',
                        border: '1px solid rgba(251, 195, 36, 0.35)',
                        color: '#FBC324',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <FileDown size={12} />
                      <span>Export Production Sheet</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
