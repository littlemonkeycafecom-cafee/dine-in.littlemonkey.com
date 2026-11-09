/**
 * Optical Marker Engine for Little Monkey Café
 * Implements 10 distinct geometric/binary optical marker specifications,
 * pattern extraction from camera canvas frames, and Hamming-distance matching.
 */

import type { TableMarkerDefinition, MarkerDetectionResult } from './types.ts';

export const TABLE_MARKER_DEFINITIONS: TableMarkerDefinition[] = [
  {
    tableNumber: 'Table 01',
    shortCode: 'T01',
    zone: 'Window Bay',
    capacity: 3,
    markerId: 'MKR-T01-SOLAR',
    markerName: 'Solar Concentric Disk',
    markerDescription: 'Concentric dark solar ring with 4 radial corner flares and central anchor core.',
    geometryType: 'solar_concentric',
    gridSize: 5,
    patternBits: [
      1, 0, 1, 0, 1,
      0, 1, 1, 1, 0,
      1, 1, 0, 1, 1,
      0, 1, 1, 1, 0,
      1, 0, 1, 0, 1,
    ],
    accentColor: '#FFC21A',
    qrPayload: 'https://dine-in.littlemonkey.com.vercel.app/?t=T01&cred=qrc_t01_abce82e42a7e.1YC1GpHGf8xAzuvqfXOm3BTEsdfUCD13',
  },
  {
    tableNumber: 'Table 02',
    shortCode: 'T02',
    zone: 'Window Bay',
    capacity: 3,
    markerId: 'MKR-T02-HEXA',
    markerName: 'Hexagonal Constellation',
    markerDescription: 'Hexagonal outer hull with dual horizontal splitter bars and corner nodal cells.',
    geometryType: 'hexagonal_ring',
    gridSize: 5,
    patternBits: [
      0, 1, 1, 1, 0,
      1, 0, 0, 0, 1,
      1, 1, 1, 1, 1,
      1, 0, 0, 0, 1,
      0, 1, 1, 1, 0,
    ],
    accentColor: '#F59E0B',
    qrPayload: 'https://dine-in.littlemonkey.com.vercel.app/?t=T02&cred=qrc_t02_42dab097e26f.-gHNtHQGW84h30M1qEI1olW6rnegg-Mz',
  },
  {
    tableNumber: 'Table 03',
    shortCode: 'T03',
    zone: 'Main Café Hall',
    capacity: 4,
    markerId: 'MKR-T03-CROSS',
    markerName: 'Crosshair Quadrant',
    markerDescription: 'Orthogonal central cross with asymmetric diagonal quadrant block weights.',
    geometryType: 'crosshair_quad',
    gridSize: 5,
    patternBits: [
      1, 1, 0, 0, 0,
      1, 1, 0, 1, 1,
      0, 0, 1, 0, 0,
      1, 1, 0, 1, 1,
      0, 0, 0, 1, 1,
    ],
    accentColor: '#EAB308',
    qrPayload: 'https://dine-in.littlemonkey.com.vercel.app/?t=T03&cred=qrc_t03_e487d7fb92a7.0r2-Exq63QBgNm6jABL3FTgc9Alt2ORY',
  },
  {
    tableNumber: 'Table 04',
    shortCode: 'T04',
    zone: 'Main Café Hall',
    capacity: 4,
    markerId: 'MKR-T04-DIAMOND',
    markerName: 'Diamond Matrix',
    markerDescription: '45-degree diamond outer boundary with alternating internal checkerboard cells.',
    geometryType: 'diamond_checker',
    gridSize: 5,
    patternBits: [
      0, 0, 1, 0, 0,
      0, 1, 0, 1, 0,
      1, 0, 1, 0, 1,
      0, 1, 0, 1, 0,
      0, 0, 1, 0, 0,
    ],
    accentColor: '#FBBF24',
    qrPayload: 'https://dine-in.littlemonkey.com.vercel.app/?t=T04&cred=qrc_t04_5597540d7470.eJLTx9GufXGZSoO_txfTZTP4DRao75Ck',
  },
  {
    tableNumber: 'Table 05',
    shortCode: 'T05',
    zone: 'Main Café Hall',
    capacity: 4,
    markerId: 'MKR-T05-CHEVRON',
    markerName: 'Triple Chevron Wave',
    markerDescription: 'Parallel angular V-chevrons with distinct apex key nodes for vertical alignment.',
    geometryType: 'chevron_wave',
    gridSize: 5,
    patternBits: [
      1, 0, 0, 0, 1,
      0, 1, 0, 1, 0,
      0, 0, 1, 0, 0,
      0, 1, 0, 1, 0,
      1, 0, 0, 0, 1,
    ],
    accentColor: '#F59E0B',
    qrPayload: 'https://dine-in.littlemonkey.com.vercel.app/?t=T05&cred=qrc_t05_c7af410358a1.HdLv_8jGE61lnv31seZpELg20FjHP4sc',
  },
  {
    tableNumber: 'Table 06',
    shortCode: 'T06',
    zone: 'Courtyard Terrace',
    capacity: 2,
    markerId: 'MKR-T06-BULLSEYE',
    markerName: 'Bullseye Dual Target',
    markerDescription: 'Perimeter ring container with internal target core and single 90-degree orientation notch.',
    geometryType: 'bullseye_target',
    gridSize: 5,
    patternBits: [
      1, 1, 1, 1, 1,
      1, 0, 0, 0, 1,
      1, 0, 1, 0, 0,
      1, 0, 0, 0, 1,
      1, 1, 1, 1, 1,
    ],
    accentColor: '#10B981',
    qrPayload: 'https://dine-in.littlemonkey.com.vercel.app/?t=T06&cred=qrc_t06_0c16a92cf12f.MFIBExBiJ05kawA0mTyDC3e08wum37fG',
  },
  {
    tableNumber: 'Table 07',
    shortCode: 'T07',
    zone: 'Courtyard Terrace',
    capacity: 2,
    markerId: 'MKR-T07-LANCHOR',
    markerName: 'L-Anchor Satellite',
    markerDescription: 'Solid L-shaped tracking boundary on bottom-left with triple satellite timing pips.',
    geometryType: 'l_anchor_satellite',
    gridSize: 5,
    patternBits: [
      1, 0, 0, 1, 0,
      1, 0, 0, 0, 1,
      1, 0, 0, 1, 0,
      1, 0, 0, 0, 0,
      1, 1, 1, 1, 1,
    ],
    accentColor: '#059669',
    qrPayload: 'https://dine-in.littlemonkey.com.vercel.app/?t=T07&cred=qrc_t07_b002b38e97d4.iLySv_5Shxu6iqXAA_tjRvUl_HCjrJFJ',
  },
  {
    tableNumber: 'Table 08',
    shortCode: 'T08',
    zone: 'Mezzanine Lounge',
    capacity: 4,
    markerId: 'MKR-T08-STAIRS',
    markerName: 'Stepped Staircase Raster',
    markerDescription: 'Ascending stepped diagonal formation with high rotational specificity.',
    geometryType: 'stepped_staircase',
    gridSize: 5,
    patternBits: [
      1, 0, 0, 0, 0,
      1, 1, 0, 0, 0,
      0, 1, 1, 0, 0,
      0, 0, 1, 1, 0,
      0, 0, 0, 1, 1,
    ],
    accentColor: '#3B82F6',
    qrPayload: 'https://dine-in.littlemonkey.com.vercel.app/?t=T08&cred=qrc_t08_80a6e5198331.xUpqz_U6NmNRP07wfSZydfFcdP4_QGg4',
  },
  {
    tableNumber: 'Table 09',
    shortCode: 'T09',
    zone: 'Mezzanine Lounge',
    capacity: 4,
    markerId: 'MKR-T09-TRIANGLE',
    markerName: 'Triforce Triquetra',
    markerDescription: 'Triangular outer perimeter with inverted central triangle and corner anchors.',
    geometryType: 'triforce_triangle',
    gridSize: 5,
    patternBits: [
      0, 0, 1, 0, 0,
      0, 1, 1, 1, 0,
      1, 0, 0, 0, 1,
      1, 1, 0, 1, 1,
      1, 1, 1, 1, 1,
    ],
    accentColor: '#6366F1',
    qrPayload: 'https://dine-in.littlemonkey.com.vercel.app/?t=T09&cred=qrc_t09_4998dd014f49.UOXfhobhYnJvNpUtCnXWTSDuvU9vdn6P',
  },
  {
    tableNumber: 'Table 10',
    shortCode: 'T10',
    zone: 'Private Alcove',
    capacity: 6,
    markerId: 'MKR-T10-SHIELD',
    markerName: 'Octagonal Shield & Crest',
    markerDescription: 'Chamfered octagonal boundary with Little Monkey interior crest motif.',
    geometryType: 'octagonal_shield',
    gridSize: 5,
    patternBits: [
      0, 1, 1, 1, 0,
      1, 1, 0, 1, 1,
      1, 0, 1, 0, 1,
      1, 1, 0, 1, 1,
      0, 1, 1, 1, 0,
    ],
    accentColor: '#EC4899',
    qrPayload: 'https://dine-in.littlemonkey.com.vercel.app/?t=T10&cred=qrc_t10_aa84175f6246.k-_iDh5HgBsF7wa5GpHF7IGbkqp0Rakh',
  },
];

