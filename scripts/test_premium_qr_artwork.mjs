import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import png from 'fast-png';
import jsQR from 'jsqr';
import { generateQRCode } from '../src/lib/qrCode.ts';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const table01 = {
  tableNumber: 'Table 01',
  shortCode: 'T01',
  zone: 'Window Bay',
  capacity: 3,
};

const entryUrl = 'https://dine-in.littlemonkey.com.vercel.app/?t=T01&cred=qrc_t01_abce82e42a7e.1YC1GpHGf8xAzuvqfXOm3BTEsdfUCD13';
const { matrix, size } = generateQRCode(entryUrl);

function buildPremiumSvgCard(table, entryUrl, qrMatrix, qrSize) {
  const quietZone = 4;
  const totalModules = qrSize + quietZone * 2;
  const qrBoxSize = 460;
  const moduleSize = qrBoxSize / totalModules;

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

  <!-- Subtle Corner Corner Accents -->
  <path d="M 48,68 L 48,48 L 68,48" fill="none" stroke="#FFC21A" stroke-width="1.6" stroke-opacity="0.6"/>
  <path d="M 752,68 L 752,48 L 732,48" fill="none" stroke="#FFC21A" stroke-width="1.6" stroke-opacity="0.6"/>
  <path d="M 48,1132 L 48,1152 L 68,1152" fill="none" stroke="#FFC21A" stroke-width="1.6" stroke-opacity="0.6"/>
  <path d="M 752,1132 L 752,1152 L 732,1152" fill="none" stroke="#FFC21A" stroke-width="1.6" stroke-opacity="0.6"/>

  <!-- SECTION 1: BRANDING -->
  <!-- Elegant Brand Crest / Emblem -->
  <g transform="translate(400, 92)">
    <circle cx="0" cy="0" r="18" fill="none" stroke="#FFC21A" stroke-width="1.2" stroke-opacity="0.5"/>
    <path d="M -7,4 C -7,-5 7,-5 7,4 C 7,8 0,11 0,11 C 0,11 -7,8 -7,4 Z" fill="#FFC21A"/>
    <circle cx="0" cy="-6" r="3" fill="#FFC21A"/>
  </g>

  <text x="400" y="142" class="font-serif" font-size="32" font-weight="700" fill="#FFC21A" text-anchor="middle" letter-spacing="3.5">LITTLE MONKEY CAFÉ</text>
  <text x="400" y="172" class="font-sans" font-size="11.5" font-weight="600" fill="#B8AEA2" text-anchor="middle" letter-spacing="3">ARTISANAL ROASTERY &amp; GOURMET DINING</text>

  <!-- SECTION 2: TABLE IDENTIFIER -->
  <!-- Elevated Golden-Yellow Table Badge -->
  <g transform="translate(260, 204)">
    <rect width="280" height="50" rx="25" fill="url(#goldGradient)" stroke="url(#badgeBorderGrad)" stroke-width="1.5"/>
    <text x="140" y="33" class="font-sans" font-size="22" font-weight="800" fill="#0D0C0A" text-anchor="middle" letter-spacing="2.5">${table.tableNumber.toUpperCase()}</text>
  </g>

  <!-- Table Zone & Dining Capacity -->
  <text x="400" y="286" class="font-sans" font-size="14" font-weight="500" fill="#EAE5DC" text-anchor="middle" letter-spacing="1">${table.zone}  •  Capacity: ${table.capacity} Diners</text>

  <!-- SECTION 3: THE UNCHANGED QR CODE -->
  <!-- Generous Pure White Container with Quiet Zone -->
  <g transform="translate(170, 318)" filter="url(#cardShadow)">
    <rect width="460" height="460" rx="20" fill="#FFFFFF" stroke="#FFC21A" stroke-width="1.2" stroke-opacity="0.3"/>
    <!-- Unaltered Camera-Readable QR Modules -->
    <path d="${qrPaths.trim()}" fill="#000000"/>
  </g>

  <!-- SECTION 4: CONCISE INSTRUCTION -->
  <text x="400" y="834" class="font-serif" font-size="25" font-weight="700" fill="#FFC21A" text-anchor="middle" letter-spacing="1.8">SCAN TO EXPLORE OUR MENU</text>
  <text x="400" y="868" class="font-sans" font-size="14" font-weight="400" fill="#C5BCB1" text-anchor="middle">Point your smartphone camera or in-app scanner to begin dining</text>

  <!-- Feature Tags / Perks -->
  <g transform="translate(400, 922)">
    <rect x="-190" y="-16" width="380" height="32" rx="16" fill="#1C1915" stroke="#332C24" stroke-width="1"/>
    <text x="0" y="5" class="font-sans" font-size="11.5" font-weight="600" fill="#FFD875" text-anchor="middle" letter-spacing="1.5">TABLE SERVICE  •  ORDERING  •  COMPLIMENTARY WI-FI</text>
  </g>

  <!-- SECTION 5: SUBTLE CAFÉ-BRANDED FOOTER -->
  <g transform="translate(400, 1020)">
    <line x1="-240" y1="0" x2="-20" y2="0" stroke="#2B2620" stroke-width="1"/>
    <polygon points="0,-4 4,0 0,4 -4,0" fill="#FFC21A" fill-opacity="0.8"/>
    <line x1="20" y1="0" x2="240" y2="0" stroke="#2B2620" stroke-width="1"/>
  </g>

  <text x="400" y="1066" class="font-sans" font-size="12" font-weight="700" fill="#FFC21A" text-anchor="middle" letter-spacing="2">TABLE ${table.shortCode}  •  AUTHENTIC DINE-IN SERVICE</text>
  <text x="400" y="1094" class="font-sans" font-size="11.5" font-weight="400" fill="#786E63" text-anchor="middle">Little Monkey Café  •  Craft Coffee, Fresh Bakes &amp; Handcrafted Dining</text>
</svg>`;
}

async function runTest() {
  console.log('--- Testing Premium QR Artwork Generation ---');
  const svg = buildPremiumSvgCard(table01, entryUrl, matrix, size);
  fs.writeFileSync('test_artifacts/test_table_t01_premium.svg', svg);
  console.log('[PASS] SVG generated: test_artifacts/test_table_t01_premium.svg');

  // Rasterize via Puppeteer at exact 800x1200
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 1 });
    await page.setContent(svg, { waitUntil: 'networkidle0' });
    const pngBuf = await page.screenshot({ type: 'png' });
    fs.writeFileSync('test_artifacts/test_table_t01_premium.png', pngBuf);
    console.log('[PASS] PNG generated: test_artifacts/test_table_t01_premium.png');

    // Test jsQR decode on the generated PNG
    const decoded = png.decode(pngBuf);
    const qrResult = jsQR(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height, {
      inversionAttempts: 'attemptBoth',
    });

    console.log('[DECODER TEST] QR Decoded Successfully:', !!qrResult);
    console.log('[DECODER TEST] Decoded Data:', qrResult?.data);
    console.log('[DECODER TEST] Matches Expected URL:', qrResult?.data === entryUrl);

    if (qrResult?.data !== entryUrl) {
      throw new Error('QR payload mismatch!');
    }
  } finally {
    await browser.close();
  }
}

runTest().catch(console.error);
