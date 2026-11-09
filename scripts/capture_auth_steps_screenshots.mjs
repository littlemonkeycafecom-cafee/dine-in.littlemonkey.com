import { createRequire } from 'node:module';
const require = createRequire('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer/package.json');
const puppeteer = require('puppeteer');
import path from 'node:path';

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_PIN = '9999';
const SCREENSHOT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/0844d1de-cdde-43df-8637-b53dd2806014/screenshots';

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
  await resetClock();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    await rotateTable('Table 01');
    const entryUrl = await getDevTableEntryUrl('Table 01');

    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812 });
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    await page.goto(entryUrl, { waitUntil: 'networkidle0' });

    // Step A: Mobile Entry
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_step_a_mobile_entry.png') });
    console.log('[SAVED] auth_step_a_mobile_entry.png');

    // Enter existing customer mobile -> Step B
    await page.type('input#customer-mobile', '9876543210');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.includes('Verify Mobile Number')
      );
      if (btn) btn.click();
    });
    await page.waitForFunction(
      () => document.body.innerText.includes('Your mobile number is already registered.'),
      { timeout: 5000 }
    );
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_step_b_existing_customer.png') });
    console.log('[SAVED] auth_step_b_existing_customer.png');

    // Now test Step C (New Customer)
    await rotateTable('Table 03');
    const entryUrl3 = await getDevTableEntryUrl('Table 03');
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 375, height: 812 });
    await page2.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });
    await page2.goto(entryUrl3, { waitUntil: 'networkidle0' });

    const freshMobile = '98765' + Math.floor(10000 + Math.random() * 90000);
    await page2.type('input#customer-mobile', freshMobile);
    await page2.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.includes('Verify Mobile Number')
      );
      if (btn) btn.click();
    });
    await page2.waitForFunction(
      () => document.body.innerText.includes("Welcome! Let's get you started."),
      { timeout: 5000 }
    );
    await page2.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_step_c_new_customer.png') });
    console.log('[SAVED] auth_step_c_new_customer.png');

    await page.close();
    await page2.close();
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
