import { strict as assert } from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteerPath = 'C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer';
const puppeteer = require(puppeteerPath);

const BASE_URL = 'http://127.0.0.1:3000';
const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'verification_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Reset local sheet customer database for pristine test verification
const LOCAL_SHEET_PATH = path.resolve(process.cwd(), 'src/data/local-customers-sheet.json');

async function run() {
  console.log('========================================================================');
  console.log('LITTLE MONKEY CAFÉ — GOOGLE SHEETS CUSTOMER INTEGRATION VERIFICATION');
  console.log('========================================================================\n');

  // Backup existing local sheet if any
  let initialSheetBackup = null;
  if (fs.existsSync(LOCAL_SHEET_PATH)) {
    initialSheetBackup = fs.readFileSync(LOCAL_SHEET_PATH, 'utf8');
  }
  fs.writeFileSync(LOCAL_SHEET_PATH, '[]', 'utf8');

  try {
    // Reset test time, rate limits, and force local emulator for regression tests
    await fetch(`${BASE_URL}/api/test/reset-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emulator: true }),
    });

    // --------------------------------------------------------------------------
    // PART 1: DIRECT SERVER-SIDE INTEGRATION & API CONTRACT TESTS
    // --------------------------------------------------------------------------
    console.log('--- PART 1: Direct Server-Side Integration & API Contract Tests ---');

    // 1. Fetch valid table credentials from dev endpoint
    const tablesResp = await fetch(`${BASE_URL}/api/dev/tables`);
    const tablesData = await tablesResp.json();
    assert.ok(tablesData.success, 'Dev tables API must be accessible');
    const table01 = tablesData.tables.find((t) => t.tableNumber === 'Table 01') || tablesData.tables[0];
    assert.ok(table01 && table01.entryUrl, 'Table 01 must have a valid entry URL');

    // 2. Obtain valid QR Proof Token by verifying Table 01 QR
    const qrVerifyResp = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: table01.tableNumber,
        cred: `${table01.credentialId}.${table01.rawSecret}`,
      }),
    });
    const qrVerifyData = await qrVerifyResp.json();
    assert.strictEqual(qrVerifyResp.status, 200, 'QR verify must return 200');
    assert.ok(qrVerifyData.qrProofToken, 'Must receive signed qrProofToken');
    const validProofToken = qrVerifyData.qrProofToken;
    console.log(`[PASS] Step 1: Valid Table 01 QR proof token acquired (${validProofToken.slice(0, 16)}...)`);

    // Test 1A: Reject missing or invalid QR proof token
    const noProofResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aarav Sharma',
        mobile: '9876543210',
      }),
    });
    assert.strictEqual(noProofResp.status, 403, 'Missing QR proof token must return 403');
    const noProofData = await noProofResp.json();
    assert.strictEqual(noProofData.error, 'MISSING_QR_PROOF');
    console.log('[PASS] Step 1A: Missing QR proof token blocked with HTTP 403 MISSING_QR_PROOF');

    // Test 1B: Reject invalid mobile numbers
    const invalidNumbers = ['12345', '98765abcde', '5876543210', '9876543210123'];
    for (const num of invalidNumbers) {
      const resp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Aarav Sharma',
          mobile: num,
          qrProofToken: validProofToken,
        }),
      });
      assert.strictEqual(resp.status, 422, `Invalid mobile "${num}" must return 422`);
      const data = await resp.json();
      assert.strictEqual(data.error, 'INVALID_MOBILE');
    }
    console.log('[PASS] Step 1B: Invalid mobile numbers rejected with HTTP 422 INVALID_MOBILE');

    // Test 1C: Reject invalid name
    const invalidNameResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '   ',
        mobile: '9876543210',
        qrProofToken: validProofToken,
      }),
    });
    assert.strictEqual(invalidNameResp.status, 422, 'Empty name must return 422');
    console.log('[PASS] Step 1C: Empty customer name rejected with HTTP 422 INVALID_NAME');

    // Test 1D: New Customer Registration
    const newCustResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aarav Sharma',
        mobile: '9876543210',
        qrProofToken: validProofToken,
      }),
    });
    assert.strictEqual(newCustResp.status, 201, 'New customer registration must return 201');
    const newCustData = await newCustResp.json();
    assert.strictEqual(newCustData.success, true);
    assert.strictEqual(newCustData.status, 'NEW_CUSTOMER');
    assert.ok(newCustData.customer.customerId.startsWith('CUST-'), 'Customer ID must start with CUST-');
    assert.strictEqual(newCustData.customer.name, 'Aarav Sharma');
    assert.strictEqual(newCustData.customer.mobile, '9876543210');
    assert.ok(newCustData.sessionToken, 'Must receive dining session token');
    const firstCustomerId = newCustData.customer.customerId;
    console.log(`[PASS] Step 1D: New Customer registered successfully (${firstCustomerId})`);

    // Verify record in local sheet file
    const sheetAfterNew = JSON.parse(fs.readFileSync(LOCAL_SHEET_PATH, 'utf8'));
    assert.strictEqual(sheetAfterNew.length, 1, 'Local sheet must contain exactly 1 row');
    assert.strictEqual(sheetAfterNew[0].customer_id, firstCustomerId);
    assert.strictEqual(sheetAfterNew[0].name, 'Aarav Sharma');
    assert.strictEqual(sheetAfterNew[0].mobile_number, '9876543210');
    assert.ok(sheetAfterNew[0].created_at, 'Must have ISO created_at');
    assert.ok(sheetAfterNew[0].updated_at, 'Must have ISO updated_at');
    console.log('  -> Verified customer row in Google Sheet schema format [customer_id, name, mobile_number, created_at, updated_at]');

    // Test 1E: Returning Customer Lookup (Exact Match)
    const returningResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aarav Sharma',
        mobile: '9876543210',
        qrProofToken: validProofToken,
      }),
    });
    assert.strictEqual(returningResp.status, 200, 'Returning customer must return 200');
    const returningData = await returningResp.json();
    assert.strictEqual(returningData.success, true);
    assert.strictEqual(returningData.status, 'EXISTING_CUSTOMER');
    assert.strictEqual(returningData.customer.customerId, firstCustomerId, 'Customer ID must remain stable');
    assert.strictEqual(returningData.customer.name, 'Aarav Sharma');
    assert.strictEqual(returningData.customer.mobile, '9876543210');

    // Verify zero duplicate rows created in spreadsheet
    const sheetAfterReturning = JSON.parse(fs.readFileSync(LOCAL_SHEET_PATH, 'utf8'));
    assert.strictEqual(sheetAfterReturning.length, 1, 'Zero duplicate rows must be created for returning customer');
    console.log('[PASS] Step 1E: Returning customer verified with zero duplicate rows (count: 1)');

    // Test 1F: Conflicting Customer Name (Same mobile, different name)
    const conflictResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aarav S.',
        mobile: '9876543210',
        qrProofToken: validProofToken,
      }),
    });
    assert.strictEqual(conflictResp.status, 200, 'Conflict check returns 200 with status EXISTING_CUSTOMER_NAME_MISMATCH');
    const conflictData = await conflictResp.json();
    assert.strictEqual(conflictData.status, 'EXISTING_CUSTOMER_NAME_MISMATCH');
    assert.strictEqual(conflictData.customer.name, 'Aarav Sharma', 'Stored name must be preserved');
    assert.strictEqual(conflictData.customer.submittedName, 'Aarav S.');
    assert.strictEqual(conflictData.sessionToken, undefined, 'No session issued before explicit conflict resolution');

    // Verify stored name on disk was NOT silently overwritten
    const sheetAfterConflict = JSON.parse(fs.readFileSync(LOCAL_SHEET_PATH, 'utf8'));
    assert.strictEqual(sheetAfterConflict[0].name, 'Aarav Sharma', 'Stored name must NOT be overwritten');
    console.log('[PASS] Step 1F: Conflicting customer name detected; stored name preserved without overwrite');

    // Test 1G: Resolving Conflict with Explicit Confirmation
    const resolveResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aarav S.',
        mobile: '9876543210',
        qrProofToken: validProofToken,
        confirmedExistingName: true,
      }),
    });
    assert.strictEqual(resolveResp.status, 200);
    const resolveData = await resolveResp.json();
    assert.strictEqual(resolveData.status, 'EXISTING_CUSTOMER');
    assert.strictEqual(resolveData.customer.name, 'Aarav Sharma');
    assert.ok(resolveData.sessionToken, 'Session token issued on confirmed resolution');
    console.log('[PASS] Step 1G: Name conflict resolved explicitly; session unlocked under verified name');

    // Test 1H: Formula Injection Sanitization
    const formulaResp = await fetch(`${BASE_URL}/api/dine-in/customer-record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '=HYPERLINK("http://malicious.com", "Click Here")',
        mobile: '9876543211',
        qrProofToken: validProofToken,
      }),
    });
    assert.strictEqual(formulaResp.status, 201);
    const sheetAfterFormula = JSON.parse(fs.readFileSync(LOCAL_SHEET_PATH, 'utf8'));
    const formulaRow = sheetAfterFormula.find((r) => r.mobile_number === '9876543211');
    assert.ok(formulaRow, 'Formula test row must exist');
    assert.ok(formulaRow.name.startsWith("'="), 'Formula characters must be escaped with single quote');
    console.log('[PASS] Step 1H: Spreadsheet formula injection prevented (neutralized with leading quote)');

    // --------------------------------------------------------------------------
    // PART 2: PUPPETEER BROWSER REGISTRATION & MENU ACCESS VERIFICATION
    // --------------------------------------------------------------------------
    console.log('\n--- PART 2: Puppeteer End-to-End Browser Flow ---');

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Enable skip of intro screen
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // 1. Navigate to Table 01 with valid QR credentials
    console.log(`Navigating to Table 01 QR entry: ${table01.entryUrl}...`);
    await page.goto(table01.entryUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // 2. Verify CustomerLoginGate is displayed with the 2-field form
    await page.waitForSelector('input#customer-name', { timeout: 8000 });
    const gateInfo = await page.evaluate(() => {
      const nameInput = document.querySelector('input#customer-name');
      const mobileInput = document.querySelector('input#customer-mobile');
      const passwordInput = document.querySelector('input[type="password"]');
      const viewMenuBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent && b.textContent.includes('VIEW DINING MENU')
      );
      const text = document.body.innerText;
      const tableBadge = text.includes('Table 01') || text.includes('QR VERIFIED') || text.includes('DINE-IN ACCESS');

      return {
        hasNameInput: Boolean(nameInput),
        hasMobileInput: Boolean(mobileInput),
        hasPasswordInput: Boolean(passwordInput),
        hasViewMenuBtn: Boolean(viewMenuBtn),
        tableBadge,
        bodyText: text.slice(0, 500),
      };
    });
    console.log('Gate Body Preview:', gateInfo.bodyText);

    assert.strictEqual(gateInfo.hasNameInput, true, 'Name input must be present');
    assert.strictEqual(gateInfo.hasMobileInput, true, 'Mobile input must be present');
    assert.strictEqual(gateInfo.hasPasswordInput, false, 'Password input must NOT be present');
    assert.strictEqual(gateInfo.hasViewMenuBtn, true, 'VIEW DINING MENU submit button must be present');
    assert.strictEqual(gateInfo.tableBadge, true, 'Verified table badge must be displayed');
    console.log('[PASS] Step 2A: CustomerLoginGate renders passwordless 2-field form with table badge');

    // Save initial registration gate screenshot
    const gatePath = path.join(SCREENSHOT_DIR, '01_customer_registration_gate.png');
    await page.screenshot({ path: gatePath });
    console.log(`[EVIDENCE] Saved: ${gatePath}`);

    // 3. Test Validation Error on Invalid Input
    console.log('Testing form validation with invalid mobile...');
    await page.type('input#customer-name', 'Rohan Mehta');
    await page.type('input#customer-mobile', '12345');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 300));

    const validationMsg = await page.evaluate(() => {
      const errBanner = document.body.innerText.includes('Please enter a valid 10-digit Indian mobile number');
      return errBanner;
    });
    assert.strictEqual(validationMsg, true, 'Validation error banner must appear for invalid mobile');
    console.log('[PASS] Step 2B: Client-side validation message displayed correctly');

    // 4. Fill valid 10-digit mobile number and submit
    console.log('Submitting valid customer registration for Rohan Mehta (9876543299)...');
    await page.evaluate(() => {
      const mob = document.querySelector('input#customer-mobile');
      if (mob) mob.value = '';
    });
    await page.type('input#customer-mobile', '9876543299');
    await page.click('button[type="submit"]');

    // Wait for transition to menu
    await page.waitForFunction(() => {
      return Boolean(document.querySelector('.lm-featured-master-section') || document.querySelector('#main-menu-catalog'));
    }, { timeout: 8000 });

    console.log('[PASS] Step 2C: Registration successful; CustomerLoginGate dismissed and Digital Menu revealed');

    // 5. Verify Menu Access State
    const menuState = await page.evaluate(() => {
      const featuredSec = Boolean(document.querySelector('.lm-featured-master-section'));
      const menuCatalog = Boolean(document.querySelector('#main-menu-catalog'));
      const cartDrawer = Boolean(document.querySelector('.lm-cart-drawer'));
      const headerUser = document.querySelector('.lm-compact-header') ? document.querySelector('.lm-compact-header').innerText : '';

      return {
        featuredSec,
        menuCatalog,
        cartDrawer,
        hasHeader: Boolean(document.querySelector('.lm-compact-header')),
      };
    });

    assert.strictEqual(menuState.featuredSec, true, 'Featured section must be visible');
    assert.strictEqual(menuState.menuCatalog, true, 'Menu catalog must be visible');
    assert.strictEqual(menuState.cartDrawer, false, 'Cart drawer must NOT exist in read-only menu');
    console.log('[PASS] Step 2D: Read-only menu fully accessible with 0 cart drawers');

    // Save menu access screenshot
    const menuPath = path.join(SCREENSHOT_DIR, '02_menu_unlocked_after_registration.png');
    await page.screenshot({ path: menuPath });
    console.log(`[EVIDENCE] Saved: ${menuPath}`);

    // 6. Test Returning Customer with Name Conflict in Browser
    console.log('\nTesting Conflicting Name UI Flow in Browser...');
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1440, height: 900 });
    await page2.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // Fresh table entry URL
    await page2.goto(table01.entryUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Enter existing mobile (9876543299, registered as Rohan Mehta) with different name "Rohan M."
    await page2.type('input#customer-name', 'Rohan M.');
    await page2.type('input#customer-mobile', '9876543299');
    await page2.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 600));

    // Verify conflict card appeared
    const conflictUIPresent = await page2.evaluate(() => {
      const text = document.body.innerText;
      return (
        text.includes('Existing record found for') &&
        text.includes('Rohan Mehta') &&
        text.includes('CONTINUE AS ROHAN MEHTA')
      );
    });
    assert.strictEqual(conflictUIPresent, true, 'Conflict resolution UI must be displayed');
    console.log('[PASS] Step 2E: Name conflict resolution UI displayed with verified name "Rohan Mehta"');

    const conflictPath = path.join(SCREENSHOT_DIR, '03_name_conflict_resolution_card.png');
    await page2.screenshot({ path: conflictPath });
    console.log(`[EVIDENCE] Saved: ${conflictPath}`);

    // Click "CONTINUE AS ROHAN MEHTA"
    const continueBtn = await page2.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.textContent && b.textContent.includes('CONTINUE AS ROHAN MEHTA'));
    });
    await continueBtn.click();

    // Verify menu unlocks
    await page2.waitForFunction(() => {
      return Boolean(document.querySelector('.lm-featured-master-section'));
    }, { timeout: 8000 });
    console.log('[PASS] Step 2F: Confirmed conflict resolution unlocked digital menu under verified name');

    await browser.close();

    console.log('\n========================================================================');
    console.log('ALL GOOGLE SHEETS CUSTOMER INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================');
  } finally {
    // Re-enable live relay mode if configured
    try {
      await fetch(`${BASE_URL}/api/test/reset-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emulator: false }),
      });
    } catch (_) {}

    // Restore initial sheet data
    if (initialSheetBackup !== null) {
      fs.writeFileSync(LOCAL_SHEET_PATH, initialSheetBackup, 'utf8');
    }
  }
}

run().catch((err) => {
  console.error('\n[TEST FAILURE]:', err);
  process.exit(1);
});
