import { strict as assert } from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteerPath = 'C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer';
const puppeteer = require(puppeteerPath);

const SCREENSHOT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93/verification_screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

async function runVerification() {
  console.log('================================================================');
  console.log('LITTLE MONKEY CAFÉ DINING — READ-ONLY DIGITAL MENU VERIFICATION');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // -------------------------------------------------------------------------
  // TEST 1: Branded Intro Welcome Screen on First Session Visit
  // -------------------------------------------------------------------------
  console.log('Step 1: Navigating to fresh session on http://127.0.0.1:3000/?table=4 ...');
  await page.goto('http://127.0.0.1:3000/?table=4', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Wait for intro screen elements
  await page.waitForSelector('[role="banner"][aria-label="Little Monkey Café Welcome"]', { timeout: 3000 });
  console.log('  [PASS] Branded intro welcome screen mounted gracefully.');

  const introScreenshot = path.join(SCREENSHOT_DIR, '01_branded_intro_screen.png');
  await page.screenshot({ path: introScreenshot });
  console.log(`  [EVIDENCE] Saved: ${introScreenshot}`);

  // Tap to skip or wait for intro transition into login gate
  console.log('Step 2: Dismissing intro into mandatory authentication gate...');
  await page.click('[role="banner"][aria-label="Little Monkey Café Welcome"]');
  await delay();

  // -------------------------------------------------------------------------
  // TEST 2: Mandatory Customer Login Gate
  // -------------------------------------------------------------------------
  const loginGateExists = await page.waitForSelector('input[type="tel"], input[placeholder*="10-digit"]', { timeout: 4000 });
  assert(loginGateExists, 'Customer login gate must be displayed to unauthenticated diners.');
  console.log('  [PASS] Mandatory customer login gate active. Unauthenticated diners cannot browse menu.');

  // Check for absent menu catalog while on login gate
  const menuOnGate = await page.$('#main-menu-catalog');
  assert(!menuOnGate, 'Menu catalog must NOT be mounted while unauthenticated.');
  console.log('  [PASS] Menu catalog is strictly gated behind authentication.');

  const loginScreenshot = path.join(SCREENSHOT_DIR, '02_mandatory_login_gate.png');
  await page.screenshot({ path: loginScreenshot });
  console.log(`  [EVIDENCE] Saved: ${loginScreenshot}`);

  // -------------------------------------------------------------------------
  // TEST 3: Enter via Dev Guest Preview Mode
  // -------------------------------------------------------------------------
  console.log('Step 3: Authenticating via Dev Guest Preview...');
  const guestBtn = await page.waitForSelector('button ::-p-text(Continue as Guest)', { timeout: 3000 });
  assert(guestBtn, 'Dev guest preview button must be present in development.');
  await guestBtn.click();
  await delay();

  // Verify Header & GUEST PREVIEW Badge
  await page.waitForSelector('header', { timeout: 4000 });
  console.log('  [PASS] Successfully entered digital menu.');

  const guestPill = await page.evaluate(() => {
    return document.body.innerText.includes('GUEST PREVIEW');
  });
  assert(guestPill, 'Header must display "GUEST PREVIEW" badge in guest mode.');
  console.log('  [PASS] "GUEST PREVIEW" badge clearly indicated in header.');

  const authHeaderScreenshot = path.join(SCREENSHOT_DIR, '03_guest_preview_authenticated_header.png');
  await page.screenshot({ path: authHeaderScreenshot });
  console.log(`  [EVIDENCE] Saved: ${authHeaderScreenshot}`);

  // -------------------------------------------------------------------------
  // TEST 4: Strict Read-Only Digital Menu Verification
  // -------------------------------------------------------------------------
  console.log('Step 4: Auditing entire menu surface for absolute absence of cart/ordering features...');

  const auditResults = await page.evaluate(() => {
    // 1. Check for Cart button or shopping bag in header
    const headerBtns = Array.from(document.querySelectorAll('header button'));
    const hasCartInHeader = headerBtns.some(b => b.getAttribute('aria-label')?.toLowerCase().includes('cart'));

    // 2. Check for Cart tab in Floating Navigation
    const navBtns = Array.from(document.querySelectorAll('nav button'));
    const hasCartInNav = navBtns.some(b => b.innerText.toLowerCase().includes('cart'));

    // 3. Check for CartDrawer element
    const hasCartDrawer = Boolean(document.querySelector('.cart-drawer, [aria-label*="cart" i][role="dialog"]'));

    // 4. Check for '+' or 'ADD' buttons inside product cards
    const cardBtns = Array.from(document.querySelectorAll('.lm-product-card button'));
    const hasAddInCards = cardBtns.some(b => {
      const text = b.innerText.trim();
      const aria = b.getAttribute('aria-label') || '';
      return text === '+' || text.toUpperCase() === 'ADD' || aria.toLowerCase().includes('add');
    });

    // 5. Check for '+' or 'ADD' in Must Try Rail
    const mustTryBtns = Array.from(document.querySelectorAll('.must-try-section button'));
    const hasAddInMustTry = mustTryBtns.some(b => {
      const text = b.innerText.trim();
      const aria = b.getAttribute('aria-label') || '';
      return text === '+' || text.toUpperCase() === 'ADD' || aria.toLowerCase().includes('add');
    });

    return {
      hasCartInHeader,
      hasCartInNav,
      hasCartDrawer,
      hasAddInCards,
      hasAddInMustTry,
      cardCount: document.querySelectorAll('.lm-product-card').length,
    };
  });

  console.log('  Audit Details:', auditResults);
  assert(!auditResults.hasCartInHeader, 'Header must NOT have a cart button.');
  assert(!auditResults.hasCartInNav, 'Floating navigation must NOT have a cart tab.');
  assert(!auditResults.hasCartDrawer, 'CartDrawer must NOT exist in the DOM.');
  assert(!auditResults.hasAddInCards, 'Product cards must NOT have add-to-cart buttons.');
  assert(!auditResults.hasAddInMustTry, 'Must-Try recommendations must NOT have add-to-cart buttons.');
  assert(auditResults.cardCount > 0, 'Products must be visible on the read-only menu.');
  console.log(`  [PASS] All ordering & cart features are strictly absent across ${auditResults.cardCount} product cards.`);

  const catalogScreenshot = path.join(SCREENSHOT_DIR, '04_catalog_view_no_cart_buttons.png');
  await page.screenshot({ path: catalogScreenshot });
  console.log(`  [EVIDENCE] Saved: ${catalogScreenshot}`);

  // -------------------------------------------------------------------------
  // TEST 5: Read-Only Product Detail View & Liquid Wave Transition
  // -------------------------------------------------------------------------
  console.log('Step 5: Clicking product card to verify read-only detail view & liquid wave...');
  const firstCard = await page.$('.lm-product-card');
  assert(firstCard, 'At least one product card must be present.');
  await firstCard.click();

  // Wait for modal
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 3000 });
  await delay(); // allow wave transition to settle

  const modalAudit = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!modal) return null;

    const buttons = Array.from(modal.querySelectorAll('button'));

    // Check for quantity steppers (-, +, digits)
    const hasQuantityStepper = buttons.some(b => b.innerText.trim() === '+' || b.innerText.trim() === '-');

    // Check for kitchen instructions textarea
    const hasInstructions = Boolean(modal.querySelector('textarea'));

    // Check for ADD TO ORDER / ADD TO CART button
    const hasAddBtn = buttons.some(b => {
      const t = b.innerText.toUpperCase();
      return t.includes('ADD TO ORDER') || t.includes('ADD TO CART') || t.includes('ORDER NOW');
    });

    // Check for CLOSE button
    const hasCloseBtn = buttons.some(b => b.innerText.toUpperCase().includes('CLOSE'));

    // Check for price display
    const hasPrice = modal.innerText.includes('₹');

    // Check for dietary badge
    const hasDietBadge = Boolean(modal.querySelector('div[title="Vegetarian"], div[title="Non-Vegetarian"]'));

    return {
      hasQuantityStepper,
      hasInstructions,
      hasAddBtn,
      hasCloseBtn,
      hasPrice,
      hasDietBadge,
    };
  });

  console.log('  Modal Audit:', modalAudit);
  assert(!modalAudit.hasQuantityStepper, 'Modal must NOT have a quantity stepper.');
  assert(!modalAudit.hasInstructions, 'Modal must NOT have kitchen instructions textarea.');
  assert(!modalAudit.hasAddBtn, 'Modal must NOT have an ADD TO ORDER button.');
  assert(modalAudit.hasCloseBtn, 'Modal must have a CLOSE action button.');
  assert(modalAudit.hasPrice, 'Modal must display price informationally.');
  console.log('  [PASS] Product detail modal is 100% read-only and informative.');

  const modalScreenshot = path.join(SCREENSHOT_DIR, '05_product_details_modal_read_only.png');
  await page.screenshot({ path: modalScreenshot });
  console.log(`  [EVIDENCE] Saved: ${modalScreenshot}`);

  // Close modal
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('CLOSE'));
    if (btn) btn.click();
  });
  await delay(400);

  // -------------------------------------------------------------------------
  // TEST 6: Mobile Viewport Verification (390 x 844)
  // -------------------------------------------------------------------------
  console.log('Step 6: Testing mobile viewport (390 x 844)...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await delay(500);

  const mobileScreenshot = path.join(SCREENSHOT_DIR, '06_mobile_read_only_experience.png');
  await page.screenshot({ path: mobileScreenshot });
  console.log(`  [EVIDENCE] Saved: ${mobileScreenshot}`);

  // Open product on mobile
  const mobileCard = await page.$('.lm-product-card');
  if (mobileCard) {
    await mobileCard.click();
    await delay();
    const mobileModalScreenshot = path.join(SCREENSHOT_DIR, '07_mobile_product_details_modal.png');
    await page.screenshot({ path: mobileModalScreenshot });
    console.log(`  [EVIDENCE] Saved: ${mobileModalScreenshot}`);
  }

  console.log('\n================================================================');
  console.log('ALL VERIFICATION SUITES PASSED WITH ZERO DEFECTS!');
  console.log('================================================================\n');

  await browser.close();
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
