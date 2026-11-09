import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const BASE_URL = 'http://127.0.0.1:3000';

async function advanceTestClock(minutes) {
  const res = await fetch(`${BASE_URL}/api/test/advance-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ms: minutes * 60 * 1000, minutes }),
  });
  return res.json();
}

async function resetTestClock() {
  const res = await fetch(`${BASE_URL}/api/test/reset-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

(async () => {
  console.log('===============================================================');
  console.log('DEVELOPER DINING ACCESS & 10 TABLE QR VERIFICATION SUITE');
  console.log('===============================================================');

  await resetTestClock();

  // Fetch all 10 developer table QR URLs with staff authorization
  const devTablesRes = await fetch(`${BASE_URL}/api/dev/tables`, {
    headers: { 'x-operational-pin': '9999' },
  });
  const devTablesData = await devTablesRes.json();
  if (!devTablesData.success || !Array.isArray(devTablesData.tables)) {
    console.error('FAIL: Could not fetch developer table QR URLs from /api/dev/tables');
    process.exit(1);
  }

  const tableList = devTablesData.tables;
  console.log(`Retrieved ${tableList.length} authoritative table QR configurations.`);
  for (const t of tableList) {
    console.log(`  ${t.tableNumber} (${t.shortCode}, ${t.zone}) -> ${t.entryUrl}`);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let allPassed = true;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // -------------------------------------------------------------------------
    // TEST 1: Valid Table 01 QR Access
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Valid Table 01 QR Access ---');
    const t01 = tableList.find(t => t.tableNumber === 'Table 01');
    if (!t01 || !t01.entryUrl) throw new Error('Table 01 URL missing');

    await page.goto(t01.entryUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // Sign in as guest
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find(b => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) guestBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    const t01Recognized = await page.evaluate(() => {
      return document.body.innerText.includes('Table 01') || document.body.innerText.includes('TABLE 01');
    });
    const hasProducts = await page.evaluate(() => {
      return document.querySelectorAll('h3, h4').length > 5;
    });

    if (t01Recognized && hasProducts) {
      console.log('  [PASS] Table 01 QR verified on server, session created, menu rendered with products.');
    } else {
      console.log('  [FAIL] Table 01 menu failed to open.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'dev_test_01_table_01_menu.png'),
    });

    // -------------------------------------------------------------------------
    // TEST 2: Valid QR for Another Table (Table 07 and Table 10)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Valid QR for Table 07 and Table 10 ---');
    // Clear session storage to test fresh QR scan for Table 07
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    const t07 = tableList.find(t => t.tableNumber === 'Table 07');
    await page.goto(t07.entryUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find(b => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) guestBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    const t07Recognized = await page.evaluate(() => {
      return document.body.innerText.includes('Table 07') || document.body.innerText.includes('TABLE 07');
    });

    if (t07Recognized) {
      console.log('  [PASS] Table 07 QR verified, session created, correct table identity confirmed.');
    } else {
      console.log('  [FAIL] Table 07 identity not recognized.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'dev_test_02_table_07_menu.png'),
    });

    // Test Table 10
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });
    const t10 = tableList.find(t => t.tableNumber === 'Table 10');
    await page.goto(t10.entryUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find(b => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) guestBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    const t10Recognized = await page.evaluate(() => {
      return document.body.innerText.includes('Table 10') || document.body.innerText.includes('TABLE 10');
    });

    if (t10Recognized) {
      console.log('  [PASS] Table 10 QR verified, session created, correct table identity confirmed.');
    } else {
      console.log('  [FAIL] Table 10 identity not recognized.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'dev_test_03_table_10_menu.png'),
    });

    // -------------------------------------------------------------------------
    // TEST 3: Invalid / Tampered QR Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Invalid / Tampered QR Rejection ---');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const invalidQrUrl = `${BASE_URL}/?t=T01&cred=qrc_t01_fakeid.invalidsecretkey999`;
    await page.goto(invalidQrUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    const isBlockedWithQrError = await page.evaluate(() => {
      const body = document.body.innerText;
      return body.includes('QR Authorization Error') || body.includes('Table QR Scan Required');
    });

    if (isBlockedWithQrError) {
      console.log('  [PASS] Tampered QR credential rejected on server; QR access gate displayed.');
    } else {
      console.log('  [FAIL] Tampered QR was not blocked.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'dev_test_04_invalid_qr_rejected.png'),
    });

    // -------------------------------------------------------------------------
    // TEST 4: Expired Session Enforcement (15-Minute Server Boundary)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Strict 15-Minute Expiration Enforcement ---');
    // Start fresh session with Table 02
    const t02 = tableList.find(t => t.tableNumber === 'Table 02');
    await page.goto(t02.entryUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find(b => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) guestBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // Advance clock past 15 minutes (16 mins) - strictly distinguishes 15m from 30m
    await advanceTestClock(16);

    // Recheck status on page reload
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1200));

    const isExpiredGateVisible = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('session expired') || text.includes('session concluded');
    });

    if (isExpiredGateVisible) {
      console.log('  [PASS] Server rejected session after 15 minutes; Session Concluded gate shown.');
    } else {
      console.log('  [FAIL] Session expired gate was not rendered.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'dev_test_05_session_expired.png'),
    });

    await resetTestClock();

    // -------------------------------------------------------------------------
    // TEST 5: Refreshed Page with Valid Session
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Refreshed Page with Valid Session ---');
    // Start fresh session with Table 03
    const t03 = tableList.find(t => t.tableNumber === 'Table 03');
    await page.goto(t03.entryUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find(b => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) guestBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // Reload bare root page (no query params)
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const isMenuPreserved = await page.evaluate(() => {
      return document.body.innerText.includes('Table 03') || document.body.innerText.includes('TABLE 03');
    });
    const isLoginGateSkipped = await page.evaluate(() => {
      return !document.body.innerText.includes('Sign in to Table');
    });

    if (isMenuPreserved && isLoginGateSkipped) {
      console.log('  [PASS] Valid dining session seamlessly restored on bare reload; menu active.');
    } else {
      console.log('  [FAIL] Menu failed to restore on reload.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'dev_test_06_refreshed_valid_session.png'),
    });

    // -------------------------------------------------------------------------
    // TEST 6: Direct Menu Access Without Valid Session
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Direct Menu Access Without Valid Session ---');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    const isDirectAccessBlocked = await page.evaluate(() => {
      const body = document.body.innerText;
      return body.includes('Table QR Scan Required') || body.includes('IN-CAFÉ QR ACCESS REQUIRED');
    });

    if (isDirectAccessBlocked) {
      console.log('  [PASS] Direct unauthenticated access strictly blocked by TableQrRequiredGate.');
    } else {
      console.log('  [FAIL] Direct access was not blocked.');
      allPassed = false;
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'dev_test_07_direct_access_blocked.png'),
    });

    // -------------------------------------------------------------------------
    // TEST 7: Confirmation Developer Shortcut is Unavailable in Production
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Development Shortcut Unavailable in Production ---');
    // Check production build bundle
    const jsFiles = fs.readdirSync(path.join(process.cwd(), 'dist/assets')).filter(f => f.endsWith('.js'));
    let foundInBundle = false;
    for (const file of jsFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), 'dist/assets', file), 'utf8');
      if (content.includes('Developer Quick Table Launcher') || content.includes('DEV ONLY')) {
        foundInBundle = true;
        break;
      }
    }

    if (!foundInBundle) {
      console.log('  [PASS] Developer Table Launcher is completely stripped from production JS build.');
    } else {
      console.log('  [FAIL] Developer shortcut text detected in production bundle!');
      allPassed = false;
    }

    console.log('\n===============================================================');
    if (allPassed) {
      console.log('ALL 7 DEVELOPER ACCESS & TABLE QR TESTS PASSED CLEANLY');
    } else {
      console.log('SOME TESTS FAILED');
    }
    console.log('===============================================================');
  } catch (err) {
    console.error('Error during developer access verification:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
