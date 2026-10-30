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

  // Scroll to card
  await page.evaluate(() => {
    const card = document.querySelector('.lm-product-card');
    if (card) card.scrollIntoView({ block: 'center' });
  });
  await new Promise(r => setTimeout(r, 500));

  const cardHandle = await page.waitForSelector('.lm-product-card', { timeout: 10000 });
  console.log('Found product card');

  // Move mouse to top-left corner
  await page.mouse.move(0, 0);
  await new Promise(r => setTimeout(r, 400));

  const unhovered = await page.evaluate(() => {
    const card = document.querySelector('.lm-product-card');
    const wrap = card.querySelector('.lm-product-card-img-wrap');
    const img = card.querySelector('.lm-product-card-img');
    const cR = card.getBoundingClientRect();
    const wR = wrap.getBoundingClientRect();
    const iR = img.getBoundingClientRect();
    return { cTop: cR.top, cLeft: cR.left, cW: cR.width, cH: cR.height, wW: wR.width, iW: iR.width, iH: iR.height };
  });

  // Native hover over the card image wrap
  const wrapEl = await page.$('.lm-product-card .lm-product-card-img-wrap');
  await wrapEl.hover();
  await new Promise(r => setTimeout(r, 500)); // wait for 320ms transition

  const hovered = await page.evaluate(() => {
    const card = document.querySelector('.lm-product-card');
    const wrap = card.querySelector('.lm-product-card-img-wrap');
    const img = card.querySelector('.lm-product-card-img');
    const cR = card.getBoundingClientRect();
    const wR = wrap.getBoundingClientRect();
    const iR = img.getBoundingClientRect();
    return { cTop: cR.top, cLeft: cR.left, cW: cR.width, cH: cR.height, wW: wR.width, iW: iR.width, iH: iR.height };
  });

  console.log('Unhovered:', JSON.stringify(unhovered));
  console.log('Hovered:', JSON.stringify(hovered));
  console.log('Scale factor:', (hovered.iW / unhovered.iW).toFixed(3));
  console.log('Card width delta:', hovered.cW - unhovered.cW);
  console.log('Card position top delta:', hovered.cTop - unhovered.cTop);
  console.log('Card position left delta:', hovered.cLeft - unhovered.cLeft);

  // Now check reduced motion
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await new Promise(r => setTimeout(r, 300));

  const reducedMotionHovered = await page.evaluate(() => {
    const card = document.querySelector('.lm-product-card');
    const img = card.querySelector('.lm-product-card-img');
    const iR = img.getBoundingClientRect();
    const cs = window.getComputedStyle(img);
    return { iW: iR.width, transform: cs.transform, transition: cs.transition };
  });
  console.log('Reduced motion with hover:', JSON.stringify(reducedMotionHovered));

  await browser.close();
})();
