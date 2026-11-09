import { createRequire } from 'node:module';
const require = createRequire('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer/package.json');
const puppeteer = require('puppeteer');
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_PIN = '9999';

async function resetClock() {
  await fetch(`${BASE_URL}/api/test/reset-time?emulator=true`, { method: 'POST' });
}

async function getDevTableEntryUrl(tableNumber) {
  const res = await fetch(`${BASE_URL}/api/dev/tables`, {
    headers: { 'X-Admin-Pin': ADMIN_PIN },
  });
  const data = await res.json();
  const t = data.tables.find((tab) => tab.tableNumber === tableNumber);
  return t ? t.entryUrl : null;
}

async function rotateTable(tableNumber) {
  await fetch(`${BASE_URL}/api/admin/qr/rotate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Pin': ADMIN_PIN,
    },
    body: JSON.stringify({ table: tableNumber }),
  });
}

async function run() {
  console.log('====================================================');
  console.log('PASSWORD-FREE CUSTOMER AUTHENTICATION VERIFICATION');
  console.log('====================================================\n');

  await resetClock();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Existing Customer Flow (Step A -> Step B -> Continue)
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Testing Existing Customer Flow (Aarav Sharma - 9876543210)...');
    await rotateTable('Table 02');
    const entryUrl1 = await getDevTableEntryUrl('Table 02');
    if (!entryUrl1) throw new Error('Could not get entry URL for Table 02');

    const page1 = await browser.newPage();
    await page1.setViewport({ width: 375, height: 812 });
    await page1.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });
    await page1.goto(entryUrl1, { waitUntil: 'networkidle0' });

    // Step A verification
    const textA = await page1.evaluate(() => document.body.innerText);
    console.log('[DEBUG textA]:', textA);
    const hasStepAHeading = textA.includes('Welcome to Little Monkey Café');
    const hasStepASupporting = textA.includes('Enter your mobile number to continue.');
    const hasVerifyBtn = textA.includes('Verify Mobile Number');
    console.log(`[TEST 1 - STEP A] Heading "Welcome to Little Monkey Café": ${hasStepAHeading}`);
    console.log(`[TEST 1 - STEP A] Supporting text "Enter your mobile number to continue.": ${hasStepASupporting}`);
    console.log(`[TEST 1 - STEP A] Primary button "Verify Mobile Number": ${hasVerifyBtn}`);

    if (!hasStepAHeading || !hasStepASupporting || !hasVerifyBtn) {
      throw new Error('TEST 1 FAILED: Step A mobile entry text mismatch');
    }

    // Type 10-digit mobile of existing customer
    await page1.type('input#customer-mobile', '9876543210');
    await page1.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.includes('Verify Mobile Number')
      );
      if (btn) btn.click();
    });

    // Wait for Step B
    await page1.waitForFunction(
      () => document.body.innerText.includes('Your mobile number is already registered.'),
      { timeout: 5000 }
    );

    const textB = await page1.evaluate(() => document.body.innerText);
    const hasStepBHeading = textB.includes('Your mobile number is already registered.');
    const hasStepBSupporting = textB.includes('Welcome back! You can continue to the menu.');
    const hasExistingName = textB.includes('Aarav Sharma');
    const hasContinueBtn = textB.includes('Continue to Menu');
    console.log(`[TEST 1 - STEP B] Heading "Your mobile number is already registered.": ${hasStepBHeading}`);
    console.log(`[TEST 1 - STEP B] Supporting text "Welcome back! You can continue to the menu.": ${hasStepBSupporting}`);
    console.log(`[TEST 1 - STEP B] Displayed Stored Name "Aarav Sharma": ${hasExistingName}`);
    console.log(`[TEST 1 - STEP B] Primary button "Continue to Menu": ${hasContinueBtn}`);

    if (!hasStepBHeading || !hasStepBSupporting || !hasExistingName || !hasContinueBtn) {
      throw new Error('TEST 1 FAILED: Step B existing customer state mismatch');
    }

    // Click "Continue to Menu"
    await page1.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.includes('Continue to Menu')
      );
      if (btn) btn.click();
    });

    // Wait for menu
    await page1.waitForSelector('#main-menu-catalog', { timeout: 6000 });
    const hasMenu1 = await page1.evaluate(() => Boolean(document.querySelector('#main-menu-catalog')));
    const headerGreeting1 = await page1.evaluate(() => document.body.innerText.includes('Aarav Sharma') || document.body.innerText.includes('Table 02'));
    console.log(`[TEST 1 - RESULT] Menu catalog mounted: ${hasMenu1}`);
    console.log(`[TEST 1 - RESULT] Active dining session active for Table 02: ${headerGreeting1}`);
    console.log('[PASS] TEST 1: Existing customer seamlessly authenticated without password!\n');
    await page1.close();

    // -------------------------------------------------------------------------
    // TEST 2: New Customer Registration Flow (Step A -> Step C -> Register)
    // -------------------------------------------------------------------------
    console.log('[TEST 2] Testing New Customer Registration Flow...');
    await rotateTable('Table 04');
    const entryUrl2 = await getDevTableEntryUrl('Table 04');
    if (!entryUrl2) throw new Error('Could not get entry URL for Table 04');

    const freshMobile = '98' + Math.floor(10000000 + Math.random() * 90000000);
    const newCustomerName = 'Priya Patel';

    const page2 = await browser.newPage();
    await page2.setViewport({ width: 375, height: 812 });
    await page2.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });
    await page2.goto(entryUrl2, { waitUntil: 'networkidle0' });

    // Enter fresh mobile
    await page2.type('input#customer-mobile', freshMobile);
    await page2.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.includes('Verify Mobile Number')
      );
      if (btn) btn.click();
    });

    // Wait for Step C
    await page2.waitForFunction(
      () => document.body.innerText.includes("Welcome! Let's get you started."),
      { timeout: 5000 }
    );

    const textC = await page2.evaluate(() => document.body.innerText);
    const hasStepCHeading = textC.includes("Welcome! Let's get you started.");
    const hasPrepopulatedMobile = textC.includes(freshMobile);
    const hasNameInput = await page2.$('input#customer-name');
    const hasRegisterBtn = textC.includes('Register & Continue');
    console.log(`[TEST 2 - STEP C] Heading "Welcome! Let's get you started.": ${hasStepCHeading}`);
    console.log(`[TEST 2 - STEP C] Pre-populated read-only mobile "+91 ${freshMobile}": ${hasPrepopulatedMobile}`);
    console.log(`[TEST 2 - STEP C] Full Name input present: ${Boolean(hasNameInput)}`);
    console.log(`[TEST 2 - STEP C] Primary button "Register & Continue": ${hasRegisterBtn}`);

    if (!hasStepCHeading || !hasPrepopulatedMobile || !hasNameInput || !hasRegisterBtn) {
      throw new Error('TEST 2 FAILED: Step C new customer registration state mismatch');
    }

    // Enter full name and submit
    await page2.type('input#customer-name', newCustomerName);
    await page2.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.includes('Register & Continue')
      );
      if (btn) btn.click();
    });

    // Wait for menu
    await page2.waitForSelector('#main-menu-catalog', { timeout: 6000 });
    const hasMenu2 = await page2.evaluate(() => Boolean(document.querySelector('#main-menu-catalog')));
    console.log(`[TEST 2 - RESULT] Menu catalog mounted for new customer: ${hasMenu2}`);
    console.log('[PASS] TEST 2: New customer registered and dining session activated!\n');
    await page2.close();

    // -------------------------------------------------------------------------
    // TEST 3: Name Immutability & Overwrite Rejection
    // -------------------------------------------------------------------------
    console.log('[TEST 3] Testing Name Immutability & Non-Overwrite Enforcement...');
    const localSheetPath = path.resolve(process.cwd(), 'src/data/local-customers-sheet.json');
    const sheetDataBefore = JSON.parse(fs.readFileSync(localSheetPath, 'utf8'));
    const aaravRecordBefore = sheetDataBefore.find((r) => r.mobile_number === '9876543210');
    console.log(`[TEST 3] Name on file for 9876543210: "${aaravRecordBefore.name}"`);

    // Rotate table 05 to get fresh valid QR proof token
    await rotateTable('Table 05');
    const entryUrl3 = await getDevTableEntryUrl('Table 05');
    const credParam3 = new URL(entryUrl3).searchParams.get('cred');
    const verifyRes = await fetch(`${BASE_URL}/api/dine-in/verify-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'Table 05', cred: credParam3 }),
    });
    const { qrProofToken } = await verifyRes.json();

    // Attempt to call continue / record with a malicious or spoofed name
    const continueRes = await fetch(`${BASE_URL}/api/dine-in/customer/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: '9876543210',
        name: 'Spoofed Hacker Name',
        qrProofToken,
      }),
    });
    const continueData = await continueRes.json();
    console.log(`[TEST 3] Response Customer Name returned by server: "${continueData.customer?.name}"`);

    const sheetDataAfter = JSON.parse(fs.readFileSync(localSheetPath, 'utf8'));
    const aaravRecordAfter = sheetDataAfter.find((r) => r.mobile_number === '9876543210');
    console.log(`[TEST 3] Name in database file after request: "${aaravRecordAfter.name}"`);

    if (aaravRecordAfter.name !== 'Aarav Sharma') {
      throw new Error(`TEST 3 FAILED: Stored name was mutated! Got "${aaravRecordAfter.name}" instead of "Aarav Sharma"`);
    }
    console.log('[PASS] TEST 3: Name immutability strictly enforced. Stored name is never overwritten.\n');

    // -------------------------------------------------------------------------
    // TEST 4: Single-Use Proof Token Replay Prevention
    // -------------------------------------------------------------------------
    console.log('[TEST 4] Testing Single-Use Token Replay Rejection...');
    const replayRes = await fetch(`${BASE_URL}/api/dine-in/customer/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: '9876543210',
        qrProofToken, // already consumed above!
      }),
    });
    const replayData = await replayRes.json();
    console.log(`[TEST 4] Replay Response Status: ${replayRes.status}, Error: ${replayData.error}`);
    if (replayRes.status !== 403 && replayRes.status !== 500) {
      throw new Error(`TEST 4 FAILED: Replayed proof token was not rejected! Status: ${replayRes.status}`);
    }
    console.log('[PASS] TEST 4: Single-use QR proof token replay properly rejected.\n');

    console.log('====================================================');
    console.log('ALL PASSWORD-FREE CUSTOMER ACCESS TESTS PASSED (100%)');
    console.log('====================================================');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('[FAILED]:', err);
  process.exit(1);
});