/**
 * Computes the Hamming distance between two binary arrays of identical length.
 */
export function computeHammingDistance(a: number[], b: number[]): number {
  let distance = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) {
      distance++;
    }
  }
  return distance;
}

/**
 * Rotates a square size*size binary matrix 90 degrees clockwise.
 */
export function rotatePattern90(bits: number[], size = 5): number[] {
  const rotated = new Array(size * size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      rotated[c * size + (size - 1 - r)] = bits[r * size + c];
    }
  }
  return rotated;
}

/**
 * Matches a 25-bit binary sample against all 10 table marker definitions,
 * evaluating all 4 rotations (0, 90, 180, 270 deg).
 */
export function matchSampledMarker(sampledBits: number[]): MarkerDetectionResult {
  if (!sampledBits || sampledBits.length !== 25) {
    return {
      isDetected: false,
      detectedMarkerId: null,
      matchedTable: null,
      confidenceScore: 0,
      hammingDistance: 25,
      rotationDegrees: 0,
      sampledBits: null,
      rawLuminanceSamples: null,
    };
  }

  let bestMatch: TableMarkerDefinition | null = null;
  let bestDist = 25;
  let bestRot: 0 | 90 | 180 | 270 = 0;

  for (const def of TABLE_MARKER_DEFINITIONS) {
    let currentBits = [...def.patternBits];

    const rotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
    for (const rot of rotations) {
      const dist = computeHammingDistance(sampledBits, currentBits);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = def;
        bestRot = rot;
      }
      currentBits = rotatePattern90(currentBits, 5);
    }
  }

  const confidenceScore = Math.max(0, (25 - bestDist) / 25);
  // Acceptance threshold: at most 3 bits difference out of 25 (>= 88% confidence)
  const isDetected = bestDist <= 3 && bestMatch !== null;

  return {
    isDetected,
    detectedMarkerId: isDetected && bestMatch ? bestMatch.markerId : null,
    matchedTable: isDetected && bestMatch ? bestMatch.tableNumber : null,
    confidenceScore,
    hammingDistance: bestDist,
    rotationDegrees: bestRot,
    sampledBits,
    rawLuminanceSamples: null,
  };
}

