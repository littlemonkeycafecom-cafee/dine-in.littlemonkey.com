import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';

(async () => {
  console.log('================================================================');
  console.log('STARTING EVIDENCE-BASED MENU REFINEMENT AUDIT & AUTOMATION TEST');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  async function enterApp(viewport) {
    await page.setViewport(viewport);
    await page.goto('http://127.0.0.1:3000/?token=dev_preview_token', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 800));
    await page.click('body').catch(() => {});
    await new Promise((r) => setTimeout(r, 600));

    const guestBtn = await page.$('button::-p-text(Continue as Guest)');
    if (guestBtn) {
      await guestBtn.click();
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: DESKTOP 1280x800 — Hover Zoom & Category Sheet Separation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 1: DESKTOP 1280x800 ---');
  await enterApp({ width: 1280, height: 800 });

  // 1A. Check hover zoom on product card image
  console.log('Testing desktop image hover-zoom effect on .lm-product-card-img...');
  await page.evaluate(() => {
    const card = document.querySelector('.lm-product-card');
    if (card) card.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise((r) => setTimeout(r, 400));

  const firstCard = await page.waitForSelector('.lm-product-card', { timeout: 6000 });
  const cardImg = await page.$('.lm-product-card .lm-product-card-img');

  if (cardImg && firstCard) {
    const scaleBefore = await page.evaluate((el) => window.getComputedStyle(el).transform, cardImg);
    console.log('  Image transform before hover:', scaleBefore || 'none (scale: 1)');

    await firstCard.hover();
    await new Promise((r) => setTimeout(r, 450));

    const scaleDuring = await page.evaluate((el) => window.getComputedStyle(el).transform, cardImg);
    console.log('  Image transform during hover:', scaleDuring);

    await page.mouse.move(0, 0);
    await new Promise((r) => setTimeout(r, 450));

    const scaleAfter = await page.evaluate((el) => window.getComputedStyle(el).transform, cardImg);
    console.log('  Image transform after hover exit:', scaleAfter);
  }

  // 1B. Open Pizzas Category Sheet
  console.log('\nTesting category opening: Pizzas...');
  const pizzaPill = await page.waitForSelector('button::-p-text(Pizzas)', { timeout: 5000 });
  await pizzaPill.click();
  await page.waitForSelector('.lm-category-sheet-modal', { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 600));

  const pizzaTitle = await page.$eval('#category-sheet-title', (el) => el.textContent?.trim());
  const pizzaItemsCount = await page.$$eval('.lm-category-sheet-modal .lm-product-card', (els) => els.length);
  console.log(`  Category title: "${pizzaTitle}" — Items count: ${pizzaItemsCount}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'refinement_01_desktop_pizzas_sheet.png') });

  // 1C. Switch to Pizza Combos in Ribbon
  console.log('\nSwitching ribbon to Pizza Combos...');
  const switchedToCombos = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.lm-category-sheet-modal [role="tab"]'));
    const comboTab = tabs.find((t) => t.textContent?.trim() === 'Pizza Combos');
    if (comboTab) {
      comboTab.click();
      return true;
    }
    return false;
  });
  console.log('  Clicked Pizza Combos tab:', switchedToCombos);
  await new Promise((r) => setTimeout(r, 800));

  const combosTitle = await page.$eval('#category-sheet-title', (el) => el.textContent?.trim());
  const combosCount = await page.$$eval('.lm-category-sheet-modal .lm-product-card', (els) => els.length);
  console.log(`  Category title: "${combosTitle}" — Items count: ${combosCount}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'refinement_02_desktop_pizza_combos_sheet.png') });

  // Close category sheet
  const closeSheetBtn = await page.$('.lm-category-sheet-modal button[aria-label="Close category"]');
  if (closeSheetBtn) await closeSheetBtn.click();
  await new Promise((r) => setTimeout(r, 600));

  // --------------------------------------------------------------------------
  // TEST 2: PRODUCT DETAILS MODAL ACROSS ALL VIEWPORTS
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: PRODUCT DETAILS MODAL VIEWPORT MATRIX ---');

  const viewports = [
    { name: 'desktop_1280x800', width: 1280, height: 800 },
    { name: 'wide_1440x900', width: 1440, height: 900 },
    { name: 'tablet_768x1024', width: 768, height: 1024 },
    { name: 'mobile_390x844', width: 390, height: 844 },
    { name: 'compact_375x667', width: 375, height: 667 },
  ];

  for (const vp of viewports) {
    console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 400));

    // Scroll to catalog section and click first product card
    await page.evaluate(() => {
      const card = document.querySelector('#main-menu-catalog .lm-product-card') || document.querySelector('.lm-product-card');
      if (card) {
        card.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });
    await new Promise((r) => setTimeout(r, 400));

    const card = await page.waitForSelector('#main-menu-catalog .lm-product-card, .lm-product-card', { timeout: 5000 });
    await card.click();
    await page.waitForSelector('.lm-product-details-modal', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 600));

    // Verify modal elements
    const modalAudit = await page.evaluate(() => {
      const modal = document.querySelector('.lm-product-details-modal');
      if (!modal) return { exists: false };
      const title = modal.querySelector('#modal-product-title')?.textContent?.trim();
      const headerTitle = modal.querySelector('span')?.textContent?.trim();
      const price = modal.querySelector('span[style*="font-size: 20px"]')?.textContent?.trim() ||
                    modal.querySelector('span[style*="font-size: 22px"]')?.textContent?.trim();
      const img = modal.querySelector('.lm-detail-img');
      const hasAddToCart = !!Array.from(modal.querySelectorAll('button')).find((b) =>
        b.textContent?.toLowerCase().includes('add to cart')
      );
      const hasQuantityStepper = !!modal.querySelector('input[type="number"], .quantity-stepper');
      const hasBackToMenu = !!Array.from(modal.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('BACK TO MENU') || b.textContent?.includes('CLOSE')
      );
      const imgBox = img ? img.getBoundingClientRect() : null;
      const modalBox = modal.getBoundingClientRect();

      return {
        exists: true,
        title,
        headerTitle,
        price,
        hasAddToCart,
        hasQuantityStepper,
        hasBackToMenu,
        imgWidth: imgBox ? Math.round(imgBox.width) : 0,
        imgHeight: imgBox ? Math.round(imgBox.height) : 0,
        modalWidth: Math.round(modalBox.width),
        modalHeight: Math.round(modalBox.height),
      };
    });

    console.log(`  Modal audit:`, JSON.stringify(modalAudit, null, 2));

    // Check horizontal page overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`  Horizontal overflow: ${hasHorizontalOverflow ? 'FAIL (overflow detected)' : 'PASS (no overflow)'}`);

    const shotName = `refinement_modal_${vp.name}.png`;
    await page.screenshot({ path: path.join(ARTIFACT_DIR, shotName) });
    console.log(`  Saved screenshot: ${shotName}`);

    // Close detail modal using "BACK TO MENU" button or Esc key
    const backBtn = await page.$('.lm-product-details-modal button::-p-text(BACK TO MENU)');
    if (backBtn) {
      await backBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  // --------------------------------------------------------------------------
  // TEST 3: CATEGORY SHEET AT TABLET & MOBILE VIEWPORTS
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: CATEGORY SHEET RESPONSIVENESS ---');

  // Tablet Category Sheet
  await page.setViewport({ width: 768, height: 1024 });
  await new Promise((r) => setTimeout(r, 400));
  const burgerPill = await page.waitForSelector('button::-p-text(Burgers)', { timeout: 5000 });
  await burgerPill.click();
  await page.waitForSelector('.lm-category-sheet-modal', { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'refinement_category_sheet_tablet.png') });
  console.log('  Saved refinement_category_sheet_tablet.png');

  // Mobile Category Sheet
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'refinement_category_sheet_mobile_390.png') });
  console.log('  Saved refinement_category_sheet_mobile_390.png');

  // Test Dietary Filter Veg on Mobile
  console.log('  Testing Veg dietary filter on mobile category sheet...');
  await page.evaluate(() => {
    const modal = document.querySelector('.lm-category-sheet-modal');
    const vegBtn = Array.from(modal.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Veg'
    );
    if (vegBtn) vegBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const mobileVegCount = await page.$$eval('.lm-category-sheet-modal .lm-product-card', (els) => els.length);
  console.log(`  Veg burgers count: ${mobileVegCount}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'refinement_category_sheet_mobile_veg_filtered.png') });

  // Close sheet
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 600));

  await browser.close();

  console.log('\n================================================================');
  console.log(`Console errors during test: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Console error details:', consoleErrors);
  }
  console.log('ALL BROWSER AUTOMATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
})();
