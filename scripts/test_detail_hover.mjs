import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:3000/?token=dev_preview_token', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 600));
  await page.click('body').catch(() => {});
  await new Promise(r => setTimeout(r, 400));
  
  const guestBtn = await page.$('button::-p-text(Continue as Guest)');
  if (guestBtn) {
    await guestBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }

  // Open product details modal
  const card = await page.waitForSelector('.lm-product-card', { timeout: 10000 });
  await card.click();
  await page.waitForSelector('.lm-product-details-modal', { timeout: 5000 });
  await new Promise(r => setTimeout(r, 600));

  // Move cursor away from modal image to (0, 0)
  await page.mouse.move(0, 0);
  await new Promise(r => setTimeout(r, 400));

  const unhovered = await page.evaluate(() => {
    const modal = document.querySelector('.lm-product-details-modal');
    const wrap = document.querySelector('.lm-detail-img-wrap');
    const img = document.querySelector('.lm-detail-img');
    const mR = modal.getBoundingClientRect();
    const wR = wrap.getBoundingClientRect();
    const iR = img.getBoundingClientRect();
    return { mW: mR.width, mH: mR.height, wW: wR.width, wH: wR.height, iW: iR.width, iH: iR.height };
  });

  // Hover over detail image wrap
  const detailWrap = await page.$('.lm-detail-img-wrap');
  await detailWrap.hover();
  await new Promise(r => setTimeout(r, 500)); // wait for 350ms transition

  const hovered = await page.evaluate(() => {
    const modal = document.querySelector('.lm-product-details-modal');
    const wrap = document.querySelector('.lm-detail-img-wrap');
    const img = document.querySelector('.lm-detail-img');
    const mR = modal.getBoundingClientRect();
    const wR = wrap.getBoundingClientRect();
    const iR = img.getBoundingClientRect();
    return { mW: mR.width, mH: mR.height, wW: wR.width, wH: wR.height, iW: iR.width, iH: iR.height };
  });

  console.log('Detail Modal Unhovered:', JSON.stringify(unhovered));
  console.log('Detail Modal Hovered:', JSON.stringify(hovered));
  console.log('Scale factor:', (hovered.iW / unhovered.iW).toFixed(3));
  console.log('Modal width delta:', hovered.mW - unhovered.mW);
  console.log('Wrap width delta:', hovered.wW - unhovered.wW);

  await browser.close();
})();
