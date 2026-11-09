/**
 * Types & Contracts for Little Monkey Café — QR + Optical Marker Laboratory
 */

export interface TableMarkerDefinition {
  tableNumber: string;
  shortCode: string;
  zone: string;
  capacity: number;
  markerId: string;
  markerName: string;
  markerDescription: string;
  geometryType:
    | 'solar_concentric'
    | 'hexagonal_ring'
    | 'crosshair_quad'
    | 'diamond_checker'
    | 'chevron_wave'
    | 'bullseye_target'
    | 'l_anchor_satellite'
    | 'stepped_staircase'
    | 'triforce_triangle'
    | 'octagonal_shield';
  gridSize: 5;
  patternBits: number[]; // 25 elements: 0 (white) or 1 (black)
  accentColor: string;
  qrPayload: string;
}

export interface MarkerDetectionResult {
  isDetected: boolean;
  detectedMarkerId: string | null;
  matchedTable: string | null;
  confidenceScore: number; // 0.0 - 1.0
  hammingDistance: number;
  rotationDegrees: 0 | 90 | 180 | 270;
  sampledBits: number[] | null;
  rawLuminanceSamples: number[] | null;
}

export interface DualScanResult {
  timestamp: number;
  qrDetected: boolean;
  qrDecoded: boolean;
  qrTableClaimed: string | null;
  qrPayload: string | null;
  markerDetected: boolean;
  markerMatched: boolean;
  markerIdDetected: string | null;
  markerConfidence: number;
  verdict: 'VERIFIED' | 'REJECTED_NO_MARKER' | 'REJECTED_MISMATCH' | 'SEARCHING';
  verdictReason: string;
}

export interface TestScenario {
  id: 'TEST_A' | 'TEST_B' | 'TEST_C' | 'TEST_D' | 'TEST_E' | 'TEST_F' | 'TEST_G';
  name: string;
  subtitle: string;
  description: string;
  qrPresence: boolean;
  markerPresence: boolean;
  markerMatchesTable: boolean | null;
  isCropped: boolean;
  isCompleteStandPhoto: boolean;
  expectedVerdict: 'VERIFIED' | 'REJECTED';
  expectedReason: string;
  securityObservation: string;
}
