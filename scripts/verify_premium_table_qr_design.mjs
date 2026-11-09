import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as fastPng from 'fast-png';
import jsQR from 'jsqr';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const ROOT_DIR = process.cwd();
const STORAGE_DIR = path.join(ROOT_DIR, 'storage', 'qr-codes');
const ARTIFACTS_DIR = path.join(ROOT_DIR, 'test_artifacts', 'qr_design');
const BRAIN_ARTIFACTS_DIR = 'C:\\Users\\chava\\.gemini\\antigravity\\brain\\0844d1de-cdde-43df-8637-b53dd2806014\\screenshots';

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
if (fs.existsSync(BRAIN_ARTIFACTS_DIR)) {
  fs.mkdirSync(BRAIN_ARTIFACTS_DIR, { recursive: true });
}

function toRgba(decoded) {
  if (decoded.channels === 4) return decoded.data;
  if (decoded.channels === 3) {
    const rgba = new Uint8ClampedArray(decoded.width * decoded.height * 4);
    let srcIdx = 0;
    let dstIdx = 0;
    for (let i = 0; i < decoded.width * decoded.height; i++) {
      rgba[dstIdx] = decoded.data[srcIdx];
      rgba[dstIdx + 1] = decoded.data[srcIdx + 1];
      rgba[dstIdx + 2] = decoded.data[srcIdx + 2];
      rgba[dstIdx + 3] = 255;
      srcIdx += 3;
      dstIdx += 4;
    }
    return rgba;
  }
  throw new Error(`Unsupported channel count: ${decoded.channels}`);
}

async function run() {
  console.log('================================================================');
  console.log('VERIFYING LITTLE MONKEY PREMIUM TABLE QR ARTWORK & SUITE');
  console.log('================================================================');

  const manifestPath = path.join(STORAGE_DIR, 'index.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`[FAIL] Manifest index.json missing at ${manifestPath}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const tables = manifest.tables || [];

  const results = [];
  let allDecoded = true;

  console.log(`\n1. Validating 10 Physical Table QR Files & Optical Scannability:`);

  for (const table of tables) {
    const tableCode = table.shortCode;
    const svgPath = path.join(STORAGE_DIR, table.svgFile);
    const pngPath = path.join(STORAGE_DIR, table.pngFile);

    if (!fs.existsSync(svgPath)) {
      console.error(`[FAIL] Missing SVG: ${svgPath}`);
      allDecoded = false;
      continue;
    }
    if (!fs.existsSync(pngPath)) {
      console.error(`[FAIL] Missing PNG: ${pngPath}`);
      allDecoded = false;
      continue;
    }

    const pngBuffer = fs.readFileSync(pngPath);
    const decodedPng = fastPng.decode(pngBuffer);
    const rgba = toRgba(decodedPng);
    const qrResult = jsQR(rgba, decodedPng.width, decodedPng.height);

    if (!qrResult) {
      console.error(`[FAIL] jsQR failed to decode ${pngPath}`);
      allDecoded = false;
      results.push({
        tableNumber: table.tableNumber,
        tableCode: table.tableCode,
        status: 'FAILED_TO_DECODE',
      });
      continue;
    }

    const decodedPayload = qrResult.data;
    const isMatch = decodedPayload === table.entryUrl;

    if (isMatch) {
      console.log(`[PASS] ${table.tableNumber} (${tableCode}): Decoded 100% exact -> ${decodedPayload.substring(0, 65)}...`);
      results.push({
        tableNumber: table.tableNumber,
        tableCode,
        credentialId: table.credentialId,
        decodedPayload,
        status: 'VERIFIED',
      });
    } else {
      console.error(`[FAIL] Table ${numStr} payload mismatch!`);
      console.error(`  Expected: ${table.entryUrl}`);
      console.error(`  Decoded:  ${decodedPayload}`);
      allDecoded = false;
      results.push({
        tableNumber: table.tableNumber,
        tableCode,
        decodedPayload,
        status: 'MISMATCH',
      });
    }
  }

  // Check PDF
  const pdfPath = path.join(STORAGE_DIR, 'little-monkey-table-qrs.pdf');
  const pdfExists = fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 1000;
  console.log(`\n2. Consolidated A4 Print PDF: ${pdfExists ? 'EXISTS (' + fs.statSync(pdfPath).size + ' bytes)' : 'MISSING'}`);

  // Check index.html and index.json
  const htmlPath = path.join(STORAGE_DIR, 'index.html');
  const jsonPath = path.join(STORAGE_DIR, 'index.json');
  console.log(`3. Studio HTML: ${fs.existsSync(htmlPath) ? 'EXISTS' : 'MISSING'}`);
  console.log(`4. Manifest JSON: ${fs.existsSync(jsonPath) ? 'EXISTS' : 'MISSING'}`);

  // Visual Puppeteer captures of the studio previews
  console.log(`\n5. Generating Puppeteer Responsive Preview Screenshots...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const studioUrl = `file://${htmlPath.replace(/\\/g, '/')}`;

    // Desktop Acrylic Preview (1280px)
    await page.setViewport({ width: 1280, height: 960 });
    await page.goto(studioUrl, { waitUntil: 'networkidle0' });
    const desktopShotPath = path.join(ARTIFACTS_DIR, 'qr_preview_desktop_acrylic_1280px.png');
    await page.screenshot({ path: desktopShotPath });
    console.log(`[SAVED] Desktop Acrylic Preview: ${desktopShotPath}`);
    if (fs.existsSync(BRAIN_ARTIFACTS_DIR)) {
      fs.copyFileSync(desktopShotPath, path.join(BRAIN_ARTIFACTS_DIR, 'qr_preview_desktop_acrylic_1280px.png'));
    }

    // Mobile Viewport Preview (390px)
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(studioUrl, { waitUntil: 'networkidle0' });
    const mobileShotPath = path.join(ARTIFACTS_DIR, 'qr_preview_mobile_stand_390px.png');
    await page.screenshot({ path: mobileShotPath });
    console.log(`[SAVED] Mobile Stand Preview: ${mobileShotPath}`);
    if (fs.existsSync(BRAIN_ARTIFACTS_DIR)) {
      fs.copyFileSync(mobileShotPath, path.join(BRAIN_ARTIFACTS_DIR, 'qr_preview_mobile_stand_390px.png'));
    }

    // Print Layout Preview
    await page.setViewport({ width: 1200, height: 1600 });
    await page.goto(studioUrl, { waitUntil: 'networkidle0' });
    // Switch to print tab if tab button exists
    const printTabBtn = await page.$('button[data-tab="print"]');
    if (printTabBtn) {
      await printTabBtn.click();
      await new Promise(r => setTimeout(r, 400));
    }
    const printShotPath = path.join(ARTIFACTS_DIR, 'qr_preview_a4_print_sheet.png');
    await page.screenshot({ path: printShotPath });
    console.log(`[SAVED] A4 Print Sheet Preview: ${printShotPath}`);
    if (fs.existsSync(BRAIN_ARTIFACTS_DIR)) {
      fs.copyFileSync(printShotPath, path.join(BRAIN_ARTIFACTS_DIR, 'qr_preview_a4_print_sheet.png'));
    }
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log(`ALL TABLES VERIFICATION: ${allDecoded ? '100% PASSED' : 'FAILED'}`);
  console.log('================================================================');

  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'qr_verification_summary.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), allDecoded, results }, null, 2)
  );

  if (!allDecoded) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
