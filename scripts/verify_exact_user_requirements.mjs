import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';

(async () => {
  console.log('--- STARTING COMPREHENSIVE VERIFICATION ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // 1. Navigate & Authenticate
  await page.goto('http://127.0.0.1:3000/?table=4', { waitUntil: 'networkidle0' });

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const guestBtn = btns.find(b => b.textContent && b.textContent.includes('Continue as Table Guest'));
    if (guestBtn) guestBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // 2. Verify Brand Marquee
  console.log('\n[TEST 1] Verifying Brand Marquee...');
  const marqueeExists = await page.evaluate(() => {
    const strip = document.querySelector('.scrolling-brand-strip');
    if (!strip) return { found: false };
    const style = window.getComputedStyle(strip);
    const stream = document.querySelector('.marquee-content-stream');
    const streamStyle = stream ? window.getComputedStyle(stream) : null;
    const text = strip.textContent || '';
    return {
      found: true,
      text: text.slice(0, 100),
      animation: streamStyle ? streamStyle.animation : 'none',
      height: strip.clientHeight,
    };
  });
  console.log('Marquee evaluation:', marqueeExists);

  // Take screenshot of Carousel + Marquee + Cold Brew Banner together
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_marquee_desktop.png') });
  console.log('Saved verified_marquee_desktop.png');

  // Verify Marquee animation movement (compare translateX over time)
  const pos1 = await page.evaluate(() => {
    const stream = document.querySelector('.marquee-content-stream');
    return stream ? stream.getBoundingClientRect().left : 0;
  });
  await new Promise(r => setTimeout(r, 600));
  const pos2 = await page.evaluate(() => {
    const stream = document.querySelector('.marquee-content-stream');
    return stream ? stream.getBoundingClientRect().left : 0;
  });
  console.log(`Marquee movement check: pos1=${pos1.toFixed(1)}, pos2=${pos2.toFixed(1)}, moved=${pos1 !== pos2}`);

  // 3. Verify Layout Widths & Section Dimensions
  console.log('\n[TEST 2] Verifying Layout Widths (No unexpected 100% expansion)...');
  const layoutMetrics = await page.evaluate(() => {
    const menuSection = document.getElementById('main-menu-catalog');
    const mustTry = document.querySelector('.must-try-section');
    const banner = document.querySelector('.lm-floating-banner');
    const grid = document.querySelector('.lm-product-grid');
    const card = document.querySelector('.lm-product-card');

    return {
      menuSection: menuSection ? { width: menuSection.clientWidth, maxWidth: window.getComputedStyle(menuSection).maxWidth } : null,
      mustTry: mustTry ? { width: mustTry.clientWidth, maxWidth: window.getComputedStyle(mustTry).maxWidth } : null,
      banner: banner ? { width: banner.clientWidth } : null,
      grid: grid ? { width: grid.clientWidth } : null,
      card: card ? { width: card.clientWidth, height: card.clientHeight } : null,
    };
  });
  console.log('Layout Metrics:', JSON.stringify(layoutMetrics, null, 2));

  // 4. Scroll to Catalog & Capture
  await page.evaluate(() => {
    const el = document.getElementById('main-menu-catalog');
    if (el) el.scrollIntoView();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_catalog_layout_desktop.png') });
  console.log('Saved verified_catalog_layout_desktop.png');

  // 5. Test Click Animation & Wave Reveal
  console.log('\n[TEST 3] Verifying Click Feedback & Liquid Wave Reveal Animation...');
  // Find first product card
  const productCard = await page.$('.lm-product-card');
  if (productCard) {
    // Click product card
    await productCard.click();

    // Capture wave sweep actively rising (~280ms)
    await new Promise(r => setTimeout(r, 260));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_wave_rising_active.png') });
    console.log('Saved verified_wave_rising_active.png');

    // Capture peak solar flood (~420ms)
    await new Promise(r => setTimeout(r, 160));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_wave_peak_flood.png') });
    console.log('Saved verified_wave_peak_flood.png');

    // Capture completed reveal (~800ms)
    await new Promise(r => setTimeout(r, 380));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_modal_content_revealed.png') });
    console.log('Saved verified_modal_content_revealed.png');

    // Check modal dimensions
    const modalMetrics = await page.evaluate(() => {
      const modal = document.querySelector('div[role=\"dialog\"] > div');
      if (!modal) return null;
      return {
        width: modal.clientWidth,
        maxWidth: window.getComputedStyle(modal).maxWidth,
        maxHeight: window.getComputedStyle(modal).maxHeight,
      };
    });
    console.log('Modal Dimensions:', modalMetrics);

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label=\"Close product details\"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 350));
  }

  // 6. Test Mobile Viewport (390 x 844 iPhone)
  console.log('\n[TEST 4] Verifying Mobile Viewport (390x844)...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_mobile_top_marquee.png') });
  console.log('Saved verified_mobile_top_marquee.png');

  // Open modal on mobile
  const mobileCard = await page.$('.lm-product-card');
  if (mobileCard) {
    await mobileCard.click();
    await new Promise(r => setTimeout(r, 260));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_mobile_wave_active.png') });
    console.log('Saved verified_mobile_wave_active.png');

    await new Promise(r => setTimeout(r, 550));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_mobile_modal_revealed.png') });
    console.log('Saved verified_mobile_modal_revealed.png');
  }

  await browser.close();
  console.log('\n--- ALL VERIFICATIONS COMPLETED ---');
})();
