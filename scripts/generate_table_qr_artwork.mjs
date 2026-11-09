/**
 * generate_table_qr_artwork.mjs
 *
 * Generates authoritative, premium, café-branded QR artwork for Little Monkey Café:
 * - 10 Vector SVGs (storage/qr-codes/table-t01.svg to table-t10.svg)
 * - 10 High-resolution Print-Ready PNGs (storage/qr-codes/table-t01.png to table-t10.png)
 * - 1 Consolidated Print-Ready A4 PDF (storage/qr-codes/little-monkey-table-qrs.pdf)
 * - Non-sensitive Table Index (storage/qr-codes/index.json)
 * - Interactive Table QR Design Studio & Responsive Digital Preview (storage/qr-codes/index.html)
 *
 * Design Language:
 * - Deep espresso-black background (#0A0908)
 * - Warm chocolate-brown secondary surface (#161411 to #100E0C)
 * - Rich solar/golden-yellow accents (#FFC21A / #FFE082)
 * - Elegant typography ('Playfair Display' serif & 'Plus Jakarta Sans' / 'Inter')
 * - Generous pure white QR plate with 4-module quiet zone and zero module obstruction
 * - Exact requested callout: "SCAN TO EXPLORE OUR MENU"
 * - Subtle café-branded footer
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import png from 'fast-png';
import jsQR from 'jsqr';
import { generateQRCode } from '../src/lib/qrCode.ts';
import {
  AUTHORITATIVE_TABLES,
  getActiveCredentialForTable,
  getActiveRawSecretForTable,
  generateTableCredential,
  generateTablesPdf,
  initializeQrStore,
  getTable2FaConfig,
} from '../src/server/qrAuthStore.ts';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

export const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'storage/qr-codes');

/**
 * Validates and resolves the base dining URL.
 * Preserves the authoritative physical stand base URL (https://dine-in.littlemonkey.com.vercel.app).
 */
