import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';

(async () => {
  console.log('Starting detailed Category Sheet verification...');
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:3000/?token=dev_preview_token', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));
  await page.click('body');
  await new Promise(r => setTimeout(r, 1000));

  const guestBtn = await page.waitForSelector('button::-p-text(Continue as Guest)', { timeout: 5000 });
  if (guestBtn) await guestBtn.click();
  await new Promise(r => setTimeout(r, 1500));

  // Find category button in menu: 'Pizzas'
  console.log('Finding Pizzas category pill...');
  const pizzaPill = await page.waitForSelector('button::-p-text(Pizzas)', { timeout: 5000 });
  await pizzaPill.click();
  await new Promise(r => setTimeout(r, 800));

  // Verify category sheet modal
  const sheetTitle = await page.waitForSelector('#category-sheet-title', { timeout: 5000 });
  let titleText = await page.evaluate(el => el.textContent, sheetTitle);
  console.log('Category Sheet Title:', titleText);

  // Capture desktop category sheet screenshot
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '08_category_sheet_desktop.png') });
  console.log('Captured 08_category_sheet_desktop.png');

  // Switch to Burgers specifically inside .lm-category-sheet-modal
  const switchSuccess = await page.evaluate(() => {
    const ribbon = document.querySelector('.lm-category-sheet-modal [role="tablist"]');
    if (!ribbon) return false;
    const buttons = Array.from(ribbon.querySelectorAll('button'));
    const burgerBtn = buttons.find(b => b.textContent?.trim() === 'Burgers');
    if (burgerBtn) {
      burgerBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Burgers inside ribbon:', switchSuccess);
  await new Promise(r => setTimeout(r, 600));

  titleText = await page.evaluate(() => document.querySelector('#category-sheet-title')?.textContent);
  console.log('Category Sheet Title after switch to Burgers:', titleText);

  // Test dietary filter inside modal: click 'Veg'
  const filterClicked = await page.evaluate(() => {
    const modal = document.querySelector('.lm-category-sheet-modal');
    if (!modal) return false;
    const vegBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent?.includes('Veg') && !b.textContent?.includes('Non'));
    if (vegBtn) {
      vegBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Veg filter in modal:', filterClicked);
  await new Promise(r => setTimeout(r, 600));

  const vegCount = await page.evaluate(() => {
    return document.querySelectorAll('.lm-category-sheet-modal .lm-product-card').length;
  });
  console.log('Number of Veg items in Burgers:', vegCount);

  // Test tablet viewport
  await page.setViewport({ width: 768, height: 1024 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '09_category_sheet_tablet.png') });
  console.log('Captured 09_category_sheet_tablet.png');

  // Test mobile viewport
  await page.setViewport({ width: 375, height: 667 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '10_category_sheet_mobile.png') });
  console.log('Captured 10_category_sheet_mobile.png');

  // Click on a product card inside the category sheet
  const firstCard = await page.waitForSelector('.lm-category-sheet-modal .lm-product-card', { timeout: 5000 });
  await firstCard.click();
  await new Promise(r => setTimeout(r, 800));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '11_product_modal_from_category_sheet.png') });
  console.log('Captured 11_product_modal_from_category_sheet.png');

  await browser.close();
  console.log('Phase 3 category sheet verification successfully completed!');
})();
