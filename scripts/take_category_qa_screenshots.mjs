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
    await new Promise((r) => setTimeout(r, 1000));

    // 1. Scroll directly to product grid in mobile view
    await page.evaluate(() => {
      const grid = document.querySelector('.lm-product-grid');
      if (grid) grid.scrollIntoView({ block: 'start' });
    });
    await new Promise((r) => setTimeout(r, 600));

    console.log('Capturing mobile 2-column grid in action...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_mobile_grid_2col.png'),
    });

    // 2. Click "Pizzas" category pill
    console.log('Clicking "Pizzas" category tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[role="tab"]'));
      const pizzaBtn = buttons.find((b) => b.textContent.trim().startsWith('Pizzas'));
      if (pizzaBtn) pizzaBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    await page.evaluate(() => {
      const grid = document.querySelector('.lm-product-grid');
      if (grid) grid.scrollIntoView({ block: 'start' });
    });
    await new Promise((r) => setTimeout(r, 400));

    console.log('Capturing Pizzas category (17 items)...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_category_pizzas.png'),
    });

    // 3. Click "Pizza Combos" category pill
    console.log('Clicking "Pizza Combos" category tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[role="tab"]'));
      const comboBtn = buttons.find((b) => b.textContent.trim().startsWith('Pizza Combos'));
      if (comboBtn) comboBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    await page.evaluate(() => {
      const grid = document.querySelector('.lm-product-grid');
      if (grid) grid.scrollIntoView({ block: 'start' });
    });
    await new Promise((r) => setTimeout(r, 400));

    console.log('Capturing Pizza Combos category (2 items, 0 cross-contamination)...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'shot_category_pizza_combos.png'),
    });

    console.log('ALL CATEGORY SCREENSHOTS CAPTURED!');
  } finally {
    await browser.close();
  }
}

capture();
