/**
 * inspect_current_responsive_ui.mjs
 * Captures screenshots and computes layout metrics across viewports to identify actual responsive UI defects.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const BASE_URL = 'http://127.0.0.1:3000';
const ARTIFACTS_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const INSPECT_DIR = path.resolve(process.cwd(), 'test_artifacts', 'inspection');

if (!fs.existsSync(INSPECT_DIR)) {
  fs.mkdirSync(INSPECT_DIR, { recursive: true });
}

async function run() {
  console.log('Fetching table credentials...');
  const devResp = await fetch(`${BASE_URL}/api/dev/tables`);
  const devData = await devResp.json();
  const t02 = devData.tables.find((t) => t.tableNumber === 'Table 02');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    localStorage.setItem('lm_dinein_intro_seen', 'true');
  });

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(t02.entryUrl, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // Sign in as Guest if CustomerLoginGate is shown
  for (let attempt = 0; attempt < 5; attempt++) {
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find((b) => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) {
        guestBtn.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      await new Promise((r) => setTimeout(r, 1200));
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  await page.waitForSelector('#main-menu-catalog', { timeout: 10000 });
  console.log('App loaded into menu view.');

  const viewports = [
    { name: 'mobile_320', width: 320, height: 640 },
    { name: 'mobile_360', width: 360, height: 740 },
    { name: 'mobile_390', width: 390, height: 844 },
    { name: 'tablet_600', width: 600, height: 960 },
    { name: 'tablet_768', width: 768, height: 1024 },
    { name: 'tablet_1024', width: 1024, height: 768 },
    { name: 'desktop_1440', width: 1440, height: 900 },
  ];

  const inspectionReport = {};

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 300));

    // Capture overall page screenshot
    const shotPath = path.join(INSPECT_DIR, `${vp.name}_full.png`);
    await page.screenshot({ path: shotPath, fullPage: false });

    // Scroll to menu catalog
    await page.evaluate(() => {
      const el = document.querySelector('#main-menu-catalog');
      if (el) el.scrollIntoView({ behavior: 'instant' });
    });
    await new Promise((r) => setTimeout(r, 200));

    const menuShotPath = path.join(INSPECT_DIR, `${vp.name}_menu.png`);
    await page.screenshot({ path: menuShotPath, fullPage: false });

    // Inspect layout metrics
    const metrics = await page.evaluate(() => {
      // 1. Header metrics
      const header = document.querySelector('header');
      const headerRect = header ? header.getBoundingClientRect() : null;

      // 2. Category Nav metrics
      const searchBtn = document.querySelector('#main-menu-catalog button[aria-label*="search" i]');
      const searchRect = searchBtn ? searchBtn.getBoundingClientRect() : null;
      const tabTrack = document.querySelector('#main-menu-catalog [role="tablist"]');
      const tabTrackRect = tabTrack ? tabTrack.getBoundingClientRect() : null;
      const firstTab = tabTrack ? tabTrack.querySelector('button') : null;
      const firstTabRect = firstTab ? firstTab.getBoundingClientRect() : null;

      // 3. Category Cards metrics
      const catGrid = document.querySelector('.menu-categories-32-grid');
      const catGridStyle = catGrid ? window.getComputedStyle(catGrid) : null;
      const catCards = Array.from(document.querySelectorAll('.menu-category-grid-card'));
      const catCardsMetrics = catCards.slice(0, 4).map((c) => {
        const r = c.getBoundingClientRect();
        const img = c.querySelector('img');
        const imgR = img ? img.getBoundingClientRect() : null;
        const name = c.querySelector('.menu-category-card-name');
        const nameStyle = name ? window.getComputedStyle(name) : null;
        return {
          cardWidth: r.width,
          cardHeight: r.height,
          imgWidth: imgR ? imgR.width : 0,
          imgHeight: imgR ? imgR.height : 0,
          title: name ? name.textContent : '',
          fontSize: nameStyle ? nameStyle.fontSize : '',
          lineHeight: nameStyle ? nameStyle.lineHeight : '',
        };
      });

      // 4. Product Cards metrics
      const prodGrid = document.querySelector('.lm-product-grid');
      const prodGridStyle = prodGrid ? window.getComputedStyle(prodGrid) : null;
      const prodCards = Array.from(document.querySelectorAll('.lm-product-card'));
      const prodCardsMetrics = prodCards.slice(0, 4).map((c) => {
        const r = c.getBoundingClientRect();
        const img = c.querySelector('img');
        const imgR = img ? img.getBoundingClientRect() : null;
        const title = c.querySelector('h3, h4');
        return {
          cardWidth: r.width,
          cardHeight: r.height,
          imgWidth: imgR ? imgR.width : 0,
          imgHeight: imgR ? imgR.height : 0,
          title: title ? title.textContent : '',
        };
      });

      // 5. Floating Navigation metrics
      const floatingNav = document.querySelector('.floating-nav, [class*="floating-nav"]');
      const floatingNavRect = floatingNav ? floatingNav.getBoundingClientRect() : null;

      return {
        viewportWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        headerHeight: headerRect ? headerRect.height : 0,
        searchBtn: searchRect ? { width: searchRect.width, height: searchRect.height } : null,
        tabTrack: tabTrackRect ? { width: tabTrackRect.width, height: tabTrackRect.height } : null,
        catGridColumns: catGridStyle ? catGridStyle.gridTemplateColumns : null,
        catGridGap: catGridStyle ? catGridStyle.gap : null,
        catCardsCount: catCards.length,
        catCardsSample: catCardsMetrics,
        prodGridColumns: prodGridStyle ? prodGridStyle.gridTemplateColumns : null,
        prodGridGap: prodGridStyle ? prodGridStyle.gap : null,
        prodCardsCount: prodCards.length,
        prodCardsSample: prodCardsMetrics,
        floatingNav: floatingNavRect ? { width: floatingNavRect.width, height: floatingNavRect.height, bottom: floatingNavRect.bottom } : null,
      };
    });

    inspectionReport[vp.name] = metrics;
    console.log(`Inspected ${vp.name}: viewport ${vp.width}px -> CatGrid: ${metrics.catGridColumns}, ProdGrid: ${metrics.prodGridColumns}`);
  }

  // Inspect Modal on 390px
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => {
    const card = document.querySelector('.lm-product-card');
    if (card) card.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const modalMetrics = await page.evaluate(() => {
    const modal = document.querySelector('.lm-product-details-modal');
    if (!modal) return null;
    const r = modal.getBoundingClientRect();
    const imgWrap = modal.querySelector('.lm-detail-img-wrap, [class*="detail-img"]');
    const imgR = imgWrap ? imgWrap.getBoundingClientRect() : null;
    return {
      modalWidth: r.width,
      modalHeight: r.height,
      imgHeight: imgR ? imgR.height : null,
      windowHeight: window.innerHeight,
    };
  });

  const modalShotPath = path.join(INSPECT_DIR, 'modal_mobile_390.png');
  await page.screenshot({ path: modalShotPath, fullPage: false });
  inspectionReport['modal_390'] = modalMetrics;

  await browser.close();

  fs.writeFileSync(
    path.join(INSPECT_DIR, 'inspection_report.json'),
    JSON.stringify(inspectionReport, null, 2)
  );

  console.log('\nInspection complete. Report saved to test_artifacts/inspection/inspection_report.json');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
