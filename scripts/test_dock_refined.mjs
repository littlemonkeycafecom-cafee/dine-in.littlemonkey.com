import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

async function testContour() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 450 });

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        margin: 0;
        background: #080706;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        overflow: hidden;
      }
      .dock-wrap {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .dock-ambient {
        position: absolute;
        width: 440px;
        height: 140px;
        background: radial-gradient(ellipse at 50% 65%, rgba(255, 194, 26, 0.22) 0%, rgba(140, 85, 0, 0.08) 55%, transparent 75%);
        pointer-events: none;
        z-index: 0;
      }
      .dock-container {
        position: relative;
        width: 360px;
        height: 64px;
        z-index: 1;
        filter: drop-shadow(0 16px 36px rgba(0, 0, 0, 0.9)) drop-shadow(0 4px 18px rgba(255, 194, 26, 0.25));
      }
      svg.dock-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
      }
      .scanner-btn {
        position: absolute;
        top: -23px;
        left: 50%;
        transform: translateX(-50%);
        width: 66px;
        height: 66px;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 35%, #242220 0%, #151413 70%, #0d0c0b 100%);
        border: 3.5px solid #FFC21A;
        box-shadow: 
          0 12px 28px rgba(0, 0, 0, 0.85),
          0 2px 8px rgba(0, 0, 0, 0.6),
          0 0 18px rgba(255, 194, 26, 0.35),
          inset 0 1px 2px rgba(255, 255, 255, 0.2),
          inset 0 -2px 4px rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        cursor: pointer;
        padding: 0;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <div class="dock-wrap">
      <div class="dock-ambient"></div>
      <div class="dock-container">
        <svg class="dock-svg" viewBox="0 0 360 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="dockGrad" x1="180" y1="0" x2="180" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FFD34D" />
              <stop offset="14%" stop-color="#FFC21A" />
              <stop offset="85%" stop-color="#F5AE00" />
              <stop offset="100%" stop-color="#DF9800" />
            </linearGradient>
            <linearGradient id="highlightGrad" x1="0" y1="0" x2="360" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="rgba(255,255,255,0.4)" />
              <stop offset="35%" stop-color="rgba(255,255,255,0.75)" />
              <stop offset="50%" stop-color="rgba(255,255,255,0.15)" />
              <stop offset="65%" stop-color="rgba(255,255,255,0.75)" />
              <stop offset="100%" stop-color="rgba(255,255,255,0.4)" />
            </linearGradient>
            <!-- Notch inner shadow filter -->
            <filter id="notchShadow" x="120" y="-10" width="120" height="70" filterUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.55)" />
            </filter>
          </defs>
          <!-- Main Yellow Pill Body with contoured notch -->
          <path d="M 32,0 L 126,0 C 146,0 148,46 180,46 C 212,46 214,0 234,0 L 328,0 A 32,32 0 0,1 360,32 A 32,32 0 0,1 328,64 L 32,64 A 32,32 0 0,1 0,32 A 32,32 0 0,1 32,0 Z" fill="url(#dockGrad)" />
          <!-- Highlight Rim along the upper contours -->
          <path d="M 32,1.2 L 126,1.2 C 145,1.2 147,46 180,46 C 213,46 215,1.2 234,1.2 L 328,1.2" stroke="url(#highlightGrad)" stroke-width="1.5" fill="none" opacity="0.65" />
          <!-- Subtle Dark Notch Rim / Inset depth -->
          <path d="M 136,3 C 148,10 150,47 180,47 C 210,47 212,10 224,3" stroke="rgba(0,0,0,0.28)" stroke-width="2.5" fill="none" />
        </svg>
        <button type="button" class="scanner-btn" aria-label="Scan Table QR">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 8.5V6C4 4.89543 4.89543 4 6 4H8.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15.5 4H18C19.1046 4 20 4.89543 20 6V8.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 15.5V18C4 19.1046 4.89543 20 6 20H8.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15.5 20H18C19.1046 20 20 19.1046 20 18V15.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html);
  await page.screenshot({ path: 'scripts/test_dock_refined.png' });
  console.log('Saved test_dock_refined.png');
  await browser.close();
}

testContour();