/**
 * Extracts a 5x5 optical marker grid from video canvas image data.
 * Computes expected marker bounds using the QR code's corners.
 */
export function extractMarkerFromCanvas(
  ctx: CanvasRenderingContext2D,
  qrCorners: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  }
): {
  markerFound: boolean;
  sampledBits: number[] | null;
  luminanceGrid: number[] | null;
  debugBounds?: { x: number; y: number; width: number; height: number };
} {
  // Center of the QR code
  const qrCenterX = (qrCorners.topLeft.x + qrCorners.topRight.x + qrCorners.bottomLeft.x + qrCorners.bottomRight.x) / 4;
  const qrCenterY = (qrCorners.topLeft.y + qrCorners.topRight.y + qrCorners.bottomLeft.y + qrCorners.bottomRight.y) / 4;

  // Vector along the vertical axis of the QR code (downward)
  const midTopX = (qrCorners.topLeft.x + qrCorners.topRight.x) / 2;
  const midTopY = (qrCorners.topLeft.y + qrCorners.topRight.y) / 2;
  const midBottomX = (qrCorners.bottomLeft.x + qrCorners.bottomRight.x) / 2;
  const midBottomY = (qrCorners.bottomLeft.y + qrCorners.bottomRight.y) / 2;

  const qrHeight = Math.hypot(midBottomX - midTopX, midBottomY - midTopY);
  const qrWidth = Math.hypot(qrCorners.topRight.x - qrCorners.topLeft.x, qrCorners.topRight.y - qrCorners.topLeft.y);

  if (qrHeight < 20 || qrWidth < 20) {
    return { markerFound: false, sampledBits: null, luminanceGrid: null };
  }

  // In the Little Monkey dual stand layout, the optical marker is centered
  // directly below the QR code at an offset of ~1.15x the QR height.
  const unitDownX = (midBottomX - midTopX) / qrHeight;
  const unitDownY = (midBottomY - midTopY) / qrHeight;

  // Expected marker center
  const markerCenterX = qrCenterX + unitDownX * (qrHeight * 1.12);
  const markerCenterY = qrCenterY + unitDownY * (qrHeight * 1.12);

  // Expected marker size (proportional to QR width, ~0.65x QR width)
  const markerRadius = (qrWidth * 0.32);

  const minX = Math.round(markerCenterX - markerRadius);
  const minY = Math.round(markerCenterY - markerRadius);
  const boxWidth = Math.round(markerRadius * 2);
  const boxHeight = Math.round(markerRadius * 2);

  // Check canvas bounds
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  if (minX < 0 || minY < 0 || minX + boxWidth > canvasW || minY + boxHeight > canvasH) {
    return {
      markerFound: false,
      sampledBits: null,
      luminanceGrid: null,
      debugBounds: { x: minX, y: minY, width: boxWidth, height: boxHeight },
    };
  }

  // Extract pixel data from the marker region
  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(minX, minY, boxWidth, boxHeight);
  } catch {
    return { markerFound: false, sampledBits: null, luminanceGrid: null };
  }

  const rawLuma: number[] = [];
  const pixels = imgData.data;

  // Sample 5x5 grid cells
  const cellSizeX = boxWidth / 5;
  const cellSizeY = boxHeight / 5;

  let minLuma = 255;
  let maxLuma = 0;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      // Sample central 50% of each cell to avoid boundary bleed
      const startX = Math.floor(c * cellSizeX + cellSizeX * 0.25);
      const endX = Math.floor(c * cellSizeX + cellSizeX * 0.75);
      const startY = Math.floor(r * cellSizeY + cellSizeY * 0.25);
      const endY = Math.floor(r * cellSizeY + cellSizeY * 0.75);

      let totalBrightness = 0;
      let count = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          if (x >= 0 && x < boxWidth && y >= 0 && y < boxHeight) {
            const idx = (y * boxWidth + x) * 4;
            // Standard perceptual luminance: 0.299 R + 0.587 G + 0.114 B
            const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
            totalBrightness += lum;
            count++;
          }
        }
      }

      const avg = count > 0 ? totalBrightness / count : 128;
      rawLuma.push(avg);
      if (avg < minLuma) minLuma = avg;
      if (avg > maxLuma) maxLuma = avg;
    }
  }

  // Contrast check: if contrast range is too low (< 35 on 0-255 scale),
  // this is a blank surface or uniform background, NOT an optical marker!
  const contrastRange = maxLuma - minLuma;
  if (contrastRange < 35) {
    return {
      markerFound: false,
      sampledBits: null,
      luminanceGrid: rawLuma,
      debugBounds: { x: minX, y: minY, width: boxWidth, height: boxHeight },
    };
  }

  // Adaptive threshold
  const threshold = (minLuma + maxLuma) / 2;
  // If cell is darker than threshold, bit is 1 (dark module), else 0 (light module)
  const bits = rawLuma.map((lum) => (lum < threshold ? 1 : 0));

  return {
    markerFound: true,
    sampledBits: bits,
    luminanceGrid: rawLuma,
    debugBounds: { x: minX, y: minY, width: boxWidth, height: boxHeight },
  };
}

