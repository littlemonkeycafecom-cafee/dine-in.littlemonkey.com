import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const EVIDENCE_DIR = 'C:/Users/chava/.gemini/antigravity/brain/474254f3-667d-473b-a69d-adafb39fb6a9/evidence/dine_in_audit';
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

console.log('================================================================');
console.log('DINE-IN: 7-VIEWPORT RESPONSIVE & CATEGORY SHEET AUDIT');
console.log('================================================================\n');

const viewports = [
  { name: 'mobile_320', width: 320, height: 568 },
  { name: 'mobile_375', width: 375, height: 667 },
  { name: 'mobile_430', width: 430, height: 932 },
  { name: 'tablet_768', width: 768, height: 1024 },
  { name: 'tablet_1024', width: 1024, height: 768 },
  { name: 'desktop_1280', width: 1280, height: 800 },
  { name: 'desktop_1440', width: 1440, height: 900 },
];

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log('Navigating to http://127.0.0.1:3000/?token=dev_preview_token...');
    await page.goto('http://127.0.0.1:3000/?token=dev_preview_token', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 1200));

    // Handle initial splash / intro click if present
    await page.click('body');
    await new Promise((r) => setTimeout(r, 800));

    // Check if Guest button is present and click
    const guestBtn = await page.$('button::-p-text(Continue as Guest)');
    if (guestBtn) {
      console.log('Clicking "Continue as Guest"...');
      await guestBtn.click();
      await new Promise((r) => setTimeout(r, 1200));
    }

    for (const vp of viewports) {
      console.log(`\n--- Auditing Viewport: ${vp.name} (${vp.width}x${vp.height}px) ---`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise((r) => setTimeout(r, 400));

      // 1. Check root overflow on page
      const pageOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return {
          scrollWidth: root.scrollWidth,
          clientWidth: window.innerWidth,
          hasOverflow: root.scrollWidth > window.innerWidth,
        };
      });
      console.log(`  Page root: scrollWidth=${pageOverflow.scrollWidth}, clientWidth=${pageOverflow.clientWidth}, overflow=${pageOverflow.hasOverflow}`);
      assert.equal(pageOverflow.hasOverflow, false, `Page must have 0 horizontal overflow at ${vp.width}px`);

      // 2. Open Category Sheet via category button
      console.log('  Opening Category Sheet (Pizzas)...');
      const opened = await page.evaluate(() => {
        // Find category button
        const buttons = Array.from(document.querySelectorAll('button'));
        const pizzaBtn = buttons.find((b) => b.innerText.includes('Pizzas'));
        if (pizzaBtn) {
          pizzaBtn.scrollIntoView({ block: 'center' });
          pizzaBtn.click();
          return true;
        }
        return false;
      });
      assert.ok(opened, `Failed to find and click Pizzas button at ${vp.width}px`);
      await new Promise((r) => setTimeout(r, 700));

      // Verify category sheet is open
      const sheetVisible = await page.evaluate(() => {
        const sheet = document.querySelector('.lm-category-sheet-modal');
        const title = document.querySelector('#category-sheet-title');
        return {
          exists: Boolean(sheet),
          title: title ? title.innerText.trim() : null,
        };
      });
      console.log(`  Sheet visible: ${sheetVisible.exists}, Title: "${sheetVisible.title}"`);
      assert.ok(sheetVisible.exists, `Category sheet must be visible at ${vp.width}px`);
      assert.ok(sheetVisible.title?.includes('Pizzas'), `Sheet title must include 'Pizzas', got '${sheetVisible.title}'`);

      // Check sheet horizontal overflow
      const sheetOverflow = await page.evaluate(() => {
        const sheet = document.querySelector('.lm-category-sheet-modal');
        if (!sheet) return null;
        return {
          scrollWidth: sheet.scrollWidth,
          clientWidth: sheet.clientWidth,
          hasOverflow: sheet.scrollWidth > sheet.clientWidth,
        };
      });
      if (sheetOverflow) {
        console.log(`  Sheet overflow check: scrollWidth=${sheetOverflow.scrollWidth}, clientWidth=${sheetOverflow.clientWidth}, overflow=${sheetOverflow.hasOverflow}`);
      }

      // Capture screenshot of category sheet
      const shotPath = path.join(EVIDENCE_DIR, `category_sheet_${vp.name}.png`);
      await page.screenshot({ path: shotPath });
      console.log(`  Saved screenshot: category_sheet_${vp.name}.png`);

      // 3. Switch to another category (Burgers) inside ribbon tablist
      console.log('  Testing ribbon tab switch to Burgers...');
      const switched = await page.evaluate(() => {
        const ribbon = document.querySelector('.lm-category-sheet-modal [role="tablist"]');
        if (!ribbon) return false;
        const buttons = Array.from(ribbon.querySelectorAll('button'));
        const burgerBtn = buttons.find((b) => b.innerText.trim() === 'Burgers');
        if (burgerBtn) {
          burgerBtn.click();
          return true;
        }
        return false;
      });
      assert.ok(switched, `Failed to find and click Burgers tab in ribbon at ${vp.width}px`);
      await new Promise((r) => setTimeout(r, 600));

      const newTitle = await page.evaluate(() => document.querySelector('#category-sheet-title')?.innerText?.trim());
      console.log(`  New Sheet Title after switch: "${newTitle}"`);
      assert.ok(newTitle?.includes('Burgers'), `Title must update to Burgers, got '${newTitle}'`);

      // 4. Test Dietary Filter (VEG)
      console.log('  Testing dietary filter pill (VEG)...');
      const filtered = await page.evaluate(() => {
        const modal = document.querySelector('.lm-category-sheet-modal');
        if (!modal) return false;
        const vegBtn = Array.from(modal.querySelectorAll('button')).find(
          (b) => b.innerText.trim().toLowerCase() === 'veg' || (b.innerText.toLowerCase().includes('veg') && !b.innerText.toLowerCase().includes('non'))
        );
        if (vegBtn) {
          vegBtn.click();
          return true;
        }
        return false;
      });
      assert.ok(filtered, 'Failed to click VEG filter pill');
      await new Promise((r) => setTimeout(r, 500));

      const productCount = await page.evaluate(() => {
        return document.querySelectorAll('.lm-category-sheet-modal .lm-product-card').length;
      });
      console.log(`  Filtered product count for VEG Burgers: ${productCount}`);

      // 5. Test opening product details modal from inside sheet
      if (productCount > 0) {
        console.log('  Clicking first product card to open ProductDetailsModal...');
        await page.evaluate(() => {
          const card = document.querySelector('.lm-category-sheet-modal .lm-product-card');
          if (card) card.click();
        });
        await new Promise((r) => setTimeout(r, 600));

        const productModalVisible = await page.evaluate(() => {
          const modal = document.querySelector('.lm-product-details-modal');
          const name = modal ? modal.querySelector('h2, h3')?.innerText : null;
          return { exists: Boolean(modal), name };
        });
        console.log(`  Product Modal open: ${productModalVisible.exists}, Product: "${productModalVisible.name}"`);

        // Close product modal
        await page.keyboard.press('Escape');
        await new Promise((r) => setTimeout(r, 400));
      }

      // 6. Close Category Sheet
      console.log('  Closing Category Sheet...');
      const closed = await page.evaluate(() => {
        const closeBtn = document.querySelector('.lm-category-sheet-modal button[aria-label="Close"], .lm-category-sheet-modal button.sheet-close-btn');
        if (closeBtn) {
          closeBtn.click();
          return true;
        }
        return false;
      });
      if (!closed) {
        await page.keyboard.press('Escape');
      }
      await new Promise((r) => setTimeout(r, 500));

      const sheetAfterClose = await page.evaluate(() => Boolean(document.querySelector('.lm-category-sheet-modal')));
      console.log(`  Sheet closed cleanly: ${!sheetAfterClose}`);
      assert.equal(sheetAfterClose, false, `Category sheet must be closed at ${vp.width}px`);
      console.log(`✓ PASS: Viewport ${vp.name} verified successfully.`);
    }

    console.log('\n================================================================');
    console.log('ALL 7 VIEWPORTS & CATEGORY SHEET CHECKS PASSED (7/7)!');
    console.log('================================================================\n');

  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\n[AUDIT FAILED]:', err);
  process.exit(1);
});
