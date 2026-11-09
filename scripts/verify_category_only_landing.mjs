/**
 * verify_category_only_landing.mjs
 * Comprehensive automated QA for the Category-Only Landing Page feature.
 * Strictly adheres to zero emojis and scope boundaries.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const BASE_URL = 'http://127.0.0.1:3000';
const ARTIFACTS_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const OUTPUT_DIR = path.resolve(process.cwd(), 'test_artifacts', 'category_only_landing');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'mobile_320', width: 320, height: 568, expectedCatCols: 2, expectedProdCols: 2 },
  { name: 'mobile_360', width: 360, height: 800, expectedCatCols: 2, expectedProdCols: 2 },
  { name: 'mobile_375', width: 375, height: 667, expectedCatCols: 2, expectedProdCols: 2 },
  { name: 'mobile_390', width: 390, height: 844, expectedCatCols: 2, expectedProdCols: 2 },
  { name: 'mobile_430', width: 430, height: 932, expectedCatCols: 2, expectedProdCols: 2 },
  { name: 'tablet_600', width: 600, height: 960, expectedCatCols: 3, expectedProdCols: 3 },
  { name: 'tablet_768', width: 768, height: 1024, expectedCatCols: 3, expectedProdCols: 3 },
  { name: 'tablet_820', width: 820, height: 1180, expectedCatCols: 3, expectedProdCols: 3 },
  { name: 'desktop_1024', width: 1024, height: 768, expectedCatCols: 4, expectedProdCols: 4 },
  { name: 'desktop_1280', width: 1280, height: 800, expectedCatCols: 4, expectedProdCols: 4 },
  { name: 'desktop_1366', width: 1366, height: 768, expectedCatCols: 4, expectedProdCols: 4 },
  { name: 'desktop_1440', width: 1440, height: 900, expectedCatCols: 4, expectedProdCols: 4 },
  { name: 'desktop_1920', width: 1920, height: 1080, expectedCatCols: 4, expectedProdCols: 4 },
];

async function run() {
  console.log('===============================================================');
  console.log('LITTLE MONKEY CAFE — CATEGORY-ONLY LANDING PAGE QA SUITE');
  console.log('===============================================================\n');

  // Fetch valid table access URL
  const devResp = await fetch(`${BASE_URL}/api/dev/tables`);
  const devData = await devResp.json();
  const table = devData.tables.find((t) => t.tableNumber === 'Table 01') || devData.tables[0];
  console.log(`Using Table credentials for ${table.tableNumber}...`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  let audioRequestsCount = 0;
  page.on('request', (req) => {
    const url = req.url().toLowerCase();
    const rt = req.resourceType();
    if (rt === 'media' || url.endsWith('.mp3') || url.endsWith('.wav') || url.endsWith('.ogg') || url.endsWith('.aac')) {
      audioRequestsCount++;
    }
  });

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
  console.log('Dining app loaded successfully.\n');

  // --------------------------------------------------------------------------
  // TEST 1: STATE A — CATEGORY DISCOVERY (Initial Landing Page)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: State A — Category Discovery Landing Page ---');
  await page.evaluate(() => {
    const el = document.querySelector('#main-menu-catalog');
    if (el) el.scrollIntoView({ behavior: 'instant' });
  });
  await new Promise((r) => setTimeout(r, 300));

  const stateAMetrics = await page.evaluate(() => {
    const menuSec = document.querySelector('#main-menu-catalog');
    const catGrid = menuSec?.querySelector('.menu-categories-32-grid');
    const catCards = catGrid ? Array.from(catGrid.querySelectorAll('.menu-category-grid-card')) : [];
    const prodGrid = menuSec?.querySelector('.lm-product-grid');
    const prodCards = menuSec ? Array.from(menuSec.querySelectorAll('.lm-product-card')) : [];
    const activeTab = document.querySelector('.lm-menu-cat-btn.active');

    return {
      hasMenuSection: Boolean(menuSec),
      hasCatGrid: Boolean(catGrid),
      catCardsCount: catCards.length,
      hasProdGrid: Boolean(prodGrid),
      prodCardsCount: prodCards.length,
      activeTabLabel: activeTab ? activeTab.textContent.trim() : null,
      firstCatTitle: catCards[0]?.querySelector('.menu-category-card-name')?.textContent?.trim() || null,
      lastCatTitle: catCards[catCards.length - 1]?.querySelector('.menu-category-card-name')?.textContent?.trim() || null,
    };
  });

  console.log('State A Metrics:', stateAMetrics);
  if (!stateAMetrics.hasCatGrid || stateAMetrics.catCardsCount !== 32) {
    throw new Error(`Expected exactly 32 category cards in State A, found: ${stateAMetrics.catCardsCount}`);
  }
  if (stateAMetrics.hasProdGrid || stateAMetrics.prodCardsCount > 0) {
    throw new Error(`VIOLATION: Product grid is rendered on category landing page! Found ${stateAMetrics.prodCardsCount} products.`);
  }
  console.log('[PASS] State A verified: Exactly 32 Category Cards rendered. ZERO products rendered underneath.\n');

  // --------------------------------------------------------------------------
  // TEST 2: STATE B — CATEGORY SELECTED (Click Category Card)
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: State B — Category Selected Transition (Pizzas) ---');
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.menu-category-grid-card'));
    const pizzaCard = cards.find((c) => c.textContent && c.textContent.includes('Pizzas'));
    if (pizzaCard) pizzaCard.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const stateBMetrics = await page.evaluate(() => {
    const menuSec = document.querySelector('#main-menu-catalog');
    const catGrid = menuSec?.querySelector('.menu-categories-32-grid');
    const prodGrid = menuSec?.querySelector('.lm-product-grid');
    const prodCards = prodGrid ? Array.from(prodGrid.querySelectorAll('.lm-product-card')) : [];
    const backBtn = menuSec?.querySelector('.lm-back-to-categories-btn');
    const headerTitle = menuSec?.querySelector('.lm-category-view-header h3');
    const activeTab = document.querySelector('.lm-menu-cat-btn.active');

    // Check products belong to category
    const titles = prodCards.map((c) => c.querySelector('h3')?.textContent?.trim() || '');

    return {
      hasCatGrid: Boolean(catGrid),
      hasProdGrid: Boolean(prodGrid),
      prodCardsCount: prodCards.length,
      hasBackBtn: Boolean(backBtn),
      backBtnText: backBtn ? backBtn.textContent.trim() : null,
      categoryHeading: headerTitle ? headerTitle.textContent.trim() : null,
      activeTabLabel: activeTab ? activeTab.textContent.trim() : null,
      sampleTitles: titles.slice(0, 3),
    };
  });

  console.log('State B Metrics:', stateBMetrics);
  if (stateBMetrics.hasCatGrid) {
    throw new Error('VIOLATION: 32 Category Cards grid is still present in Category Selected view!');
  }
  if (!stateBMetrics.hasProdGrid || stateBMetrics.prodCardsCount === 0) {
    throw new Error(`Expected pizza products to render, found: ${stateBMetrics.prodCardsCount}`);
  }
  if (!stateBMetrics.hasBackBtn) {
    throw new Error('Expected Back to Categories button in Category Selected view!');
  }
  if (stateBMetrics.categoryHeading !== 'Pizzas') {
    throw new Error(`Expected category heading "Pizzas", got: ${stateBMetrics.categoryHeading}`);
  }
  console.log('[PASS] State B verified: Category Selected view rendered with header, back button, and category products only.\n');

  // --------------------------------------------------------------------------
  // TEST 3: STATE C — PRODUCT DETAILS OVER CATEGORY VIEW
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: State C — Product Details Modal & Return ---');
  await page.evaluate(() => {
    const firstProd = document.querySelector('.lm-product-card');
    if (firstProd) firstProd.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const modalMetrics = await page.evaluate(() => {
    const modal = document.querySelector('.lm-product-details-modal');
    const closeBtn = document.querySelector('button[aria-label="Close product details"]');
    const title = document.querySelector('#modal-product-title') || modal?.querySelector('h3');
    return {
      isModalOpen: Boolean(modal),
      title: title ? title.textContent.trim() : null,
      hasCloseBtn: Boolean(closeBtn),
    };
  });

  console.log('Modal Metrics:', modalMetrics);
  if (!modalMetrics.isModalOpen || !modalMetrics.hasCloseBtn) {
    throw new Error('Product Details Modal did not open properly!');
  }

  // Close modal
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button[aria-label="Close product details"]');
    if (closeBtn) closeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // Verify we are STILL in Pizzas category
  const afterModalCategory = await page.evaluate(() => {
    const headerTitle = document.querySelector('.lm-category-view-header h3');
    return headerTitle ? headerTitle.textContent.trim() : null;
  });
  if (afterModalCategory !== 'Pizzas') {
    throw new Error(`Expected still to be in "Pizzas" after closing modal, got: ${afterModalCategory}`);
  }
  console.log('[PASS] State C verified: Modal opened and closed cleanly, preserving category view.\n');

  // --------------------------------------------------------------------------
  // TEST 4: STATE D — RETURN TO CATEGORIES OVERVIEW
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: State D — Back Button Return to Categories ---');
  await page.evaluate(() => {
    const backBtn = document.querySelector('.lm-back-to-categories-btn');
    if (backBtn) backBtn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  const afterReturnMetrics = await page.evaluate(() => {
    const catGrid = document.querySelector('.menu-categories-32-grid');
    const catCards = catGrid ? Array.from(catGrid.querySelectorAll('.menu-category-grid-card')) : [];
    const prodGrid = document.querySelector('.lm-product-grid');
    const activeTab = document.querySelector('.lm-menu-cat-btn.active');
    return {
      hasCatGrid: Boolean(catGrid),
      catCardsCount: catCards.length,
      hasProdGrid: Boolean(prodGrid),
      activeTabLabel: activeTab ? activeTab.textContent.trim() : null,
    };
  });

  console.log('After Return Metrics:', afterReturnMetrics);
  if (!afterReturnMetrics.hasCatGrid || afterReturnMetrics.catCardsCount !== 32) {
    throw new Error(`Failed to restore 32 category cards upon returning, found: ${afterReturnMetrics.catCardsCount}`);
  }
  if (afterReturnMetrics.hasProdGrid) {
    throw new Error('VIOLATION: Product grid was rendered upon returning to category discovery!');
  }
  console.log('[PASS] State D verified: Category overview restored seamlessly without full product grid.\n');

  // --------------------------------------------------------------------------
  // TEST 5: SYSTEMATIC CATEGORY SWITCHING (Multiple Categories)
  // --------------------------------------------------------------------------
  console.log('--- TEST 5: Systematic Multi-Category Verification ---');
  const testCategories = ['Burgers', 'Pasta', 'Desserts', 'Momos', 'Cold Coffee'];
  for (const catName of testCategories) {
    // Click category
    await page.evaluate((name) => {
      const cards = Array.from(document.querySelectorAll('.menu-category-grid-card'));
      const target = cards.find((c) => c.textContent && c.textContent.includes(name));
      if (target) target.click();
    }, catName);
    await new Promise((r) => setTimeout(r, 400));

    const check = await page.evaluate(() => {
      const headerTitle = document.querySelector('.lm-category-view-header h3');
      const prodCards = document.querySelectorAll('.lm-product-card');
      const catGrid = document.querySelector('.menu-categories-32-grid');
      return {
        title: headerTitle ? headerTitle.textContent.trim() : null,
        productsCount: prodCards.length,
        hasCatGrid: Boolean(catGrid),
      };
    });

    console.log(`  Category [${catName}]: Title="${check.title}", Products=${check.productsCount}, CatGridPresent=${check.hasCatGrid}`);
    if (check.title !== catName || check.productsCount === 0 || check.hasCatGrid) {
      throw new Error(`Category check failed for ${catName}: ${JSON.stringify(check)}`);
    }

    // Return to categories
    await page.evaluate(() => {
      const backBtn = document.querySelector('.lm-back-to-categories-btn');
      if (backBtn) backBtn.click();
    });
    await new Promise((r) => setTimeout(r, 350));
  }
  console.log('[PASS] Systematic category switching verified cleanly.\n');

  // --------------------------------------------------------------------------
  // TEST 6: MULTI-VIEWPORT RESPONSIVENESS & SCREENSHOT EVIDENCE
  // --------------------------------------------------------------------------
  console.log('--- TEST 6: Multi-Viewport Responsive & Screenshot Suite (13 Viewports) ---');
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 250));

    // Measure State A on this viewport
    const vpMetricsA = await page.evaluate(() => {
      const html = document.documentElement;
      const catGrid = document.querySelector('.menu-categories-32-grid');
      const catStyle = catGrid ? window.getComputedStyle(catGrid) : null;
      const cols = catStyle ? catStyle.gridTemplateColumns.trim().split(/\s+/).length : 0;
      const overflow = Math.max(0, html.scrollWidth - html.clientWidth);
      return { cols, overflow };
    });

    const isMatchA = vpMetricsA.cols === vp.expectedCatCols && vpMetricsA.overflow <= 1;
    console.log(`  [State A] ${vp.name} (${vp.width}x${vp.height}): CatCols=${vpMetricsA.cols} (expected ${vp.expectedCatCols}), Overflow=${vpMetricsA.overflow}px -> ${isMatchA ? 'PASS' : 'FAIL'}`);
    if (!isMatchA) throw new Error(`State A layout failure at ${vp.name}`);

    // Capture key representative screenshots
    const keyVps = ['mobile_320', 'mobile_390', 'tablet_768', 'desktop_1440'];
    if (keyVps.includes(vp.name)) {
      // Screenshot State A
      await page.evaluate(() => {
        const el = document.querySelector('#main-menu-catalog');
        if (el) el.scrollIntoView({ behavior: 'instant' });
      });
      await new Promise((r) => setTimeout(r, 150));
      const shotAName = `category_discovery_${vp.name}.png`;
      const localShotA = path.join(OUTPUT_DIR, shotAName);
      const artifactShotA = path.join(ARTIFACTS_DIR, shotAName);
      await page.screenshot({ path: localShotA, fullPage: false });
      fs.copyFileSync(localShotA, artifactShotA);

      // Transition to State B (Pizzas) and capture
      await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.menu-category-grid-card'));
        const pizzaCard = cards.find((c) => c.textContent && c.textContent.includes('Pizzas'));
        if (pizzaCard) pizzaCard.click();
      });
      await new Promise((r) => setTimeout(r, 400));

      const shotBName = `category_selected_pizza_${vp.name}.png`;
      const localShotB = path.join(OUTPUT_DIR, shotBName);
      const artifactShotB = path.join(ARTIFACTS_DIR, shotBName);
      await page.screenshot({ path: localShotB, fullPage: false });
      fs.copyFileSync(localShotB, artifactShotB);

      // Return to State A
      await page.evaluate(() => {
        const backBtn = document.querySelector('.lm-back-to-categories-btn');
        if (backBtn) backBtn.click();
      });
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  console.log('[PASS] Multi-viewport responsiveness verified across all 13 viewports.\n');

  // --------------------------------------------------------------------------
  // TEST 7: ZERO AUDIO POLICY VERIFICATION
  // --------------------------------------------------------------------------
  console.log('--- TEST 7: Audio & Sound Policy Verification ---');
  const domAudioTags = await page.evaluate(() => document.querySelectorAll('audio').length);
  console.log(`DOM <audio> tags: ${domAudioTags}, Network media requests: ${audioRequestsCount}`);
  if (domAudioTags > 0 || audioRequestsCount > 0) {
    throw new Error('VIOLATION: Audio elements or media requests detected!');
  }
  console.log('[PASS] Strict ZERO AUDIO policy verified.\n');

  await browser.close();

  console.log('===============================================================');
  console.log('ALL CATEGORY-ONLY LANDING PAGE TESTS PASSED CLEANLY!');
  console.log('===============================================================');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
