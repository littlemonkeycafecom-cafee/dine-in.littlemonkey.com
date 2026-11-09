import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
  Lock,
} from 'lucide-react';
import { verifyScannedQr } from '../services/auth';

export type ScannerState =
  | 'initializing'
  | 'scanning'
  | 'verifying'
  | 'success'
  | 'rejected'
  | 'permission_denied'
  | 'os_permission_denied'
  | 'no_camera'
  | 'camera_in_use'
  | 'insecure_context'
  | 'unsupported_browser'
  | 'timeout';

interface InBuiltQrScannerProps {
  onSuccess?: (result: { tableNumber: string; qrProofToken: string; credentialId: string }) => void;
  onCancel?: () => void;
}

export const InBuiltQrScanner: React.FC<InBuiltQrScannerProps> = ({ onSuccess, onCancel }) => {
  const [state, setState] = useState<ScannerState>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedTable, setVerifiedTable] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const attachTimeoutRef = useRef<any>(null);
  const isProcessingRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const isTerminatedRef = useRef<boolean>(false);
  const permissionStatusRef = useRef<PermissionStatus | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCancelRef.current = onCancel;
  });

  // Stop all camera hardware tracks cleanly, clear video srcObject, and cancel loops
  const stopCamera = useCallback(() => {
    isTerminatedRef.current = true;
    isStartingRef.current = false;

    // 1. Clear any pending stream attachment timeout
    if (attachTimeoutRef.current) {
      clearTimeout(attachTimeoutRef.current);
      attachTimeoutRef.current = null;
    }

    // 2. Cancel video processing animation frame
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // 3. Explicitly stop and disable every track in streamRef
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
      streamRef.current = null;
    }

    // 4. Explicitly stop any track attached to the video DOM element itself
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

    // 5. Clean permissions listener
    if (permissionStatusRef.current) {
      try {
        permissionStatusRef.current.onchange = null;
      } catch {}
      permissionStatusRef.current = null;
    }
  }, []);

  // Parse QR string into table candidate and credential
  const parseQrPayload = (data: string): { tableCandidate: string; credCandidate: string } => {
    let tableCandidate = '';
    let credCandidate = '';
    const trimmed = data.trim();

    try {
      const url = new URL(trimmed, window.location.origin);
      tableCandidate = url.searchParams.get('t') || url.searchParams.get('table') || '';
      credCandidate = url.searchParams.get('cred') || url.searchParams.get('credential') || '';
    } catch {
      const matchT = /[?&](?:t|table)=([^&#]+)/i.exec(trimmed);
      const matchCred = /[?&](?:cred|credential)=([^&#]+)/i.exec(trimmed);
      if (matchT) tableCandidate = decodeURIComponent(matchT[1]);
      if (matchCred) credCandidate = decodeURIComponent(matchCred[1]);
    }

    if (!credCandidate && trimmed.startsWith('qrc_')) {
      credCandidate = trimmed;
      const tMatch = /^qrc_t0*([1-9]\d*)_/i.exec(trimmed);
      if (tMatch) {
        tableCandidate = `T${String(parseInt(tMatch[1], 10)).padStart(2, '0')}`;
      }
    }

    return { tableCandidate, credCandidate };
  };

  // Process detected QR code
  const handleQrDetected = useCallback(
    async (decodedText: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      // Stop camera hardware immediately upon detection
      stopCamera();
      setState('verifying');
      setErrorMessage(null);

      const { tableCandidate, credCandidate } = parseQrPayload(decodedText);

      if (!credCandidate) {
        setState('rejected');
        setErrorMessage('Scanned QR code is not a valid Little Monkey Café dining credential.');
        isProcessingRef.current = false;
        return;
      }

      try {
        const verifyResult = await verifyScannedQr(tableCandidate, credCandidate);
        if (verifyResult.valid && verifyResult.tableNumber && verifyResult.qrProofToken) {
          setVerifiedTable(verifyResult.tableNumber);
          setState('success');

          setTimeout(() => {
            if (onSuccessRef.current) {
              onSuccessRef.current({
                tableNumber: verifyResult.tableNumber!,
                qrProofToken: verifyResult.qrProofToken!,
                credentialId: verifyResult.credentialId || '',
              });
            } else if (typeof window !== 'undefined') {
              window.location.href = `/?t=${tableCandidate}&cred=${credCandidate}`;
            }
          }, 800);
        } else {
          setState('rejected');
          setErrorMessage(
            verifyResult.message || 'QR credential rejected. Please scan the genuine QR card on your café table.'
          );
          isProcessingRef.current = false;
        }
      } catch (err: any) {
        setState('rejected');
        setErrorMessage('Verification network error. Please verify your connection to the café server.');
        isProcessingRef.current = false;
      }
    },
    [stopCamera]
  );

  // Scanning frame loop
  const scanLoop = useCallback(() => {
    if (!videoRef.current || isProcessingRef.current || !streamRef.current) return;
    const video = videoRef.current;

    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, vw, vh);
        const imgData = ctx.getImageData(0, 0, vw, vh);
        let qrCode = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth',
        });

        // Fast central crop fallback for glare/reflections and high-res webcams
        if (!qrCode && (vw > 720 || vh > 720)) {
          const cropW = Math.floor(vw * 0.65);
          const cropH = Math.floor(vh * 0.65);
          const cropX = Math.floor((vw - cropW) / 2);
          const cropY = Math.floor((vh - cropH) / 2);
          const croppedData = ctx.getImageData(cropX, cropY, cropW, cropH);
          qrCode = jsQR(croppedData.data, croppedData.width, croppedData.height, {
            inversionAttempts: 'attemptBoth',
          });
        }

        if (qrCode && qrCode.data) {
          handleQrDetected(qrCode.data);
          return;
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  }, [handleQrDetected]);

  // Request camera and initialize video stream immediately
  const startCamera = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    isTerminatedRef.current = false;
    stopCamera();
    isTerminatedRef.current = false;

    // 1. Insecure Context Check (Browsers block camera over HTTP unless localhost)
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      const isLoopback =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '::1';
      if (!isLoopback) {
        isStartingRef.current = false;
        setState('insecure_context');
        setErrorMessage(
          'Camera access requires a secure connection (HTTPS or localhost). Your browser blocks camera permissions over unencrypted HTTP network connections.'
        );
        return;
      }
    }

    // 2. Browser MediaDevices Support Check
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      isStartingRef.current = false;
      setState('unsupported_browser');
      setErrorMessage(
        'Camera capture is not supported by this browser. Please use Chrome, Safari, Firefox, or Edge.'
      );
      return;
    }

    // 3. Permissions API Inspection & Listener (if supported)
    let browserPermissionState = 'unknown';
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        permissionStatusRef.current = permissionStatus;
        browserPermissionState = permissionStatus.state;
        permissionStatus.onchange = () => {
          if (!isMountedRef.current || isTerminatedRef.current) return;
          if (permissionStatus.state === 'denied') {
            stopCamera();
            setState('permission_denied');
            setErrorMessage('Camera access was revoked in your browser settings.');
          }
        };

        if (permissionStatus.state === 'denied') {
          isStartingRef.current = false;
          setState('permission_denied');
          setErrorMessage(
            'Camera access is currently blocked by your browser settings. Please allow camera permissions in your address bar.'
          );
          return;
        }
      } catch {
        // Permissions query for 'camera' might throw in older browsers; safely proceed
      }
    }

    setState('initializing');
    setErrorMessage(null);
    isProcessingRef.current = false;

    // 4. Initialization Timeout Promise (12 seconds)
    let timeoutId: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const err = new Error('Camera initialization timed out.');
        err.name = 'TimeoutError';
        reject(err);
      }, 12000);
    });

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia(constraints),
        timeoutPromise,
      ]);
      clearTimeout(timeoutId);

      // CRITICAL RACE-CONDITION PREVENTION:
      // If user clicked Exit, pressed Escape, or component unmounted while getUserMedia was resolving
      if (!isMountedRef.current || isTerminatedRef.current) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch {}
        });
        return;
      }

      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          if (!isMountedRef.current || isTerminatedRef.current) return;
          stopCamera();
          setState('camera_in_use');
          setErrorMessage('Camera stream was disconnected or terminated by the operating system.');
        };
      }

      setState('scanning');
      isStartingRef.current = false;

      // Attach stream to video element safely
      attachTimeoutRef.current = setTimeout(() => {
        attachTimeoutRef.current = null;
        if (!isMountedRef.current || isTerminatedRef.current) {
          if (stream) {
            stream.getTracks().forEach((track) => {
              try {
                track.stop();
                track.enabled = false;
              } catch {}
            });
          }
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          animFrameRef.current = requestAnimationFrame(scanLoop);
        }
      }, 40);
    } catch (err: any) {
      clearTimeout(timeoutId);
      stopCamera();
      isStartingRef.current = false;

      if (!isMountedRef.current || isTerminatedRef.current) return;

      const name = err?.name || '';
      const msg = String(err?.message || '').toLowerCase();

      if (name === 'TimeoutError') {
        setState('timeout');
        setErrorMessage(
          'Camera hardware took longer than 12 seconds to respond. The device camera may be sleeping or unresponsive.'
        );
      } else if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        if (
          browserPermissionState === 'granted' ||
          msg.includes('system') ||
          msg.includes('os') ||
          msg.includes('dismiss') ||
          msg.includes('denied by system')
        ) {
          setState('os_permission_denied');
          setErrorMessage(
            'Camera access is allowed in your browser, but is blocked by your operating system privacy settings.'
          );
        } else {
          setState('permission_denied');
          setErrorMessage(
            'Camera access was blocked by your browser settings. Please allow camera permissions in your browser address bar and retry.'
          );
        }
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
        setState('no_camera');
        setErrorMessage('No camera device was detected on this hardware.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
        setState('camera_in_use');
        setErrorMessage(
          'The camera is currently locked or in use by another application or browser tab.'
        );
      } else {
        setState('unsupported_browser');
        setErrorMessage(err.message || 'Unable to open device camera.');
      }
    }
  }, [stopCamera, scanLoop]);

  const handleCancel = useCallback(() => {
    stopCamera();
    if (onCancelRef.current) {
      onCancelRef.current();
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [stopCamera]);

  // Immediately start camera on component mount & attach lifecycle listeners
  useEffect(() => {
    isMountedRef.current = true;
    isTerminatedRef.current = false;
    startCamera();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    const handlePageHide = () => {
      stopCamera();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopCamera();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopCamera();
    };
  }, []);

  const isErrorState = [
    'permission_denied',
    'os_permission_denied',
    'no_camera',
    'camera_in_use',
    'insecure_context',
    'unsupported_browser',
    'timeout',
  ].includes(state);

  return (
    <div
      role="dialog"
      aria-label="Table QR Camera Scanner"
      aria-modal="true"
      className="lm-scanner-fullscreen"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        backgroundColor: '#080808',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* 1. Full-screen Video Stream Surface */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 1,
          backgroundColor: '#080808',
        }}
      />

      {/* 2. Top Header Bar (Subtle Branding & Clean Exit Action) */}
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        {/* Subtle Little Monkey Café branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            pointerEvents: 'auto',
          }}
        >
          <img
            src="/branding/little-monkey-logo-transparent.png"
            alt="Little Monkey Café"
            style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: 'rgba(250, 247, 242, 0.85)',
              textTransform: 'uppercase',
            }}
          >
            Little Monkey Café
          </span>
        </div>

        {/* Clear Exit Action */}
        <button
          type="button"
          onClick={handleCancel}
          aria-label="Exit Camera Scanner"
          style={{
            pointerEvents: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(20, 18, 16, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '999px',
            padding: '8px 16px',
            color: '#FAF7F2',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
            transition: 'all 0.15s ease',
          }}
        >
          <X size={16} style={{ color: '#FFC21A' }} />
          <span>Exit</span>
        </button>
      </header>

      {/* 3. Symmetrical Yellow Scanning Frame with Dark Vignette */}
      {!isErrorState && (
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            width: 'clamp(250px, 68vw, 340px)',
            height: 'clamp(250px, 68vw, 340px)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 194, 26, 0.35)',
            boxShadow: '0 0 0 9999px rgba(8, 8, 8, 0.62)',
            overflow: 'hidden',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* 4 Crisp Yellow Corner Brackets */}
          <div
            style={{
              position: 'absolute',
              top: '-1px',
              left: '-1px',
              width: '32px',
              height: '32px',
              borderTop: '3.5px solid #FFC21A',
              borderLeft: '3.5px solid #FFC21A',
              borderTopLeftRadius: '14px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '-1px',
              right: '-1px',
              width: '32px',
              height: '32px',
              borderTop: '3.5px solid #FFC21A',
              borderRight: '3.5px solid #FFC21A',
              borderTopRightRadius: '14px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-1px',
              left: '-1px',
              width: '32px',
              height: '32px',
              borderBottom: '3.5px solid #FFC21A',
              borderLeft: '3.5px solid #FFC21A',
              borderBottomLeftRadius: '14px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-1px',
              right: '-1px',
              width: '32px',
              height: '32px',
              borderBottom: '3.5px solid #FFC21A',
              borderRight: '3.5px solid #FFC21A',
              borderBottomRightRadius: '14px',
            }}
          />

          {/* Symmetrical Scanning Beam Line */}
          {state === 'scanning' && (
            <div
              className="lm-scanner-beam-line"
              style={{
                position: 'absolute',
                left: '12px',
                right: '12px',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, #FFC21A, transparent)',
                boxShadow: '0 0 8px #FFC21A',
              }}
            />
          )}
        </div>
      )}

      {/* 4. Natural Feedback Status (Positioned below the frame) */}
      {!isErrorState && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 36px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            maxWidth: '360px',
            padding: '0 20px',
            boxSizing: 'border-box',
          }}
        >
          {state === 'initializing' && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(20, 18, 16, 0.88)',
                border: '1px solid rgba(255, 194, 26, 0.35)',
                borderRadius: '999px',
                padding: '8px 18px',
                backdropFilter: 'blur(10px)',
                color: '#FAF7F2',
                fontSize: '12.5px',
                fontWeight: 600,
              }}
            >
              <RefreshCw size={14} style={{ color: '#FFC21A', animation: 'spin 1s linear infinite' }} />
              <span>Connecting to camera...</span>
            </div>
          )}

          {state === 'scanning' && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(20, 18, 16, 0.88)',
                border: '1px solid rgba(255, 194, 26, 0.35)',
                borderRadius: '999px',
                padding: '8px 18px',
                backdropFilter: 'blur(10px)',
                color: '#FAF7F2',
                fontSize: '12.5px',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#FFC21A',
                  display: 'inline-block',
                }}
              />
              <span>Align table QR within frame</span>
            </div>
          )}

          {state === 'verifying' && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(255, 194, 26, 0.18)',
                border: '1px solid rgba(255, 194, 26, 0.55)',
                borderRadius: '999px',
                padding: '8px 20px',
                backdropFilter: 'blur(10px)',
                color: '#FFC21A',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Verifying Table Credential...</span>
            </div>
          )}

          {state === 'success' && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.22)',
                border: '1px solid rgba(16, 185, 129, 0.55)',
                borderRadius: '999px',
                padding: '8px 20px',
                backdropFilter: 'blur(10px)',
                color: '#10B981',
                fontSize: '13px',
                fontWeight: 800,
              }}
            >
              <CheckCircle2 size={16} />
              <span>Table {verifiedTable} Verified</span>
            </div>
          )}

          {state === 'rejected' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.22)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  borderRadius: '999px',
                  padding: '8px 18px',
                  backdropFilter: 'blur(10px)',
                  color: '#FECACA',
                  fontSize: '12px',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                <AlertCircle size={15} style={{ color: '#EF4444', flexShrink: 0 }} />
                <span>{errorMessage || 'Unrecognized QR code'}</span>
              </div>

              <button
                type="button"
                onClick={startCamera}
                style={{
                  padding: '8px 20px',
                  borderRadius: '999px',
                  backgroundColor: '#FFC21A',
                  color: '#080808',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 14px rgba(255, 194, 26, 0.35)',
                }}
              >
                <RefreshCw size={13} />
                <span>Scan Again</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. Minimal Error Recovery Card (When Permission Denied or Camera In Use) */}
      {isErrorState && (
        <div
          style={{
            position: 'relative',
            zIndex: 25,
            width: '100%',
            maxWidth: '380px',
            margin: '0 20px',
            backgroundColor: '#141210',
            border: '1px solid rgba(239, 68, 68, 0.38)',
            borderRadius: '20px',
            padding: '28px 22px',
            textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.95)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1.5px solid rgba(239, 68, 68, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#EF4444',
            }}
          >
            <AlertCircle size={26} />
          </div>

          <h3 style={{ fontSize: '18px', color: '#FAF7F2', margin: '0 0 8px', fontWeight: 700 }}>
            {state === 'permission_denied'
              ? 'Camera Access Blocked'
              : state === 'no_camera'
              ? 'No Camera Detected'
              : state === 'camera_in_use'
              ? 'Camera In Use'
              : state === 'insecure_context'
              ? 'Secure Connection Required'
              : 'Camera Unavailable'}
          </h3>

          <p style={{ fontSize: '12.5px', color: '#D4CEB8', lineHeight: 1.55, margin: '0 0 20px' }}>
            {errorMessage || 'Camera access is currently blocked by your browser settings.'}
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={startCamera}
              style={{
                flex: 1,
                padding: '12px 18px',
                borderRadius: '12px',
                backgroundColor: '#FFC21A',
                color: '#080808',
                fontSize: '13px',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={14} />
              <span>Try Again</span>
            </button>

            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: '12px 18px',
                borderRadius: '12px',
                backgroundColor: '#1E1D1A',
                color: '#FAF7F2',
                fontSize: '13px',
                fontWeight: 600,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                cursor: 'pointer',
              }}
            >
              Exit
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
