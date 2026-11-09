/**
 * verify_responsive_ui_repair.mjs
 * Rigorous automated verification of the responsive UI repair across 14 standard viewports.
 * Strictly adheres to zero emojis and scope rules.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const BASE_URL = 'http://127.0.0.1:3000';
const ARTIFACTS_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const OUTPUT_DIR = path.resolve(process.cwd(), 'test_artifacts', 'responsive_repair');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'mobile_320_se', width: 320, height: 568, type: 'mobile', expectedCols: 2 },
  { name: 'mobile_360_galaxy', width: 360, height: 800, type: 'mobile', expectedCols: 2 },
  { name: 'mobile_375_ip8', width: 375, height: 667, type: 'mobile', expectedCols: 2 },
  { name: 'mobile_390_ip14', width: 390, height: 844, type: 'mobile', expectedCols: 2 },
  { name: 'mobile_430_ip14promax', width: 430, height: 932, type: 'mobile', expectedCols: 2 },
  { name: 'tablet_600_portrait', width: 600, height: 960, type: 'tablet', expectedCols: 3 },
  { name: 'tablet_768_ipad', width: 768, height: 1024, type: 'tablet', expectedCols: 3 },
  { name: 'tablet_820_ipadair', width: 820, height: 1180, type: 'tablet', expectedCols: 3 },
  { name: 'desktop_1024_small', width: 1024, height: 768, type: 'desktop', expectedCols: 4 },
  { name: 'desktop_1280_mac13', width: 1280, height: 800, type: 'desktop', expectedCols: 4 },
  { name: 'desktop_1366_laptop', width: 1366, height: 768, type: 'desktop', expectedCols: 4 },
  { name: 'desktop_1440_macpro', width: 1440, height: 900, type: 'desktop', expectedCols: 4 },
  { name: 'desktop_1600_hdplus', width: 1600, height: 900, type: 'desktop', expectedCols: 4 },
  { name: 'desktop_1920_fhd', width: 1920, height: 1080, type: 'desktop', expectedCols: 4 },
];

async function run() {
  console.log('Starting Responsive UI Repair Verification Suite...');
  
  // 1. Fetch valid table access URL
  const devResp = await fetch(`${BASE_URL}/api/dev/tables`);
  const devData = await devResp.json();
  const table = devData.tables.find((t) => t.tableNumber === 'Table 01') || devData.tables[0];
  console.log(`Using credentials for ${table.tableNumber}...`);

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
  await page.goto(table.entryUrl, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // Bypass customer login modal if presented
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
      await new Promise((r) => setTimeout(r, 1000));
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  await page.waitForSelector('#main-menu-catalog', { timeout: 10000 });
  console.log('App loaded into menu catalog.');

  const results = [];
  let allPassed = true;

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 350));

    // Scroll to menu section
    await page.evaluate(() => {
      const el = document.querySelector('#main-menu-catalog');
      if (el) el.scrollIntoView({ behavior: 'instant' });
    });
    await new Promise((r) => setTimeout(r, 200));

    const metrics = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const menuSec = document.querySelector('#main-menu-catalog');
      const catGrid = document.querySelector('.menu-categories-32-grid');
      const prodGrid = document.querySelector('.lm-product-grid');
      const firstCatCard = document.querySelector('.menu-category-grid-card');
      const firstProdCard = document.querySelector('.lm-product-card');
      const searchBtn = document.querySelector('.lm-menu-search-btn');
      const firstCatBtn = document.querySelector('.lm-menu-cat-btn');

      const catStyle = catGrid ? window.getComputedStyle(catGrid) : null;
      const prodStyle = prodGrid ? window.getComputedStyle(prodGrid) : null;
      const catCols = catStyle ? catStyle.gridTemplateColumns.trim().split(/\s+/).length : 0;
      const prodCols = prodStyle ? prodStyle.gridTemplateColumns.trim().split(/\s+/).length : 0;

      const secRect = menuSec ? menuSec.getBoundingClientRect() : null;
      const catRect = firstCatCard ? firstCatCard.getBoundingClientRect() : null;
      const prodRect = firstProdCard ? firstProdCard.getBoundingClientRect() : null;
      const searchRect = searchBtn ? searchBtn.getBoundingClientRect() : null;
      const catBtnRect = firstCatBtn ? firstCatBtn.getBoundingClientRect() : null;

      const horizontalOverflow = html.scrollWidth - html.clientWidth;

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        htmlScrollWidth: html.scrollWidth,
        htmlClientWidth: html.clientWidth,
        horizontalOverflow: Math.max(0, horizontalOverflow),
        menuSectionWidth: secRect ? Math.round(secRect.width) : 0,
        catGridColumns: catCols,
        prodGridColumns: prodCols,
        firstCatCardWidth: catRect ? Math.round(catRect.width) : 0,
        firstProdCardWidth: prodRect ? Math.round(prodRect.width) : 0,
        searchBtnHeight: searchRect ? Math.round(searchRect.height) : 0,
        catBtnHeight: catBtnRect ? Math.round(catBtnRect.height) : 0,
      };
    });

    const isColsMatch = metrics.catGridColumns === vp.expectedCols && metrics.prodGridColumns === vp.expectedCols;
    const isSectionContained = metrics.menuSectionWidth <= vp.width;
    const isNoOverflow = metrics.horizontalOverflow <= 1; // 1px rounding tolerance
    const isButtonsSized = metrics.searchBtnHeight >= 32 && metrics.searchBtnHeight <= 42 &&
                           metrics.catBtnHeight >= 32 && metrics.catBtnHeight <= 42;

    const passed = isColsMatch && isSectionContained && isNoOverflow && isButtonsSized;
    if (!passed) allPassed = false;

    // Capture screenshot for key representative viewports
    const keyViewports = ['mobile_320_se', 'mobile_390_ip14', 'tablet_768_ipad', 'desktop_1440_macpro'];
    if (keyViewports.includes(vp.name)) {
      const shotName = `responsive_menu_${vp.name}.png`;
      const localShotPath = path.join(OUTPUT_DIR, shotName);
      const artifactShotPath = path.join(ARTIFACTS_DIR, shotName);
      await page.screenshot({ path: localShotPath, fullPage: false });
      fs.copyFileSync(localShotPath, artifactShotPath);
    }

    results.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      type: vp.type,
      expectedCols: vp.expectedCols,
      actualCatCols: metrics.catGridColumns,
      actualProdCols: metrics.prodGridColumns,
      sectionWidth: metrics.menuSectionWidth,
      catCardWidth: metrics.firstCatCardWidth,
      prodCardWidth: metrics.firstProdCardWidth,
      searchBtnHeight: metrics.searchBtnHeight,
      catBtnHeight: metrics.catBtnHeight,
      horizontalOverflow: metrics.horizontalOverflow,
      status: passed ? 'PASS' : 'FAIL',
    });

    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${vp.name} (${vp.width}x${vp.height}): CatCols=${metrics.catGridColumns}, ProdCols=${metrics.prodGridColumns}, SecWidth=${metrics.menuSectionWidth}px, Overflow=${metrics.horizontalOverflow}px`);
  }

  // 2. Test Product Details Modal responsiveness & interactions on Mobile (390px) and Desktop (1440px)
  console.log('\nTesting Product Details Modal across viewports...');
  for (const vp of [{ name: 'mobile_390', width: 390, height: 844 }, { name: 'desktop_1440', width: 1440, height: 900 }]) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 300));

    // Click first product card
    await page.evaluate(() => {
      const card = document.querySelector('.lm-product-card');
      if (card) (card).click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const modalMetrics = await page.evaluate(() => {
      const modal = document.querySelector('.lm-product-details-modal');
      const imgWrap = document.querySelector('.lm-detail-img-wrap');
      const closeBtn = document.querySelector('button[aria-label="Close product details"]');
      const title = document.querySelector('#modal-product-title');

      const modalRect = modal ? modal.getBoundingClientRect() : null;
      const imgRect = imgWrap ? imgWrap.getBoundingClientRect() : null;

      return {
        modalVisible: Boolean(modal),
        modalWidth: modalRect ? Math.round(modalRect.width) : 0,
        modalHeight: modalRect ? Math.round(modalRect.height) : 0,
        imgHeight: imgRect ? Math.round(imgRect.height) : 0,
        closeBtnPresent: Boolean(closeBtn),
        titlePresent: Boolean(title),
      };
    });

    const modalShotName = `responsive_modal_${vp.name}.png`;
    const localModalShot = path.join(OUTPUT_DIR, modalShotName);
    const artifactModalShot = path.join(ARTIFACTS_DIR, modalShotName);
    await page.screenshot({ path: localModalShot, fullPage: false });
    fs.copyFileSync(localModalShot, artifactModalShot);

    console.log(`Modal on ${vp.name}: Visible=${modalMetrics.modalVisible}, ModalWidth=${modalMetrics.modalWidth}px, ImgHeight=${modalMetrics.imgHeight}px, CloseBtn=${modalMetrics.closeBtnPresent}`);

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close product details"]');
      if (closeBtn) (closeBtn).click();
    });
    await new Promise((r) => setTimeout(r, 400));
  }

  await browser.close();

  // Save report
  const summary = {
    timestamp: new Date().toISOString(),
    allPassed,
    totalViewportsTested: VIEWPORTS.length,
    results,
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\nVerification completed. All passed: ${allPassed}`);
  return summary;
}

run().catch((err) => {
  console.error('Error during responsive verification:', err);
  process.exit(1);
});
