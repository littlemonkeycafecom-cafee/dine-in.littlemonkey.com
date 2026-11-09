import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const puppeteerPath = 'C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer';
const puppeteer = require(puppeteerPath);

const BASE_URL = 'http://127.0.0.1:3000';
const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/0844d1de-cdde-43df-8637-b53dd2806014/screenshots';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function capture() {
  console.log('[INFO] Launching Puppeteer browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 }); // iPhone 14 frame

  // 1. Get Table 01 valid entry URL from dev tables and active secrets
  const tablesResp = await fetch(`${BASE_URL}/api/dev/tables`);
  const tablesData = await tablesResp.json();
  const table01 = tablesData.tables.find((t) => t.tableNumber === 'Table 01') || tablesData.tables[0];
  const secretsMap = JSON.parse(fs.readFileSync('.active_qr_secrets.json', 'utf8'));
  const rawSecret = secretsMap[table01.credentialId];

  // Navigate to Table 01 QR entry
  const entryUrl = `${BASE_URL}/?table=Table%2001&cred=${table01.credentialId}.${rawSecret}`;
  console.log(`[INFO] Navigating to ${entryUrl}...`);
  await page.goto(entryUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  await delay(1000);

  // Take screenshot 1: Mobile Entry Screen
  const shot1 = path.join(ARTIFACT_DIR, 'phase2_step1_mobile_entry.png');
  await page.screenshot({ path: shot1, fullPage: true });
  console.log(`[PASS] Captured ${shot1}`);

  // 2. Type existing customer mobile: 9999999999
  const inputSelector = '#customer-mobile';
  await page.waitForSelector(inputSelector);
  await page.type(inputSelector, '9999999999');
  await delay(500);

  // Submit mobile number
  const submitBtnSelector = 'button[type="submit"]';
  await page.click(submitBtnSelector);
  console.log('[INFO] Submitted mobile number, waiting for Google Sheets response...');

  // Wait for existing customer screen (contains "Welcome back")
  await page.waitForFunction(
    () => document.body.innerText.includes('Welcome back') && document.body.innerText.includes('Test Probe'),
    { timeout: 15000 }
  );
  await delay(1000);

  // Take screenshot 2: Existing Customer Recognition Screen
  const shot2 = path.join(ARTIFACT_DIR, 'phase2_step2_existing_customer_recognized.png');
  await page.screenshot({ path: shot2, fullPage: true });
  console.log(`[PASS] Captured ${shot2}`);

  // 3. Click "Continue to Menu" button
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.innerText.includes('Continue to Menu'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }, { timeout: 10000 });

  console.log('[INFO] Clicked Continue to Menu, waiting for dining menu...');
  await delay(2500);

  // Take screenshot 3: Continued Dining Menu
  const shot3 = path.join(ARTIFACT_DIR, 'phase2_step3_dining_session_active.png');
  await page.screenshot({ path: shot3, fullPage: true });
  console.log(`[PASS] Captured ${shot3}`);

  await browser.close();
  console.log('[INFO] All screenshots captured successfully.');
}

capture().catch(console.error);
