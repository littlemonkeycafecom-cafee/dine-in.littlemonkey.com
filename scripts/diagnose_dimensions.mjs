import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewport(vp);
    await page.goto('http://127.0.0.1:3000/?token=dev_preview_token', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));
    await page.click('body').catch(() => {});
    const guestBtn = await page.$('button::-p-text(Continue as Guest)');
    if (guestBtn) {
      await guestBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }

    // Scroll to catalog and click card
    await page.evaluate(() => {
      const card = document.querySelector('#main-menu-catalog .lm-product-card') || document.querySelector('.lm-product-card');
      if (card) card.scrollIntoView({ block: 'center' });
    });
    await new Promise(r => setTimeout(r, 400));
    const card = await page.waitForSelector('.lm-product-card');
    await card.click();
    await page.waitForSelector('.lm-product-details-modal', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 500));

    const metrics = await page.evaluate(() => {
      const modal = document.querySelector('.lm-product-details-modal');
      const wrap = document.querySelector('.lm-detail-img-wrap');
      const img = document.querySelector('.lm-detail-img');

      const modalRect = modal ? modal.getBoundingClientRect() : null;
      const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
      const imgRect = img ? img.getBoundingClientRect() : null;

      const modalComputed = modal ? window.getComputedStyle(modal) : null;
      const wrapComputed = wrap ? window.getComputedStyle(wrap) : null;
      const imgComputed = img ? window.getComputedStyle(img) : null;

      return {
        viewportWidth: window.innerWidth,
        modal: {
          computedWidth: modalComputed ? modalComputed.width : '',
          rectWidth: modalRect ? modalRect.width : 0,
          rectHeight: modalRect ? modalRect.height : 0,
        },
        wrap: {
          computedWidth: wrapComputed ? wrapComputed.width : '',
          computedHeight: wrapComputed ? wrapComputed.height : '',
          rectWidth: wrapRect ? wrapRect.width : 0,
          rectHeight: wrapRect ? wrapRect.height : 0,
          overflow: wrapComputed ? wrapComputed.overflow : '',
        },
        img: {
          src: img ? img.src : '',
          naturalWidth: img ? img.naturalWidth : 0,
          naturalHeight: img ? img.naturalHeight : 0,
          computedWidth: imgComputed ? imgComputed.width : '',
          computedHeight: imgComputed ? imgComputed.height : '',
          rectWidth: imgRect ? imgRect.width : 0,
          rectHeight: imgRect ? imgRect.height : 0,
          objectFit: imgComputed ? imgComputed.objectFit : '',
        }
      };
    });

    console.log(`\nMetrics for viewport ${vp.width}x${vp.height}:`);
    console.log(JSON.stringify(metrics, null, 2));

    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));
  }

  await browser.close();
})();
