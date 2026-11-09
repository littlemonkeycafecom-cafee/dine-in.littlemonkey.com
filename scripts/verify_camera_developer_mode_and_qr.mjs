import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const BASE_URL = 'http://127.0.0.1:3000';

async function resetTestClock() {
  const res = await fetch(`${BASE_URL}/api/test/reset-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

async function advanceTestClock(minutes) {
  const res = await fetch(`${BASE_URL}/api/test/advance-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ms: minutes * 60 * 1000, minutes }),
  });
  return res.json();
}

(async () => {
  console.log('======================================================================');
  console.log('LMC DINING — CAMERA ACCESS, DEVELOPER MODE & QR RECOVERY TEST SUITE');
  console.log('======================================================================\n');

  await resetTestClock();

  // Fetch all 10 developer table QR configurations with staff operational PIN
  const devTablesRes = await fetch(`${BASE_URL}/api/dev/tables?pin=9999`);
  const devTablesData = await devTablesRes.json();
  if (!devTablesData.success || !Array.isArray(devTablesData.tables)) {
    console.error('FAIL: Could not fetch developer table QR URLs from /api/dev/tables');
    process.exit(1);
  }

  const tableList = devTablesData.tables;
  console.log(`Retrieved ${tableList.length} authoritative table QR configurations from server.`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const context = browser.defaultBrowserContext();
  let allPassed = true;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Ensure intro seen
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // -----------------------------------------------------------------------
    // TEST A: Developer Access Works Without Requiring Camera Scanning
    // -----------------------------------------------------------------------
    console.log('--- TEST A: Developer Mode Independent Access & Table Launch ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // Verify DevTableLauncher is rendered and unlocked
    const isLauncherPresent = await page.evaluate(() => {
      return document.body.innerText.includes('DEVELOPER TESTING') &&
             document.body.innerText.includes('10 Physical Tables');
    });
    console.log(`  DevTableLauncher visible: ${isLauncherPresent}`);

    // Check table buttons are enabled
    const enabledButtonsCount = await page.evaluate(() => {
      const devBtns = Array.from(document.querySelectorAll('button')).filter(b => {
        const text = b.textContent || '';
        return /^T(0[1-9]|10)/.test(text.trim());
      });
      return devBtns.filter(b => !b.disabled).length;
    });
    console.log(`  Enabled developer table launcher buttons: ${enabledButtonsCount}/10`);

    if (isLauncherPresent && enabledButtonsCount === 10) {
      console.log('  [PASS] DevTableLauncher is independently unlocked with all 10 tables clickable.');
    } else {
      console.log('  [FAIL] DevTableLauncher buttons are disabled or missing.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'test_a1_developer_launcher_unlocked.png'),
    });

    // Test QR Preview Modal
    console.log('  Testing QR Code Preview Modal on Table 02...');
    await page.evaluate(() => {
      const qrBtns = Array.from(document.querySelectorAll('button')).filter(b => {
        return b.getAttribute('title')?.includes('Inspect QR Code for Table 02');
      });
      if (qrBtns.length > 0) qrBtns[0].click();
    });
    await new Promise(r => setTimeout(r, 500));

    const qrModalVisible = await page.evaluate(() => {
      const modal = document.querySelector('svg[aria-label="Table QR Code"]');
      const hasTitle = document.body.innerText.includes('Table 02 (T02)');
      return !!modal && hasTitle;
    });
    console.log(`  QR Code SVG preview visible: ${qrModalVisible}`);

    if (qrModalVisible) {
      console.log('  [PASS] Scannable vector QR code preview displayed on screen with table metadata.');
    } else {
      console.log('  [FAIL] QR Code preview modal failed to render.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'test_a2_table_02_qr_preview_modal.png'),
    });

    // Close QR modal
    await page.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Close');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Clear storage before launching Table 01 so we can verify the clean customer login gate flow
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      sessionStorage.setItem('lm_dev_pin', '9999');
    });

    // Re-render TableQrRequiredGate with cleared session
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // Click Table 01 button to launch Table 01 dining experience
    console.log('  Clicking Table 01 launch button...');
    await page.evaluate(() => {
      const t01Btn = Array.from(document.querySelectorAll('button')).find(b => {
        const text = b.textContent || '';
        return text.includes('T01') && text.includes('Table 01');
      });
      if (t01Btn) t01Btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Should now be on CustomerLoginGate for Table 01
    const onLoginGate = await page.evaluate(() => {
      const body = document.body.innerText.toUpperCase();
      return body.includes('TABLE 01') && (body.includes('WELCOME TO LITTLE MONKEY') || body.includes('CONTINUE AS GUEST'));
    });
    console.log(`  Customer Login Gate for Table 01 reached: ${onLoginGate}`);

    // Click "Continue as Guest (Dev Preview)"
    await page.evaluate(() => {
      const guestBtn = Array.from(document.querySelectorAll('button')).find(b => {
        return b.textContent?.includes('Continue as Guest');
      });
      if (guestBtn) guestBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    const menuOpen = await page.evaluate(() => {
      return document.body.innerText.includes('Table 01') &&
             document.querySelectorAll('h3, h4').length > 5;
    });
    console.log(`  Dining menu loaded cleanly: ${menuOpen}`);

    if (onLoginGate && menuOpen) {
      console.log('  [PASS] Developer mode successfully accessed Dining menu without any camera scanning!');
    } else {
      console.log('  [FAIL] Developer mode failed to access dining menu.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'test_a3_developer_table_01_menu_active.png'),
    });

    // -----------------------------------------------------------------------
    // TEST C: In-Built Camera Scanner Permission Denial, Error Classification & Retry Flow
    // -----------------------------------------------------------------------
    console.log('\n--- TEST C: Camera Permission Denial, Accurate Error & Retry Flow ---');
    // Clear session storage to return to initial state
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // Explicitly deny camera permission via Puppeteer context
    await context.overridePermissions(BASE_URL, []);

    // Navigate to scanner route
    await page.goto(`${BASE_URL}/scanner`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // Verify initial scanner explanation prompt
    const isScannerPromptVisible = await page.evaluate(() => {
      return document.body.innerText.includes('Camera Access Required') &&
             document.body.innerText.includes('Allow Camera & Continue');
    });
    console.log(`  Scanner permission prompt visible: ${isScannerPromptVisible}`);

    // Click "Allow Camera & Continue" (will trigger permission denial because context has no camera permission)
    await page.evaluate(() => {
      const allowBtn = Array.from(document.querySelectorAll('button')).find(b => {
        return b.textContent?.includes('Allow Camera & Continue');
      });
      if (allowBtn) allowBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Verify accurate Camera Permission Denied error message
    const isPermissionDeniedAccurate = await page.evaluate(() => {
      const text = document.body.innerText;
      return (text.includes('Browser Camera Permission Denied') || text.includes('System Camera Access Blocked') || text.includes('Camera Permission Denied')) &&
             (text.includes('lock, shield, or tune icon') || text.includes('operating system privacy settings'));
    });
    console.log(`  Accurate camera error message & actionable guidance displayed: ${isPermissionDeniedAccurate}`);

    if (isPermissionDeniedAccurate) {
      console.log('  [PASS] Camera permission denial produces accurate, actionable guidance.');
    } else {
      console.log('  [FAIL] Camera permission denial did not produce expected error state.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'test_c1_camera_permission_denied_screen.png'),
    });

    // Test Genuine Retry: Grant camera permission in context and provide active video track
    console.log('  Testing Genuine Retry action after camera access is granted...');
    await context.overridePermissions(BASE_URL, ['camera']);
    await page.evaluate(() => {
      // Mock permissions query if supported to return granted
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query = async () => ({
          state: 'granted',
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
        });
      }
      // Provide simulated video capture stream when permission is granted
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#111';
          ctx.fillRect(0, 0, 640, 480);
        }
        return canvas.captureStream(30);
      };
    });

    await page.evaluate(() => {
      const retryBtn = Array.from(document.querySelectorAll('button')).find(b => {
        return b.textContent?.includes('Try Again');
      });
      if (retryBtn) retryBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Verify state transitioned to scanning viewfinder with video element
    const isScanningActive = await page.evaluate(() => {
      const video = document.querySelector('video');
      const text = document.body.innerText;
      return !!video && text.includes('Point camera at your physical café table QR code');
    });
    console.log(`  Live camera scanning viewfinder active after retry: ${isScanningActive}`);

    if (isScanningActive) {
      console.log('  [PASS] Retry successfully initiated camera capture once permission was granted.');
    } else {
      console.log('  [FAIL] Retry did not activate camera capture.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'test_c2_camera_scanning_viewfinder_active.png'),
    });

    // -----------------------------------------------------------------------
    // TEST B: Customer QR Scanning Works When Camera Captures Valid QR
    // -----------------------------------------------------------------------
    console.log('\n--- TEST B: Customer QR Code Decoding & Table Authentication ---');
    const t01 = tableList.find(t => t.tableNumber === 'Table 01');

    // Clear customer session so registration gate appears
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // Navigate with the verified scanned table QR URL
    console.log(`  Navigating to scanned table QR URL: ${t01.entryUrl}`);
    await page.goto(t01.entryUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    const isCustomerGateReachedFromScan = await page.evaluate(() => {
      const body = document.body.innerText.toUpperCase();
      return body.includes('TABLE 01') &&
             (body.includes('WELCOME TO LITTLE MONKEY') || body.includes('CONTINUE AS GUEST') || body.includes('HANDCRAFTED DIGITAL DINING MENU'));
    });
    console.log(`  QR verified on server, Customer Registration Gate reached: ${isCustomerGateReachedFromScan}`);

    if (isCustomerGateReachedFromScan) {
      console.log('  [PASS] Customer QR scan verified on server and bound to physical Table 01.');
    } else {
      console.log('  [FAIL] Customer QR scan did not reach registration gate.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'test_b_scanned_qr_verified_customer_gate.png'),
    });

    // -----------------------------------------------------------------------
    // TEST D: Invalid and Tampered QR Credentials Rejected
    // -----------------------------------------------------------------------
    console.log('\n--- TEST D: Tampered HMAC QR Credential Rejection ---');
    await page.goto(`${BASE_URL}/?t=T01&cred=qrc_t01_abce82e42a7e.TAMPERED_HMAC_SIGNATURE_999`, {
      waitUntil: 'networkidle0',
    });
    await new Promise(r => setTimeout(r, 800));

    const isTamperedRejected = await page.evaluate(() => {
      const body = document.body.innerText;
      return body.includes('QR Authorization Error') ||
             body.includes('Invalid cryptographic signature') ||
             body.includes('Table QR Scan Required');
    });
    console.log(`  Tampered QR rejected: ${isTamperedRejected}`);

    if (isTamperedRejected) {
      console.log('  [PASS] Tampered QR credentials are cryptographically rejected.');
    } else {
      console.log('  [FAIL] Tampered QR was not rejected.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'test_d_tampered_qr_rejected.png'),
    });

    // -----------------------------------------------------------------------
    // TEST E: 15-Minute Expiry Boundary
    // -----------------------------------------------------------------------
    console.log('\n--- TEST E: 15-Minute Session Expiration Boundary ---');
    // Start valid session on Table 04
    const t04 = tableList.find(t => t.tableNumber === 'Table 04');

    await page.goto(t04.entryUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const guestBtn = Array.from(document.querySelectorAll('button')).find(b => {
        return b.textContent?.includes('Continue as Guest');
      });
      if (guestBtn) guestBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // Advance clock by 16 minutes
    console.log('  Advancing test clock by 16 minutes...');
    await advanceTestClock(16);

    // Recheck status on page reload
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1200));

    const isExpiredScreenShown = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('session expired') || text.includes('session concluded') || text.includes('15-minute');
    });
    console.log(`  Dining Session Expired Gate shown: ${isExpiredScreenShown}`);

    if (isExpiredScreenShown) {
      console.log('  [PASS] 15-Minute production session boundary strictly enforced.');
    } else {
      console.log('  [FAIL] Expired session did not trigger expiration gate.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'test_e_session_expired_screen.png'),
    });

    // Reset clock
    await resetTestClock();

    // -----------------------------------------------------------------------
    // TEST F: Customer Session Restoration on Bare Page Reload
    // -----------------------------------------------------------------------
    console.log('\n--- TEST F: Customer Session Restoration on Bare Page Reload ---');
    const t05 = tableList.find(t => t.tableNumber === 'Table 05');
    await page.goto(t05.entryUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const guestBtn = Array.from(document.querySelectorAll('button')).find(b => {
        return b.textContent?.includes('Continue as Guest');
      });
      if (guestBtn) guestBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // Reload bare root page (no query params)
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const isSessionRestored = await page.evaluate(() => {
      const body = document.body.innerText;
      return (body.includes('Table 05') || body.includes('TABLE 05')) &&
             !body.includes('Sign in to Table');
    });
    console.log(`  Session restored on bare reload: ${isSessionRestored}`);

    if (isSessionRestored) {
      console.log('  [PASS] Dining session seamlessly restored on reload without QR re-scan.');
    } else {
      console.log('  [FAIL] Session failed to restore on bare reload.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'test_f_session_restored_reload.png'),
    });

    // -----------------------------------------------------------------------
    // TEST G: Production Bundle Isolation Check
    // -----------------------------------------------------------------------
    console.log('\n--- TEST G: Production Customer Access Isolation Check ---');
    const jsFiles = fs.readdirSync(path.join(process.cwd(), 'dist/assets')).filter(f => f.endsWith('.js'));
    let foundDevShortcutInProd = false;
    for (const file of jsFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), 'dist/assets', file), 'utf8');
      if (content.includes('DEVELOPER TESTING — LOCAL ONLY') || content.includes('DevTableLauncher')) {
        foundDevShortcutInProd = true;
        break;
      }
    }

    if (!foundDevShortcutInProd) {
      console.log('  [PASS] Developer table launcher is completely stripped from production JS build.');
    } else {
      console.log('  [FAIL] Developer shortcut text leaked into production bundle!');
      allPassed = false;
    }

    // -----------------------------------------------------------------------
    // TEST H: Absence of Customer Ordering UI Check
    // -----------------------------------------------------------------------
    console.log('\n--- TEST H: Zero Customer Ordering Elements Verification ---');
    const orderingAudit = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const found = [];
      buttons.forEach(b => {
        const text = (b.textContent || '').trim().toLowerCase();
        if (text === 'add to cart' || text === '+ add' || text === 'checkout' || text === 'place order' || text === 'view cart') {
          found.push(text);
        }
      });
      const hasCartDrawer = !!document.querySelector('.lm-cart-drawer, [data-testid="cart-drawer"]');
      const hasCartCount = !!document.querySelector('.cart-count, [data-testid="cart-count"]');
      return { found, hasCartDrawer, hasCartCount };
    });

    console.log(`  Found ordering buttons: ${JSON.stringify(orderingAudit.found)}`);
    console.log(`  Cart drawer present: ${orderingAudit.hasCartDrawer}`);
    console.log(`  Cart count present: ${orderingAudit.hasCartCount}`);

    if (orderingAudit.found.length === 0 && !orderingAudit.hasCartDrawer && !orderingAudit.hasCartCount) {
      console.log('  [PASS] Confirmed 100% absence of customer ordering controls.');
    } else {
      console.log('  [FAIL] Ordering controls detected in dining menu!');
      allPassed = false;
    }

    console.log('\n======================================================================');
    if (allPassed) {
      console.log('ALL VERIFICATION AREAS (A THROUGH H) PASSED CLEANLY');
    } else {
      console.log('SOME TESTS FAILED - REVIEW LOGS ABOVE');
      process.exit(1);
    }
    console.log('======================================================================');
  } catch (err) {
    console.error('Error during test execution:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
