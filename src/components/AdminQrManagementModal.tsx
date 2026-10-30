import React, { useState, useEffect } from 'react';
import { X, Shield, RefreshCw, AlertTriangle, FileDown, CheckCircle2, Lock } from 'lucide-react';
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
    const url = `/api/admin/qr/export-pdf?mode=${mode}&pin=${encodeURIComponent(pinInput)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `little-monkey-tables-qr-${mode}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
                Physical Tables 01 – 06 • Server-Authorized 30-Min Access Protocol
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
                  </div>
                ))}
              </div>

              {/* PDF Export Actions */}
              <div
                style={{
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingTop: '18px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2', marginBottom: '2px' }}>
                    Print-Ready Vector Table Markers
                  </div>
                  <div style={{ fontSize: '11px', color: '#9C8C7E' }}>
                    A4 document containing scannable high-contrast vector codes for all 6 tables.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleDownloadPdf('staging')}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#262626',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#FAF7F2',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <FileDown size={14} />
                    <span>Download Staging PDF</span>
                  </button>

                  <button
                    onClick={() => handleDownloadPdf('production')}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#FBC324',
                      border: 'none',
                      color: '#080808',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <FileDown size={14} />
                    <span>Download Official Production PDF</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
