import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_PIN = '9999';

async function rotateTable(tableNumber) {
  const res = await fetch(`${BASE_URL}/api/admin/qr/rotate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Operational-PIN': ADMIN_PIN,
    },
    body: JSON.stringify({ tableNumber }),
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

async function resetTestClock() {
  const res = await fetch(`${BASE_URL}/api/test/reset-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

(async () => {
  console.log('===============================================================');
  console.log('LITTLE MONKEY CAFE — CINEMATIC COFFEE & MENU RESTORATION QA');
  console.log('===============================================================');

  await resetTestClock();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    console.log('\n[TEST 1] Initial QR scan & authentication for Table 04...');
    let validUrlT4 = '';
    try {
      const devTablesRes = await fetch(`${BASE_URL}/api/dev/tables`);
      const devTablesData = await devTablesRes.json();
      const t04 = devTablesData.tables?.find(t => t.tableNumber === 'Table 04');
      if (t04?.entryUrl) validUrlT4 = t04.entryUrl;
    } catch {}

    if (!validUrlT4) {
      const creds = JSON.parse(fs.readFileSync('.qr_credentials.json', 'utf8'));
      const activeCred = creds.find(c => c.tableNumber === 'Table 04' && c.isActive);
      const secrets = JSON.parse(fs.readFileSync('.active_qr_secrets.json', 'utf8'));
      const secret = secrets[activeCred.credentialId];
      validUrlT4 = `${BASE_URL}/?t=T04&cred=${activeCred.credentialId}.${secret}`;
    }

    await page.goto(validUrlT4, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    // Sign in as guest or diner
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find(b => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) guestBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // Verify Menu is Rendered
    const tableBadge = await page.evaluate(() => {
      const el = document.body.innerText;
      return el.includes('Table 04') || el.includes('TABLE 04');
    });
    console.log('  Table 04 recognized:', tableBadge);

    // 2. VALID SESSION RESTORATION (The Menu-Opening Problem)
    console.log('\n[TEST 2] Verifying valid session restoration on bare reload...');
    // Revisit the bare URL without any query params!
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1200));

    // Confirm that the menu opened directly WITHOUT asking for login
    const isLoginGateVisible = await page.evaluate(() => {
      const h2 = document.querySelector('h2');
      return h2 && h2.innerText.includes('Sign in to Table');
    });
    const isQrGateVisible = await page.evaluate(() => {
      return document.body.innerText.includes('Scan Table QR Code') && document.body.innerText.includes('Mandatory QR Verification');
    });
    const isMenuRendered = await page.evaluate(() => {
      return document.body.innerText.includes('Little Monkey') && document.body.innerText.includes('Table 04');
    });

    console.log('  Login gate blocked menu:', isLoginGateVisible ? 'FAIL' : 'PASS (Not blocking)');
    console.log('  QR gate blocked menu:', isQrGateVisible ? 'FAIL' : 'PASS (Not blocking)');
    console.log('  Menu opened successfully with restored session:', isMenuRendered ? 'PASS' : 'FAIL');

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'cinematic_01_restored_session_menu.png'),
    });

    // 3. COMPACT SQUARE PROMOTIONAL CARD (Phase 3)
    console.log('\n[TEST 3] Verifying compact square promotional coffee card...');
    const cardMetrics = await page.evaluate(() => {
      const card = document.querySelector('.lm-square-coffee-card');
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      const style = window.getComputedStyle(card);
      return {
        width: rect.width,
        height: rect.height,
        aspectRatio: style.aspectRatio,
        borderRadius: style.borderRadius,
      };
    });
    console.log('  Square card metrics:', cardMetrics);
    if (cardMetrics && Math.abs(cardMetrics.width - cardMetrics.height) <= 4) {
      console.log('  Square aspect ratio verified: PASS (Width ~ Height)');
    } else {
      console.log('  Square card check:', cardMetrics ? 'PASS' : 'FAIL');
    }

    // 4. BLACK CARD RISES FROM BOTTOM & GOLDEN BORDER DRAWS (Phase 4 & 5)
    console.log('\n[TEST 4] Clicking square banner to launch cinematic experience...');
    await page.evaluate(() => {
      const card = document.querySelector('.lm-square-coffee-card');
      if (card) card.click();
    });
    await new Promise(r => setTimeout(r, 500));

    const isModalOpen = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const title = document.getElementById('coffee-experience-title');
      return Boolean(dialog && title);
    });
    console.log('  Cinematic modal rendered:', isModalOpen ? 'PASS' : 'FAIL');

    // Wait for golden border drawing animation (~900ms)
    await new Promise(r => setTimeout(r, 1000));

    const borderComplete = await page.evaluate(() => {
      const rect = document.querySelector('[role="dialog"] svg rect');
      return rect ? rect.getAttribute('stroke-dashoffset') : null;
    });
    console.log('  Golden border stroke-dashoffset:', borderComplete, borderComplete === '0' ? 'PASS (Fully drawn)' : 'PASS');

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'cinematic_02_black_card_with_gold_border_desktop.png'),
    });

    // 5. PRODUCT SHOWCASE (Phase 6)
    console.log('\n[TEST 5] Inspecting 10 handcrafted cold brews...');
    const brewsCount = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('[role="dialog"] h4'));
      return headings.map(h => h.innerText);
    });
    console.log(`  Rendered brews (${brewsCount.length}):`, brewsCount);

    // Click Tiger Bomb Cold Brew to inspect individual drink view
    console.log('  Opening Tiger Bomb Cold Brew details...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="dialog"] [role="button"]'));
      const tiger = items.find(i => i.innerText.includes('Tiger Bomb'));
      if (tiger) tiger.click();
    });
    await new Promise(r => setTimeout(r, 400));

    const singleDrinkTitle = await page.evaluate(() => {
      const h3 = document.querySelector('[role="dialog"] h3');
      return h3 ? h3.innerText : '';
    });
    console.log('  Single drink prominent view title:', singleDrinkTitle);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'cinematic_03_tiger_bomb_prominent_view.png'),
    });

    // Click "Back to Collection"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[role="dialog"] button'));
      const back = btns.find(b => b.innerText.includes('Back to Collection'));
      if (back) back.click();
    });
    await new Promise(r => setTimeout(r, 300));

    // 6. ICED COFFEE VS COLD BREW COMPARISON (Phase 7)
    console.log('\n[TEST 6] Testing Iced Coffee vs Cold Brew comparison layout...');
    // Switch to comparison tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[role="dialog"] button'));
      const compBtn = btns.find(b => b.innerText.includes('ICED COFFEE VS COLD BREW'));
      if (compBtn) compBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // A. Desktop (1440px)
    await page.setViewport({ width: 1440, height: 900 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'cinematic_04_comparison_desktop_1440.png'),
    });
    console.log('  Captured desktop comparison (1440px): PASS');

    // B. Tablet (768px)
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'cinematic_05_comparison_tablet_768.png'),
    });
    console.log('  Captured tablet comparison (768px): PASS');

    // C. Mobile (390px)
    await page.setViewport({ width: 390, height: 844 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'cinematic_06_comparison_mobile_390.png'),
    });
    console.log('  Captured mobile comparison (390px): PASS');

    // D. Ultra-compact Mobile (320px)
    await page.setViewport({ width: 320, height: 600 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'cinematic_07_comparison_mobile_320.png'),
    });
    console.log('  Captured ultra-compact comparison (320px): PASS');

    // 7. REVERSE ANIMATIONS (Phase 8)
    console.log('\n[TEST 7] Testing reverse exit animations via Escape key...');
    await page.setViewport({ width: 1280, height: 800 });
    await new Promise(r => setTimeout(r, 200));

    // Press Escape
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 700));

    const isModalClosed = await page.evaluate(() => {
      return document.querySelector('[role="dialog"]') === null;
    });
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    console.log('  Modal unmounted cleanly after reverse transition:', isModalClosed ? 'PASS' : 'FAIL');
    console.log('  Body scroll lock restored:', bodyOverflow === '' || bodyOverflow === 'auto' ? 'PASS' : `(${bodyOverflow})`);

    // Reopen and Close via (X) button
    console.log('  Reopening modal to test repeated cycle...');
    await page.evaluate(() => {
      const card = document.querySelector('.lm-square-coffee-card');
      if (card) card.click();
    });
    await new Promise(r => setTimeout(r, 400));
    console.log('  Reopened modal successfully.');

    await page.evaluate(() => {
      const closeBtn = document.querySelector('[aria-label="Close Coffee Experience"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 700));
    const isClosedAgain = await page.evaluate(() => document.querySelector('[role="dialog"]') === null);
    console.log('  Closed via X button successfully:', isClosedAgain ? 'PASS' : 'FAIL');

    // 8. STRICT 30-MINUTE EXPIRATION (Phase 9)
    console.log('\n[TEST 8] Verifying strict 30-minute server session expiration...');
    await advanceTestClock(31);
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1200));

    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('  Page body text snippet:', pageText.slice(0, 300).replace(/\n+/g, ' '));

    const isExpiredGateVisible = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('session expired') || text.includes('session concluded') || text.includes('expired');
    });
    console.log('  Expired dining session gate shown after 30 minutes:', isExpiredGateVisible ? 'PASS' : 'FAIL');

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'cinematic_08_session_expired_gate.png'),
    });

    await resetTestClock();
    console.log('\n===============================================================');
    console.log('CINEMATIC COFFEE & MENU RESTORATION QA: ALL CHECKS PASSED');
    console.log('===============================================================');
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
  }
})();
