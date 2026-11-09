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

async function run() {
  console.log('===============================================================');
  console.log('LITTLE MONKEY CAFÉ — PRICE ACCURACY & ADD-ON INTEGRATION QA');
  console.log('===============================================================\n');

  // Fetch valid table access URL
  const devResp = await fetch(`${BASE_URL}/api/dev/tables`);
  const devData = await devResp.json();
  const table = devData.tables.find((t) => t.tableNumber === 'Table 01') || devData.tables[0];
  console.log(`Using Table credentials for ${table.tableNumber}...`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    localStorage.setItem('lm_dinein_intro_seen', 'true');
  });

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(table.entryUrl, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // Bypass customer login modal if presented
  for (let attempt = 0; attempt < 5; attempt++) {
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find((b) => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) {
        guestBtn.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      await new Promise((r) => setTimeout(r, 1000));
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  await page.waitForSelector('#main-menu-catalog', { timeout: 10000 });
  console.log('Dining app loaded successfully.\n');

  // --------------------------------------------------------------------------
  // TEST 1: PIZZA ADD-ON SELECTION & DYNAMIC PRICE CALCULATION
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Pizza Add-ons Selection & Math Verification ---');

  // Click Pizzas category
  const clickedPizzaCat = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.menu-category-grid-card'));
    const pizzaCard = cards.find((c) => c.textContent && c.textContent.includes('Pizzas'));
    if (pizzaCard) {
      pizzaCard.click();
      return true;
    }
    return false;
  });
  assert(clickedPizzaCat, 'Must find and click Pizzas category card.');
  await new Promise((r) => setTimeout(r, 600));

  // Click Margherita Pizza
  const clickedProduct = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.lm-product-card'));
    const pizza = cards.find((c) => c.textContent && c.textContent.includes('Margherita Pizza'));
    if (pizza) {
      pizza.click();
      return true;
    }
    return false;
  });
  assert(clickedProduct, 'Must find and click Margherita Pizza product card.');
  await new Promise((r) => setTimeout(r, 600));

  // Verify modal is open
  const modalOpen = await page.evaluate(() => {
    const modal = document.querySelector('.lm-product-details-modal');
    return Boolean(modal);
  });
  assert(modalOpen, 'Product details modal must be open.');

  // Capture initial state (base price only)
  const initialModalData = await page.evaluate(() => {
    const modal = document.querySelector('.lm-product-details-modal');
    const title = modal?.querySelector('h2')?.textContent?.trim();
    const pricingRowText = modal?.querySelector('[style*="display: flex"][style*="baseline"]')?.textContent?.trim();
    const addonBtns = Array.from(modal?.querySelectorAll('.lm-addon-item') || []);
    return {
      title,
      pricingRowText,
      addonCount: addonBtns.length,
      addonNames: addonBtns.map((b) => b.querySelector('span')?.textContent?.trim()),
    };
  });

  console.log('Initial Modal Data:', initialModalData);
  assert.equal(initialModalData.title, 'Margherita Pizza');
  // Authoritative catalog price for Margherita Pizza is ₹279 (27900 paise, ₹15 reduced from ₹294)
  assert(initialModalData.pricingRowText?.includes('₹279'), 'Base price must be ₹279 from updated catalog (₹294 - ₹15)');
  assert(initialModalData.addonCount > 0, 'Must have applicable add-ons for Pizza');

  const shot1 = path.join(SCREENSHOT_DIR, 'addon_test_01_margherita_base.png');
  await page.screenshot({ path: shot1 });
  console.log(`[EVIDENCE] Saved: ${shot1}`);

  // Step 1: Select "Extra Cheese" (+₹75)
  console.log('Step 1: Selecting "Extra Cheese" (+₹75)...');
  const selectedExtraCheese = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.lm-addon-item'));
    const extraCheese = btns.find((b) => b.textContent && b.textContent.includes('Extra Cheese'));
    if (extraCheese) {
      extraCheese.click();
      return true;
    }
    return false;
  });
  assert(selectedExtraCheese, 'Must find and click Extra Cheese add-on.');
  await new Promise((r) => setTimeout(r, 300));

  // Verify updated price: 279 + 75 = 354
  const priceWithCheese = await page.evaluate(() => {
    const modal = document.querySelector('.lm-product-details-modal');
    const pricingText = modal?.querySelector('[style*="display: flex"][style*="baseline"]')?.textContent?.trim();
    const isChecked = modal?.querySelector('.lm-addon-item[aria-checked="true"]')?.textContent?.trim();
    return { pricingText, isChecked };
  });

  console.log('Price with Extra Cheese:', priceWithCheese);
  assert(priceWithCheese.pricingText?.includes('₹354'), 'Displayed total must be ₹354 (279 + 75)');
  assert(priceWithCheese.pricingText?.includes('Base ₹279 + Extras ₹75'), 'Must display breakdown');

  const shot2 = path.join(SCREENSHOT_DIR, 'addon_test_02_margherita_extra_cheese.png');
  await page.screenshot({ path: shot2 });
  console.log(`[EVIDENCE] Saved: ${shot2}`);

  // Step 2: Select "Jalapeno" (+₹50)
  console.log('Step 2: Selecting "Jalapeno" (+₹50)...');
  const selectedJalapeno = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.lm-addon-item'));
    const jalapeno = btns.find((b) => b.textContent && b.textContent.includes('Jalapeno'));
    if (jalapeno) {
      jalapeno.click();
      return true;
    }
    return false;
  });
  assert(selectedJalapeno, 'Must find and click Jalapeno add-on.');
  await new Promise((r) => setTimeout(r, 300));

  // Verify updated price: 279 + 75 + 50 = 404
  const priceWithTwoAddons = await page.evaluate(() => {
    const modal = document.querySelector('.lm-product-details-modal');
    const pricingText = modal?.querySelector('[style*="display: flex"][style*="baseline"]')?.textContent?.trim();
    const checkedCount = modal?.querySelectorAll('.lm-addon-item[aria-checked="true"]')?.length || 0;
    return { pricingText, checkedCount };
  });

  console.log('Price with Extra Cheese & Jalapeno:', priceWithTwoAddons);
  assert.equal(priceWithTwoAddons.checkedCount, 2);
  assert(priceWithTwoAddons.pricingText?.includes('₹404'), 'Displayed total must be ₹404 (279 + 75 + 50)');
  assert(priceWithTwoAddons.pricingText?.includes('Base ₹279 + Extras ₹125'), 'Must display breakdown (279 + 125)');

  const shot3 = path.join(SCREENSHOT_DIR, 'addon_test_03_margherita_multiple_addons.png');
  await page.screenshot({ path: shot3 });
  console.log(`[EVIDENCE] Saved: ${shot3}`);

  // Step 3: Deselect "Extra Cheese"
  console.log('Step 3: Deselecting "Extra Cheese" to test price deduction...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.lm-addon-item'));
    const extraCheese = btns.find((b) => b.textContent && b.textContent.includes('Extra Cheese'));
    if (extraCheese) extraCheese.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  // Verify updated price: 279 + 50 = 329
  const priceDeselectedCheese = await page.evaluate(() => {
    const modal = document.querySelector('.lm-product-details-modal');
    const pricingText = modal?.querySelector('[style*="display: flex"][style*="baseline"]')?.textContent?.trim();
    const checkedCount = modal?.querySelectorAll('.lm-addon-item[aria-checked="true"]')?.length || 0;
    return { pricingText, checkedCount };
  });

  console.log('Price after deselecting Extra Cheese:', priceDeselectedCheese);
  assert.equal(priceDeselectedCheese.checkedCount, 1);
  assert(priceDeselectedCheese.pricingText?.includes('₹329'), 'Displayed total must be ₹329 (279 + 50)');

  // Step 4: Deselect "Jalapeno" (Zero extras selected)
  console.log('Step 4: Deselecting "Jalapeno" to verify full reversal to Base Price...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.lm-addon-item'));
    const jalapeno = btns.find((b) => b.textContent && b.textContent.includes('Jalapeno'));
    if (jalapeno) jalapeno.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  // Verify back to base price: 279
  const priceBackToBase = await page.evaluate(() => {
    const modal = document.querySelector('.lm-product-details-modal');
    const pricingText = modal?.querySelector('[style*="display: flex"][style*="baseline"]')?.textContent?.trim();
    const checkedCount = modal?.querySelectorAll('.lm-addon-item[aria-checked="true"]')?.length || 0;
    return { pricingText, checkedCount };
  });

  console.log('Price back to base:', priceBackToBase);
  assert.equal(priceBackToBase.checkedCount, 0);
  assert(priceBackToBase.pricingText?.includes('₹279'), 'Displayed total must be back to ₹279');
  assert(!priceBackToBase.pricingText?.includes('Extras'), 'Breakdown should disappear when no extras selected');

  console.log('[PASS] Test 1: Add-on addition, cumulative sum, and reversal verified perfectly.');

  // Close product modal
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'CLOSE');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // --------------------------------------------------------------------------
  // TEST 2: EXTRA DIPS ON FRIES & SIDES
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Extra Dips on Fries & Accompaniments ---');

  // Go back to categories
  await page.evaluate(() => {
    const backBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('All Categories'));
    if (backBtn) backBtn.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // Click Fries category
  const clickedFriesCat = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.menu-category-grid-card'));
    const friesCard = cards.find((c) => c.textContent && c.textContent.includes('Fries'));
    if (friesCard) {
      friesCard.click();
      return true;
    }
    return false;
  });
  assert(clickedFriesCat, 'Must find and click Fries category card.');
  await new Promise((r) => setTimeout(r, 600));

  // Click first fries product
  const clickedFriesProduct = await page.evaluate(() => {
    const card = document.querySelector('.lm-product-card');
    if (card) {
      card.click();
      return true;
    }
    return false;
  });
  assert(clickedFriesProduct, 'Must click a fries product card.');
  await new Promise((r) => setTimeout(r, 600));

  const friesModalData = await page.evaluate(() => {
    const modal = document.querySelector('.lm-product-details-modal');
    const title = modal?.querySelector('h2')?.textContent?.trim();
    const basePriceText = modal?.querySelector('[style*="display: flex"][style*="baseline"]')?.textContent?.trim();
    const addonBtns = Array.from(modal?.querySelectorAll('.lm-addon-item') || []);
    return {
      title,
      basePriceText,
      addons: addonBtns.map((b) => b.textContent?.trim()),
    };
  });

  console.log('Fries Modal Data:', friesModalData);
  assert(friesModalData.addons.some((a) => a.includes('Extra Dip')), 'Must offer Extra Dip (Sauces)');
  assert(friesModalData.addons.some((a) => a.includes('Mayo Dip')), 'Must offer Mayo Dip');

  // Select "Extra Dip (Sauces)" (+₹30)
  console.log('Selecting Extra Dip (Sauces) (+₹30)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.lm-addon-item'));
    const dip = btns.find((b) => b.textContent && b.textContent.includes('Extra Dip'));
    if (dip) dip.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  const friesWithDip = await page.evaluate(() => {
    const modal = document.querySelector('.lm-product-details-modal');
    const pricingText = modal?.querySelector('[style*="display: flex"][style*="baseline"]')?.textContent?.trim();
    return pricingText;
  });
  console.log('Fries price with Extra Dip (+₹30):', friesWithDip);
  assert(friesWithDip?.includes('Extras ₹30'), 'Must show Extras ₹30');

  const shot4 = path.join(SCREENSHOT_DIR, 'addon_test_04_fries_extra_dip.png');
  await page.screenshot({ path: shot4 });
  console.log(`[EVIDENCE] Saved: ${shot4}`);

  console.log('[PASS] Test 2: Extra dips selection and calculation verified.');

  // Close modal
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'CLOSE');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // --------------------------------------------------------------------------
  // TEST 3: READ-ONLY GUARDRAIL AUDIT (SECTION 5 COMPLIANCE)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Read-Only Menu Guardrail Verification (Section 5) ---');

  const guardrailAudit = await page.evaluate(() => {
    // 1. Check for Cart button or shopping bag in header
    const headerBtns = Array.from(document.querySelectorAll('header button'));
    const hasCartInHeader = headerBtns.some((b) => b.getAttribute('aria-label')?.toLowerCase().includes('cart'));

    // 2. Check for Cart tab in Floating Navigation
    const navBtns = Array.from(document.querySelectorAll('nav button'));
    const hasCartInNav = navBtns.some((b) => b.innerText.toLowerCase().includes('cart'));

    // 3. Check for CartDrawer element
    const hasCartDrawer = Boolean(document.querySelector('.cart-drawer, [aria-label*="cart" i][role="dialog"]'));

    // 4. Check for '+' or 'ADD' buttons inside product cards
    const cardBtns = Array.from(document.querySelectorAll('.lm-product-card button'));
    const hasAddInCards = cardBtns.some((b) => {
      const text = b.innerText.trim();
      const aria = b.getAttribute('aria-label') || '';
      return text === '+' || text.toUpperCase() === 'ADD' || aria.toLowerCase().includes('add');
    });

    return {
      hasCartInHeader,
      hasCartInNav,
      hasCartDrawer,
      hasAddInCards,
    };
  });

  console.log('Guardrail Audit:', guardrailAudit);
  assert(!guardrailAudit.hasCartInHeader, 'Header must NOT have a cart button.');
  assert(!guardrailAudit.hasCartInNav, 'Floating navigation must NOT have a cart tab.');
  assert(!guardrailAudit.hasCartDrawer, 'CartDrawer must NOT exist in the DOM.');
  assert(!guardrailAudit.hasAddInCards, 'Product cards must NOT have add-to-cart buttons.');
  console.log('[PASS] Test 3: Read-only digital menu boundaries completely preserved.');

  await browser.close();
  console.log('\n===============================================================');
  console.log('ALL PRICE ACCURACY & ADD-ON INTEGRATION TESTS PASSED CLEANLY!');
  console.log('===============================================================');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