export function validateAndResolveBaseUrl(customUrl = null) {
  let raw = customUrl || process.env.DINING_BASE_URL;

  if (!raw) {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--base-url' && args[i + 1]) {
        raw = args[i + 1];
        break;
      }
      if (args[i].startsWith('--base-url=')) {
        raw = args[i].split('=')[1];
        break;
      }
    }
  }

  if (!raw) {
    raw = process.env.DINING_PRODUCTION_URL || 'https://dine-in.littlemonkey.com.vercel.app';
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`INVALID_BASE_URL: "${raw}" is not a valid absolute URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`INVALID_PROTOCOL: Protocol must be "http:" or "https:", received "${parsed.protocol}"`);
  }

  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (isProd) {
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0') {
      throw new Error(`PRODUCTION_HOST_REJECTED: Loopback host "${parsed.hostname}" is forbidden in production.`);
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(`PRODUCTION_HTTPS_REQUIRED: Base URL must use HTTPS in production.`);
    }
  }

  return parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, ''));
}

function ensureOutputDir(outputDir = DEFAULT_OUTPUT_DIR) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * Helper to convert fast-png decoded buffers to RGBA for jsQR
 */
function toRgba(decoded) {
  if (decoded.channels === 4) return new Uint8ClampedArray(decoded.data);
  const rgba = new Uint8ClampedArray(decoded.width * decoded.height * 4);
  const src = decoded.data;
  let s = 0;
  let d = 0;
  for (let i = 0; i < decoded.width * decoded.height; i++) {
    rgba[d] = src[s];
    rgba[d + 1] = src[s + 1];
    rgba[d + 2] = src[s + 2];
    rgba[d + 3] = 255;
    s += 3;
    d += 4;
  }
  return rgba;
}

/**
 * Builds the authoritative, premium SVG card for physical stands, acrylic displays, and stickers
 */
export function buildSvgCard(table, entryUrl, qrMatrix, qrSize) {
  const quietZone = 4;
  const totalModules = qrSize + quietZone * 2;
  const qrBoxSize = 460;
  const moduleSize = qrBoxSize / totalModules;
  const twoFaConfig = getTable2FaConfig(table.tableNumber) || { symbol: '◈', code: 'T01A' };

  let qrPaths = '';
  for (let r = 0; r < qrSize; r++) {
    for (let c = 0; c < qrSize; c++) {
      if (qrMatrix[r][c] === 1) {
        const x = ((c + quietZone) * moduleSize).toFixed(2);
        const y = ((r + quietZone) * moduleSize).toFixed(2);
        const w = (moduleSize + 0.08).toFixed(2);
        qrPaths += `M${x},${y}h${w}v${w}h-${w}z `;
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200" width="800" height="1200">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&amp;family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;display=swap');
      .font-serif { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; }
      .font-sans { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    </style>
    <radialGradient id="goldAmbient" cx="50%" cy="22%" r="65%">
      <stop offset="0%" stop-color="#FFC21A" stop-opacity="0.10"/>
      <stop offset="60%" stop-color="#FFC21A" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="#FFC21A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFE082"/>
      <stop offset="45%" stop-color="#FFC21A"/>
      <stop offset="100%" stop-color="#E5A600"/>
    </linearGradient>
    <linearGradient id="badgeBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF3C4"/>
      <stop offset="100%" stop-color="#CC9300"/>
    </linearGradient>
    <linearGradient id="innerCardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#171512"/>
      <stop offset="100%" stop-color="#0F0E0C"/>
    </linearGradient>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="20" stdDeviation="28" flood-color="#000000" flood-opacity="0.85"/>
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#FFC21A" flood-opacity="0.08"/>
    </filter>
  </defs>

  <!-- Deep Espresso Background -->
  <rect width="800" height="1200" fill="#0A0908"/>
  <rect width="800" height="1200" fill="url(#goldAmbient)"/>

  <!-- Outer Architectural Border -->
  <rect x="24" y="24" width="752" height="1152" rx="22" fill="none" stroke="#FFC21A" stroke-width="1.6" stroke-opacity="0.45"/>
  
  <!-- Warm Chocolate Secondary Surface -->
  <rect x="36" y="36" width="728" height="1128" rx="16" fill="url(#innerCardGrad)" stroke="#2B2620" stroke-width="1.2"/>

  <!-- Subtle Corner Geometric Accents -->
  <path d="M 48,68 L 48,48 L 68,48" fill="none" stroke="#FFC21A" stroke-width="1.6" stroke-opacity="0.6"/>
  <path d="M 752,68 L 752,48 L 732,48" fill="none" stroke="#FFC21A" stroke-width="1.6" stroke-opacity="0.6"/>
  <path d="M 48,1132 L 48,1152 L 68,1152" fill="none" stroke="#FFC21A" stroke-width="1.6" stroke-opacity="0.6"/>
  <path d="M 752,1132 L 752,1152 L 732,1152" fill="none" stroke="#FFC21A" stroke-width="1.6" stroke-opacity="0.6"/>

  <!-- SECTION 1: LITTLE MONKEY BRANDING -->
  <!-- Refined Brand Crest Emblem -->
  <g transform="translate(400, 92)">
    <circle cx="0" cy="0" r="18" fill="none" stroke="#FFC21A" stroke-width="1.2" stroke-opacity="0.5"/>
    <path d="M -7,4 C -7,-5 7,-5 7,4 C 7,8 0,11 0,11 C 0,11 -7,8 -7,4 Z" fill="#FFC21A"/>
    <circle cx="0" cy="-6" r="3" fill="#FFC21A"/>
  </g>

  <text x="400" y="142" class="font-serif" font-size="32" font-weight="700" fill="#FFC21A" text-anchor="middle" letter-spacing="3.5">LITTLE MONKEY CAFÉ</text>
  <text x="400" y="172" class="font-sans" font-size="11.5" font-weight="600" fill="#B8AEA2" text-anchor="middle" letter-spacing="3">ARTISANAL ROASTERY &amp; GOURMET DINING</text>

  <!-- SECTION 2: CLEARLY VISIBLE TABLE IDENTIFIER -->
  <!-- Elevated Golden-Yellow Table Badge -->
  <g transform="translate(260, 204)">
    <rect width="280" height="50" rx="25" fill="url(#goldGradient)" stroke="url(#badgeBorderGrad)" stroke-width="1.5"/>
    <text x="140" y="33" class="font-sans" font-size="22" font-weight="800" fill="#0D0C0A" text-anchor="middle" letter-spacing="2.5">${table.tableNumber.toUpperCase()}</text>
  </g>

  <!-- Zone & Seating Context -->
  <text x="400" y="286" class="font-sans" font-size="14" font-weight="500" fill="#EAE5DC" text-anchor="middle" letter-spacing="1">${table.zone}  •  Capacity: ${table.capacity} Diners</text>

  <!-- SECTION 3: THE UNCHANGED QR CODE -->
  <!-- Generous Pure White Container with Quiet Zone -->
  <g transform="translate(170, 318)" filter="url(#cardShadow)">
    <rect width="460" height="460" rx="20" fill="#FFFFFF" stroke="#FFC21A" stroke-width="1.2" stroke-opacity="0.3"/>
    <!-- Unaltered, Camera-Readable QR Modules -->
    <path d="${qrPaths.trim()}" fill="#000000"/>
  </g>

  <!-- SECTION 4: CONCISE INSTRUCTION & DUAL-FACTOR PRESENCE CONFIRMATION -->
  <text x="400" y="825" class="font-serif" font-size="24" font-weight="700" fill="#FFC21A" text-anchor="middle" letter-spacing="1.5">SCAN TO EXPLORE OUR MENU</text>
  <text x="400" y="855" class="font-sans" font-size="13" font-weight="400" fill="#C5BCB1" text-anchor="middle">Scan QR code, then confirm table symbol or code to enter</text>

  <!-- Distinct Table Symbol & Secret Code Physical Presence Verification Box -->
  <g transform="translate(190, 885)">
    <rect width="420" height="74" rx="16" fill="#181512" stroke="#FFC21A" stroke-width="1.4" stroke-opacity="0.7"/>
    <!-- Symbol Accent Badge -->
    <rect x="14" y="12" width="50" height="50" rx="12" fill="rgba(255, 194, 26, 0.12)" stroke="rgba(255, 194, 26, 0.35)"/>
    <text x="39" y="47" font-size="28" fill="#FFC21A" text-anchor="middle">${twoFaConfig.symbol}</text>

    <!-- Table Code Details -->
    <text x="82" y="32" class="font-sans" font-size="11" font-weight="700" fill="#A89B8D" letter-spacing="1.5">PHYSICAL PRESENCE FACTOR</text>
    <text x="82" y="55" class="font-sans" font-size="19" font-weight="800" fill="#FAF7F2" letter-spacing="2">TABLE CODE: <tspan fill="#FFC21A">${twoFaConfig.code}</tspan></text>
  </g>

  <!-- Feature Tags / Dining Perks -->
  <g transform="translate(400, 995)">
    <rect x="-190" y="-14" width="380" height="28" rx="14" fill="#161411" stroke="#2B2620" stroke-width="1"/>
    <text x="0" y="4" class="font-sans" font-size="11" font-weight="600" fill="#FFD875" text-anchor="middle" letter-spacing="1.5">TABLE SERVICE  •  ORDERING  •  COMPLIMENTARY WI-FI</text>
  </g>

  <!-- SECTION 5: SUBTLE CAFÉ-BRANDED FOOTER -->
  <g transform="translate(400, 1045)">
    <line x1="-240" y1="0" x2="-20" y2="0" stroke="#2B2620" stroke-width="1"/>
    <polygon points="0,-4 4,0 0,4 -4,0" fill="#FFC21A" fill-opacity="0.8"/>
    <line x1="20" y1="0" x2="240" y2="0" stroke="#2B2620" stroke-width="1"/>
  </g>

  <text x="400" y="1080" class="font-sans" font-size="12" font-weight="700" fill="#FFC21A" text-anchor="middle" letter-spacing="2">TABLE ${table.shortCode}  •  AUTHENTIC DINE-IN SERVICE</text>
  <text x="400" y="1106" class="font-sans" font-size="11.5" font-weight="400" fill="#786E63" text-anchor="middle">Little Monkey Café  •  Craft Coffee, Fresh Bakes &amp; Handcrafted Dining</text>
</svg>`;
}

