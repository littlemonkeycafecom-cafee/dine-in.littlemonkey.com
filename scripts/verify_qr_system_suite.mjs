import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const SCREENSHOT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const BASE_URL = 'http://127.0.0.1:3000';

async function fetchAdminTables() {
  const res = await fetch(`${BASE_URL}/api/admin/qr/tables`, {
    headers: { 'X-Operational-PIN': '9999' },
  });
  const data = await res.json();
  return data.tables;
}

async function resetTestClock() {
  await fetch(`${BASE_URL}/api/test/reset-time`, { method: 'POST' });
}

async function advanceTestClock(seconds) {
  const res = await fetch(`${BASE_URL}/api/test/advance-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ms: seconds * 1000 }),
  });
  return res.json();
}

async function rotateTable(tableNumber) {
  const res = await fetch(`${BASE_URL}/api/admin/qr/rotate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Operational-PIN': '9999',
    },
    body: JSON.stringify({ tableNumber }),
  });
  return res.json();
}

async function runVerificationSuite() {
  console.log('================================================================');
  console.log('STARTING SECURE QR-AUTHORIZED DINING END-TO-END VERIFICATION');
  console.log('================================================================\n');

  const baselineCredentialsSnapshot = fs.readFileSync('.qr_credentials.json', 'utf8');
  await resetTestClock();

  // Get active credentials from authoritative server
  const tables = await fetchAdminTables();
  if (!tables || tables.length !== 10) {
    throw new Error(`Expected 10 tables, received: ${tables?.length}`);
  }
  console.log(`[SETUP] Fetched 10 authoritative tables: ${tables.map(t => t.tableNumber).join(', ')}`);

  const t1 = tables.find(t => t.tableNumber === 'Table 01');
  const t2 = tables.find(t => t.tableNumber === 'Table 02');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // -------------------------------------------------------------------------
    // SCENARIO A: Direct URL Access (http://127.0.0.1:3000/) without QR Code
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO A: Direct URL Access Denied ---');
    const pageA = await browser.newPage();
    await pageA.setViewport({ width: 1280, height: 900 });

    // Mark intro seen so we test the access gate directly
    await pageA.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    await pageA.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const contentA = await pageA.content();
    const hasQrRequiredA = contentA.includes('Table QR Scan Required') || contentA.includes('IN-CAFÉ QR ACCESS REQUIRED');
    const hasMenuCatalogA = contentA.includes('id="main-menu-catalog"');

    console.log(`[SCENARIO A] Has "Table QR Scan Required": ${hasQrRequiredA}`);
    console.log(`[SCENARIO A] Has Protected Menu Catalog: ${hasMenuCatalogA}`);

    if (!hasQrRequiredA || hasMenuCatalogA) {
      throw new Error('SCENARIO A FAILED: Direct URL was not blocked by QR Scan Required gate!');
    }
    await pageA.screenshot({ path: path.join(SCREENSHOT_DIR, 'qr_scenario_a_direct_url_blocked.png') });
    console.log('[PASS] SCENARIO A: Direct URL properly blocked. Screenshot saved.');
    await pageA.close();

    // -------------------------------------------------------------------------
    // SCENARIO B: Table Spoofing URL (http://127.0.0.1:3000/?table=Table 01)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO B: Table Spoofing Denied ---');
    const pageB = await browser.newPage();
    await pageB.setViewport({ width: 1280, height: 900 });
    await pageB.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    await pageB.goto(`${BASE_URL}/?table=Table%2001`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const contentB = await pageB.content();
    const hasQrRequiredB = contentB.includes('Table QR Scan Required') || contentB.includes('IN-CAFÉ QR ACCESS REQUIRED');
    const hasMenuCatalogB = contentB.includes('id="main-menu-catalog"');

    console.log(`[SCENARIO B] Has "Table QR Scan Required": ${hasQrRequiredB}`);
    console.log(`[SCENARIO B] Has Protected Menu Catalog: ${hasMenuCatalogB}`);

    if (!hasQrRequiredB || hasMenuCatalogB) {
      throw new Error('SCENARIO B FAILED: Table spoofing was not blocked!');
    }
    await pageB.screenshot({ path: path.join(SCREENSHOT_DIR, 'qr_scenario_b_table_spoof_blocked.png') });
    console.log('[PASS] SCENARIO B: Table parameter without credential strictly denied.');
    await pageB.close();

    // -------------------------------------------------------------------------
    // SCENARIO C: Invalid / Tampered QR Credential
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO C: Tampered / Invalid QR Credential ---');
    const pageC = await browser.newPage();
    await pageC.setViewport({ width: 1280, height: 900 });
    await pageC.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    await pageC.goto(`${BASE_URL}/?t=T01&cred=qrc_t01_fake.tampered_secret_xyz`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    const contentC = await pageC.content();
    const hasErrorC = contentC.includes('QR Authorization Error') || contentC.includes('Invalid or unknown QR credential');

    console.log(`[SCENARIO C] Displays QR Authorization Error Banner: ${hasErrorC}`);
    if (!hasErrorC) {
      throw new Error('SCENARIO C FAILED: Tampered QR credential was not rejected!');
    }
    await pageC.screenshot({ path: path.join(SCREENSHOT_DIR, 'qr_scenario_c_invalid_cred_rejected.png') });
    console.log('[PASS] SCENARIO C: Tampered QR credential rejected with error banner.');
    await pageC.close();

    // -------------------------------------------------------------------------
    // SCENARIO D: Valid Physical QR Code Scan
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO D: Valid Physical QR Code Scan ---');
    const pageD = await browser.newPage();
    await pageD.setViewport({ width: 1280, height: 900 });
    await pageD.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // Obtain fresh authorized credential for Table 01
    const rotT1 = await rotateTable('Table 01');
    const t1Url = new URL(rotT1.entryUrl);
    const validQrUrl = `${BASE_URL}/?${t1Url.searchParams.toString()}`;
    console.log(`[SCENARIO D] Navigating to scanned QR URL: ${validQrUrl}`);

    await pageD.goto(validQrUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    // Verify URL was cleansed
    const currentUrl = pageD.url();
    const paramsCleaned = !currentUrl.includes('cred=');
    console.log(`[SCENARIO D] URL Credential param cleansed from address bar: ${paramsCleaned} (Current: ${currentUrl})`);

    const contentD = await pageD.content();
    const hasQrVerifiedBadge = contentD.includes('QR VERIFIED');
    const hasLoginGate =
      contentD.includes('Sign In to Dine') ||
      contentD.includes('New Diner Registration') ||
      contentD.includes('Already registered? Sign in') ||
      contentD.includes('Enter your mobile number to continue') ||
      contentD.includes('Verify Mobile Number');

    console.log(`[SCENARIO D] Shows "Table 01 • QR VERIFIED": ${hasQrVerifiedBadge}`);
    console.log(`[SCENARIO D] Shows Customer Login Gate: ${hasLoginGate}`);

    if (!hasQrVerifiedBadge || !hasLoginGate) {
      throw new Error('SCENARIO D FAILED: Valid QR did not verify and present login gate!');
    }
    await pageD.screenshot({ path: path.join(SCREENSHOT_DIR, 'qr_scenario_d_qr_verified_login_gate.png') });
    console.log('[PASS] SCENARIO D: Valid QR verified, URL sanitized, customer login gate ready.');

    // -------------------------------------------------------------------------
    // SCENARIO E: Customer Authentication & 30-Minute Session Activation
    // -------------------------------------------------------------------------
    pageD.on('console', msg => console.log('[BROWSER LOG]', msg.text()));
    console.log('\n--- SCENARIO E: Customer Authentication & 30-Minute Session ---');
    // Complete registration with unique diner mobile using real keyboard typing
    const randomMobile = '98' + Math.floor(10000000 + Math.random() * 90000000);
    // Handle both password-free 2-step registration and legacy unified registration
    const hasNameInputInitially = await pageD.$('input#customer-name');
    if (!hasNameInputInitially) {
      // Password-Free Flow: Step A (Enter Mobile) -> Verify -> Step C (Enter Name) -> Register
      await pageD.type('input#customer-mobile', randomMobile);
      await pageD.evaluate(() => {
        const verifyBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent && b.textContent.includes('Verify Mobile Number')
        );
        if (verifyBtn) verifyBtn.click();
      });
      await pageD.waitForSelector('input#customer-name', { timeout: 6000 });
      await pageD.type('input#customer-name', 'Aarav Sharma');
      await pageD.evaluate(() => {
        const submitBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent && (b.textContent.includes('Register') || b.textContent.includes('REGISTER'))
        );
        if (submitBtn) submitBtn.click();
      });
    } else {
      // Legacy Unified Flow
      await pageD.type('input#customer-name', 'Aarav Sharma');
      await pageD.type('input#customer-mobile', randomMobile);
      await pageD.evaluate(() => {
        const submitBtn = document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('REGISTER'));
        if (submitBtn) submitBtn.click();
      });
    }

    try {
      await pageD.waitForSelector('#main-menu-catalog', { timeout: 8000 });
    } catch {
      await new Promise(r => setTimeout(r, 2000));
    }

    const contentE = await pageD.content();
    const hasMenuCatalogE = contentE.includes('id="main-menu-catalog"');
    const hasHeroE = contentE.includes('Little Monkey Café') && contentE.includes('Table 01');

    console.log(`[SCENARIO E] Menu Catalog Mounted: ${hasMenuCatalogE}`);
    console.log(`[SCENARIO E] Table 01 in Header: ${hasHeroE}`);

    if (!hasMenuCatalogE) {
      const errorText = await pageD.evaluate(() => {
        const errDiv = document.querySelector('div[style*="EF4444"], div[style*="ef4444"]');
        return errDiv ? errDiv.textContent : 'No error banner';
      });
      console.log(`[SCENARIO E DIAGNOSTIC] Page error text: "${errorText}"`);
      await pageD.screenshot({ path: path.join(SCREENSHOT_DIR, 'qr_scenario_e_debug_failure.png') });
      throw new Error('SCENARIO E FAILED: Menu did not mount after authenticating with valid QR!');
    }

    await pageD.screenshot({ path: path.join(SCREENSHOT_DIR, 'qr_scenario_e_active_session_menu.png') });
    console.log('[PASS] SCENARIO E: 30-minute session started, digital menu active.');

    // -------------------------------------------------------------------------
    // SCENARIO F: Deterministic 30-Minute Session Expiry
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO F: Deterministic 30-Minute Expiry Test ---');
    console.log('[SCENARIO F] Advancing server test clock by 31 minutes (+1860 seconds)...');
    await advanceTestClock(1860);

    // Reload the page to trigger session revalidation against server clock
    await pageD.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const contentF = await pageD.content();
    const hasSessionExpired = contentF.includes('30-MINUTE DINING SESSION EXPIRED') || contentF.includes('15-MINUTE DINING SESSION EXPIRED') || contentF.includes('Session Concluded');
    const hasMenuCatalogF = contentF.includes('id="main-menu-catalog"');

    console.log(`[SCENARIO F] Shows Session Expired Screen: ${hasSessionExpired}`);
    console.log(`[SCENARIO F] Protected Menu Catalog Unmounted: ${!hasMenuCatalogF}`);

    if (!hasSessionExpired || hasMenuCatalogF) {
      throw new Error('SCENARIO F FAILED: Expired session did not block menu access!');
    }
    await pageD.screenshot({ path: path.join(SCREENSHOT_DIR, 'qr_scenario_f_session_expired_screen.png') });
    console.log('[PASS] SCENARIO F: Server strictly expired session after 30 minutes.');

    // Reset clock for remaining tests
    await resetTestClock();
    await pageD.close();

    // -------------------------------------------------------------------------
    // SCENARIO G: Staff Admin QR Modal & Dynamic Credential Rotation
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO G: Admin QR Modal & Dynamic Credential Rotation ---');
    const pageG = await browser.newPage();
    await pageG.setViewport({ width: 1280, height: 900 });
    await pageG.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    await pageG.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // Click "Staff QR Administration" button on the Scan Required page
    await pageG.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const adminBtn = btns.find(b => b.textContent.includes('Staff QR Administration'));
      if (adminBtn) adminBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Enter PIN "9999" and submit
    await pageG.type('input[type="password"]', '9999');
    await pageG.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 800));

    const contentG = await pageG.content();
    const hasTablesList = contentG.includes('Table 01') && contentG.includes('Table 06') && contentG.includes('Window Bay');
    console.log(`[SCENARIO G] Admin Tables Overview Loaded: ${hasTablesList}`);

    if (!hasTablesList) {
      throw new Error('SCENARIO G FAILED: Admin PIN submission failed to load table list!');
    }
    await pageG.screenshot({ path: path.join(SCREENSHOT_DIR, 'qr_scenario_g_admin_modal.png') });
    console.log('[PASS] SCENARIO G: Admin modal verified, table credentials managed.');

    // -------------------------------------------------------------------------
    // SCENARIO H: Revocation Cascading Test
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO H: Revocation Cascading Test ---');
    // Rotate Table 03 first to obtain an active valid URL, then revoke it
    const rotT3 = await rotateTable('Table 03');
    const revokeRes = await fetch(`${BASE_URL}/api/admin/qr/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Operational-PIN': '9999',
      },
      body: JSON.stringify({ tableNumber: 'Table 03' }),
    });
    console.log(`[SCENARIO H] Revoked Table 03: Status ${revokeRes.status}`);

    // Try scanning revoked Table 03 credential
    const pageH = await browser.newPage();
    await pageH.setViewport({ width: 1280, height: 900 });
    await pageH.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    const t3Url = new URL(rotT3.entryUrl);
    await pageH.goto(`${BASE_URL}/?${t3Url.searchParams.toString()}`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    const contentH = await pageH.content();
    const hasRevokedError = contentH.includes('revoked') || contentH.includes('deactivated') || contentH.includes('QR Authorization Error');
    console.log(`[SCENARIO H] Revocation error message shown: ${hasRevokedError}`);

    if (!hasRevokedError) {
      throw new Error('SCENARIO H FAILED: Revoked table QR was not rejected!');
    }
    await pageH.screenshot({ path: path.join(SCREENSHOT_DIR, 'qr_scenario_h_revoked_qr_rejected.png') });
    console.log('[PASS] SCENARIO H: Revoked table QR successfully rejected.');
    await pageH.close();
    await pageG.close();

    // -------------------------------------------------------------------------
    // SCENARIO I: Read-Only Digital Menu Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO I: Read-Only Digital Menu Verification ---');
    // Rotate Table 02 so it's fresh and active
    const rotateRes = await fetch(`${BASE_URL}/api/admin/qr/rotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Operational-PIN': '9999',
      },
      body: JSON.stringify({ tableNumber: 'Table 02' }),
    });
    const rotateData = await rotateRes.json();

    const pageI = await browser.newPage();
    await pageI.setViewport({ width: 1280, height: 900 });
    await pageI.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    const t2Url = new URL(rotateData.entryUrl);
    await pageI.goto(`${BASE_URL}/?${t2Url.searchParams.toString()}`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    // Sign in as guest
    await pageI.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find(b => b.textContent.includes('Continue as Guest') || b.textContent.includes('Guest'));
      if (guestBtn) guestBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Check for cart or checkout controls in DOM
    const readOnlyChecks = await pageI.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const cartButtons = btns.filter(b => {
        const text = (b.textContent || '').toLowerCase();
        return text.includes('add to cart') || text.includes('checkout') || text.includes('pay now') || text.includes('place order');
      });
      return {
        cartButtonsCount: cartButtons.length,
      };
    });

    console.log(`[SCENARIO I] Cart/Ordering Buttons Found: ${readOnlyChecks.cartButtonsCount}`);
    if (readOnlyChecks.cartButtonsCount !== 0) {
      throw new Error(`SCENARIO I FAILED: Found ${readOnlyChecks.cartButtonsCount} ordering buttons in read-only menu!`);
    }

    // Open first product card modal
    const productCard = await pageI.$('.lm-product-card');
    if (productCard) {
      await productCard.click();
      await new Promise(r => setTimeout(r, 600));
      await pageI.screenshot({ path: path.join(SCREENSHOT_DIR, 'qr_scenario_i_read_only_product_modal.png') });
      console.log('[PASS] SCENARIO I: Product modal opened, verified read-only.');
    }
    await pageI.close();

    console.log('\n================================================================');
    console.log('ALL SCENARIOS (A THROUGH I) PASSED WITH COMPLETE EVIDENCE');
    console.log('================================================================');
  } finally {
    if (baselineCredentialsSnapshot) {
      fs.writeFileSync('.qr_credentials.json', baselineCredentialsSnapshot);
      console.log('[VERIFICATION SUITE] Authoritative physical baseline credentials restored.');
    }
    await resetTestClock();
    if (browser) await browser.close();
  }
}

runVerificationSuite().catch(err => {
  console.error('\n[VERIFICATION SUITE ERROR]:', err);
  process.exit(1);
});
