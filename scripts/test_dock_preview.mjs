import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

async function testDock() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 400 });

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        margin: 0;
        background: #020202;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        overflow: hidden;
      }
      .dock-container {
        position: relative;
        width: 360px;
        height: 64px;
        filter: drop-shadow(0 16px 36px rgba(0, 0, 0, 0.9)) drop-shadow(0 4px 18px rgba(255, 194, 26, 0.25));
      }
      .dock-ambient {
        position: absolute;
        inset: -40px -20px -30px -20px;
        background: radial-gradient(ellipse at 50% 60%, rgba(255, 194, 26, 0.15) 0%, rgba(120, 75, 0, 0.08) 50%, transparent 75%);
        pointer-events: none;
        z-index: 0;
      }
      svg.dock-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }
      .scanner-btn {
        position: absolute;
        top: -24px;
        left: 50%;
        transform: translateX(-50%);
        width: 66px;
        height: 66px;
        border-radius: 50%;
        background: #191817;
        border: 3.5px solid #FFC21A;
        box-shadow: 
          0 10px 24px rgba(0, 0, 0, 0.9),
          0 2px 6px rgba(0, 0, 0, 0.7),
          0 0 16px rgba(255, 194, 26, 0.3),
          inset 0 1px 2px rgba(255, 255, 255, 0.15),
          inset 0 -2px 4px rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <div class="dock-ambient"></div>
    <div class="dock-container">
      <svg class="dock-svg" viewBox="0 0 360 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dockGrad" x1="180" y1="0" x2="180" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FFD34D" />
            <stop offset="12%" stop-color="#FFC21A" />
            <stop offset="85%" stop-color="#FBAE00" />
            <stop offset="100%" stop-color="#E59B00" />
          </linearGradient>
          <linearGradient id="highlightGrad" x1="0" y1="0" x2="360" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="rgba(255,255,255,0.4)" />
            <stop offset="35%" stop-color="rgba(255,255,255,0.7)" />
            <stop offset="50%" stop-color="rgba(255,255,255,0.1)" />
            <stop offset="65%" stop-color="rgba(255,255,255,0.7)" />
            <stop offset="100%" stop-color="rgba(255,255,255,0.4)" />
          </linearGradient>
        </defs>
        <path d="M 32,0 L 126,0 C 146,0 148,46 180,46 C 212,46 214,0 234,0 L 328,0 A 32,32 0 0,1 360,32 A 32,32 0 0,1 328,64 L 32,64 A 32,32 0 0,1 0,32 A 32,32 0 0,1 32,0 Z" fill="url(#dockGrad)" />
        <path d="M 32,1.2 L 126,1.2 C 145,1.2 147,46 180,46 C 213,46 215,1.2 234,1.2 L 328,1.2" stroke="url(#highlightGrad)" stroke-width="1.5" fill="none" opacity="0.6" />
      </svg>
      <div class="scanner-btn">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 8.5V6C4 4.89543 4.89543 4 6 4H8.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M15.5 4H18C19.1046 4 20 4.89543 20 6V8.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4 15.5V18C4 19.1046 4.89543 20 6 20H8.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M15.5 20H18C19.1046 20 20 19.1046 20 18V15.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html);
  await page.screenshot({ path: 'scripts/test_dock_preview.png' });
  console.log('Saved test_dock_preview.png');
  await browser.close();
}

testDock();
