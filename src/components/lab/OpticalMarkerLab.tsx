/**
 * Little Monkey Café — QR + Optical Marker Laboratory
 * Complete interactive experimental prototype for 10 table-specific QR and optical marker designs.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  FlaskConical,
  Download,
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Layers,
  Sparkles,
  ExternalLink,
  Shield,
  FileCode,
  Smartphone,
  Eye,
  RefreshCw,
  QrCode,
  MapPin,
  Lock,
} from 'lucide-react';
import { TABLE_MARKER_DEFINITIONS, matchSampledMarker } from './markerEngine.ts';
import { renderStandCardToCanvas, generateStandCardSVG } from './markerArtworkGenerator.ts';
import { createZipArchive } from './zipGenerator.ts';
import { ExperimentalScanner } from './ExperimentalScanner.tsx';
import type { TableMarkerDefinition, TestScenario } from './types.ts';

interface OpticalMarkerLabProps {
  onBack: () => void;
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'TEST_A',
    name: 'Test A — Original QR Only',
    subtitle: 'Standard QR scan without optical marker',
    description: 'Scanning a physical or digital QR code that lacks the table-specific optical marker beside it.',
    qrPresence: true,
    markerPresence: false,
    markerMatchesTable: null,
    isCropped: true,
    isCompleteStandPhoto: false,
    expectedVerdict: 'REJECTED',
    expectedReason: 'QR decoded, but optical marker was missing. Dual-verification rejected.',
    securityObservation: 'Successfully prevents single QR copies and plain URL sharing from passing.',
  },
  {
    id: 'TEST_B',
    name: 'Test B — Correct QR + Correct Marker',
    subtitle: 'Table 01 QR with Table 01 Marker (MKR-T01-SOLAR)',
    description: 'Scanning genuine dual-verification stand containing both matching QR code and optical marker.',
    qrPresence: true,
    markerPresence: true,
    markerMatchesTable: true,
    isCropped: false,
    isCompleteStandPhoto: false,
    expectedVerdict: 'VERIFIED',
    expectedReason: 'Table 01 verified: QR code and MKR-T01-SOLAR match with 100% confidence.',
    securityObservation: 'Normal legitimate customer workflow: unlocks dining session.',
  },
  {
    id: 'TEST_C',
    name: 'Test C — Correct QR + Wrong Marker',
    subtitle: 'Table 01 QR with Table 02 Marker (MKR-T02-HEXA)',
    description: 'An attacker pastes another table\'s optical marker next to Table 01\'s QR code.',
    qrPresence: true,
    markerPresence: true,
    markerMatchesTable: false,
    isCropped: false,
    isCompleteStandPhoto: false,
    expectedVerdict: 'REJECTED',
    expectedReason: 'Marker mismatch: QR claims Table 01 (MKR-T01), but camera detected MKR-T02.',
    securityObservation: 'Cross-table spoofing is detected immediately by pattern disagreement.',
  },
  {
    id: 'TEST_D',
    name: 'Test D — Cropped QR Photograph',
    subtitle: 'Photograph cropped to just the QR square',
    description: 'A customer photographs only the QR code from their seat and sends it to an off-site friend.',
    qrPresence: true,
    markerPresence: false,
    markerMatchesTable: null,
    isCropped: true,
    isCompleteStandPhoto: false,
    expectedVerdict: 'REJECTED',
    expectedReason: 'Optical marker region contains only background or noise. Rejected.',
    securityObservation: 'Prevents standard smartphone crop-and-share attacks.',
  },
  {
    id: 'TEST_E',
    name: 'Test E — Complete Stand Photograph',
    subtitle: 'High-res photo containing BOTH QR code and Optical Marker',
    description: 'A customer photographs the complete stand (both QR and marker) and displays it on another phone screen.',
    qrPresence: true,
    markerPresence: true,
    markerMatchesTable: true,
    isCropped: false,
    isCompleteStandPhoto: true,
    expectedVerdict: 'VERIFIED',
    expectedReason: 'Static pattern recognition succeeds because the photo contains the static marker.',
    securityObservation: 'CRITICAL SECURITY FINDING: A static optical marker CANNOT defeat a complete photograph. Static photons on camera cannot prove physical presence without temporal challenges.',
  },
  {
    id: 'TEST_F',
    name: 'Test F — Multi-Angle Camera Skew & Tilt',
    subtitle: 'Scanning at 30° perspective slant and 90° rotation',
    description: 'Evaluates rotational invariance and perspective tolerance when the phone is held at an angle.',
    qrPresence: true,
    markerPresence: true,
    markerMatchesTable: true,
    isCropped: false,
    isCompleteStandPhoto: false,
    expectedVerdict: 'VERIFIED',
    expectedReason: '4-way 90-degree matrix rotation matching maintains >92% pattern correlation.',
    securityObservation: 'Good ergonomics: customers do not need to hold their phone perfectly level.',
  },
  {
    id: 'TEST_G',
    name: 'Test G — Mobile-to-Mobile Display Scan',
    subtitle: 'Scanning downloaded stand image on another phone\'s OLED display',
    description: 'Open a downloaded experimental PNG on Phone A, and scan it with Phone B.',
    qrPresence: true,
    markerPresence: true,
    markerMatchesTable: true,
    isCropped: false,
    isCompleteStandPhoto: true,
    expectedVerdict: 'VERIFIED',
    expectedReason: 'OLED subpixel matrix displays both 2D patterns; camera binarizes them cleanly.',
    securityObservation: 'Confirms that digital screen replays pass static 2D optical checks.',
  },
];

export const OpticalMarkerLab: React.FC<OpticalMarkerLabProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'designs' | 'scanner' | 'matrix' | 'security' | 'tunnel'>('designs');
  const [selectedTable, setSelectedTable] = useState<TableMarkerDefinition>(TABLE_MARKER_DEFINITIONS[0]);
  const [isGeneratingZip, setIsGeneratingZip] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<TestScenario | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render the selected table card to canvas preview
  useEffect(() => {
    if (previewCanvasRef.current && selectedTable) {
      renderStandCardToCanvas(previewCanvasRef.current, selectedTable, {
        width: 800,
        height: 1200,
      });
    }
  }, [selectedTable]);

  // Download high-resolution PNG for a specific table
  const handleDownloadPNG = (table: TableMarkerDefinition) => {
    const canvas = document.createElement('canvas');
    renderStandCardToCanvas(canvas, table, { width: 1200, height: 1600 });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `little-monkey-${table.shortCode.toLowerCase()}-qr-marker.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  // Download crisp SVG vector card for a specific table
  const handleDownloadSVG = (table: TableMarkerDefinition) => {
    const svgStr = generateStandCardSVG(table);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `little-monkey-${table.shortCode.toLowerCase()}-qr-marker.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate and download all 10 designs in a zero-dependency .ZIP file
  const handleDownloadAllZip = async () => {
    setIsGeneratingZip(true);
    try {
      const zipFiles: Array<{ name: string; data: Uint8Array }> = [];

      for (const table of TABLE_MARKER_DEFINITIONS) {
        const canvas = document.createElement('canvas');
        renderStandCardToCanvas(canvas, table, { width: 800, height: 1200 });

        // Convert canvas to png binary buffer
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        zipFiles.push({
          name: `little-monkey-${table.shortCode.toLowerCase()}-stand-qr-marker.png`,
          data: bytes,
        });
      }

      // Create ZIP archive
      const zipData = createZipArchive(zipFiles);
      const blob = new Blob([zipData.buffer as ArrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'little-monkey-experimental-marker-tables.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  if (activeTab === 'scanner') {
    return (
      <ExperimentalScanner
        onBack={() => setActiveTab('designs')}
        expectedTable={selectedTable.tableNumber}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0A0908',
        color: '#FAF7F2',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          width: '100%',
          backgroundColor: '#12100E',
          borderBottom: '1px solid rgba(255, 194, 26, 0.25)',
          padding: '16px 20px',
          boxSizing: 'border-box',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '8px',
                color: '#FAF7F2',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={16} style={{ color: '#FFC21A' }} />
              <span>Back to Café</span>
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FlaskConical size={20} style={{ color: '#FFC21A' }} />
                <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '18px', fontWeight: 800, margin: 0, color: '#FAF7F2' }}>
                  QR + Optical Marker Laboratory
                </h1>
                <span
                  style={{
                    backgroundColor: 'rgba(255, 194, 26, 0.15)',
                    color: '#FFC21A',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  PROTOTYPE
                </span>
              </div>
              <div style={{ color: '#9C8C7E', fontSize: '12px', marginTop: '2px' }}>
                Experimental research investigating table-specific optical markers alongside physical QR codes.
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleDownloadAllZip}
              disabled={isGeneratingZip}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#FFC21A',
                color: '#080808',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 16px',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: isGeneratingZip ? 'wait' : 'pointer',
                boxShadow: '0 4px 14px rgba(255, 194, 26, 0.35)',
              }}
            >
              <Download size={15} />
              <span>{isGeneratingZip ? 'Packaging ZIP...' : 'Download All 10 (.ZIP)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('scanner')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#FAF7F2',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                padding: '10px 16px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Camera size={15} style={{ color: '#FFC21A' }} />
              <span>Launch Dual-Scanner</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav
          style={{
            maxWidth: '1200px',
            margin: '14px auto 0 auto',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}
        >
          {[
            { id: 'designs', label: '10 Table Designs & Downloads', icon: Layers },
            { id: 'matrix', label: 'Test Matrix (Scenarios A–G)', icon: FlaskConical },
            { id: 'security', label: 'Security Reality & Limits', icon: Shield },
            { id: 'tunnel', label: 'Mobile Remote Testing Guide', icon: Smartphone },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: isActive ? 'rgba(255, 194, 26, 0.15)' : 'transparent',
                  color: isActive ? '#FFC21A' : '#9C8C7E',
                  border: `1px solid ${isActive ? 'rgba(255, 194, 26, 0.4)' : 'transparent'}`,
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px', width: '100%', boxSizing: 'border-box' }}>
        {/* ================================================================= */}
        {/* TAB 1: 10 TABLE DESIGNS & DOWNLOADS                                */}
        {/* ================================================================= */}
        {activeTab === 'designs' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0', color: '#FAF7F2' }}>
                  10 Table-Specific Optical Marker Designs
                </h2>
                <p style={{ color: '#9C8C7E', fontSize: '13px', margin: 0 }}>
                  Each table features an authentic ISO/IEC 18004 QR code paired with a unique 5×5 fiducial marker pattern.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#8A7D70' }}>Selected for Inspection:</span>
                <span style={{ backgroundColor: 'rgba(255, 194, 26, 0.15)', color: '#FFC21A', padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '12px' }}>
                  {selectedTable.tableNumber} ({selectedTable.markerId})
                </span>
              </div>
            </div>

            {/* Split Inspection View: Left Live Preview + Right 10 Table Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', alignItems: 'start' }}>
              {/* Stand Card Visual Inspector */}
              <div
                style={{
                  backgroundColor: '#12110F',
                  border: '1px solid rgba(255, 194, 26, 0.3)',
                  borderRadius: '20px',
                  padding: '20px',
                  boxSizing: 'border-box',
                  position: 'sticky',
                  top: '120px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Eye size={16} style={{ color: '#FFC21A' }} />
                    <span style={{ fontWeight: 800, fontSize: '13px', color: '#FAF7F2' }}>
                      Stand Card Render Preview
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleDownloadPNG(selectedTable)}
                      style={{
                        backgroundColor: '#FFC21A',
                        color: '#080808',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      PNG (High-Res)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadSVG(selectedTable)}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        color: '#FAF7F2',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Vector SVG
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#000000',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    justifyContent: 'center',
                    boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.8)',
                  }}
                >
                  <canvas
                    ref={previewCanvasRef}
                    style={{
                      width: '100%',
                      maxWidth: '340px',
                      height: 'auto',
                      borderRadius: '8px',
                      display: 'block',
                    }}
                  />
                </div>

                <div style={{ marginTop: '14px', fontSize: '11.5px', color: '#8A7D70', lineHeight: 1.5 }}>
                  💡 <strong style={{ color: '#FAF7F2' }}>Verification Mechanics:</strong> The QR payload points to Table{' '}
                  {selectedTable.shortCode}. The lower panel holds the {selectedTable.markerName} pattern matrix. The in-app dual scanner evaluates both in a single frame.
                </div>
              </div>

              {/* 10 Table Cards Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {TABLE_MARKER_DEFINITIONS.map((table) => {
                  const isSelected = selectedTable.shortCode === table.shortCode;
                  return (
                    <div
                      key={table.shortCode}
                      style={{
                        backgroundColor: isSelected ? 'rgba(255, 194, 26, 0.08)' : '#141311',
                        border: `1.5px solid ${isSelected ? '#FFC21A' : 'rgba(255, 255, 255, 0.08)'}`,
                        borderRadius: '16px',
                        padding: '16px 18px',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '14px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                        {/* 5x5 Matrix Miniature Visual */}
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            backgroundColor: '#FFFFFF',
                            border: `2px solid ${table.accentColor}`,
                            borderRadius: '8px',
                            padding: '3px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(5, 1fr)',
                            gap: '1px',
                            flexShrink: 0,
                            boxSizing: 'border-box',
                          }}
                        >
                          {table.patternBits.map((bit, bIdx) => (
                            <div
                              key={bIdx}
                              style={{
                                backgroundColor: bit === 1 ? '#000000' : '#FFFFFF',
                                width: '100%',
                                height: '100%',
                              }}
                            />
                          ))}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#FAF7F2', fontSize: '15px', fontWeight: 800 }}>
                              {table.tableNumber}
                            </span>
                            <span style={{ color: table.accentColor, fontSize: '11px', fontWeight: 800 }}>
                              {table.shortCode}
                            </span>
                            <span style={{ color: '#8A7D70', fontSize: '11.5px' }}>
                              • {table.zone} ({table.capacity} Diners)
                            </span>
                          </div>

                          <div style={{ color: '#FFC21A', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>
                            {table.markerName}
                          </div>

                          <div style={{ color: '#8A7D70', fontSize: '11px', marginTop: '2px' }}>
                            Pattern ID: <span style={{ fontFamily: 'monospace', color: '#D4CEB8' }}>{table.markerId}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setSelectedTable(table)}
                          style={{
                            backgroundColor: isSelected ? 'rgba(255, 194, 26, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                            border: `1px solid ${isSelected ? '#FFC21A' : 'rgba(255, 255, 255, 0.15)'}`,
                            color: isSelected ? '#FFC21A' : '#FAF7F2',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {isSelected ? 'Inspecting' : 'Inspect'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadPNG(table)}
                          title="Download PNG"
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#FAF7F2',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '11.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: TEST MATRIX (SCENARIOS A THROUGH G)                        */}
        {/* ================================================================= */}
        {activeTab === 'matrix' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '22px', fontWeight: 700, margin: '0 0 6px 0', color: '#FAF7F2' }}>
                Experimental Test Matrix (Scenarios A through G)
              </h2>
              <p style={{ color: '#9C8C7E', fontSize: '13px', margin: 0 }}>
                Rigorous testing framework comparing standard QR photography against dual-verification optical markers.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {TEST_SCENARIOS.map((scenario) => {
                const isSelected = activeScenario?.id === scenario.id;
                return (
                  <div
                    key={scenario.id}
                    onClick={() => setActiveScenario(scenario)}
                    style={{
                      backgroundColor: isSelected ? 'rgba(255, 194, 26, 0.08)' : '#141311',
                      border: `1.5px solid ${isSelected ? '#FFC21A' : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: '16px',
                      padding: '18px',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#FFC21A', fontSize: '13px', fontWeight: 800 }}>
                          {scenario.name}
                        </span>
                        <span
                          style={{
                            backgroundColor:
                              scenario.expectedVerdict === 'VERIFIED'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            color: scenario.expectedVerdict === 'VERIFIED' ? '#10B981' : '#EF4444',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          EXPECTED: {scenario.expectedVerdict}
                        </span>
                      </div>

                      <div style={{ color: '#FAF7F2', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                        {scenario.subtitle}
                      </div>

                      <p style={{ color: '#9C8C7E', fontSize: '12px', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                        {scenario.description}
                      </p>
                    </div>

                    <div
                      style={{
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        fontSize: '11.5px',
                        color: '#D4CEB8',
                        lineHeight: 1.45,
                      }}
                    >
                      <strong style={{ color: '#FAF7F2' }}>Outcome: </strong>
                      {scenario.expectedReason}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Scenario Inspector Modal / Card */}
            {activeScenario && (
              <div
                style={{
                  marginTop: '24px',
                  backgroundColor: '#181614',
                  border: '1.5px solid rgba(255, 194, 26, 0.4)',
                  borderRadius: '20px',
                  padding: '22px',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FlaskConical size={18} style={{ color: '#FFC21A' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FAF7F2', margin: 0 }}>
                      Inspection: {activeScenario.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveScenario(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9C8C7E',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Close Inspection
                  </button>
                </div>

                <div style={{ color: '#D4CEB8', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                  {activeScenario.description}
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 194, 26, 0.08)',
                    border: '1px solid rgba(255, 194, 26, 0.25)',
                    borderRadius: '12px',
                    padding: '14px',
                    fontSize: '12px',
                    lineHeight: 1.55,
                    color: '#FAF7F2',
                  }}
                >
                  <strong style={{ color: '#FFC21A' }}>Security Analysis: </strong>
                  {activeScenario.securityObservation}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: SECURITY REALITY & LIMITS                                   */}
        {/* ================================================================= */}
        {activeTab === 'security' && (
          <div style={{ textAlign: 'left', maxWidth: '840px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0', color: '#FAF7F2' }}>
              Scientific Security Reality & Physical Presence Limits
            </h2>
            <p style={{ color: '#9C8C7E', fontSize: '13.5px', lineHeight: 1.55, margin: '0 0 24px 0' }}>
              This laboratory prototypes optical marker verification to explore where computer vision helps, and where physical optics fundamentally encounter security boundaries.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Point 1 */}
              <div style={{ backgroundColor: '#141311', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFC21A', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
                  <Shield size={16} />
                  <span>1. Why Optical Markers Prevent Lazy Cropping, But NOT Complete Photos</span>
                </div>
                <p style={{ color: '#D4CEB8', fontSize: '12.5px', lineHeight: 1.55, margin: 0 }}>
                  A standard smartphone camera scanning only a QR code (Test A / Test D) will fail because the required optical marker is missing from the frame.
                  However, if a customer photographs the <strong>entire physical stand</strong> containing both the QR and the marker (Test E), a standard 2D camera will see both patterns and verify them. Photons reflecting from an OLED phone screen or photo print produce the identical 2D bit patterns.
                </p>
              </div>

              {/* Point 2 */}
              <div style={{ backgroundColor: '#141311', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFC21A', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
                  <Eye size={16} />
                  <span>2. The Limits of Moiré, Glare, and Perspective Depth Analysis</span>
                </div>
                <p style={{ color: '#D4CEB8', fontSize: '12.5px', lineHeight: 1.55, margin: 0 }}>
                  While computer vision algorithms can analyze specular reflection (glare on acrylic) or moiré screen fringing, real café environments feature warm spotlights, shadows, fingerprint smudges, and scratched stands.
                  Attempting to block photographed stands via glare or texture heuristics causes high false-rejection rates, frustrating genuine customers sitting at real tables.
                </p>
              </div>

              {/* Point 3 */}
              <div style={{ backgroundColor: '#141311', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
                  <CheckCircle2 size={16} />
                  <span>3. The True Zero-Cost Solution: Cryptographic Temporal Rotation</span>
                </div>
                <p style={{ color: '#D4CEB8', fontSize: '12.5px', lineHeight: 1.55, margin: 0 }}>
                  Physical stands cannot prove they are physical without changing over time. The most reliable, zero-cost, customer-friendly security in Little Monkey Café is:
                  <br />• <strong>Shift / Daily Credential Rotation:</strong> Staff rotates table credentials with one tap in the Admin modal (PIN: 9999). Old photos instantly fail with <code>QR Authorization Error</code>.
                  <br />• <strong>15-Minute Session Expiry:</strong> Active dining sessions strictly expire after 15 minutes, preventing stale access.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: MOBILE REMOTE TESTING GUIDE                                 */}
        {/* ================================================================= */}
        {activeTab === 'tunnel' && (
          <div style={{ textAlign: 'left', maxWidth: '840px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0', color: '#FAF7F2' }}>
              Mobile Remote Testing Guide (Temporary Cloudflare Tunnel)
            </h2>
            <p style={{ color: '#9C8C7E', fontSize: '13.5px', lineHeight: 1.55, margin: '0 0 24px 0' }}>
              To test the experimental dual scanner using a real smartphone camera, the browser requires a secure HTTPS origin.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: '#141311', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
                <div style={{ color: '#FFC21A', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
                  Step 1: Start a Temporary Development Tunnel
                </div>
                <p style={{ color: '#D4CEB8', fontSize: '12.5px', lineHeight: 1.55, margin: '0 0 10px 0' }}>
                  Run the installed <code>cloudflared</code> binary to establish a temporary, zero-configuration HTTPS tunnel to your local Vite server (port 3000):
                </p>
                <pre
                  style={{
                    backgroundColor: '#000000',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    color: '#FFC21A',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                  }}
                >
                  cloudflared tunnel --url http://127.0.0.1:3000
                </pre>
              </div>

              <div style={{ backgroundColor: '#141311', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
                <div style={{ color: '#FFC21A', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
                  Step 2: Open Laboratory on Your Mobile Device
                </div>
                <p style={{ color: '#D4CEB8', fontSize: '12.5px', lineHeight: 1.55, margin: '0 0 10px 0' }}>
                  Cloudflared outputs a temporary HTTPS URL (e.g. <code>https://random-words.trycloudflare.com</code>). Open this URL on your phone and navigate to:
                </p>
                <pre
                  style={{
                    backgroundColor: '#000000',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    color: '#FFC21A',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                  }}
                >
                  https://&lt;random-subdomain&gt;.trycloudflare.com/?lab=true
                </pre>
              </div>

              <div style={{ backgroundColor: 'rgba(255, 194, 26, 0.08)', border: '1px solid rgba(255, 194, 26, 0.3)', borderRadius: '14px', padding: '18px' }}>
                <div style={{ color: '#FFC21A', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
                  Step 3: Security & Isolation Safeguards
                </div>
                <p style={{ color: '#FAF7F2', fontSize: '12.5px', lineHeight: 1.55, margin: 0 }}>
                  • <strong>Zero DNS modifications:</strong> No production domains or Cloudflare account settings are touched.
                  <br />• <strong>Ephemeral lifetime:</strong> Terminating the cloudflared process immediately destroys the tunnel.
                  <br />• <strong>Strict Isolation:</strong> The laboratory is self-contained and does not expose production customer records.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
