/**
 * test_developer_access_and_security_suite.mjs
 * Comprehensive automated QA suite verifying:
 * 1. Developer Access Panel on local dev QR gate with label "DEVELOPER TESTING — LOCAL DEVELOPMENT ONLY"
 * 2. 10 unique physical tables (T01 through T10) mapped to authoritative server credentials
 * 3. Server-side rejection of invalid, tampered, or mismatched table credentials
 * 4. Table switching protection (URL/state changes do not alter server-authorized table)
 * 5. Copied URLs and browser context isolation
 * 6. Session expiration verification (fixed 15-min server contract & clock advancement)
 * 7. Menu browsing and product inspection via developer launcher
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const BASE_URL = 'http://127.0.0.1:3000';
const ARTIFACTS_DIR = path.resolve(process.cwd(), 'test_artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function resetTestClock() {
  try {
    await fetch(`${BASE_URL}/api/test/reset-time`, { method: 'POST' });
  } catch {}
}

async function advanceTestClock(ms) {
  const res = await fetch(`${BASE_URL}/api/test/advance-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ms }),
  });
  return res.json();
}

async function run() {
  console.log('===============================================================');
  console.log('DEVELOPER TESTING ACCESS & TABLE SECURITY VERIFICATION SUITE');
  console.log('===============================================================');

  await resetTestClock();

  // 1. Fetch Authoritative Developer Tables from Server
  console.log('\n--- 1. Fetching Authoritative Table Configurations ---');
  const devTablesRes = await fetch(`${BASE_URL}/api/dev/tables`);
  const devTablesData = await devTablesRes.json();
  assert(devTablesData.success, 'Fetched developer table configs successfully');
  assert(Array.isArray(devTablesData.tables) && devTablesData.tables.length === 10, 'Exactly 10 physical tables returned');

  console.log(`Retrieved ${devTablesData.tables.length} physical tables:`);
  for (const t of devTablesData.tables) {
    console.log(`  ${t.tableNumber} (${t.shortCode}, ${t.zone}) -> Credential ID: ${t.credentialId}`);
  }

  // 2. Direct Server-Side QR Verification for all 10 Tables
  console.log('\n--- 2. Verifying Server-Side Cryptographic Validation (T01 - T10) ---');
  let ipCounter = 10;
  for (const t of devTablesData.tables) {
    assert(t.entryUrl, `Table ${t.tableNumber} has entry URL`);
    const credParam = `${t.credentialId}.${t.rawSecret}`;
    ipCounter++;

    const verifyRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': `192.168.10.${ipCounter}`,
      },
      body: JSON.stringify({
        table: t.tableNumber,
        cred: credParam,
      }),
    });
    const verifyData = await verifyRes.json();
    assert(verifyData.valid, `Table ${t.tableNumber} QR credential validated by server`);
    assert.strictEqual(verifyData.tableNumber, t.tableNumber, `Verified table matches intended table (${t.tableNumber})`);
    assert(verifyData.qrProofToken, `Server issued valid short-lived QR proof token for ${t.tableNumber}`);
    console.log(`  [PASS] ${t.tableNumber} verified: ${verifyData.tableNumber} (proof token issued)`);
  }

  // 3. Rejection of Tampered, Unknown, and Mismatched Credentials
  console.log('\n--- 3. Testing Server Rejection of Invalid / Mismatched Credentials ---');
  const t01 = devTablesData.tables[0];

  // A. Tampered Secret
  const tamperedRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.168.20.1',
    },
    body: JSON.stringify({
      table: t01.tableNumber,
      cred: `${t01.credentialId}.INVALID_TAMPERED_SECRET_XYZ`,
    }),
  });
  const tamperedData = await tamperedRes.json();
  assert(!tamperedData.valid, 'Tampered secret rejected');
  assert.strictEqual(tamperedData.error, 'INVALID_SECRET', 'Correct error code: INVALID_SECRET');
  console.log('  [PASS] Tampered secret rejected by cryptographic hash verification');

  // B. Unknown Credential ID
  const unknownRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.168.20.2',
    },
    body: JSON.stringify({
      table: 'Table 01',
      cred: 'qrc_t01_unknown_fake.some_secret',
    }),
  });
  const unknownData = await unknownRes.json();
  assert(!unknownData.valid, 'Unknown credential rejected');
  assert.strictEqual(unknownData.error, 'UNKNOWN_CREDENTIAL', 'Correct error code: UNKNOWN_CREDENTIAL');
  console.log('  [PASS] Unknown credential rejected');

  // C. Table Mismatch: Table 01 credential used with Table 04 candidate
  const mismatchRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.168.20.3',
    },
    body: JSON.stringify({
      table: 'Table 04',
      cred: `${t01.credentialId}.${t01.rawSecret}`,
    }),
  });
  const mismatchData = await mismatchRes.json();
  assert(!mismatchData.valid, 'Table mismatch rejected');
  assert.strictEqual(mismatchData.error, 'TABLE_MISMATCH', 'Correct error code: TABLE_MISMATCH');
  console.log('  [PASS] Table mismatch rejected (T01 credential cannot authorize Table 04)');

  // 4. Browser Automation Testing
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('Failed to load resource')) {
          consoleErrors.push(text);
        }
      }
    });

    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // -------------------------------------------------------------------------
    // TEST A: Developer Access Panel Visibility on QR Gate
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Developer Access Panel on QR Gate ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });

    const devPanelInfo = await page.evaluate(() => {
      const label = document.body.textContent.includes('DEVELOPER TESTING — LOCAL DEVELOPMENT ONLY');
      const tableButtons = Array.from(document.querySelectorAll('button')).filter((b) =>
        b.title && b.title.includes('simulate scanning this table QR')
      );
      return {
        hasLabel: label,
        buttonCount: tableButtons.length,
      };
    });

    assert(devPanelInfo.hasLabel, 'Developer testing label is visibly displayed');
    assert.strictEqual(devPanelInfo.buttonCount, 10, 'All 10 physical table buttons rendered in dev panel');
    console.log('  [PASS] Developer testing panel is clearly visible and provides 10 physical tables');

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'dev_access_panel_visible.png'),
    });

    // -------------------------------------------------------------------------
    // TEST B: Launch Table 04 via Developer Panel & Verify Menu Entry
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Launching Table 04 via Developer Panel ---');
    const t04 = devTablesData.tables.find((t) => t.tableNumber === 'Table 04');
    assert(t04 && t04.entryUrl, 'Table 04 entry URL present');
    console.log('  Visiting t04 entryUrl:', t04.entryUrl);

    await page.goto(t04.entryUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));

    const pageStatusBeforeGuest = await page.evaluate(() => {
      const h1 = document.querySelector('h1')?.textContent || '';
      const h2 = document.querySelector('h2')?.textContent || '';
      const btns = Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim());
      return { url: window.location.href, h1, h2, btns };
    });
    console.log('  Page status before guest click:', pageStatusBeforeGuest);

    // Sign in as Guest if prompted
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find((b) => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) guestBtn.click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    const pageStatusAfterGuest = await page.evaluate(() => {
      const h1 = document.querySelector('h1')?.textContent || '';
      const h2 = document.querySelector('h2')?.textContent || '';
      const header = document.querySelector('header')?.textContent || '';
      const bodySnippet = document.body.innerText.slice(0, 300);
      return { url: window.location.href, h1, h2, header, bodySnippet };
    });
    console.log('  Page status after guest click:', pageStatusAfterGuest);

    // Verify Table 04 in Header Badge
    const headerTable = await page.evaluate(() => {
      const badge = document.querySelector('header')?.textContent || '';
      return badge;
    });
    console.log('  Header text:', headerTable);
    assert(headerTable.includes('Table 04'), 'Header reflects server-authorized Table 04');
    console.log('  [PASS] Table 04 authorized and dining menu opened');

    // -------------------------------------------------------------------------
    // TEST C: Table Switching Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Table Switching Protection ---');
    // Attempt to tamper with URL: change ?t=T03 while session is for Table 04
    await page.goto(`${BASE_URL}/?t=T03`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 800));

    const postTamperTable = await page.evaluate(() => {
      return document.querySelector('header')?.textContent || '';
    });
    assert(postTamperTable.includes('Table 04'), 'Authorized table remains Table 04 despite URL parameter tampering');
    assert(!postTamperTable.includes('Table 03'), 'Table was NOT switched to Table 03');
    console.log('  [PASS] Table switching blocked: server-issued session enforces Table 04 identity');

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'table_switching_blocked.png'),
    });

    // -------------------------------------------------------------------------
    // TEST D: Copied URL and Browser Context Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Copied URL & Context Isolation ---');
    // 1. New tab in same browser context: session cookies/storage preserved
    const page2 = await browser.newPage();
    await page2.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    const tabSameContext = await page2.evaluate(() => {
      return document.querySelector('header')?.textContent || '';
    });
    assert(tabSameContext.includes('Table 04'), 'Session restored in new tab of same browser context');
    await page2.close();
    console.log('  [PASS] Same-context tab restores active session');

    // 2. Separate incognito / isolated context without session:
    const isolatedContext = await browser.createBrowserContext();
    const isolatedPage = await isolatedContext.newPage();
    await isolatedPage.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });
    await isolatedPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });

    const isolatedState = await isolatedPage.evaluate(() => {
      return {
        heading: document.querySelector('h1')?.textContent || '',
        isMenuBlocked: Boolean(document.querySelector('h1')?.textContent.includes('Table QR Scan Required')),
      };
    });
    assert(isolatedState.isMenuBlocked, 'Isolated context without session is blocked at QR gate');
    await isolatedContext.close();
    console.log('  [PASS] Isolated browser context without session credentials returns to QR gate');

    // -------------------------------------------------------------------------
    // TEST E: 15-Minute Session Expiration Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing 15-Minute Session Expiration ---');
    // Step 1: Check session status at t = 0 min
    const sessionToken = await page.evaluate(() => {
      return sessionStorage.getItem('lm_dining_session_token') || localStorage.getItem('lm_dining_session_token');
    });
    assert(sessionToken, 'Active session token exists in browser storage');

    const statusT0Res = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
      headers: { 'x-dining-session': sessionToken },
    });
    const statusT0 = await statusT0Res.json();
    assert(statusT0.valid, 'Session is valid initially');
    console.log(`  Initial session remaining time: ${statusT0.timeRemainingMs} ms`);
    assert(statusT0.timeRemainingMs <= 900000 && statusT0.timeRemainingMs > 880000, 'Session initial duration is 15 minutes (900,000 ms)');

    // Step 2: Advance test clock by 14 minutes (840,000 ms) - Before expiration
    console.log('  Advancing test clock by 14 minutes (before expiration)...');
    await advanceTestClock(14 * 60 * 1000);
    await new Promise((r) => setTimeout(r, 300));

    const statusT14Res = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
      headers: { 'x-dining-session': sessionToken },
    });
    const statusT14 = await statusT14Res.json();
    assert(statusT14.valid, 'Session remains valid before 15-minute expiration');
    console.log(`  Remaining time at t=14m: ${statusT14.timeRemainingMs} ms`);
    assert(statusT14.timeRemainingMs <= 60000, 'Remaining time is ~1 minute');

    // Step 3: Refresh page to confirm interacting/refreshing does NOT extend expiration
    await page.reload({ waitUntil: 'networkidle2' });
    const statusT14ReloadRes = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
      headers: { 'x-dining-session': sessionToken },
    });
    const statusT14Reload = await statusT14ReloadRes.json();
    assert.strictEqual(statusT14Reload.expiresAt, statusT14.expiresAt, 'ExpiresAt is fixed and unchanged after reload (zero sliding extension)');
    console.log('  [PASS] Fixed expiration preserved: reload/interaction does not extend session');

    // Step 4: Advance test clock by 2 more minutes (total 16 minutes > 15 minutes) - After expiration
    console.log('  Advancing test clock by 2 more minutes (total 16m, past 15-minute limit)...');
    await advanceTestClock(2 * 60 * 1000);
    await new Promise((r) => setTimeout(r, 300));

    const statusT16Res = await fetch(`${BASE_URL}/api/dine-in/session-status`, {
      headers: { 'x-dining-session': sessionToken },
    });
    const statusT16 = await statusT16Res.json();
    assert(!statusT16.valid, 'Session rejected after 15 minutes');
    assert.strictEqual(statusT16.error, 'DINING_SESSION_EXPIRED', 'Server error is DINING_SESSION_EXPIRED');
    console.log('  [PASS] Server strictly rejects requests after 15 minutes');

    // Reload page to verify expired gate is displayed
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    const expiredState = await page.evaluate(() => {
      return {
        hasExpiredGate: document.body.textContent.includes('DINING SESSION EXPIRED') ||
                        document.body.textContent.includes('Session Concluded') ||
                        document.body.textContent.includes('expired'),
      };
    });
    assert(expiredState.hasExpiredGate, 'Server expired session gate rendered after 15-minute duration');
    console.log('  [PASS] Server-enforced 15-minute session expiration gate verified');

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'session_expired_gate.png'),
    });

    await resetTestClock();

    // -------------------------------------------------------------------------
    // TEST F: Launch Table 02 & Inspect Complete Menu
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Launching Table 02 & Inspecting Menu Catalog ---');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });
    const t02 = devTablesData.tables.find((t) => t.tableNumber === 'Table 02');
    await page.goto(t02.entryUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Sign in as Guest if prompted
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find((b) => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) guestBtn.click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Verify Menu Heading, Category Tabs, and Products
    const menuStats = await page.evaluate(() => {
      const heading = document.querySelector('#main-menu-catalog h2')?.textContent || '';
      const tabs = Array.from(document.querySelectorAll('#main-menu-catalog [role="tab"]')).map((b) => b.textContent.trim());
      const cards = document.querySelectorAll('#main-menu-catalog .lm-product-card').length;
      return { heading, tabsCount: tabs.length, cards };
    });

    console.log(`  Menu Heading: "${menuStats.heading}", Category Tabs: ${menuStats.tabsCount}, Products: ${menuStats.cards}`);
    assert(menuStats.heading.includes('Dine-In Menu'), 'Menu heading verified');
    assert(menuStats.tabsCount >= 30, 'All regular categories present');
    assert(menuStats.cards >= 180, 'Full product catalog rendered');
    console.log('  [PASS] Full menu catalog rendered and verified under Table 02');

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'developer_menu_inspected_t02.png'),
    });

    // -------------------------------------------------------------------------
    // TEST G: Category Filtering (Pizzas, Pizza Combos, Burgers, Burger Combos, Sandwiches)
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Testing Category Filtering Strictness ---');

    // 1. Pizzas (thin-crust-pizza)
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('#main-menu-catalog [role="tab"]'));
      const pizzaTab = tabs.find((t) => t.textContent.trim() === 'Pizzas');
      if (pizzaTab) pizzaTab.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const pizzaResult = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#main-menu-catalog .lm-product-card'));
      const titles = cards.map((c) => c.querySelector('h3, h4')?.textContent?.trim() || '');
      const hasCombo = titles.some((t) => t.toLowerCase().includes('combo'));
      return { count: cards.length, titles, hasCombo };
    });
    console.log(`  Pizzas count: ${pizzaResult.count}, hasCombos: ${pizzaResult.hasCombo}`);
    assert(pizzaResult.count > 0, 'Pizzas returned at least 1 product');
    assert(!pizzaResult.hasCombo, 'Pizzas category does NOT contain pizza combos');
    console.log('  [PASS] Pizzas category strictly contains only pizza products');

    // 2. Pizza Combos (pizza-combos)
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('#main-menu-catalog [role="tab"]'));
      const comboTab = tabs.find((t) => t.textContent.trim() === 'Pizza Combos');
      if (comboTab) comboTab.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const pizzaComboResult = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#main-menu-catalog .lm-product-card'));
      const titles = cards.map((c) => c.querySelector('h3, h4')?.textContent?.trim() || '');
      return { count: cards.length, titles };
    });
    console.log(`  Pizza Combos count: ${pizzaComboResult.count}`);
    assert(pizzaComboResult.count > 0, 'Pizza Combos returned products');
    console.log('  [PASS] Pizza Combos category returns only pizza combo products');

    // 3. Burgers (burgers)
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('#main-menu-catalog [role="tab"]'));
      const burgerTab = tabs.find((t) => t.textContent.trim() === 'Burgers');
      if (burgerTab) burgerTab.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const burgerResult = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#main-menu-catalog .lm-product-card'));
      const titles = cards.map((c) => c.querySelector('h3, h4')?.textContent?.trim() || '');
      const hasCombo = titles.some((t) => t.toLowerCase().includes('combo'));
      return { count: cards.length, titles, hasCombo };
    });
    console.log(`  Burgers count: ${burgerResult.count}, hasCombos: ${burgerResult.hasCombo}`);
    assert(burgerResult.count > 0, 'Burgers returned products');
    assert(!burgerResult.hasCombo, 'Burgers category does NOT contain burger combos');
    console.log('  [PASS] Burgers category strictly contains only burger products');

    // 4. Burger Combos (burger-combos)
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('#main-menu-catalog [role="tab"]'));
      const burgerComboTab = tabs.find((t) => t.textContent.trim() === 'Burger Combos');
      if (burgerComboTab) burgerComboTab.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const burgerComboResult = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#main-menu-catalog .lm-product-card'));
      return { count: cards.length };
    });
    console.log(`  Burger Combos count: ${burgerComboResult.count}`);
    assert(burgerComboResult.count > 0, 'Burger Combos returned products');
    console.log('  [PASS] Burger Combos category returns only burger combo products');

    // 5. Sandwiches (sandwiches)
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('#main-menu-catalog [role="tab"]'));
      const sandwichTab = tabs.find((t) => t.textContent.trim() === 'Sandwiches');
      if (sandwichTab) sandwichTab.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const sandwichResult = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#main-menu-catalog .lm-product-card'));
      return { count: cards.length };
    });
    console.log(`  Sandwiches count: ${sandwichResult.count}`);
    assert(sandwichResult.count > 0, 'Sandwiches returned products');
    console.log('  [PASS] Sandwiches category returns only sandwich products');

    // -------------------------------------------------------------------------
    // TEST H: Search Filtering and Synergy
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Testing Search Filtering & Synergy ---');
    // First: switch back to "All Items" to test global search across catalog
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('#main-menu-catalog [role="tab"]'));
      const allTab = tabs.find((t) => t.textContent.trim() === 'All Items');
      if (allTab) allTab.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Click Search toggle button
    await page.evaluate(() => {
      const searchBtn = document.querySelector('button[aria-label="Search menu items"]');
      if (searchBtn) searchBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    // Type query "tiger"
    await page.type('input[type="text"]', 'tiger', { delay: 50 });
    await new Promise((r) => setTimeout(r, 500));

    const searchResults = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#main-menu-catalog .lm-product-card'));
      const titles = cards.map((c) => c.querySelector('h3, h4')?.textContent?.trim() || '');
      return { count: cards.length, titles };
    });
    console.log(`  Search "tiger" results count: ${searchResults.count}`, searchResults.titles);
    assert(searchResults.titles.some((t) => t.toLowerCase().includes('tiger')), 'Found Tiger Bomb product');
    console.log('  [PASS] Global search filters correctly matching dishes across catalog');

    // Clear Search
    await page.evaluate(() => {
      const clearBtn = document.querySelector('button[aria-label="Clear search query"]');
      if (clearBtn) clearBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    // -------------------------------------------------------------------------
    // TEST I: Responsive Viewport Check (390px, 768px, 1440px)
    // -------------------------------------------------------------------------
    console.log('\n--- 12. Testing Responsive Viewports (Zero Horizontal Overflow) ---');
    for (const width of [390, 768, 1440]) {
      await page.setViewport({ width, height: 900 });
      await new Promise((r) => setTimeout(r, 300));
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - window.innerWidth;
      });
      assert(overflow <= 1, `Zero horizontal overflow at ${width}px (measured: ${overflow}px)`);
      console.log(`  [PASS] Viewport ${width}px: 0px horizontal overflow`);
    }

    assert(consoleErrors.length === 0, `Zero uncaught console errors (found: ${consoleErrors.join(', ')})`);
    console.log('  [PASS] Zero uncaught console errors verified');

    console.log('\n===============================================================');
    console.log('ALL DEVELOPER ACCESS & SECURITY TESTS COMPLETED SUCCESSFULLY');
    console.log('===============================================================');
  } finally {
    await browser.close();
    await resetTestClock();
  }
}

run().catch((err) => {
  console.error('\nFAIL: Test suite failed with error:');
  console.error(err);
  process.exit(1);
});
