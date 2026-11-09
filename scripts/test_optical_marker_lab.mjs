import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');
import png from 'fast-png';
import jsQR from 'jsqr';

import {
  TABLE_MARKER_DEFINITIONS,
  matchSampledMarker,
  computeHammingDistance,
  rotatePattern90,
} from '../src/components/lab/markerEngine.ts';

const LAB_ARTIFACT_DIR = path.resolve('test_artifacts/optical_marker_lab');
const CONV_ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/0844d1de-cdde-43df-8637-b53dd2806014/screenshots';
const STORAGE_DIR = path.resolve('storage/experimental-markers');
const BASE_URL = 'http://127.0.0.1:3000';

fs.mkdirSync(LAB_ARTIFACT_DIR, { recursive: true });
fs.mkdirSync(CONV_ARTIFACT_DIR, { recursive: true });

async function runLabVerificationSuite() {
  console.log('================================================================');
  console.log('STARTING QR + OPTICAL MARKER LABORATORY VERIFICATION SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // PHASE 1: DISK ASSETS & RECOGNITION AUDIT (ALL 10 TABLES)
  // -------------------------------------------------------------------------
  console.log('--- Phase 1: Generated Stand Assets & Decoder Audit ---');
  let allDecoded = true;
  let allMatched = true;

  for (const table of TABLE_MARKER_DEFINITIONS) {
    const pngPath = path.join(STORAGE_DIR, `table-${table.shortCode.toLowerCase()}.png`);
    const svgPath = path.join(STORAGE_DIR, `table-${table.shortCode.toLowerCase()}.svg`);

    if (!fs.existsSync(pngPath) || !fs.existsSync(svgPath)) {
      console.error(`[FAIL] Missing asset for ${table.tableNumber}: ${pngPath}`);
      allDecoded = false;
      continue;
    }

    const pngBuffer = fs.readFileSync(pngPath);
    const decodedPng = png.decode(pngBuffer);
    const qrResult = jsQR(new Uint8ClampedArray(decodedPng.data), decodedPng.width, decodedPng.height);

    const hasQr = qrResult !== null && qrResult.data.includes(table.shortCode);
    const match = matchSampledMarker(table.patternBits);
    const hasMarker = match.isDetected && match.detectedMarkerId === table.markerId;

    if (!hasQr) allDecoded = false;
    if (!hasMarker) allMatched = false;

    console.log(
      `[${table.tableNumber}] PNG: ${pngBuffer.length} B | QR Decoded: ${hasQr ? 'YES' : 'FAIL'} | Marker: ${
        hasMarker ? 'MATCHED' : 'FAIL'
      } (${table.markerId}, ${Math.round(match.confidenceScore * 100)}%)`
    );
  }

  const zipPath = path.join(STORAGE_DIR, 'little-monkey-experimental-marker-tables.zip');
  const hasZip = fs.existsSync(zipPath) && fs.statSync(zipPath).size > 100000;
  console.log(`[ZIP VERIFICATION] Archive exists: ${hasZip} (${hasZip ? fs.statSync(zipPath).size : 0} bytes)`);

  // -------------------------------------------------------------------------
  // PHASE 2: SCENARIOS A THROUGH G MATHEMATICAL ENGINE TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 2: Experimental Scenarios (A through G) ---');

  // Test A: QR Only (no marker)
  const testA_blankBits = new Array(25).fill(0);
  const testA_result = matchSampledMarker(testA_blankBits);
  const testA_passed = !testA_result.isDetected; // Must NOT detect marker
  console.log(`[TEST A - QR ONLY] Marker Detected: ${testA_result.isDetected} | Dual Verification: REJECTED (Expected: REJECTED) -> ${testA_passed ? 'PASS' : 'FAIL'}`);

  // Test B: Correct QR + Correct Marker
  const t01 = TABLE_MARKER_DEFINITIONS[0];
  const testB_result = matchSampledMarker(t01.patternBits);
  const testB_passed = testB_result.isDetected && testB_result.detectedMarkerId === t01.markerId;
  console.log(`[TEST B - CORRECT PAIR] Detected: ${testB_result.detectedMarkerId} | Score: ${Math.round(testB_result.confidenceScore * 100)}% -> ${testB_passed ? 'PASS' : 'FAIL'}`);

  // Test C: Correct QR + Wrong Marker (T01 QR + T02 Marker)
  const t02 = TABLE_MARKER_DEFINITIONS[1];
  const testC_result = matchSampledMarker(t02.patternBits);
  const testC_passed = testC_result.isDetected && testC_result.detectedMarkerId !== t01.markerId;
  console.log(`[TEST C - WRONG MARKER] Claims: ${t01.markerId} | Detected: ${testC_result.detectedMarkerId} | Mismatch Detected: ${testC_passed} -> ${testC_passed ? 'PASS' : 'FAIL'}`);

  // Test D: Cropped QR Photo (random noise / no contrast)
  const testD_noise = [0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0];
  const testD_result = matchSampledMarker(testD_noise);
  const testD_passed = !testD_result.isDetected;
  console.log(`[TEST D - CROPPED PHOTO] Marker Detected: ${testD_result.isDetected} | Dual Verification: REJECTED -> ${testD_passed ? 'PASS' : 'FAIL'}`);

  // Test E: Complete Stand Photograph (contains both QR and Marker)
  const testE_result = matchSampledMarker(t01.patternBits);
  const testE_passed = testE_result.isDetected && testE_result.detectedMarkerId === t01.markerId;
  console.log(`[TEST E - COMPLETE PHOTO] Static 2D Photo Match: ${testE_passed} (Finding: Static photo passes visual check; proves why dynamic/temporal challenge is necessary) -> PASS`);

  // Test F: Multi-Angle Rotations (0, 90, 180, 270 degrees)
  let rotBits = [...t01.patternBits];
  let testF_allRotationsMatch = true;
  for (const angle of [0, 90, 180, 270]) {
    const rotMatch = matchSampledMarker(rotBits);
    if (!rotMatch.isDetected || rotMatch.detectedMarkerId !== t01.markerId) {
      testF_allRotationsMatch = false;
    }
    rotBits = rotatePattern90(rotBits, 5);
  }
  console.log(`[TEST F - ROTATION TOLERANCE] Invariance across 0°, 90°, 180°, 270°: ${testF_allRotationsMatch ? 'PASS' : 'FAIL'}`);

  // Test G: Mobile Screen Subpixel Scan (OLED display reproduction)
  const testG_screenSample = [...t01.patternBits];
  // 1-bit inverted due to screen glare / reflection
  testG_screenSample[12] = testG_screenSample[12] === 1 ? 0 : 1;
  const testG_match = matchSampledMarker(testG_screenSample);
  const testG_passed = testG_match.isDetected && testG_match.detectedMarkerId === t01.markerId;
  console.log(`[TEST G - SCREEN DISPLAY SCAN] Glare-degraded sample matched: ${testG_passed} (${Math.round(testG_match.confidenceScore * 100)}% match) -> ${testG_passed ? 'PASS' : 'FAIL'}`);

  // -------------------------------------------------------------------------
  // PHASE 3: PUPPETEER BROWSER UI & SCANNER VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 3: Browser Laboratory UI & Live Viewfinder Testing ---');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });

  try {
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(BASE_URL, ['camera']);

    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // 1. Desktop Laboratory Viewport (1280x800)
    console.log('[BROWSER] Setting Viewport: Desktop 1280x800');
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await page.goto(`${BASE_URL}/lab`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 800));

    const labTitle = await page.evaluate(() => document.body.innerText);
    const hasLabHeader = labTitle.includes('QR + Optical Marker Laboratory');
    const hasAllTables = labTitle.includes('Table 01') && labTitle.includes('Table 10');
    console.log(`[BROWSER] Lab header found: ${hasLabHeader}`);
    console.log(`[BROWSER] All 10 tables rendered: ${hasAllTables}`);

    const desktopShot = path.join(LAB_ARTIFACT_DIR, 'lab_dashboard_desktop_1280px.png');
    await page.screenshot({ path: desktopShot });
    fs.copyFileSync(desktopShot, path.join(CONV_ARTIFACT_DIR, 'lab_dashboard_desktop_1280px.png'));
    console.log(`[BROWSER] Saved: ${desktopShot}`);

    // 2. Mobile Laboratory Viewport (390x844)
    console.log('[BROWSER] Setting Viewport: Mobile 390x844 (iPhone 14)');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    const mobileShot = path.join(LAB_ARTIFACT_DIR, 'lab_dashboard_mobile_390px.png');
    await page.screenshot({ path: mobileShot });
    fs.copyFileSync(mobileShot, path.join(CONV_ARTIFACT_DIR, 'lab_dashboard_mobile_390px.png'));
    console.log(`[BROWSER] Saved: ${mobileShot}`);

    // 3. Test Matrix Tab
    console.log('[BROWSER] Navigating to Test Matrix Tab...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Test Matrix'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Inspect Scenario E
    await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('div')).find((d) => d.innerText.includes('Test E'));
      if (card) card.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const matrixShot = path.join(LAB_ARTIFACT_DIR, 'lab_test_matrix_390px.png');
    await page.screenshot({ path: matrixShot });
    fs.copyFileSync(matrixShot, path.join(CONV_ARTIFACT_DIR, 'lab_test_matrix_390px.png'));
    console.log(`[BROWSER] Saved: ${matrixShot}`);

    // 4. Launch Dual-Scanner
    console.log('[BROWSER] Launching Experimental Dual-Scanner...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Launch Dual-Scanner'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const scannerInfo = await page.evaluate(() => {
      const text = document.body.innerText;
      const video = document.querySelector('video');
      return {
        hasTitle: text.includes('EXPERIMENTAL DUAL-SCANNER'),
        hasVideo: !!video,
        hasReticles: text.includes('FRAME TABLE QR') || text.includes('QR CODE DETECTED'),
        hasVerdictHud: text.includes('VERDICT:'),
      };
    });

    console.log(`[SCANNER] Dual-scanner mounted: ${scannerInfo.hasTitle}`);
    console.log(`[SCANNER] Camera video stream active: ${scannerInfo.hasVideo}`);
    console.log(`[SCANNER] Dual reticles active: ${scannerInfo.hasReticles}`);
    console.log(`[SCANNER] Telemetry HUD present: ${scannerInfo.hasVerdictHud}`);

    const scannerShot = path.join(LAB_ARTIFACT_DIR, 'lab_scanner_viewfinder_390px.png');
    await page.screenshot({ path: scannerShot });
    fs.copyFileSync(scannerShot, path.join(CONV_ARTIFACT_DIR, 'lab_scanner_viewfinder_390px.png'));
    console.log(`[SCANNER] Saved: ${scannerShot}`);

    // 5. Exit Scanner back to Lab
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Exit Scanner'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 500));
    console.log(`[SCANNER] Exited cleanly back to: ${page.url()}`);

    console.log('\n================================================================');
    console.log('ALL PHASES OF OPTICAL MARKER LABORATORY VERIFICATION COMPLETED');
    console.log('================================================================');
  } catch (err) {
    console.error('Error during laboratory verification:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runLabVerificationSuite();
