/**
 * scripts/verify_premium_ui_and_production_qr.mjs
 *
 * Comprehensive verification suite covering:
 * Part 1: Premium UI Simplification & Complete Motion Refinement
 * Part 2: Production QR Rebuild & Scan Reliability
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');
import png from 'fast-png';
import jsQR from 'jsqr';
import {
  AUTHORITATIVE_TABLES,
  getActiveCredentialForTable,
  getActiveRawSecretForTable,
  initializeQrStore,
} from '../src/server/qrAuthStore.ts';

const BASE_URL = 'http://127.0.0.1:3000';
const PROD_ORIGIN = 'https://dine-in.littlemonkey.com.vercel.app';
const ARTIFACTS_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';

async function runVerification() {
  console.log('================================================================');
  console.log('LITTLE MONKEY CAFÉ DINING — UI SIMPLIFICATION & PRODUCTION QR');
  console.log('================================================================\n');

  initializeQrStore();
  let passCount = 0;
  let totalCount = 0;

  function assert(condition, message) {
    totalCount++;
    if (condition) {
      passCount++;
      console.log(`[PASS] ${message}`);
    } else {
      console.error(`[FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 1: PRODUCTION QR SCAN RELIABILITY (10 TABLES)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- Phase 1: Verifying Production QR Rebuild (10 Tables) ---');

  for (const table of AUTHORITATIVE_TABLES) {
    const cred = getActiveCredentialForTable(table.tableNumber);
    const rawSecret = getActiveRawSecretForTable(table.tableNumber);
    const expectedUrl = `${PROD_ORIGIN}/?t=${table.shortCode}&cred=${cred.credentialId}.${rawSecret}`;

    // 1. Verify PNG File Optical Decoding
    const pngPath = path.resolve(process.cwd(), `storage/qr-codes/table-${table.shortCode.toLowerCase()}.png`);
    assert(fs.existsSync(pngPath), `Table ${table.tableNumber} PNG exists at ${pngPath}`);

    const pngBuffer = fs.readFileSync(pngPath);
    const decodedPng = png.decode(pngBuffer);
    const qrResult = jsQR(new Uint8ClampedArray(decodedPng.data), decodedPng.width, decodedPng.height);

    assert(Boolean(qrResult), `Table ${table.tableNumber} PNG optically decodes with jsQR`);
    assert(qrResult.data === expectedUrl, `Table ${table.tableNumber} QR points to exact production URL`);
    assert(qrResult.data.startsWith(PROD_ORIGIN), `Table ${table.tableNumber} QR uses production origin`);
    assert(!qrResult.data.includes('localhost') && !qrResult.data.includes('127.0.0.1'), `Table ${table.tableNumber} QR contains no loopback/localhost`);
  }

  // Verify Consolidated PDF exists
  const pdfPath = path.resolve(process.cwd(), 'storage/qr-codes/little-monkey-table-qrs.pdf');
  assert(fs.existsSync(pdfPath), `Consolidated A4 PDF exists (${fs.statSync(pdfPath).size} bytes)`);

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 2: PUPPETEER UI & MOTION VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Phase 2: Puppeteer UI Simplification & Motion Testing ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // 1. Capture Branded Intro Screen
    console.log('Capturing Branded Intro Screen...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${ARTIFACTS_DIR}/screenshot_01_branded_intro.png` });
    console.log(`Saved: screenshot_01_branded_intro.png`);

    // Dismiss intro screen for subsequent tests
    await page.evaluate(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // 2. Launch valid Table 01 session via genuine signed table URL
    const t01Cred = getActiveCredentialForTable('Table 01');
    const t01Secret = getActiveRawSecretForTable('Table 01');
    const t01DevUrl = `${BASE_URL}/?t=T01&cred=${t01Cred.credentialId}.${t01Secret}`;

    await page.goto(t01DevUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Sign in on CustomerLoginGate (try guest or form submission)
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find((b) => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) {
        guestBtn.click();
      }
    });

    await new Promise((r) => setTimeout(r, 1200));

    // Wait for dining application header to load
    await page.waitForSelector('header', { timeout: 8000 });
    const pageContent = await page.content();

    // 3. Header Timer Verification
    console.log('Verifying Header Timer Removal...');
    assert(pageContent.includes('Little Monkey Café'), 'Header retains Little Monkey Café brand wordmark');
    assert(pageContent.toUpperCase().includes('TABLE 01') || pageContent.toUpperCase().includes('T01'), 'Header retains Table 01 identifier');

    // Verify countdown timer is absent from customer-facing header
    const clockIcon = await page.$('header svg.lucide-clock');
    assert(!clockIcon, 'Clock icon is completely absent from customer header');

    const countdownText = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (!header) return null;
      const text = header.textContent || '';
      const match = text.match(/\b\d{1,2}:\d{2}\b/);
      return match ? match[0] : null;
    });
    assert(!countdownText, 'Countdown timer display (mm:ss) is completely absent from header');

    // 4. Hero Controls Verification
    console.log('Verifying Hero Controls Simplification...');
    const exploreBtn = await page.$('.lm-hero-explore-btn');
    assert(Boolean(exploreBtn), 'Explore Menu button is present as primary hero control');

    // Verify "All Items" selector is absent from the hero control area
    const heroCategoryDropdown = await page.evaluate(() => {
      const hero = document.querySelector('.lm-hero-coverflow-container, .lm-hero-controls, .lm-interactive-btn');
      const text = document.querySelector('.lm-hero-explore-btn')?.parentElement?.textContent || '';
      return text.includes('Categories') || text.includes('All Items');
    });
    assert(!heroCategoryDropdown, 'Categories / All Items dropdown is absent from hero control area');

    // Verify "Veg Only" toggle switch is absent from the hero control area
    const heroVegToggle = await page.evaluate(() => {
      const exploreBtn = document.querySelector('.lm-hero-explore-btn');
      const parent = exploreBtn?.parentElement;
      return parent ? parent.textContent?.includes('Veg Only') : false;
    });
    assert(!heroVegToggle, 'Veg Only toggle switch is absent from hero control area');

    // 5. Floating Navigation Pill Verification
    console.log('Verifying Floating Navigation Pill Removal...');
    const floatingNav = await page.$('nav[aria-label="Dining Navigation"], .lm-floating-nav');
    assert(!floatingNav, 'Floating navigation pill (Menu/Account) is completely absent');

    // 6. Must-Try Section Verification
    console.log('Verifying Must-Try Section Editorial Redesign...');
    const mustTrySection = await page.$('.lm-must-try-editorial-section');
    assert(Boolean(mustTrySection), 'Editorial Must-Try Specialties section is rendered');

    // Verify both authoritative products are present
    const mustTryText = await page.evaluate(() => {
      const sec = document.querySelector('.lm-must-try-editorial-section');
      return sec ? sec.textContent : '';
    });
    assert(mustTryText.includes('Tiger Bomb Cold Brew'), 'Tiger Bomb Cold Brew is present in Must-Try section');
    assert(mustTryText.includes('Mont Blanc Cold Brew'), 'Mont Blanc Cold Brew is present in Must-Try section');
    assert(mustTryText.includes('₹234'), 'Tiger Bomb Cold Brew exact price (₹234) is preserved');
    assert(mustTryText.includes('₹284'), 'Mont Blanc Cold Brew exact price (₹284) is preserved');
    assert(!mustTryText.includes('2 Master Items'), 'Tacky "2 Master Items" badge is removed');

    // 7. Verify Zero Ordering Controls
    console.log('Verifying Zero Ordering Controls Invariant...');
    const orderControls = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, span'));
      const cartKeywords = ['ADD TO CART', 'ADD TO ORDER', 'CHECKOUT', 'VIEW CART', 'PLACE ORDER'];
      return buttons.filter((b) => {
        const text = (b.textContent || '').trim().toUpperCase();
        return cartKeywords.some((k) => text.includes(k));
      }).map((b) => b.textContent?.trim());
    });
    assert(orderControls.length === 0, `0 customer ordering / cart buttons found (found: ${orderControls.length})`);

    // 8. Test Product Detail Modal
    console.log('Verifying Product Detail Modal...');
    const firstViewBtn = await page.$('.lm-must-try-view-btn');
    assert(Boolean(firstViewBtn), 'View button exists on Must-Try card');

    await firstViewBtn.click();
    await page.waitForSelector('.lm-modal-backdrop, [role="dialog"], h1', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400)); // wait for entrance animation

    await page.screenshot({ path: `${ARTIFACTS_DIR}/screenshot_05_product_detail_modal.png` });
    console.log('Saved: screenshot_05_product_detail_modal.png');

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]') ||
        Array.from(document.querySelectorAll('button')).find((b) => b.querySelector('svg.lucide-x') || b.textContent?.includes('Close'));
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // 9. Capture Hero Carousel & Simplified Menu Controls
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: `${ARTIFACTS_DIR}/screenshot_02_hero_carousel_simplified.png` });
    console.log('Saved: screenshot_02_hero_carousel_simplified.png');

    // Scroll to Must-Try section and capture
    await page.evaluate(() => {
      const el = document.querySelector('.lm-must-try-editorial-section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: `${ARTIFACTS_DIR}/screenshot_04_must_try_editorial.png` });
    console.log('Saved: screenshot_04_must_try_editorial.png');

    // Scroll to Menu Section and capture
    await page.evaluate(() => {
      const el = document.getElementById('main-menu-catalog');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: `${ARTIFACTS_DIR}/screenshot_03_menu_controls.png` });
    console.log('Saved: screenshot_03_menu_controls.png');

    // 10. Capture Desktop 1440px
    await page.setViewport({ width: 1440, height: 900 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: `${ARTIFACTS_DIR}/screenshot_08_desktop_1440px.png` });
    console.log('Saved: screenshot_08_desktop_1440px.png');

    // 11. Capture Tablet 768px
    await page.setViewport({ width: 768, height: 1024 });
    await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'instant' }));
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: `${ARTIFACTS_DIR}/screenshot_07_tablet_768px.png` });
    console.log('Saved: screenshot_07_tablet_768px.png');

    // 12. Capture Mobile 390px
    await page.setViewport({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo({ top: 250, behavior: 'instant' }));
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: `${ARTIFACTS_DIR}/screenshot_06_mobile_390px.png` });
    console.log('Saved: screenshot_06_mobile_390px.png');

    // 13. Test all 7 Viewports for Horizontal Overflow
    console.log('\n--- Testing 7 Viewport Widths for Overflow & Layout Stability ---');
    const testViewports = [375, 390, 430, 768, 1024, 1280, 1440];
    for (const width of testViewports) {
      await page.setViewport({ width, height: 900 });
      await new Promise((r) => setTimeout(r, 100));
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      assert(!hasOverflow, `No horizontal overflow at ${width}px viewport`);
    }

    // 14. Capture Developer QR Preview Modal
    console.log('\n--- Capturing Developer QR Preview Modal ---');
    // Open TableQrRequiredGate by clearing session
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });

    // Click QR button on Table 01 card in DevTableLauncher
    const qrBtn = await page.$('button[title*="Inspect QR Code for Table 01"]');
    if (qrBtn) {
      await qrBtn.click();
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: `${ARTIFACTS_DIR}/screenshot_09_dev_qr_preview_modal.png` });
      console.log('Saved: screenshot_09_dev_qr_preview_modal.png');
    }

    console.log(`\n================================================================`);
    console.log(`ALL VERIFICATION CHECKS PASSED: ${passCount} / ${totalCount}`);
    console.log(`================================================================\n`);
  } finally {
    await browser.close();
  }
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
