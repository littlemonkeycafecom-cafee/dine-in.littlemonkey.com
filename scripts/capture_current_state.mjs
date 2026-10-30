import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:3000/?table=4', { waitUntil: 'networkidle0' });

  // Authenticate as table guest
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Continue as Table Guest'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // Capture desktop top
  await page.screenshot({ path: 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93/current_live_desktop_top.png' });

  // Scroll to cold brew hero and must try
  await page.evaluate(() => window.scrollBy(0, 500));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93/current_live_desktop_hero.png' });

  // Scroll to catalog
  await page.evaluate(() => {
    const el = document.getElementById('main-menu-catalog');
    if (el) el.scrollIntoView();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93/current_live_desktop_catalog.png' });

  // Click a product card
  const card = await page.$('.lm-product-card');
  if (card) await card.click();
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93/current_live_desktop_modal.png' });

  // Mobile viewport
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93/current_live_mobile_modal.png' });

  await browser.close();
  console.log('Screenshots captured successfully');
})();
