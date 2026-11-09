/**
 * Experimental Dual-Verification Scanner (QR Code + Optical Marker)
 * Performs real-time camera decoding of QR codes and simultaneous optical marker pattern matching.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Scan,
  ShieldCheck,
  RefreshCw,
  Info,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import {
  TABLE_MARKER_DEFINITIONS,
  extractMarkerFromCanvas,
  matchSampledMarker,
} from './markerEngine.ts';
import type { DualScanResult, TableMarkerDefinition } from './types.ts';

interface ExperimentalScannerProps {
  onBack: () => void;
  expectedTable?: string | null;
}

export const ExperimentalScanner: React.FC<ExperimentalScannerProps> = ({
  onBack,
  expectedTable = null,
}) => {
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetFilterTable, setTargetFilterTable] = useState<string>(expectedTable || 'ALL');

  // Real-time scan telemetry
  const [latestScan, setLatestScan] = useState<DualScanResult>({
    timestamp: Date.now(),
    qrDetected: false,
    qrDecoded: false,
    qrTableClaimed: null,
    qrPayload: null,
    markerDetected: false,
    markerMatched: false,
    markerIdDetected: null,
    markerConfidence: 0,
    verdict: 'SEARCHING',
    verdictReason: 'Position the dual-verification stand inside the viewfinder.',
  });

  const [scanHistory, setScanHistory] = useState<DualScanResult[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const isTerminatedRef = useRef<boolean>(false);
  const lastRecordedVerdictRef = useRef<string | null>(null);
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  });

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    isTerminatedRef.current = true;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        const vStream = videoRef.current.srcObject as MediaStream | null;
        if (vStream && typeof vStream.getTracks === 'function') {
          vStream.getTracks().forEach((track) => {
            try {
              track.stop();
              track.enabled = false;
            } catch {}
          });
        }
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {}
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Request camera and initiate frame processing loop
  const startCamera = useCallback(async () => {
    isTerminatedRef.current = false;
    stopCamera();
    isTerminatedRef.current = false;
    setCameraState('requesting');
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!isMountedRef.current || isTerminatedRef.current) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
            t.enabled = false;
          } catch {}
        });
        return;
      }

      streamRef.current = stream;
      setCameraState('active');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      stopCamera();
      if (!isMountedRef.current || isTerminatedRef.current) return;
      setCameraState('error');
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied in your browser.'
          : err.message || 'Unable to access device camera.'
      );
    }
  }, [stopCamera]);

  // Main frame analysis loop
  const processFrame = useCallback(() => {
    if (!videoRef.current || videoRef.current.readyState < 2 || isPaused) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const video = videoRef.current;
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const qrCode = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });

      if (qrCode && qrCode.data) {
        // Parse claimed table from URL (e.g. ?t=T01)
        let claimedTable = 'Unknown';
        const urlMatch = qrCode.data.match(/[?&]t=([Tt]?\d+)/i);
        if (urlMatch) {
          const num = parseInt(urlMatch[1].replace(/t/i, ''), 10);
          claimedTable = `Table ${String(num).padStart(2, '0')}`;
        }

        // Expected marker for claimed table
        const expectedDef = TABLE_MARKER_DEFINITIONS.find(
          (d) => d.tableNumber.toLowerCase() === claimedTable.toLowerCase()
        );

        // Extract and analyze optical marker from canvas relative to QR corners
        const markerExtraction = extractMarkerFromCanvas(ctx, {
          topLeft: qrCode.location.topLeftCorner,
          topRight: qrCode.location.topRightCorner,
          bottomLeft: qrCode.location.bottomLeftCorner,
          bottomRight: qrCode.location.bottomRightCorner,
        });

        let markerDetected = false;
        let markerMatched = false;
        let markerIdDetected: string | null = null;
        let markerConfidence = 0;
        let verdict: DualScanResult['verdict'] = 'SEARCHING';
        let verdictReason = '';

        if (markerExtraction.markerFound && markerExtraction.sampledBits) {
          const matchResult = matchSampledMarker(markerExtraction.sampledBits);
          markerDetected = matchResult.isDetected;
          markerIdDetected = matchResult.detectedMarkerId;
          markerConfidence = matchResult.confidenceScore;

          if (markerDetected && expectedDef) {
            if (markerIdDetected === expectedDef.markerId) {
              markerMatched = true;
              verdict = 'VERIFIED';
              verdictReason = `${claimedTable} verified: QR code and ${markerIdDetected} match perfectly (${Math.round(markerConfidence * 100)}% match).`;
            } else {
              markerMatched = false;
              verdict = 'REJECTED_MISMATCH';
              verdictReason = `Marker Mismatch: QR claims ${claimedTable} (${expectedDef.markerId}), but camera detected ${markerIdDetected}.`;
            }
          } else {
            markerMatched = false;
            verdict = 'REJECTED_MISMATCH';
            verdictReason = `Optical pattern unrecognized or degraded (confidence ${Math.round(markerConfidence * 100)}%).`;
          }
        } else {
          // QR was found, but NO optical marker detected! (e.g. photo cropped to just QR)
          markerDetected = false;
          markerMatched = false;
          verdict = 'REJECTED_NO_MARKER';
          verdictReason = `Table QR detected, but optical marker was missing or cropped out. Dual-verification rejected.`;
        }

        const scanResult: DualScanResult = {
          timestamp: Date.now(),
          qrDetected: true,
          qrDecoded: true,
          qrTableClaimed: claimedTable,
          qrPayload: qrCode.data,
          markerDetected,
          markerMatched,
          markerIdDetected,
          markerConfidence,
          verdict,
          verdictReason,
        };

        setLatestScan(scanResult);

        // Record distinct verdicts to history
        const key = `${claimedTable}_${verdict}_${markerIdDetected}`;
        if (key !== lastRecordedVerdictRef.current) {
          lastRecordedVerdictRef.current = key;
          setScanHistory((prev) => [scanResult, ...prev.slice(0, 19)]);
        }
      } else {
        setLatestScan((prev) => ({
          ...prev,
          qrDetected: false,
          verdict: 'SEARCHING',
          verdictReason: 'Aim camera at dual-verification stand. Center both QR code and optical marker in frame.',
        }));
      }
    } catch {
      // Frame decode exception ignored
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [isPaused]);

  useEffect(() => {
    isMountedRef.current = true;
    isTerminatedRef.current = false;
    startCamera();

    const handlePageHide = () => {
      stopCamera();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopCamera();
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (cameraState === 'active') {
      animFrameRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraState, processFrame]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#080808',
        color: '#FAF7F2',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Top Glassmorphic Navigation Bar */}
      <header
        style={{
          width: '100%',
          backgroundColor: 'rgba(18, 16, 14, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 194, 26, 0.25)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          onClick={() => {
            stopCamera();
            if (onBackRef.current) onBackRef.current();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '999px',
            color: '#FAF7F2',
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} style={{ color: '#FFC21A' }} />
          <span>Exit Scanner</span>
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#FFC21A', fontSize: '13px', fontWeight: 800, letterSpacing: '0.04em' }}>
            EXPERIMENTAL DUAL-SCANNER
          </div>
          <div style={{ color: '#9C8C7E', fontSize: '11px' }}>QR Code + Optical Marker Recognition</div>
        </div>

        <button
          type="button"
          onClick={() => setIsPaused((prev) => !prev)}
          style={{
            backgroundColor: isPaused ? 'rgba(255, 194, 26, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            border: `1px solid ${isPaused ? '#FFC21A' : 'rgba(255, 255, 255, 0.16)'}`,
            borderRadius: '8px',
            color: isPaused ? '#FFC21A' : '#D4CEB8',
            padding: '8px 14px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {isPaused ? 'Resume' : 'Freeze'}
        </button>
      </header>

      {/* Main Container */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px',
          maxWidth: '560px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Camera Viewfinder Card */}
        <div
          style={{
            width: '100%',
            aspectRatio: '3 / 4',
            maxHeight: '440px',
            backgroundColor: '#000000',
            borderRadius: '24px',
            overflow: 'hidden',
            position: 'relative',
            border: '2px solid rgba(255, 194, 26, 0.5)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 24px rgba(255, 194, 26, 0.2)',
            marginBottom: '16px',
          }}
        >
          {cameraState === 'active' ? (
            <>
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />

              {/* Viewfinder Target Reticles */}
              {/* 1. Primary QR Reticle (Upper Half) */}
              <div
                style={{
                  position: 'absolute',
                  top: '12%',
                  left: '16%',
                  right: '16%',
                  height: '42%',
                  border: `2px dashed ${latestScan.qrDetected ? '#10B981' : '#FFC21A'}`,
                  borderRadius: '16px',
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                  boxShadow: latestScan.qrDetected
                    ? '0 0 16px rgba(16, 185, 129, 0.4)'
                    : '0 0 12px rgba(255, 194, 26, 0.25)',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '12px',
                    backgroundColor: '#080808',
                    color: latestScan.qrDetected ? '#10B981' : '#FFC21A',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {latestScan.qrDetected ? '✓ QR CODE DETECTED' : '1. FRAME TABLE QR'}
                </span>
              </div>

              {/* 2. Secondary Optical Marker Reticle (Lower Half) */}
              <div
                style={{
                  position: 'absolute',
                  top: '58%',
                  left: '24%',
                  right: '24%',
                  height: '32%',
                  border: `2px dashed ${
                    latestScan.markerMatched ? '#10B981' : latestScan.markerDetected ? '#F59E0B' : '#06B6D4'
                  }`,
                  borderRadius: '14px',
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                  boxShadow: latestScan.markerMatched
                    ? '0 0 16px rgba(16, 185, 129, 0.4)'
                    : '0 0 12px rgba(6, 182, 212, 0.25)',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '12px',
                    backgroundColor: '#080808',
                    color: latestScan.markerMatched
                      ? '#10B981'
                      : latestScan.markerDetected
                      ? '#F59E0B'
                      : '#06B6D4',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {latestScan.markerMatched
                    ? '✓ MARKER MATCHED'
                    : latestScan.markerDetected
                    ? '⚠ MARKER DETECTED'
                    : '2. FRAME OPTICAL MARKER'}
                </span>
              </div>
            </>
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                textAlign: 'center',
              }}
            >
              {cameraState === 'error' ? (
                <>
                  <CameraOff size={42} style={{ color: '#F87171', marginBottom: '12px' }} />
                  <div style={{ color: '#F87171', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>
                    Camera Access Required
                  </div>
                  <div style={{ color: '#9C8C7E', fontSize: '12px', marginBottom: '16px', maxWidth: '300px' }}>
                    {errorMessage}
                  </div>
                  <button
                    type="button"
                    onClick={startCamera}
                    style={{
                      backgroundColor: '#FFC21A',
                      color: '#080808',
                      border: 'none',
                      padding: '10px 18px',
                      borderRadius: '10px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Retry Camera
                  </button>
                </>
              ) : (
                <>
                  <Camera size={42} style={{ color: '#FFC21A', marginBottom: '12px' }} />
                  <div style={{ color: '#FAF7F2', fontSize: '14px', fontWeight: 700 }}>Starting Camera...</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Real-Time Dual-Verification Verdict Card */}
        <div
          style={{
            width: '100%',
            backgroundColor:
              latestScan.verdict === 'VERIFIED'
                ? 'rgba(16, 185, 129, 0.12)'
                : latestScan.verdict === 'REJECTED_MISMATCH' || latestScan.verdict === 'REJECTED_NO_MARKER'
                ? 'rgba(239, 68, 68, 0.12)'
                : 'rgba(255, 255, 255, 0.05)',
            border: `1.5px solid ${
              latestScan.verdict === 'VERIFIED'
                ? 'rgba(16, 185, 129, 0.5)'
                : latestScan.verdict === 'REJECTED_MISMATCH' || latestScan.verdict === 'REJECTED_NO_MARKER'
                ? 'rgba(239, 68, 68, 0.5)'
                : 'rgba(255, 194, 26, 0.3)'
            }`,
            borderRadius: '18px',
            padding: '16px 18px',
            boxSizing: 'border-box',
            marginBottom: '16px',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {latestScan.verdict === 'VERIFIED' ? (
                <CheckCircle2 size={20} style={{ color: '#10B981' }} />
              ) : latestScan.verdict === 'REJECTED_MISMATCH' || latestScan.verdict === 'REJECTED_NO_MARKER' ? (
                <XCircle size={20} style={{ color: '#EF4444' }} />
              ) : (
                <Scan size={20} style={{ color: '#FFC21A' }} />
              )}
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  color:
                    latestScan.verdict === 'VERIFIED'
                      ? '#10B981'
                      : latestScan.verdict === 'REJECTED_MISMATCH' || latestScan.verdict === 'REJECTED_NO_MARKER'
                      ? '#EF4444'
                      : '#FFC21A',
                }}
              >
                VERDICT: {latestScan.verdict.replace(/_/g, ' ')}
              </span>
            </div>

            {latestScan.qrTableClaimed && (
              <span
                style={{
                  backgroundColor: 'rgba(255, 194, 26, 0.15)',
                  color: '#FFC21A',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '6px',
                }}
              >
                {latestScan.qrTableClaimed}
              </span>
            )}
          </div>

          <div style={{ color: '#D4CEB8', fontSize: '12px', lineHeight: 1.45, marginBottom: '12px' }}>
            {latestScan.verdictReason}
          </div>

          {/* Diagnostic Metrics Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '11px',
            }}
          >
            <div>
              <span style={{ color: '#8A7D70' }}>QR Code: </span>
              <strong style={{ color: latestScan.qrDetected ? '#10B981' : '#F87171' }}>
                {latestScan.qrDetected ? 'DECODED' : 'NOT FOUND'}
              </strong>
            </div>

            <div>
              <span style={{ color: '#8A7D70' }}>Marker ID: </span>
              <strong style={{ color: latestScan.markerIdDetected ? '#FFC21A' : '#8A7D70' }}>
                {latestScan.markerIdDetected || 'NONE'}
              </strong>
            </div>

            <div>
              <span style={{ color: '#8A7D70' }}>Pattern Match: </span>
              <strong style={{ color: latestScan.markerMatched ? '#10B981' : '#F59E0B' }}>
                {Math.round(latestScan.markerConfidence * 100)}%
              </strong>
            </div>

            <div>
              <span style={{ color: '#8A7D70' }}>Binding Rule: </span>
              <strong style={{ color: latestScan.markerMatched ? '#10B981' : '#8A7D70' }}>
                {latestScan.markerMatched ? 'PASS' : 'FAIL'}
              </strong>
            </div>
          </div>
        </div>

        {/* Live Test History Feed */}
        <div
          style={{
            width: '100%',
            backgroundColor: '#12110F',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            boxSizing: 'border-box',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#FAF7F2', fontSize: '13px', fontWeight: 800 }}>
              Live Scan History ({scanHistory.length})
            </span>
            {scanHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setScanHistory([])}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9C8C7E',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>

          {scanHistory.length === 0 ? (
            <div style={{ color: '#8A7D70', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
              No dual scans recorded yet. Frame a table stand to record live telemetry.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {scanHistory.map((entry, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11.5px',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 800, color: '#FAF7F2' }}>{entry.qrTableClaimed || 'Unknown'}</span>
                    <span style={{ color: '#8A7D70', marginLeft: '6px' }}>{entry.markerIdDetected || 'No Marker'}</span>
                  </div>

                  <span
                    style={{
                      fontWeight: 800,
                      color:
                        entry.verdict === 'VERIFIED'
                          ? '#10B981'
                          : entry.verdict === 'REJECTED_MISMATCH' || entry.verdict === 'REJECTED_NO_MARKER'
                          ? '#EF4444'
                          : '#F59E0B',
                    }}
                  >
                    {entry.verdict.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
