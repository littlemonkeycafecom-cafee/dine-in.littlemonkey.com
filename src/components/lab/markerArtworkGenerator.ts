/**
 * Complete Stand Artwork Generator for Little Monkey Café
 * Generates print-ready, high-resolution dual-verification cards (QR Code + Optical Marker).
 */

import type { TableMarkerDefinition } from './types.ts';
import { generateQRCode } from '../../lib/qrCode.ts';
import { drawMarkerOnCanvas } from './markerEngine.ts';

export interface StandCardOptions {
  width?: number; // default 800
  height?: number; // default 1200
  darkBg?: string;
  lightBg?: string;
  accentGold?: string;
}

/**
 * Renders a full dual-verification stand card to an HTML5 Canvas.
 */
export function renderStandCardToCanvas(
  canvas: HTMLCanvasElement,
  marker: TableMarkerDefinition,
  options: StandCardOptions = {}
): void {
  const {
    width = 800,
    height = 1200,
    darkBg = '#0D0D0D',
    accentGold = '#FFC21A',
  } = options;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Dark Base Background
  ctx.fillStyle = darkBg;
  ctx.fillRect(0, 0, width, height);

  // Ambient gold glow at top
  const radialGlow = ctx.createRadialGradient(width / 2, 260, 50, width / 2, 260, 480);
  radialGlow.addColorStop(0, 'rgba(255, 194, 26, 0.12)');
  radialGlow.addColorStop(1, 'rgba(255, 194, 26, 0)');
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, width, height);

  // 2. Dual Outer Border
  ctx.strokeStyle = accentGold;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  ctx.strokeStyle = '#262420';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  // Inner card background
  ctx.fillStyle = '#141311';
  ctx.fillRect(32, 32, width - 64, height - 64);

  // 3. Header Typography
  ctx.textAlign = 'center';

  // Café Brand
  ctx.font = '800 32px "Playfair Display", Georgia, serif';
  ctx.fillStyle = accentGold;
  ctx.fillText('LITTLE MONKEY CAFÉ', width / 2, 85);

  ctx.font = '600 12px sans-serif';
  ctx.fillStyle = '#B8B3A8';
  ctx.fillText('ARTISANAL ROASTERY  •  DUAL OPTICAL VERIFICATION', width / 2, 110);

  // Table Banner Badge
  const badgeW = 280;
  const badgeH = 40;
  const badgeX = (width - badgeW) / 2;
  const badgeY = 130;

  const goldGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
  goldGrad.addColorStop(0, '#FFD666');
  goldGrad.addColorStop(0.5, '#FFC21A');
  goldGrad.addColorStop(1, '#E5A600');

  ctx.fillStyle = goldGrad;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 20);
  ctx.fill();

  ctx.fillStyle = '#0D0D0D';
  ctx.font = '900 20px sans-serif';
  ctx.fillText(`${marker.tableNumber.toUpperCase()}  •  ${marker.shortCode}`, width / 2, badgeY + 27);

  // Zone & Capacity
  ctx.fillStyle = '#FAF7F2';
  ctx.font = '500 14px sans-serif';
  ctx.fillText(`${marker.zone}   •   Capacity: ${marker.capacity} Diners`, width / 2, 196);

  // 4. Primary Section: QR Code Container
  const qrBoxSize = 390;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = 220;

  // White rounded backing
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 18);
  ctx.fill();

  // Draw authentic QR code
  const { matrix, size: matrixSize } = generateQRCode(marker.qrPayload);
  const quietZone = 2;
  const totalQrModules = matrixSize + quietZone * 2;
  const qrPadding = 20;
  const drawableQrSize = qrBoxSize - qrPadding * 2;
  const moduleSize = drawableQrSize / totalQrModules;

  ctx.fillStyle = '#000000';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c] === 1) {
        const mx = qrBoxX + qrPadding + (c + quietZone) * moduleSize;
        const my = qrBoxY + qrPadding + (r + quietZone) * moduleSize;
        ctx.fillRect(Math.floor(mx), Math.floor(my), Math.ceil(moduleSize), Math.ceil(moduleSize));
      }
    }
  }

  // 5. Connecting Alignment Banner
  const trackY = 628;
  ctx.fillStyle = 'rgba(255, 194, 26, 0.12)';
  ctx.fillRect(qrBoxX, trackY, qrBoxSize, 28);
  ctx.strokeStyle = 'rgba(255, 194, 26, 0.35)';
  ctx.strokeRect(qrBoxX, trackY, qrBoxSize, 28);

  ctx.fillStyle = accentGold;
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('▼  OPTICAL MARKER COUPLING ALIGNMENT  ▼', width / 2, trackY + 18);

  // 6. Secondary Section: Optical Marker Container
  const markerBoxW = qrBoxSize;
  const markerBoxH = 360;
  const markerBoxX = qrBoxX;
  const markerBoxY = 670;

  ctx.fillStyle = '#181614';
  ctx.beginPath();
  ctx.roundRect(markerBoxX, markerBoxY, markerBoxW, markerBoxH, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 194, 26, 0.3)';
  ctx.stroke();

  // Marker Title
  ctx.fillStyle = '#FAF7F2';
  ctx.font = '700 15px sans-serif';
  ctx.fillText(marker.markerName.toUpperCase(), width / 2, markerBoxY + 34);

  ctx.fillStyle = accentGold;
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`MARKER ID: ${marker.markerId}`, width / 2, markerBoxY + 54);

  // Optical Marker Core (240x240 white backing)
  const markerCoreSize = 230;
  const markerCoreX = markerBoxX + (markerBoxW - markerCoreSize) / 2;
  const markerCoreY = markerBoxY + 70;

  drawMarkerOnCanvas(ctx, markerCoreX, markerCoreY, markerCoreSize, marker, {
    showLabel: false,
    darkColor: '#000000',
    lightColor: '#FFFFFF',
    accentColor: marker.accentColor,
  });

  // Marker Description
  ctx.fillStyle = '#A8A29E';
  ctx.font = '11px sans-serif';
  ctx.fillText(marker.markerDescription, width / 2, markerBoxY + markerBoxH - 18);

  // 7. Footer & Instructions
  ctx.fillStyle = '#78716C';
  ctx.font = '11px sans-serif';
  ctx.fillText(
    'Dual-Verification Rule: Built-in scanner requires both QR and Optical Marker to unlock dining session.',
    width / 2,
    height - 52
  );
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#57534E';
  ctx.fillText('LMC DINE-IN LAB PROTOCOL // ISO-18004 + OPTICAL-FIDUCIAL V1.0', width / 2, height - 34);
}

