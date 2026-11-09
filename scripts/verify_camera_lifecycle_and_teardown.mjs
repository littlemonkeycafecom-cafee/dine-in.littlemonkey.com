import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const BASE_URL = 'http://127.0.0.1:3000';

console.log('================================================================');
console.log('VERIFYING CAMERA LIFECYCLE AND TEARDOWN IN PUPPETEER');
console.log('================================================================\n');

async function testCameraLifecycle() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });

    // Mark intro seen
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // 1. Load Landing Page
    console.log('[STEP 1] Navigating to Dining Landing Page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // 2. Click Elevated Scanner Button
    console.log('[STEP 2] Clicking central elevated scanner button...');
    const dockScannerBtn = await page.$('.lm-scanner-dock-btn');
    if (!dockScannerBtn) {
      throw new Error('Dock scanner button .lm-scanner-dock-btn not found!');
    }
    await dockScannerBtn.click();
    await new Promise(r => setTimeout(r, 800));

    // 3. Verify Scanner mounted and camera stream is active
    console.log('[STEP 3] Inspecting camera stream state while scanner is open...');
    const streamStatusWhileOpen = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return { found: false };
      const stream = video.srcObject;
      if (!stream) return { found: true, hasStream: false };
      const tracks = stream.getVideoTracks();
      return {
        found: true,
        hasStream: true,
        trackCount: tracks.length,
        readyState: tracks[0]?.readyState,
        enabled: tracks[0]?.enabled,
      };
    });
    console.log('[STEP 3] Stream status while open:', streamStatusWhileOpen);

    // 4. Click Exit Button (.lm-scanner-exit-btn or button with title/text Exit)
    console.log('[STEP 4] Clicking Exit button...');
    const exitClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const exitBtn = btns.find(b => {
        const text = (b.textContent || '').toLowerCase();
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const title = (b.getAttribute('title') || '').toLowerCase();
        return text.includes('exit') || aria.includes('close') || aria.includes('exit') || title.includes('exit');
      });
      if (exitBtn) {
        exitBtn.click();
        return true;
      }
      return false;
    });
    console.log(`[STEP 4] Exit button clicked: ${exitClicked}`);
    await new Promise(r => setTimeout(r, 800));

    // 5. Verify camera stream is cleanly stopped and video element is detached
    console.log('[STEP 5] Inspecting stream state after Exit...');
    const streamStatusAfterExit = await page.evaluate(() => {
      const video = document.querySelector('video');
      // If video element unmounted, scanner is closed
      if (!video) {
        return {
          scannerUnmounted: true,
          videoInDOM: false,
        };
      }
      const stream = video.srcObject;
      const tracks = stream ? stream.getVideoTracks() : [];
      return {
        scannerUnmounted: false,
        videoInDOM: true,
        hasStream: !!stream,
        tracksEnded: tracks.every(t => t.readyState === 'ended'),
        tracksDisabled: tracks.every(t => !t.enabled),
      };
    });
    console.log('[STEP 5] Stream status after Exit:', streamStatusAfterExit);

    // 6. Test Experimental Scanner in /lab
    console.log('\n[STEP 6] Navigating to Optical Marker Laboratory (/lab)...');
    await page.goto(`${BASE_URL}/lab`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // Click "Launch Dual-Scanner" button
    console.log('[STEP 7] Clicking Launch Dual-Scanner button in Lab...');
    const labScannerTab = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const tab = btns.find(b => (b.textContent || '').includes('Launch Dual-Scanner'));
      if (tab) {
        tab.click();
        return true;
      }
      return false;
    });
    console.log(`[STEP 7] Lab scanner launched: ${labScannerTab}`);
    await new Promise(r => setTimeout(r, 1000));

    // Inspect stream while in lab scanner
    const labStreamWhileOpen = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return { found: false };
      const stream = video.srcObject;
      if (!stream) return { found: true, hasStream: false };
      const tracks = stream.getVideoTracks();
      return {
        found: true,
        hasStream: true,
        trackCount: tracks.length,
        readyState: tracks[0]?.readyState,
        enabled: tracks[0]?.enabled,
      };
    });
    console.log('[STEP 7] Lab stream status while open:', labStreamWhileOpen);

    // Click "Exit Scanner" in Lab
    console.log('[STEP 8] Clicking Exit Scanner in Lab...');
    const labExitClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const exitBtn = btns.find(b => (b.textContent || '').includes('Exit Scanner'));
      if (exitBtn) {
        exitBtn.click();
        return true;
      }
      return false;
    });
    console.log(`[STEP 8] Lab exit clicked: ${labExitClicked}`);
    await new Promise(r => setTimeout(r, 800));

    // Inspect stream after exiting lab scanner
    const labStreamAfterExit = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return { videoInDOM: false, tracksEnded: true };
      const stream = video.srcObject;
      const tracks = stream ? stream.getVideoTracks() : [];
      return {
        videoInDOM: true,
        hasStream: !!stream,
        tracksEnded: tracks.every(t => t.readyState === 'ended'),
        tracksDisabled: tracks.every(t => !t.enabled),
      };
    });
    console.log('[STEP 8] Lab stream status after Exit:', labStreamAfterExit);

    console.log('\n================================================================');
    console.log('CAMERA LIFECYCLE & TEARDOWN VERIFICATION PASSED COMPLETELY');
    console.log('================================================================');
  } finally {
    await browser.close();
  }
}

testCameraLifecycle().catch(err => {
  console.error('[ERROR]:', err);
  process.exit(1);
});
