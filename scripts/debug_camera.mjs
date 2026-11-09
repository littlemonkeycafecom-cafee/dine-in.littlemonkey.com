import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('lm_dinein_intro_seen', 'true');
  });
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://127.0.0.1:3000', ['camera']);
  await page.goto('http://127.0.0.1:3000');
  await new Promise(r => setTimeout(r, 500));
  const btn = await page.$('.lm-scanner-dock-btn');
  console.log('Button found:', !!btn);
  await btn.click();
  await new Promise(r => setTimeout(r, 1200));
  const state = await page.evaluate(() => {
    const video = document.querySelector('video');
    const srcObj = video ? video.srcObject : null;
    return {
      hasVideo: !!video,
      hasSrcObj: !!srcObj,
      tracks: srcObj ? srcObj.getTracks().map(t => ({ id: t.id, readyState: t.readyState, enabled: t.enabled })) : []
    };
  });
  console.log('Camera state after click:', JSON.stringify(state, null, 2));
  await browser.close();
})();
