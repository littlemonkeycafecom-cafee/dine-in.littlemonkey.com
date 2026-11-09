import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_PIN = '9999';

async function rotateTable(tableNumber) {
  const res = await fetch(`${BASE_URL}/api/admin/qr/rotate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Operational-PIN': ADMIN_PIN,
    },
    body: JSON.stringify({ tableNumber }),
  });
  return res.json();
}

(async () => {
  console.log('--- Starting Master UI/UX Visual Verification ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // Rotate Table 04 to get fresh scannable URL
    const rot4 = await rotateTable('Table 04');
    const u4 = new URL(rot4.entryUrl);
    const validUrlT4 = `${BASE_URL}/?${u4.searchParams.toString()}`;

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    console.log('1. Navigating to verified QR URL for Table 04...');
    await page.goto(validUrlT4, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // Click Continue as Guest
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find(b => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) guestBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // Capture Active Menu Desktop
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'master_desktop_menu_t04.png') });
    console.log('Saved: master_desktop_menu_t04.png');

    // 2. Open Category Sheet Modal for Pizzas
    console.log('2. Opening Category Sheet for Pizzas...');
    await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div, button'));
      const pizzaTarget = allDivs.find(el => el.textContent && el.textContent.trim() === 'Pizzas');
      if (pizzaTarget) (pizzaTarget.closest('div[role="button"]') || pizzaTarget).click();
    });
    await new Promise(r => setTimeout(r, 800));

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'master_pizzas_category_sheet_desktop.png') });
    console.log('Saved: master_pizzas_category_sheet_desktop.png');

    // 3. Switch to Pizza Combos inside modal
    console.log('3. Switching to Pizza Combos inside modal...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const comboBtn = buttons.find(b => b.textContent && b.textContent.includes('Pizza Combos'));
      if (comboBtn) comboBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'master_pizza_combos_sheet_desktop.png') });
    console.log('Saved: master_pizza_combos_sheet_desktop.png');

    // 4. Close Modal via Close button
    console.log('4. Closing modal...');
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close Category Sheet"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // 5. Open Admin QR Management Modal to inspect all 10 tables
    console.log('5. Opening Admin QR Modal for 10 tables...');
    await page.evaluate(() => {
      const adminBtn = document.querySelector('button[aria-label="Open Admin QR Modal"]');
      if (adminBtn) adminBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Enter PIN 9999
    const pinInputs = await page.$$('input');
    if (pinInputs.length > 0) {
      await pinInputs[0].type(ADMIN_PIN);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const unlockBtn = btns.find(b => b.textContent && b.textContent.includes('Unlock'));
        if (unlockBtn) unlockBtn.click();
      });
      await new Promise(r => setTimeout(r, 1000));
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'master_admin_10_tables_modal.png') });
    console.log('Saved: master_admin_10_tables_modal.png');

    // 6. Mobile Viewport (390x844) Test
    console.log('6. Mobile Viewport Test (390x844)...');
    const rot1 = await rotateTable('Table 01');
    const u1 = new URL(rot1.entryUrl);
    const validUrlT1 = `${BASE_URL}/?${u1.searchParams.toString()}`;

    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mobilePage.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    await mobilePage.goto(validUrlT1, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    await mobilePage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find(b => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) guestBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'master_mobile_390_menu.png') });
    console.log('Saved: master_mobile_390_menu.png');

    // Open category modal on mobile
    await mobilePage.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div, button'));
      const pizzaTarget = allDivs.find(el => el.textContent && el.textContent.trim() === 'Pizzas');
      if (pizzaTarget) (pizzaTarget.closest('div[role="button"]') || pizzaTarget).click();
    });
    await new Promise(r => setTimeout(r, 800));

    await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'master_mobile_390_category_sheet.png') });
    console.log('Saved: master_mobile_390_category_sheet.png');

    // 7. Tablet Viewport (768x1024) Test
    console.log('7. Tablet Viewport Test (768x1024)...');
    await mobilePage.setViewport({ width: 768, height: 1024, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 400));
    await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'master_tablet_768_category_sheet.png') });
    console.log('Saved: master_tablet_768_category_sheet.png');

    console.log('\nAll Visual QA Screenshots successfully updated!');
  } catch (err) {
    console.error('Visual verification error:', err);
  } finally {
    await browser.close();
  }
})();