/**
 * Builds the interactive Table QR Design Studio & Responsive Digital Preview HTML
 */
export function buildStudioHtml(manifest) {
  const tableDataJson = JSON.stringify(manifest.tables);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Little Monkey Dining — Premium Table QR Design Studio</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0A0908;
      --surface-dark: #141210;
      --surface-card: #1C1915;
      --gold-primary: #FFC21A;
      --gold-light: #FFD875;
      --text-cream: #FAF7F2;
      --text-muted: #9E9388;
      --border-subtle: rgba(255, 194, 26, 0.22);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 0;
      background-color: var(--bg-dark);
      color: var(--text-cream);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      background: rgba(18, 16, 14, 0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-subtle);
      padding: 16px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
      flex-wrap: wrap;
      gap: 12px;
    }

    .brand-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-title h1 {
      margin: 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 20px;
      color: var(--gold-primary);
      letter-spacing: 1.5px;
    }

    .brand-title span {
      font-size: 11px;
      color: var(--text-muted);
      letter-spacing: 1px;
      text-transform: uppercase;
      font-weight: 700;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
    }

    .btn-gold {
      background: var(--gold-primary);
      color: #0A0908;
    }
    .btn-gold:hover {
      background: var(--gold-light);
      transform: translateY(-1px);
    }

    .btn-outline {
      background: transparent;
      color: var(--text-cream);
      border: 1px solid rgba(255, 255, 255, 0.18);
    }
    .btn-outline:hover {
      border-color: var(--gold-primary);
      color: var(--gold-primary);
    }

    main {
      flex: 1;
      padding: 28px 24px 60px 24px;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }

    /* Controls Bar */
    .controls-panel {
      background: var(--surface-dark);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }

    .table-tabs {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .tab-btn {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .tab-btn:hover {
      background: rgba(255, 194, 26, 0.1);
      color: var(--text-cream);
    }
    .tab-btn.active {
      background: var(--gold-primary);
      color: #0A0908;
      border-color: var(--gold-primary);
    }

    .view-mode-selector {
      display: flex;
      background: rgba(0, 0, 0, 0.4);
      padding: 4px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .mode-btn {
      background: transparent;
      color: var(--text-muted);
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mode-btn.active {
      background: rgba(255, 255, 255, 0.12);
      color: var(--gold-primary);
    }

    /* Stage Layout */
    .studio-stage {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 28px;
      align-items: start;
    }
    @media (max-width: 980px) {
      .studio-stage {
        grid-template-columns: 1fr;
      }
    }

    /* Responsive Preview Area */
    .preview-viewport {
      background: radial-gradient(circle at 50% 30%, #1A1713 0%, #0A0908 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 40px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 720px;
      position: relative;
      overflow: hidden;
    }

    /* Container for Acrylic / Mobile / Print */
    .stand-canvas-wrap {
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      justify-content: center;
    }

    /* Mode: Desktop Acrylic Display */
    .mode-acrylic {
      width: 480px;
      padding: 18px 18px 24px 18px;
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(6px);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(255, 194, 26, 0.1);
      position: relative;
    }
    .mode-acrylic::after {
      content: '';
      position: absolute;
      bottom: -14px;
      left: 10%;
      right: 10%;
      height: 14px;
      background: linear-gradient(180deg, #332B22 0%, #15120E 100%);
      border-radius: 4px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8);
    }

    /* Mode: Mobile Stand (390px viewport simulation) */
    .mode-mobile {
      width: 360px;
      padding: 12px;
      background: #000;
      border-radius: 40px;
      border: 6px solid #2B2620;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.9);
    }

    /* Mode: A4 Print Sheet */
    .mode-a4 {
      width: 520px;
      background: #FFFFFF;
      padding: 24px;
      border-radius: 6px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.85);
      border: 1px dashed #CCC;
      position: relative;
    }
    .mode-a4 .crop-mark {
      position: absolute;
      width: 14px;
      height: 14px;
      border-color: #888;
      border-style: solid;
    }
    .mode-a4 .crop-tl { top: 6px; left: 6px; border-width: 1px 0 0 1px; }
    .mode-a4 .crop-tr { top: 6px; right: 6px; border-width: 1px 1px 0 0; }
    .mode-a4 .crop-bl { bottom: 6px; left: 6px; border-width: 0 0 1px 1px; }
    .mode-a4 .crop-br { bottom: 6px; right: 6px; border-width: 0 1px 1px 0; }

    .qr-svg-preview {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 14px;
    }

    /* Info Sidebar */
    .info-sidebar {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .spec-card {
      background: var(--surface-dark);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 20px;
    }

    .spec-card h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 800;
      color: var(--gold-primary);
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .spec-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 12.5px;
    }
    .spec-row:last-child { border-bottom: none; }
    .spec-label { color: var(--text-muted); }
    .spec-value { font-weight: 700; color: var(--text-cream); }

    .verify-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(34, 197, 94, 0.12);
      color: #4ADE80;
      border: 1px solid rgba(34, 197, 94, 0.3);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      margin-top: 6px;
    }

    .download-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }
    .download-grid a {
      text-align: center;
      padding: 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: var(--text-cream);
      font-size: 11.5px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s;
    }
    .download-grid a:hover {
      background: rgba(255, 194, 26, 0.15);
      border-color: var(--gold-primary);
      color: var(--gold-primary);
    }

    /* Print Stylesheet for Physical Production */
    @media print {
      body {
        background: #FFFFFF !important;
        color: #000000 !important;
      }
      header, .controls-panel, .info-sidebar, .badge-bar {
        display: none !important;
      }
      main {
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
      }
      .studio-stage {
        display: block !important;
      }
      .preview-viewport {
        background: #FFFFFF !important;
        border: none !important;
        padding: 0 !important;
        min-height: auto !important;
      }
      .stand-canvas-wrap {
        width: 100% !important;
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
      }
      .mode-acrylic, .mode-mobile, .mode-a4 {
        box-shadow: none !important;
        border: none !important;
        background: none !important;
        padding: 0 !important;
        width: 100% !important;
      }
      .qr-svg-preview {
        max-height: 96vh;
        margin: 0 auto;
      }
    }
  </style>
</head>
<body>

  <header>
    <div class="brand-title">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" stroke="#FFC21A" stroke-width="1.5"/>
        <path d="M 8,14 C 8,9 16,9 16,14 C 16,16 12,18 12,18 C 12,18 8,16 8,14 Z" fill="#FFC21A"/>
      </svg>
      <div>
        <h1>LITTLE MONKEY CAFÉ</h1>
        <span>Table QR Design Studio &amp; Previews</span>
      </div>
    </div>

    <div class="header-actions">
      <a href="/api/admin/qr/artwork?file=pdf" class="btn btn-gold" download>Download 10-Table PDF</a>
      <button onclick="window.print()" class="btn btn-outline">Print A4 Sheet</button>
      <a href="/scanner" class="btn btn-outline">Launch In-App Scanner</a>
    </div>
  </header>

  <main>
    <div class="controls-panel">
      <!-- Table Selector Tabs -->
      <div class="table-tabs" id="tableTabsContainer"></div>

      <!-- View Mode Selector -->
      <div class="view-mode-selector">
        <button class="mode-btn active" id="btnModeAcrylic" onclick="setViewMode('acrylic')">
          <span>💻 Acrylic Desktop</span>
        </button>
        <button class="mode-btn" id="btnModeMobile" onclick="setViewMode('mobile')">
          <span>📱 Mobile Stand</span>
        </button>
        <button class="mode-btn" id="btnModeA4" onclick="setViewMode('a4')">
          <span>📄 A4 Print Sheet</span>
        </button>
      </div>
    </div>

    <div class="studio-stage">
      <!-- Active Preview Viewport -->
      <div class="preview-viewport">
        <div class="stand-canvas-wrap mode-acrylic" id="standWrapper">
          <div class="crop-mark crop-tl"></div>
          <div class="crop-mark crop-tr"></div>
          <div class="crop-mark crop-bl"></div>
          <div class="crop-mark crop-br"></div>
          <img id="qrPreviewImage" class="qr-svg-preview" src="" alt="Table QR Artwork Preview" />
        </div>
      </div>

      <!-- Table Details & Manufacturing Specifications -->
      <div class="info-sidebar">
        <div class="spec-card">
          <h3>Table Specifications</h3>
          <div class="spec-row">
            <span class="spec-label">Table Identity:</span>
            <span class="spec-value" id="specTableName">Table 01</span>
          </div>
          <div class="spec-row">
            <span class="spec-label">Short Code:</span>
            <span class="spec-value" id="specShortCode">T01</span>
          </div>
          <div class="spec-row">
            <span class="spec-label">Café Zone:</span>
            <span class="spec-value" id="specZone">Window Bay</span>
          </div>
          <div class="spec-row">
            <span class="spec-label">Dining Capacity:</span>
            <span class="spec-value" id="specCapacity">3 Diners</span>
          </div>
          <div class="spec-row">
            <span class="spec-label">Active Credential:</span>
            <span class="spec-value" id="specCredId" style="font-family: monospace; font-size: 11px;">qrc_t01_...</span>
          </div>

          <div class="verify-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            <span>VERIFIED SCANNABLE (100% Optical Decode)</span>
          </div>
        </div>

        <div class="spec-card">
          <h3>Download Artwork</h3>
          <p style="margin: 0 0 10px 0; font-size: 12px; color: var(--text-muted);">Authoritative vector and high-resolution assets for this table:</p>
          <div class="download-grid">
            <a id="downloadSvgLink" href="" download>Vector SVG</a>
            <a id="downloadPngLink" href="" download>Print PNG</a>
          </div>
        </div>

        <div class="spec-card">
          <h3>Manufacturing Specs</h3>
          <div class="spec-row">
            <span class="spec-label">Dimensions:</span>
            <span class="spec-value">800 × 1200 px (2:3)</span>
          </div>
          <div class="spec-row">
            <span class="spec-label">Recommended Print:</span>
            <span class="spec-value">100 × 150 mm (A6)</span>
          </div>
          <div class="spec-row">
            <span class="spec-label">Substrate Material:</span>
            <span class="spec-value">3mm Cast Acrylic</span>
          </div>
          <div class="spec-row">
            <span class="spec-label">Quiet Zone:</span>
            <span class="spec-value">≥ 4 Modules (Strict ISO)</span>
          </div>
          <div class="spec-row">
            <span class="spec-label">Contrast Ratio:</span>
            <span class="spec-value">> 15:1 (Pitch Black / Pure White)</span>
          </div>
        </div>
      </div>
    </div>
  </main>

  <script>
    const tables = ${tableDataJson};
    let currentTableIdx = 0;
    let currentMode = 'acrylic';

    function initStudio() {
      const container = document.getElementById('tableTabsContainer');
      container.innerHTML = '';

      tables.forEach((t, idx) => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (idx === 0 ? ' active' : '');
        btn.textContent = t.shortCode;
        btn.title = t.tableNumber + ' (' + t.zone + ')';
        btn.onclick = () => selectTab(idx);
        container.appendChild(btn);
      });

      renderTable();
    }

    function selectTab(idx) {
      currentTableIdx = idx;
      const btns = document.querySelectorAll('.tab-btn');
      btns.forEach((b, i) => b.classList.toggle('active', i === idx));
      renderTable();
    }

    function setViewMode(mode) {
      currentMode = mode;
      const wrap = document.getElementById('standWrapper');
      wrap.className = 'stand-canvas-wrap mode-' + mode;

      document.getElementById('btnModeAcrylic').classList.toggle('active', mode === 'acrylic');
      document.getElementById('btnModeMobile').classList.toggle('active', mode === 'mobile');
      document.getElementById('btnModeA4').classList.toggle('active', mode === 'a4');
    }

    function renderTable() {
      const table = tables[currentTableIdx];
      if (!table) return;

      document.getElementById('qrPreviewImage').src = table.svgFile;
      document.getElementById('specTableName').textContent = table.tableNumber;
      document.getElementById('specShortCode').textContent = table.shortCode;
      document.getElementById('specZone').textContent = table.zone;
      document.getElementById('specCapacity').textContent = table.capacity + ' Diners';
      document.getElementById('specCredId').textContent = table.credentialId;

      document.getElementById('downloadSvgLink').href = table.downloadSvgUrl;
      document.getElementById('downloadPngLink').href = table.downloadPngUrl;
    }

    window.addEventListener('DOMContentLoaded', initStudio);
  </script>
</body>
</html>`;
}

/**
 * Main generator execution function
 */
export async function generateAllTableArtwork(options = {}) {
  initializeQrStore();

  const outputDir = options.outputDir || DEFAULT_OUTPUT_DIR;
  const diningBaseUrl = validateAndResolveBaseUrl(options.baseUrl);
  const isProd = options.isProduction ?? (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production');

  ensureOutputDir(outputDir);

  console.log(`================================================================`);
  console.log(`GENERATING LITTLE MONKEY CAFÉ PREMIUM TABLE QR ARTWORK`);
  console.log(`Base URL: ${diningBaseUrl}`);
  console.log(`Output Directory: ${outputDir}`);
  console.log(`================================================================\n`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    environment: isProd ? 'production' : 'development',
    diningBaseUrl,
    pdf: 'little-monkey-table-qrs.pdf',
    totalTables: AUTHORITATIVE_TABLES.length,
    tables: [],
  };

  // Launch Puppeteer once for high-resolution PNG rasterization
  console.log('[PUPPETEER] Launching headless browser for ultra-high-resolution PNG rendering...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 1 });

  // Initialize page shell with Google Fonts once
  const initialHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 800px; height: 1200px; background: #0A0908; overflow: hidden; }
    #root { width: 800px; height: 1200px; }
    svg { display: block; width: 800px; height: 1200px; }
  </style>
</head>
<body id="root">
</body>
</html>`;

  await page.setContent(initialHtml, { waitUntil: 'load', timeout: 15000 }).catch(() => {});

  try {
    for (const table of AUTHORITATIVE_TABLES) {
      let cred = getActiveCredentialForTable(table.tableNumber);
      let rawSecret = getActiveRawSecretForTable(table.tableNumber);

      if (!cred || !rawSecret) {
        console.log(`Table ${table.tableNumber} missing active credential. Generating baseline credential...`);
        const gen = generateTableCredential(table.tableNumber, 'GeneratorBootstrap');
        cred = gen.record;
        rawSecret = gen.rawSecret;
      }

      const shortSlug = table.shortCode.toLowerCase();
      const entryUrl = `${diningBaseUrl}/?t=${table.shortCode}&cred=${cred.credentialId}.${rawSecret}`;
      const { matrix, size } = generateQRCode(entryUrl);

      // 1. Generate Authoritative Vector SVG
      const svgFileName = `table-${shortSlug}.svg`;
      const svgFilePath = path.join(outputDir, svgFileName);
      const svgContent = buildSvgCard(table, entryUrl, matrix, size);
      fs.writeFileSync(svgFilePath, svgContent, 'utf8');

      // 2. Generate High-Resolution Print-Ready PNG via Puppeteer
      const pngFileName = `table-${shortSlug}.png`;
      const pngFilePath = path.join(outputDir, pngFileName);
      await page.evaluate((svg) => {
        document.getElementById('root').innerHTML = svg;
      }, svgContent);
      await new Promise(r => setTimeout(r, 100));
      const pngBuffer = await page.screenshot({ type: 'png' });
      fs.writeFileSync(pngFilePath, pngBuffer);

      // 3. Optical Decode Verification using fast-png & jsQR
      const decodedPng = png.decode(pngBuffer);
      const rgba = toRgba(decodedPng);
      const qrResult = jsQR(rgba, decodedPng.width, decodedPng.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (!qrResult || qrResult.data !== entryUrl) {
        throw new Error(`Optical decode verification FAILED for ${table.tableNumber} PNG! Decoded: "${qrResult?.data}" Expected: "${entryUrl}"`);
      }

      const twoFaConfig = getTable2FaConfig(table.tableNumber) || { symbol: '◈', code: 'T01A' };

      manifest.tables.push({
        tableNumber: table.tableNumber,
        shortCode: table.shortCode,
        symbol: twoFaConfig.symbol,
        zone: table.zone,
        capacity: table.capacity,
        credentialId: cred.credentialId,
        svgFile: svgFileName,
        pngFile: pngFileName,
        downloadSvgUrl: `/api/admin/qr/artwork?table=${table.shortCode}&format=svg`,
        downloadPngUrl: `/api/admin/qr/artwork?table=${table.shortCode}&format=png`,
        verifiedScannable: true,
      });

      console.log(`[PASS] ${table.tableNumber} (${table.shortCode}) -> SVG & PNG verified scannable. Payload 100% matched.`);
    }
  } finally {
    await browser.close();
  }

  // 4. Generate Consolidated Printable PDF for all 10 tables
  console.log('\n[PDF] Generating consolidated 10-table A4 printable PDF...');
  const pdfBuffer = generateTablesPdf({
    diningBaseUrl,
    isProduction: isProd,
  });
  const pdfPath = path.join(outputDir, 'little-monkey-table-qrs.pdf');
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log(`[PASS] PDF written: ${pdfPath} (${pdfBuffer.length} bytes)`);

  // 5. Generate Non-Sensitive Table Index JSON
  const jsonPath = path.join(outputDir, 'index.json');
  fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[PASS] Non-sensitive index.json written: ${jsonPath}`);

  // 6. Generate Table QR Design Studio & Responsive Digital Preview HTML
  const htmlPath = path.join(outputDir, 'index.html');
  const htmlContent = buildStudioHtml(manifest);
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log(`[PASS] Interactive studio index.html written: ${htmlPath}`);

  console.log(`\n================================================================`);
  console.log(`ALL 10 TABLE QR ARTWORKS GENERATED & VERIFIED SCANNABLE`);
  console.log(`================================================================\n`);

  return manifest;
}

// Execute when invoked directly
if (process.argv[1] && process.argv[1].endsWith('generate_table_qr_artwork.mjs')) {
  try {
    await generateAllTableArtwork();
  } catch (err) {
    console.error('Failed to generate table QR artwork:', err);
    process.exit(1);
  }
}
