/**
 * test_complete_dual_factor_repair_suite.mjs
 *
 * End-to-end verification of:
 * 1. Strict dual-factor policy (QR + Symbol + Code all required).
 * 2. Seamless mobile transition into DualFactorChallengeGate upon QR scan.
 * 3. Rejection of partial factors (symbol only or code only).
 * 4. Rejection of incorrect symbol or incorrect code.
 * 5. Successful session authorization upon valid symbol + code.
 * 6. Admin preview modal rendering complete tabletop stand artwork with symbol and code.
 * 7. Screenshot captures of both mobile challenge gate and desktop admin preview.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  AUTHORITATIVE_TABLES,
  AUTHORITATIVE_TABLE_2FA,
  getActiveCredentialForTable,
  getActiveRawSecretForTable,
  getTable2FaConfig,
  verifyDualFactor,
} from '../src/server/qrAuthStore.ts';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runRepairVerificationSuite() {
  console.log('================================================================');
  console.log('LITTLE MONKEY CAFÉ — DUAL-FACTOR REPAIR VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, name, details = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] Test ${total}: ${name}`);
    } else {
      console.error(`  [FAIL] Test ${total}: ${name} — ${details}`);
    }
  }

  // 1. Get Table 01 details
  const t01Cred = getActiveCredentialForTable('Table 01');
  const t01Secret = getActiveRawSecretForTable('Table 01');
  const t01Config = getTable2FaConfig('Table 01');

  if (!t01Cred || !t01Secret || !t01Config) {
    console.error('Fatal: Table 01 credentials not found');
    process.exit(1);
  }

  const fullCred = `${t01Cred.credentialId}.${t01Secret}`;

  // ---------------------------------------------------------------------------
  // STEP 1: REST API POLICY VERIFICATION (Localhost & Tunnel)
  // ---------------------------------------------------------------------------
  console.log('--- CATEGORY 1: STRICT 3-FACTOR POLICY API VERIFICATION ---');

  // Test 1: Initial Scan (QR only) yields requires2fa: true
  {
    const res = await fetch('http://127.0.0.1:3000/api/dine-in/verify-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: fullCred }),
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.requires2fa === true && typeof data.challengeToken === 'string' && data.tableNumber === 'Table 01',
      'Initial QR scan initiates 2FA challenge without granting dining access',
      `status=${res.status}, requires2fa=${data.requires2fa}`
    );
  }

  // Test 2: Submitting only symbol to /api/dine-in/verify-2fa fails with MISSING_SECOND_FACTOR
  {
    const res = await fetch('http://127.0.0.1:3000/api/dine-in/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: fullCred, symbol: t01Config.symbol }),
    });
    const data = await res.json();
    assert(
      res.status === 400 && data.error === 'MISSING_SECOND_FACTOR',
      'Submitting symbol alone without 4-character code is rejected',
      `status=${res.status}, error=${data.error}`
    );
  }

  // Test 3: Submitting only code to /api/dine-in/verify-2fa fails with MISSING_SECOND_FACTOR
  {
    const res = await fetch('http://127.0.0.1:3000/api/dine-in/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: fullCred, code: t01Config.code }),
    });
    const data = await res.json();
    assert(
      res.status === 400 && data.error === 'MISSING_SECOND_FACTOR',
      'Submitting 4-character code alone without table symbol is rejected',
      `status=${res.status}, error=${data.error}`
    );
  }

  // Test 4: Submitting correct symbol + incorrect code fails with VERIFICATION_FAILED
  {
    const res = await fetch('http://127.0.0.1:3000/api/dine-in/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: fullCred, symbol: t01Config.symbol, code: 'WRNG' }),
    });
    const data = await res.json();
    assert(
      res.status === 400 && data.error === 'VERIFICATION_FAILED',
      'Submitting correct symbol + wrong code is rejected',
      `status=${res.status}, error=${data.error}`
    );
  }

  // Test 5: Submitting incorrect symbol + correct code fails with VERIFICATION_FAILED
  {
    const res = await fetch('http://127.0.0.1:3000/api/dine-in/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: fullCred, symbol: '❖', code: t01Config.code }),
    });
    const data = await res.json();
    assert(
      res.status === 400 && data.error === 'VERIFICATION_FAILED',
      'Submitting wrong symbol + correct code is rejected',
      `status=${res.status}, error=${data.error}`
    );
  }

  // Test 6: Submitting correct symbol + correct code succeeds and issues qrProofToken
  {
    const res = await fetch('http://127.0.0.1:3000/api/dine-in/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: fullCred, symbol: t01Config.symbol, code: t01Config.code }),
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.valid === true && typeof data.qrProofToken === 'string' && data.tableNumber === 'Table 01',
      'Submitting both matching symbol AND code authorizes table proof token',
      `status=${res.status}, valid=${data.valid}`
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 2: CLOUDFLARE TUNNEL CONNECTIVITY CHECK
  // ---------------------------------------------------------------------------
  console.log('\n--- CATEGORY 2: TUNNEL VERIFICATION ---');
  const tunnelBaseUrl = 'https://satellite-exams-nerve-fans.trycloudflare.com';
  try {
    const tRes = await fetch(`${tunnelBaseUrl}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'T01', cred: fullCred }),
    });
    const tData = await tRes.json();
    assert(
      tRes.status === 200 && tData.requires2fa === true,
      'Tunnel URL responds and initiates 2FA challenge correctly',
      `status=${tRes.status}`
    );
  } catch (err) {
    assert(false, 'Tunnel connectivity check', err.message);
  }

  // ---------------------------------------------------------------------------
  // STEP 3: PUPPETEER MOBILE USER JOURNEY (QR SCAN -> 2FA CHALLENGE -> LOGIN)
  // ---------------------------------------------------------------------------
  console.log('\n--- CATEGORY 3: PUPPETEER MOBILE SCAN & 2FA EXPERIENCE ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    // Mark intro seen so it bypasses splash screen directly to scanned QR handler
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    const targetUrl = `http://127.0.0.1:3000/?t=T01&cred=${encodeURIComponent(fullCred)}`;
    console.log(`[PUPPETEER] Navigating mobile client to: ${targetUrl.slice(0, 60)}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 15000 });

    // Wait for the DualFactorChallengeGate to render
    await page.waitForSelector('input#table-code-input', { timeout: 10000 });

    const challengeHeading = await page.$eval('h1', (el) => el.textContent);
    assert(
      challengeHeading.includes('Table 01') || challengeHeading.includes('Table'),
      'Mobile client successfully enters DualFactorChallengeGate (no error screen)',
      `Heading: "${challengeHeading}"`
    );

    // Verify Factor 1 Verified badge
    const factor1Badge = await page.evaluate(() => {
      const text = document.body.innerText.toUpperCase();
      return text.includes('FACTOR 1 VERIFIED') || text.includes('TABLE QR CREDENTIAL');
    });
    assert(factor1Badge, 'Factor 1 (Table QR Credential) verified badge is visible on mobile');

    // Capture screenshot of mobile challenge gate
    const mobileScreenPath = path.join(SCREENSHOT_DIR, 'mobile_2fa_challenge_screen.png');
    await page.screenshot({ path: mobileScreenPath, fullPage: true });
    console.log(`[SCREENSHOT] Saved mobile 2FA challenge screen to: ${mobileScreenPath}`);

    // Verify submit button is initially disabled
    const isButtonDisabledInitially = await page.$eval('button[type="submit"]', (btn) => btn.disabled);
    assert(isButtonDisabledInitially, 'Submit button is disabled before symbol and code entry');

    // Click on table symbol button ◈
    await page.evaluate((sym) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find((b) => b.textContent && b.textContent.includes(sym));
      if (target) target.click();
    }, t01Config.symbol);

    // Type 4-character code
    await page.type('input#table-code-input', t01Config.code);

    // Wait a tick for React state to update
    await new Promise((r) => setTimeout(r, 200));

    // Verify submit button is now enabled
    const isButtonEnabledNow = await page.$eval('button[type="submit"]', (btn) => !btn.disabled);
    assert(isButtonEnabledNow, 'Submit button is enabled after entering both symbol and 4-character code');

    // Click submit to complete 2FA
    await page.click('button[type="submit"]');

    // Wait for customer login gate to appear
    await page.waitForSelector('input[type="tel"]', { timeout: 10000 });

    const customerLoginPrompt = await page.evaluate(() => document.body.innerText.toUpperCase());
    assert(
      customerLoginPrompt.includes('TABLE 01') && (customerLoginPrompt.includes('MOBILE') || customerLoginPrompt.includes('PHONE') || customerLoginPrompt.includes('WELCOME')),
      'Mobile client transitions to Customer Login Gate after successful 2FA submission'
    );

    // Capture screenshot of Customer Login Gate with Table 01 authorized
    const mobileLoginScreenPath = path.join(SCREENSHOT_DIR, 'mobile_customer_login_authorized.png');
    await page.screenshot({ path: mobileLoginScreenPath, fullPage: true });
    console.log(`[SCREENSHOT] Saved customer login screen to: ${mobileLoginScreenPath}`);

    // -------------------------------------------------------------------------
    // STEP 4: PUPPETEER DESKTOP ADMIN PREVIEW MODAL VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- CATEGORY 4: PUPPETEER DESKTOP ADMIN PREVIEW MODAL ---');
    const desktopPage = await browser.newPage();
    await desktopPage.setViewport({ width: 1280, height: 800 });

    await desktopPage.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // Open home page with unlocked dev launcher
    await desktopPage.goto('http://127.0.0.1:3000/?pin=9999', { waitUntil: 'networkidle2' });

    // Wait for TableQrRequiredGate to render
    await desktopPage.waitForSelector('button', { timeout: 10000 });

    // Click "Artwork" on Table 01 card in the DevTableLauncher to open the preview modal
    await desktopPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const artworkBtn = buttons.find((b) => b.textContent && b.textContent.includes('Artwork'));
      if (artworkBtn) artworkBtn.click();
    });

    // Wait for preview modal to open
    await desktopPage.waitForSelector('img[alt*="Tabletop Stand Artwork"]', { timeout: 10000 });

    const standTabVisible = await desktopPage.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Complete Stand Artwork') && text.includes('QR Module Only');
    });
    assert(standTabVisible, 'Admin preview modal shows both "Complete Stand Artwork" and "QR Module Only" tabs');

    const artworkImgSrc = await desktopPage.$eval('img[alt*="Tabletop Stand Artwork"]', (img) => img.src);
    assert(
      artworkImgSrc.includes('/api/admin/qr/artwork') && artworkImgSrc.includes('format=svg'),
      'Admin preview modal renders full vector SVG tabletop stand artwork',
      `src=${artworkImgSrc.slice(0, 60)}`
    );

    // Capture screenshot of the tabletop stand artwork preview modal
    const desktopPreviewPath = path.join(SCREENSHOT_DIR, 'desktop_tabletop_stand_preview_modal.png');
    await desktopPage.screenshot({ path: desktopPreviewPath });
    console.log(`[SCREENSHOT] Saved desktop tabletop stand preview modal to: ${desktopPreviewPath}`);

    // Click on "QR Module Only" tab
    await desktopPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const qrTab = buttons.find((b) => b.textContent && b.textContent.includes('QR Module Only'));
      if (qrTab) qrTab.click();
    });

    await new Promise((r) => setTimeout(r, 400));

    // Verify vector QR SVG is visible
    const qrSvgVisible = await desktopPage.$eval('svg[aria-label*="Table QR"]', (s) => Boolean(s));
    assert(qrSvgVisible, '"QR Module Only" tab switches cleanly to render vector QR module');

    const desktopQrModulePath = path.join(SCREENSHOT_DIR, 'desktop_qr_module_only_tab.png');
    await desktopPage.screenshot({ path: desktopQrModulePath });
    console.log(`[SCREENSHOT] Saved desktop QR module only preview to: ${desktopQrModulePath}`);

  } catch (err) {
    console.error('Puppeteer verification failed:', err);
    assert(false, 'Puppeteer verification flow', err.message);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log(`REPAIR SUITE RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log(`STATUS: ${passed === total ? 'ALL TESTS PASSED (100% REPAIRED)' : 'FAILURES DETECTED'}`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runRepairVerificationSuite();