/**
 * Draws an optical marker onto an HTML5 Canvas at (x, y) with the given size.
 */
export function drawMarkerOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  marker: TableMarkerDefinition,
  options: {
    showLabel?: boolean;
    darkColor?: string;
    lightColor?: string;
    accentColor?: string;
  } = {}
) {
  const {
    showLabel = true,
    darkColor = '#0D0D0D',
    lightColor = '#FFFFFF',
    accentColor = marker.accentColor || '#FFC21A',
  } = options;

  ctx.save();
  ctx.translate(x, y);

  // Outer container with quiet zone
  ctx.fillStyle = lightColor;
  ctx.fillRect(0, 0, size, size);

  // Precision Outer Finder Ring
  const borderWidth = Math.max(3, Math.round(size * 0.04));
  ctx.strokeStyle = darkColor;
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(borderWidth / 2, borderWidth / 2, size - borderWidth, size - borderWidth);

  // Inner grid positioning
  const margin = size * 0.12;
  const gridAreaSize = size - margin * 2;
  const cellSize = gridAreaSize / 5;

  // Draw 5x5 pattern cells
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const bit = marker.patternBits[r * 5 + c];
      const cellX = margin + c * cellSize;
      const cellY = margin + r * cellSize;

      if (bit === 1) {
        ctx.fillStyle = darkColor;
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
      } else {
        ctx.fillStyle = lightColor;
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
      }
    }
  }

  // Corner Orientation Anchors (Top-Left is solid accent for rotation disambiguation)
  const anchorSize = cellSize * 0.45;
  ctx.fillStyle = accentColor;
  ctx.fillRect(margin + 2, margin + 2, anchorSize, anchorSize);

  // Bottom text label if requested
  if (showLabel && size >= 140) {
    ctx.fillStyle = darkColor;
    ctx.font = `bold ${Math.max(10, Math.round(size * 0.055))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(marker.markerId, size / 2, size - 6);
  }

  ctx.restore();
}
