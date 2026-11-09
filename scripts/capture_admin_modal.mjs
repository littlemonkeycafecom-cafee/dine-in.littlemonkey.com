import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_PIN = '9999';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // Go to QR scan required screen where Staff QR Administration button is
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // Click "Staff QR Administration" button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const adminBtn = btns.find(b => b.textContent && b.textContent.includes('Staff QR Administration'));
      if (adminBtn) adminBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Enter PIN 9999
    const pinInput = await page.$('input[placeholder*="PIN"], input[type="password"]');
    if (pinInput) {
      await pinInput.type(ADMIN_PIN);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const unlockBtn = btns.find(b => b.textContent && b.textContent.includes('VERIFY & ACCESS'));
        if (unlockBtn) unlockBtn.click();
      });
      await new Promise(r => setTimeout(r, 1500));
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'master_admin_10_tables_modal.png') });
    console.log('Saved: master_admin_10_tables_modal.png');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
