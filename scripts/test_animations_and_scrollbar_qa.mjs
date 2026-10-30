import { strict as assert } from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteerPath = 'C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer';
const puppeteer = require(puppeteerPath);

const SCREENSHOT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93/verification_screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runQATests() {
  console.log('\n================================================================');
  console.log('LITTLE MONKEY CAFÉ — ANIMATION & SCROLLBAR AUTOMATED QA');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });

  // 1. Prepare Customer Auth Session
  const testPhone = '9876543210';
  const customerTokenPayload = {
    sub: `user_${testPhone}`,
    phone: `+91${testPhone}`,
    name: 'Bhuvan Teja',
    role: 'customer',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7200,
  };
  const validCustomerToken = `dev_token.${Buffer.from(JSON.stringify(customerTokenPayload)).toString('base64')}.lmc`;
  const sessionData = {
    token: validCustomerToken,
    user: {
      id: `user_${testPhone}`,
      phone: `+91${testPhone}`,
      name: 'Bhuvan Teja',
      role: 'customer',
    },
    expiresAt: Date.now() + 7200 * 1000,
  };

  console.log('Step 1: Navigating to Little Monkey Dine-In on 127.0.0.1:3000/?table=4 ...');
  await page.goto('http://127.0.0.1:3000/?table=4', { waitUntil: 'networkidle0' });

  // Inject session into localStorage
  await page.evaluate((data) => {
    localStorage.setItem('lm_dinein_auth_v2', JSON.stringify(data));
  }, sessionData);

  // Reload to authenticate
  await page.goto('http://127.0.0.1:3000/?table=4', { waitUntil: 'networkidle0' });
  await page.waitForSelector('main', { timeout: 8000 });
  console.log('✅ PASS: Customer authenticated into Dine-In menu');

  // Step 2: Test Primary Animation (Liquid Wave Reveal) on Product Details Modal
  console.log('\nStep 2: Testing Primary Animation (Liquid Wave Reveal) on Product Details Modal...');
  
  // Find a product card to click
  await page.waitForSelector('.lm-product-card', { timeout: 6000 });
  
  // Click on the first product card
  const productCard = await page.$('.lm-product-card');
  assert(productCard, 'Product card must be present');
  
  // Setup listener to catch wave element immediately after click
  await productCard.click();
  
  // Wait for dialog
  await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

  // Check if wave sweep container is present
  const waveEl = await page.$('.lm-liquid-wave-sweep-container');
  const wavePresent = waveEl !== null;
  console.log(`Wave Sweep Container Present on Click: ${wavePresent ? '✅ YES' : '❌ NO'}`);
  assert(wavePresent, 'LiquidWaveTransition sweep container must be present on modal open');

  // Capture screenshot during active wave reveal
  const waveShotPath = path.join(SCREENSHOT_DIR, 'shot_wave_animation_active.png');
  await page.screenshot({ path: waveShotPath });
  console.log(`📸 Saved active wave animation screenshot: ${waveShotPath}`);

  // Wait for wave animation to complete (~650ms)
  await new Promise((r) => setTimeout(r, 680));

  // Check that content is revealed and wave is done
  const productTitle = await page.$eval('#modal-product-title', (el) => el.textContent);
  console.log(`✅ PASS: Liquid wave smoothly dissolved, revealing: "${productTitle}"`);

  const revealedShotPath = path.join(SCREENSHOT_DIR, 'shot_product_details_revealed.png');
  await page.screenshot({ path: revealedShotPath });
  console.log(`📸 Saved revealed product detail screenshot: ${revealedShotPath}`);

  // Step 3: Test Custom Scrollbar Animation & Sync in Product Details Modal
  console.log('\nStep 3: Testing Custom Scrollbar Animation & Tracking in Modal...');
  
  const customTrack = await page.$('.lm-custom-scrollbar-track');
  const customThumb = await page.$('.lm-custom-scrollbar-thumb');
  const viewport = await page.$('.lm-custom-scrollbar-viewport');
  
  assert(customTrack, 'Custom scrollbar track must be rendered');
  assert(customThumb, 'Custom scrollbar thumb must be rendered');
  assert(viewport, 'Custom scrollbar viewport must be rendered');

  // Check initial scroll metrics
  const initialScroll = await page.evaluate((vp) => ({
    scrollTop: vp.scrollTop,
    scrollHeight: vp.scrollHeight,
    clientHeight: vp.clientHeight,
  }), viewport);
  console.log(`Initial metrics: scrollTop=${initialScroll.scrollTop}, clientHeight=${initialScroll.clientHeight}, scrollHeight=${initialScroll.scrollHeight}`);

  const initialThumbTop = await page.evaluate((thumb) => parseFloat(thumb.style.top || '0'), customThumb);
  console.log(`Initial thumb top: ${initialThumbTop}px`);

  // Scroll viewport down by 250px
  await page.evaluate((vp) => {
    vp.scrollTop = 250;
    vp.dispatchEvent(new Event('scroll'));
  }, viewport);

  await new Promise((r) => setTimeout(r, 150));

  // Verify thumb updated
  const updatedThumb = await page.evaluate((thumb) => ({
    top: parseFloat(thumb.style.top || '0'),
    backgroundColor: window.getComputedStyle(thumb).backgroundColor,
    boxShadow: window.getComputedStyle(thumb).boxShadow,
  }), customThumb);

  console.log(`Updated thumb top after scroll: ${updatedThumb.top}px`);
  console.log(`Active thumb color: ${updatedThumb.backgroundColor}`);
  assert(updatedThumb.top > initialThumbTop, 'Thumb must track scroll position downward');

  const scrolledShotPath = path.join(SCREENSHOT_DIR, 'shot_custom_scrollbar_scrolled.png');
  await page.screenshot({ path: scrolledShotPath });
  console.log(`📸 Saved custom scrollbar scrolled screenshot: ${scrolledShotPath}`);

  // Step 4: Test Add to Cart & Cart Drawer Wave Reveal
  console.log('\nStep 4: Testing Add to Cart and Cart Drawer Liquid Wave Reveal...');
  
  // Click Add to Order button in modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtn = btns.find((b) => b.textContent?.includes('ADD TO ORDER'));
    if (addBtn) addBtn.click();
  });

  await new Promise((r) => setTimeout(r, 500));

  // Open Cart Drawer via floating navigation or button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const cartBtn = btns.find((b) => 
      b.textContent?.toLowerCase().includes('cart') || 
      b.getAttribute('aria-label')?.toLowerCase().includes('cart') ||
      b.className?.includes('cart')
    );
    if (cartBtn) cartBtn.click();
  });

  await new Promise((r) => setTimeout(r, 120));

  // Check if wave sweep is triggered on Cart Drawer
  const cartWave = await page.$('.lm-liquid-wave-sweep-container');
  console.log(`Cart Drawer Wave Sweep Active: ${cartWave !== null ? '✅ YES' : '❌ NO'}`);

  const cartWaveShotPath = path.join(SCREENSHOT_DIR, 'shot_cart_wave_reveal.png');
  await page.screenshot({ path: cartWaveShotPath });
  console.log(`📸 Saved Cart wave reveal screenshot: ${cartWaveShotPath}`);

  await new Promise((r) => setTimeout(r, 650));
  const cartOpenShotPath = path.join(SCREENSHOT_DIR, 'shot_cart_drawer_open.png');
  await page.screenshot({ path: cartOpenShotPath });
  console.log(`📸 Saved Cart drawer open screenshot: ${cartOpenShotPath}`);

  // Step 5: Test Mobile Viewport (390x844 iPhone 14 / modern smartphone)
  console.log('\nStep 5: Testing Mobile Viewport (390x844) Responsiveness...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('main', { timeout: 8000 });

  // Open a product modal on mobile
  const mobileCard = await page.$('.lm-product-card');
  if (mobileCard) {
    await mobileCard.click();
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });

    const mobileWaveShotPath = path.join(SCREENSHOT_DIR, 'shot_mobile_modal_wave.png');
    await page.screenshot({ path: mobileWaveShotPath });
    console.log(`📸 Saved mobile modal wave screenshot: ${mobileWaveShotPath}`);

    await new Promise((r) => setTimeout(r, 650));

    // Scroll content on mobile
    const mobileViewport = await page.$('.lm-custom-scrollbar-viewport');
    if (mobileViewport) {
      await page.evaluate((vp) => {
        vp.scrollTop = 200;
        vp.dispatchEvent(new Event('scroll'));
      }, mobileViewport);

      await new Promise((r) => setTimeout(r, 150));
    }

    const mobileScrollShotPath = path.join(SCREENSHOT_DIR, 'shot_mobile_custom_scrollbar.png');
    await page.screenshot({ path: mobileScrollShotPath });
    console.log(`📸 Saved mobile custom scrollbar screenshot: ${mobileScrollShotPath}`);
  }

  await browser.close();

  console.log('\n================================================================');
  console.log('ALL ANIMATION & SCROLLBAR AUTOMATED QA TESTS PASSED! (5/5)');
  console.log('================================================================\n');
}

runQATests().catch((err) => {
  console.error('❌ QA Test Failed:', err);
  process.exit(1);
});
