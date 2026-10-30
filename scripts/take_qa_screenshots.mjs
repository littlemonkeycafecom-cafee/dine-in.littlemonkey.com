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

async function capture() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // 1. Desktop View (1280x800)
    console.log('Setting viewport: Desktop 1280x800');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('http://127.0.0.1:3000/?table=04', { waitUntil: 'networkidle2' });

    // Set localStorage auth session
    await page.evaluate((session) => {
      localStorage.setItem('lm_dinein_auth_v2', JSON.stringify(session));
      localStorage.setItem('lmc_dinein_table', '04');
    }, authSession);

    // Reload with authenticated session
    await page.goto('http://127.0.0.1:3000/?table=04', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    console.log('Capturing Desktop Menu Overview...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_menu_desktop.png'),
      fullPage: false,
    });

    // 2. Scroll to Main Menu & Capture 32 Category Navigation
    console.log('Scrolling to main menu catalog...');
    await page.evaluate(() => {
      const el = document.getElementById('main-menu-catalog');
      if (el) el.scrollIntoView();
    });
    await new Promise((r) => setTimeout(r, 600));

    console.log('Capturing Category Navigation & Product Grid on Desktop...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_category_navigation.png'),
      fullPage: false,
    });

    // 3. Tablet View (768x1024)
    console.log('Setting viewport: Tablet 768x1024');
    await page.setViewport({ width: 768, height: 1024 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 600));

    console.log('Capturing Tablet Overview...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_menu_tablet.png'),
      fullPage: false,
    });

    // 4. Mobile View (390x844 - iPhone 14 / modern Android)
    console.log('Setting viewport: Mobile 390x844');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.evaluate(() => {
      const el = document.getElementById('main-menu-catalog');
      if (el) el.scrollIntoView();
    });
    await new Promise((r) => setTimeout(r, 600));

    console.log('Capturing Mobile 2-Column Compact Product Grid...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_menu_mobile_compact.png'),
      fullPage: false,
    });

    // 5. Open Bottom-Sliding Product Details Sheet
    console.log('Clicking on first product card to trigger bottom-sliding sheet...');
    await page.evaluate(() => {
      const card = document.querySelector('.lm-product-card');
      if (card) card.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    console.log('Capturing Bottom-Sliding Product Details Modal...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_bottom_sliding_sheet_mobile.png'),
      fullPage: false,
    });

    // 6. Close modal and scroll to Promotional Cold Brew Collection
    console.log('Dismissing modal...');
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 500));

    console.log('Scrolling to Promotional Cold Brew Collection...');
    await page.evaluate(() => {
      const banner = document.querySelector('[aria-label="Promotional Craft Cold Brew Collection"]');
      if (banner) banner.scrollIntoView();
      else window.scrollTo(0, 450);
    });
    await new Promise((r) => setTimeout(r, 600));

    console.log('Capturing Promotional Cold Brew Showcase...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_cold_brew_collection_new.png'),
      fullPage: false,
    });

    console.log('ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

capture();
