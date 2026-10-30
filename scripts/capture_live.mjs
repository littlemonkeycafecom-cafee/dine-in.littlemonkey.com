import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:3000/?table=4', { waitUntil: 'networkidle0' });

  // Click guest button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Continue as Table Guest'));
    if (b) b.click();
  });

  await new Promise(r => setTimeout(r, 1000));

  // Scroll down to main menu catalog
  await page.evaluate(() => {
    const el = document.getElementById('main-menu-catalog');
    if (el) el.scrollIntoView();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93/live_catalog_desktop.png' });

  // Click on a product card
  await page.evaluate(() => {
    const card = document.querySelector('.lm-product-card');
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93/live_modal_desktop.png' });

  // Now test mobile viewport
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93/live_modal_mobile.png' });

  await browser.close();
  console.log('Catalog and Modal captured');
})();
