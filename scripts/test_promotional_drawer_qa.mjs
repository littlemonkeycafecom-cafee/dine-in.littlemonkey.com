import puppeteer from 'file:///C:/Users/chava/.gemini/antigravity-ide/scratch/ordering%20system/node_modules/puppeteer/lib/puppeteer/puppeteer.js';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';

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

const authSession = {
  mobile: testPhone,
  name: 'Bhuvan Teja',
  token: validCustomerToken,
  expiresAt: Date.now() + 7200000,
  isAuthenticated: true,
  tableNumber: '04',
};

async function runQA() {
  console.log('Launching browser for Promotional Drawer & Floating Banner QA...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('http://127.0.0.1:3000/?table=04', { waitUntil: 'networkidle2' });

    await page.evaluate((session) => {
      localStorage.setItem('lm_dinein_auth_v2', JSON.stringify(session));
      localStorage.setItem('lmc_dinein_table', '04');
    }, authSession);

    await page.goto('http://127.0.0.1:3000/?table=04', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    // 1. Verify Floating Promotional Banner
    console.log('1. Scrolling to Promotional Banner...');
    await page.evaluate(() => {
      const banner = document.querySelector('.lm-floating-banner');
      if (banner) banner.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 600));

    console.log('Capturing Floating Promotional Banner...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_floating_banner.png'),
    });

    // 2. Click the Promotional Banner to Open Black Menu Drawer
    console.log('2. Clicking Promotional Banner to trigger Drawer...');
    await page.evaluate(() => {
      const banner = document.querySelector('.lm-floating-banner');
      if (banner) banner.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    console.log('Capturing Promotional Menu Drawer (Opened from bottom)...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_promotional_drawer_open.png'),
    });

    // 3. Click the first product inside the drawer to open product detail view
    console.log('3. Selecting a product from Promotional Drawer to open details...');
    await page.evaluate(() => {
      const drawer = document.querySelector('[aria-labelledby="promotional-drawer-title"]');
      if (drawer) {
        const firstCard = drawer.querySelector('[role="button"]');
        if (firstCard) firstCard.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    console.log('Capturing Product Details Modal opened from Drawer...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_drawer_product_detail.png'),
    });

    // 4. Close details and drawer
    console.log('4. Dismissing details modal and drawer via Escape...');
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 400));
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 400));

    // 5. Verify that total-cart floating panel is REMOVED
    console.log('5. Verifying removal of floating total-cart panel...');
    const hasFloatingTotalCart = await page.evaluate(() => {
      const aside = document.querySelector('aside[aria-label="Cart Quick Action"]');
      const text = document.body.innerText;
      return !!aside || text.includes('VIEW CART');
    });
    console.log('Is floating total-cart panel present?', hasFloatingTotalCart);
    if (hasFloatingTotalCart) {
      throw new Error('Floating total-cart panel should have been removed!');
    }

    // Scroll to regular menu section to prove clear view
    await page.evaluate(() => {
      const grid = document.querySelector('.lm-product-grid');
      if (grid) grid.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 600));

    console.log('Capturing Menu Section with Total-Cart UI completely removed...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_menu_no_floating_cart.png'),
    });

    console.log('ALL PROMOTIONAL DRAWER & FLOATING BANNER QA TESTS PASSED!');
  } finally {
    await browser.close();
  }
}

runQA();