/**
 * Generates an SVG string of the full stand card.
 */
export function generateStandCardSVG(marker: TableMarkerDefinition): string {
  const width = 800;
  const height = 1200;
  const { matrix, size: matrixSize } = generateQRCode(marker.qrPayload);
  const quietZone = 2;
  const totalModules = matrixSize + quietZone * 2;

  let qrPaths = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c] === 1) {
        const mx = (c + quietZone);
        const my = (r + quietZone);
        qrPaths += `M${mx},${my}h1v1h-1z `;
      }
    }
  }

  // Generate marker SVG rects
  let markerRects = '';
  const mSize = 5;
  for (let r = 0; r < mSize; r++) {
    for (let c = 0; c < mSize; c++) {
      if (marker.patternBits[r * mSize + c] === 1) {
        markerRects += `<rect x="${c * 40}" y="${r * 40}" width="40" height="40" fill="#000000" />\n`;
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="ambGlow" cx="50%" cy="20%" r="60%">
      <stop offset="0%" stop-color="#FFC21A" stop-opacity="0.14" />
      <stop offset="100%" stop-color="#FFC21A" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="goldBanner" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFD666" />
      <stop offset="50%" stop-color="#FFC21A" />
      <stop offset="100%" stop-color="#E5A600" />
    </linearGradient>
  </defs>

  <!-- Background Base -->
  <rect width="${width}" height="${height}" fill="#0D0D0D" />
  <rect width="${width}" height="${height}" fill="url(#ambGlow)" />

  <!-- Borders -->
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="18" fill="none" stroke="#FFC21A" stroke-width="2" />
  <rect x="32" y="32" width="${width - 64}" height="${height - 64}" rx="14" fill="#141311" stroke="#262420" stroke-width="1.5" />

  <!-- Brand Header -->
  <text x="400" y="85" font-family="'Playfair Display', Georgia, serif" font-size="32" font-weight="800" fill="#FFC21A" text-anchor="middle" letter-spacing="4">LITTLE MONKEY CAFÉ</text>
  <text x="400" y="110" font-family="sans-serif" font-size="12" font-weight="600" fill="#B8B3A8" text-anchor="middle" letter-spacing="2">ARTISANAL ROASTERY  •  DUAL OPTICAL VERIFICATION</text>

  <!-- Table Badge -->
  <rect x="260" y="130" width="280" height="40" rx="20" fill="url(#goldBanner)" />
  <text x="400" y="157" font-family="sans-serif" font-size="20" font-weight="900" fill="#0D0D0D" text-anchor="middle" letter-spacing="2">${marker.tableNumber.toUpperCase()}  •  ${marker.shortCode}</text>

  <!-- Zone & Capacity -->
  <text x="400" y="196" font-family="sans-serif" font-size="14" font-weight="500" fill="#FAF7F2" text-anchor="middle">${marker.zone}   •   Capacity: ${marker.capacity} Diners</text>

  <!-- QR Code Container -->
  <g transform="translate(205, 220)">
    <rect width="390" height="390" rx="18" fill="#FFFFFF" />
    <g transform="translate(20, 20) scale(${(390 - 40) / totalModules})" shape-rendering="crispEdges">
      <path d="${qrPaths.trim()}" fill="#000000" />
    </g>
  </g>

  <!-- Coupling Alignment Track -->
  <rect x="205" y="628" width="390" height="28" fill="rgba(255, 194, 26, 0.12)" stroke="rgba(255, 194, 26, 0.35)" />
  <text x="400" y="646" font-family="sans-serif" font-size="11" font-weight="bold" fill="#FFC21A" text-anchor="middle">▼  OPTICAL MARKER COUPLING ALIGNMENT  ▼</text>

  <!-- Optical Marker Container -->
  <g transform="translate(205, 670)">
    <rect width="390" height="360" rx="18" fill="#181614" stroke="rgba(255, 194, 26, 0.3)" />
    <text x="195" y="34" font-family="sans-serif" font-size="15" font-weight="bold" fill="#FAF7F2" text-anchor="middle">${marker.markerName.toUpperCase()}</text>
    <text x="195" y="54" font-family="monospace" font-size="12" font-weight="bold" fill="#FFC21A" text-anchor="middle">MARKER ID: ${marker.markerId}</text>

    <!-- White Marker Board -->
    <g transform="translate(80, 70)">
      <rect width="230" height="230" fill="#FFFFFF" stroke="#000000" stroke-width="8" />
      <g transform="translate(15, 15)">
        ${markerRects}
      </g>
      <!-- Corner Anchor -->
      <rect x="15" y="15" width="18" height="18" fill="${marker.accentColor}" />
    </g>

    <text x="195" y="338" font-family="sans-serif" font-size="11" fill="#A8A29E" text-anchor="middle">${marker.markerDescription}</text>
  </g>

  <!-- Footer -->
  <text x="400" y="1148" font-family="sans-serif" font-size="11" fill="#78716C" text-anchor="middle">Dual-Verification Rule: Built-in scanner requires both QR and Optical Marker to unlock dining session.</text>
  <text x="400" y="1166" font-family="monospace" font-size="10" font-weight="bold" fill="#57534E" text-anchor="middle">LMC DINE-IN LAB PROTOCOL // ISO-18004 + OPTICAL-FIDUCIAL V1.0</text>
</svg>`;
}
