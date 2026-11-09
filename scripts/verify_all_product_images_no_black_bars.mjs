import { strict as assert } from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteerPath = 'C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer';
const puppeteer = require(puppeteerPath);

const BASE_URL = 'http://127.0.0.1:3000';
const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'verification_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'mobile_320', width: 320, height: 568 },
  { name: 'mobile_375', width: 375, height: 667 },
  { name: 'mobile_430', width: 430, height: 932 },
  { name: 'tablet_768', width: 768, height: 1024 },
  { name: 'tablet_1024', width: 1024, height: 768 },
  { name: 'desktop_1280', width: 1280, height: 800 },
  { name: 'desktop_1440', width: 1440, height: 900 },
  { name: 'desktop_1920', width: 1920, height: 1080 },
];

async function run() {
  console.log('========================================================================');
  console.log('LITTLE MONKEY CAFÉ — COMPREHENSIVE PRODUCT IMAGE PRESENTATION VERIFICATION');
  console.log('Zero Black Bars | Edge-to-Edge Framing | Dual-Layer Ambient Backdrop');
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    const browserErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        browserErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      browserErrors.push(err.message);
    });

    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    console.log('Navigating to http://127.0.0.1:3000/?token=dev_preview_token...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:3000/?token=dev_preview_token', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Dismiss guest gate if present
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
        await new Promise((r) => setTimeout(r, 400));
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    // --------------------------------------------------------------------------
    // TEST 1: MUST TRY RAIL (FEATURED SECTION) DUAL-LAYER & ZERO BLACK BARS
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 1: Featured Section Master Items (Tiger Bomb & Mont Blanc) ---');
    const featuredResults = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.lm-featured-master-card'));
      return cards.map((card) => {
        const titleEl = card.querySelector('h3, h4, span, div');
        const container = card.querySelector('.lm-featured-img-container');
        const img = card.querySelector('.lm-featured-img');
        const backdrop = card.querySelector('.lm-img-ambient-backdrop');
        const cRect = container ? container.getBoundingClientRect() : null;
        const iRect = img ? img.getBoundingClientRect() : null;
        const style = img ? window.getComputedStyle(img) : null;
        return {
          title: card.innerText.split('\n')[0],
          hasContainer: Boolean(container),
          hasImg: Boolean(img),
          hasBackdrop: Boolean(backdrop),
          imgSrc: img ? img.src : null,
          naturalWidth: img ? img.naturalWidth : 0,
          naturalHeight: img ? img.naturalHeight : 0,
          objectFit: style ? style.objectFit : null,
          objectPosition: style ? style.objectPosition : null,
          containerWidth: cRect ? cRect.width : 0,
          containerHeight: cRect ? cRect.height : 0,
          imgWidth: iRect ? iRect.width : 0,
          imgHeight: iRect ? iRect.height : 0,
        };
      });
    });

    console.log('Featured items found:', featuredResults.length);
    assert.strictEqual(featuredResults.length, 2, 'Exactly 2 master items must be displayed');
    featuredResults.forEach((item, idx) => {
      console.log(`  Master ${idx + 1}: ${item.title}`);
      console.log(`    objectFit: ${item.objectFit}, objectPosition: ${item.objectPosition}`);
      console.log(`    hasBackdrop: ${item.hasBackdrop}, natural: ${item.naturalWidth}x${item.naturalHeight}`);
      console.log(`    container: ${item.containerWidth}x${item.containerHeight}, img: ${item.imgWidth}x${item.imgHeight}`);
      assert.ok(item.naturalWidth > 0 && item.naturalHeight > 0, 'Image must load with valid natural dimensions');
    });

    const tigerBomb = featuredResults.find((f) => f.imgSrc && f.imgSrc.includes('tiger-bomb'));
    if (tigerBomb) {
      assert.strictEqual(tigerBomb.hasBackdrop, true, 'Tiger Bomb must have ambient backdrop layer');
      assert.strictEqual(tigerBomb.objectFit, 'contain', 'Tiger Bomb must preserve cutout bottle proportions');
    }

    // --------------------------------------------------------------------------
    // TEST 2: THIN CRUST PIZZA CATEGORY & PRODUCT DETAILS MODAL (SPICY MEXICAN PIZZA)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 2: Thin Crust Pizza Category & Details Modal ---');

    // Click on Pizzas category
    const pizzaClicked = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.menu-category-grid-card, .menu-category-card'));
      const pizzaCard = cards.find((c) => c.innerText.toLowerCase().includes('pizza'));
      if (pizzaCard) {
        pizzaCard.scrollIntoView({ block: 'center' });
        pizzaCard.click();
        return true;
      }
      return false;
    });
    assert.ok(pizzaClicked, 'Should find and click Pizzas category card');
    await new Promise((r) => setTimeout(r, 700));

    // Verify Category View is active
    const viewInfo = await page.evaluate(() => {
      const backBtn = document.querySelector('.lm-back-to-categories-btn');
      const cards = Array.from(document.querySelectorAll('.lm-product-card'));
      return {
        hasBackBtn: Boolean(backBtn),
        cardCount: cards.length,
        firstFew: cards.slice(0, 3).map((c) => {
          const img = c.querySelector('.lm-product-card-img');
          const style = img ? window.getComputedStyle(img) : null;
          return {
            title: c.innerText.split('\n')[0],
            src: img ? img.src : null,
            objectFit: style ? style.objectFit : null,
            objectPosition: style ? style.objectPosition : null,
          };
        }),
      };
    });

    console.log(`  Category view active: ${viewInfo.hasBackBtn}, product cards in view: ${viewInfo.cardCount}`);
    assert.ok(viewInfo.hasBackBtn, 'Category view back button must exist');
    assert.ok(viewInfo.cardCount > 0, 'Must have product cards rendered');
    viewInfo.firstFew.forEach((c) => {
      console.log(`    Card: ${c.title} -> objectFit: ${c.objectFit}, objectPosition: ${c.objectPosition}`);
      assert.strictEqual(c.objectFit, 'cover', 'Pizza card images must use object-fit: cover');
      assert.strictEqual(c.objectPosition, '50% 22%', 'Pizza card images must use center 22% focal position');
    });

    // Capture category view at desktop 1440
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_category_pizza_cards_desktop_1440.png'),
    });
    console.log('  Saved: 01_category_pizza_cards_desktop_1440.png');

    // Find and click Spicy Mexican Pizza (or Farmhouse Pizza) card to open details modal
    console.log('  Opening ProductDetailsModal for Spicy Mexican Pizza / Farmhouse Pizza...');
    const pizzaItemClicked = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.lm-product-card'));
      const target = cards.find(
        (c) =>
          c.innerText.toLowerCase().includes('spicy mexican') ||
          c.innerText.toLowerCase().includes('farmhouse') ||
          c.innerText.toLowerCase().includes('margherita')
      );
      if (target) {
        target.scrollIntoView({ block: 'center' });
        target.click();
        return target.innerText.split('\n')[0];
      }
      return null;
    });

    console.log(`  Clicked item: ${pizzaItemClicked}`);
    assert.ok(pizzaItemClicked, 'Must find and click a pizza item card');
    await new Promise((r) => setTimeout(r, 600));

    // Measure ProductDetailsModal image
    const modalImageAudit = await page.evaluate(() => {
      const modal = document.querySelector('.lm-product-details-modal');
      const wrap = document.querySelector('.lm-detail-img-wrap');
      const img = document.querySelector('.lm-detail-img');
      const backdrop = document.querySelector('.lm-detail-img-wrap .lm-img-ambient-backdrop');
      const wRect = wrap ? wrap.getBoundingClientRect() : null;
      const iRect = img ? img.getBoundingClientRect() : null;
      const style = img ? window.getComputedStyle(img) : null;

      return {
        modalOpen: Boolean(modal),
        wrapExists: Boolean(wrap),
        imgExists: Boolean(img),
        hasBackdrop: Boolean(backdrop),
        src: img ? img.src : null,
        naturalWidth: img ? img.naturalWidth : 0,
        naturalHeight: img ? img.naturalHeight : 0,
        objectFit: style ? style.objectFit : null,
        objectPosition: style ? style.objectPosition : null,
        wrapWidth: wRect ? Math.round(wRect.width) : 0,
        wrapHeight: wRect ? Math.round(wRect.height) : 0,
        imgWidth: iRect ? Math.round(iRect.width) : 0,
        imgHeight: iRect ? Math.round(iRect.height) : 0,
        // Zero black bars means imgWidth exactly equals wrapWidth
        zeroHorizontalBlackBars: iRect && wRect ? Math.abs(iRect.width - wRect.width) <= 1 : false,
        zeroVerticalBlackBars: iRect && wRect ? Math.abs(iRect.height - wRect.height) <= 1 : false,
      };
    });

    console.log('  ProductDetailsModal Audit:');
    console.log(`    modalOpen: ${modalImageAudit.modalOpen}`);
    console.log(`    natural: ${modalImageAudit.naturalWidth}x${modalImageAudit.naturalHeight}`);
    console.log(`    objectFit: ${modalImageAudit.objectFit}, objectPosition: ${modalImageAudit.objectPosition}`);
    console.log(`    wrap: ${modalImageAudit.wrapWidth}x${modalImageAudit.wrapHeight}, img: ${modalImageAudit.imgWidth}x${modalImageAudit.imgHeight}`);
    console.log(`    zeroHorizontalBlackBars: ${modalImageAudit.zeroHorizontalBlackBars}`);
    console.log(`    zeroVerticalBlackBars: ${modalImageAudit.zeroVerticalBlackBars}`);

    assert.strictEqual(modalImageAudit.modalOpen, true, 'ProductDetailsModal must be open');
    assert.strictEqual(modalImageAudit.objectFit, 'cover', 'Pizza modal image must use object-fit: cover');
    assert.strictEqual(modalImageAudit.objectPosition, '50% 22%', 'Pizza modal image must use center 22%');
    assert.strictEqual(modalImageAudit.zeroHorizontalBlackBars, true, 'Image must completely fill wrap width (ZERO horizontal black bars)');
    assert.strictEqual(modalImageAudit.zeroVerticalBlackBars, true, 'Image must completely fill wrap height (ZERO vertical black bars)');

    // Capture screenshot on Desktop 1440
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02_spicy_mexican_pizza_modal_desktop_1440.png'),
    });
    console.log('  Saved: 02_spicy_mexican_pizza_modal_desktop_1440.png');

    // Test the pizza modal across Tablet 768 and Mobile 375
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02_spicy_mexican_pizza_modal_tablet_768.png'),
    });
    console.log('  Saved: 02_spicy_mexican_pizza_modal_tablet_768.png');

    await page.setViewport({ width: 375, height: 667 });
    await new Promise((r) => setTimeout(r, 400));
    const mobileModalAudit = await page.evaluate(() => {
      const wrap = document.querySelector('.lm-detail-img-wrap');
      const img = document.querySelector('.lm-detail-img');
      const wRect = wrap ? wrap.getBoundingClientRect() : null;
      const iRect = img ? img.getBoundingClientRect() : null;
      return {
        wrapWidth: wRect ? Math.round(wRect.width) : 0,
        imgWidth: iRect ? Math.round(iRect.width) : 0,
        zeroBlackBars: iRect && wRect ? Math.abs(iRect.width - wRect.width) <= 1 : false,
      };
    });
    console.log(`  Mobile 375 modal: wrapWidth=${mobileModalAudit.wrapWidth}, imgWidth=${mobileModalAudit.imgWidth}, zeroBlackBars=${mobileModalAudit.zeroBlackBars}`);
    assert.strictEqual(mobileModalAudit.zeroBlackBars, true, 'Mobile 375 must have zero black bars');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02_spicy_mexican_pizza_modal_mobile_375.png'),
    });
    console.log('  Saved: 02_spicy_mexican_pizza_modal_mobile_375.png');

    // Close details modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close product details"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Reset viewport to desktop 1440
    await page.setViewport({ width: 1440, height: 900 });
    await new Promise((r) => setTimeout(r, 300));

    // --------------------------------------------------------------------------
    // TEST 3: BURGER CATEGORY & BURGER DETAILS MODAL (FOCAL POINT CENTER 75%)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 3: Burger Category & Burger Details Modal ---');

    // Switch to Burgers in category ribbon
    const burgerSwitched = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('div[role="tablist"] button[role="tab"]'));
      const burgerTab = tabs.find((t) => t.innerText.toLowerCase().includes('burger'));
      if (burgerTab) {
        burgerTab.scrollIntoView({ block: 'center' });
        burgerTab.click();
        return true;
      }
      return false;
    });
    assert.ok(burgerSwitched, 'Must find and click Burgers tab in ribbon');
    await new Promise((r) => setTimeout(r, 600));

    // Inspect burger product cards
    const burgerCardInfo = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.lm-product-card'));
      return cards.slice(0, 3).map((c) => {
        const img = c.querySelector('.lm-product-card-img');
        const style = img ? window.getComputedStyle(img) : null;
        return {
          title: c.innerText.split('\n')[0],
          objectFit: style ? style.objectFit : null,
          objectPosition: style ? style.objectPosition : null,
        };
      });
    });

    burgerCardInfo.forEach((b) => {
      console.log(`  Burger card: ${b.title} -> objectFit: ${b.objectFit}, objectPosition: ${b.objectPosition}`);
      assert.strictEqual(b.objectFit, 'cover', 'Burger card must use object-fit: cover');
      assert.strictEqual(b.objectPosition, '50% 75%', 'Burger card must use center 75% focal point');
    });

    // Click first burger card
    await page.evaluate(() => {
      const card = document.querySelector('.lm-product-card');
      if (card) card.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const burgerModalAudit = await page.evaluate(() => {
      const img = document.querySelector('.lm-detail-img');
      const wrap = document.querySelector('.lm-detail-img-wrap');
      const style = img ? window.getComputedStyle(img) : null;
      const wRect = wrap ? wrap.getBoundingClientRect() : null;
      const iRect = img ? img.getBoundingClientRect() : null;
      return {
        objectFit: style ? style.objectFit : null,
        objectPosition: style ? style.objectPosition : null,
        zeroBlackBars: iRect && wRect ? Math.abs(iRect.width - wRect.width) <= 1 : false,
      };
    });
    console.log(`  Burger modal: objectFit=${burgerModalAudit.objectFit}, objectPosition=${burgerModalAudit.objectPosition}, zeroBlackBars=${burgerModalAudit.zeroBlackBars}`);
    assert.strictEqual(burgerModalAudit.objectFit, 'cover', 'Burger modal must use object-fit: cover');
    assert.strictEqual(burgerModalAudit.objectPosition, '50% 75%', 'Burger modal must use center 75%');
    assert.strictEqual(burgerModalAudit.zeroBlackBars, true, 'Burger modal must have zero horizontal black bars');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_burger_details_modal_desktop_1440.png'),
    });
    console.log('  Saved: 03_burger_details_modal_desktop_1440.png');

    // Close burger modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close product details"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // --------------------------------------------------------------------------
    // TEST 3B: PASTA CATEGORY & PASTA DETAILS MODAL (FOCAL POINT CENTER)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 3B: Pasta Category & Pasta Details Modal ---');

    // Switch to Pasta in category ribbon
    const pastaSwitched = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('div[role="tablist"] button[role="tab"], .lm-menu-cat-btn'));
      const pastaTab = tabs.find((t) => t.innerText.toLowerCase().includes('pasta'));
      if (pastaTab) {
        pastaTab.scrollIntoView({ block: 'center' });
        pastaTab.click();
        return true;
      }
      return false;
    });
    assert.ok(pastaSwitched, 'Must find and click Pasta tab in ribbon');
    await new Promise((r) => setTimeout(r, 600));

    // Inspect pasta product cards
    const pastaCardInfo = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.lm-product-card'));
      return cards.map((c) => {
        const img = c.querySelector('.lm-product-card-img');
        const style = img ? window.getComputedStyle(img) : null;
        return {
          title: c.innerText.split('\n')[0],
          objectFit: style ? style.objectFit : null,
          objectPosition: style ? style.objectPosition : null,
          naturalWidth: img ? img.naturalWidth : 0,
          naturalHeight: img ? img.naturalHeight : 0,
        };
      });
    });

    console.log(`  Pasta cards found: ${pastaCardInfo.length}`);
    assert.ok(pastaCardInfo.length > 0, 'Must render pasta product cards');
    pastaCardInfo.forEach((p) => {
      console.log(`  Pasta card: ${p.title} -> objectFit: ${p.objectFit}, objectPosition: ${p.objectPosition}, natural: ${p.naturalWidth}x${p.naturalHeight}`);
      assert.strictEqual(p.objectFit, 'cover', 'Pasta card must use object-fit: cover');
      assert.strictEqual(p.objectPosition, '50% 50%', 'Pasta card must use center focal point');
      assert.ok(p.naturalWidth > 0 && p.naturalHeight > 0, 'Pasta card image must load with valid natural dimensions');
    });

    // Click first pasta card
    await page.evaluate(() => {
      const card = document.querySelector('.lm-product-card');
      if (card) card.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const pastaModalAudit = await page.evaluate(() => {
      const img = document.querySelector('.lm-detail-img');
      const wrap = document.querySelector('.lm-detail-img-wrap');
      const style = img ? window.getComputedStyle(img) : null;
      const wRect = wrap ? wrap.getBoundingClientRect() : null;
      const iRect = img ? img.getBoundingClientRect() : null;
      return {
        objectFit: style ? style.objectFit : null,
        objectPosition: style ? style.objectPosition : null,
        naturalWidth: img ? img.naturalWidth : 0,
        naturalHeight: img ? img.naturalHeight : 0,
        wrapWidth: wRect ? Math.round(wRect.width) : 0,
        wrapHeight: wRect ? Math.round(wRect.height) : 0,
        imgWidth: iRect ? Math.round(iRect.width) : 0,
        imgHeight: iRect ? Math.round(iRect.height) : 0,
        zeroBlackBars: iRect && wRect ? Math.abs(iRect.width - wRect.width) <= 1 : false,
      };
    });
    console.log(`  Pasta modal: objectFit=${pastaModalAudit.objectFit}, objectPosition=${pastaModalAudit.objectPosition}, zeroBlackBars=${pastaModalAudit.zeroBlackBars}`);
    assert.strictEqual(pastaModalAudit.objectFit, 'cover', 'Pasta modal must use object-fit: cover');
    assert.strictEqual(pastaModalAudit.objectPosition, '50% 50%', 'Pasta modal must use center');
    assert.strictEqual(pastaModalAudit.zeroBlackBars, true, 'Pasta modal must have zero horizontal black bars');
    assert.ok(pastaModalAudit.naturalWidth > 0 && pastaModalAudit.naturalHeight > 0, 'Pasta modal image must load');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_pasta_details_modal_desktop_1440.png'),
    });
    console.log('  Saved: 03_pasta_details_modal_desktop_1440.png');

    // Close pasta modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close product details"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // --------------------------------------------------------------------------
    // TEST 4: TIGER BOMB DRINK DETAILS MODAL (DUAL-LAYER AMBIENT BACKDROP)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 4: Drink Details Modal with Ambient Backdrop ---');

    // Scroll back up to the featured section
    await page.evaluate(() => {
      const featuredSec = document.querySelector('.lm-featured-master-section');
      if (featuredSec) {
        featuredSec.scrollIntoView({ block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    });
    await new Promise((r) => setTimeout(r, 400));

    // Click Tiger Bomb in Featured Section
    const tigerClicked = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.lm-featured-master-card'));
      const tiger = cards.find((c) => c.innerText.toLowerCase().includes('tiger'));
      if (tiger) {
        tiger.scrollIntoView({ block: 'center' });
        tiger.click();
        return true;
      }
      return false;
    });
    assert.ok(tigerClicked, 'Must find and click Tiger Bomb card in featured section');
    await new Promise((r) => setTimeout(r, 600));

    const tigerModalAudit = await page.evaluate(() => {
      const wrap = document.querySelector('.lm-detail-img-wrap');
      const img = document.querySelector('.lm-detail-img');
      const backdrop = document.querySelector('.lm-detail-img-wrap .lm-img-ambient-backdrop');
      const style = img ? window.getComputedStyle(img) : null;
      const bStyle = backdrop ? window.getComputedStyle(backdrop) : null;

      return {
        hasImg: Boolean(img),
        hasBackdrop: Boolean(backdrop),
        objectFit: style ? style.objectFit : null,
        filter: style ? style.filter : null,
        backdropFilter: bStyle ? bStyle.filter : null,
        backdropDisplay: bStyle ? bStyle.display : null,
      };
    });

    console.log('  Tiger Bomb Modal Audit:');
    console.log(`    hasImg: ${tigerModalAudit.hasImg}`);
    console.log(`    hasBackdrop: ${tigerModalAudit.hasBackdrop}`);
    console.log(`    img objectFit: ${tigerModalAudit.objectFit}`);
    console.log(`    backdrop filter: ${tigerModalAudit.backdropFilter}`);

    assert.strictEqual(tigerModalAudit.hasBackdrop, true, 'Tiger Bomb modal must render ambient backdrop');
    assert.strictEqual(tigerModalAudit.objectFit, 'contain', 'Tiger Bomb modal foreground must preserve bottle silhouette');
    assert.ok(tigerModalAudit.backdropFilter && tigerModalAudit.backdropFilter.includes('blur'), 'Ambient backdrop must have blur filter');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04_tiger_bomb_ambient_backdrop_desktop_1440.png'),
    });
    console.log('  Saved: 04_tiger_bomb_ambient_backdrop_desktop_1440.png');

    await page.setViewport({ width: 375, height: 667 });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04_tiger_bomb_ambient_backdrop_mobile_375.png'),
    });
    console.log('  Saved: 04_tiger_bomb_ambient_backdrop_mobile_375.png');

    // Close Tiger Bomb modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close product details"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // --------------------------------------------------------------------------
    // TEST 5: FULL RESPONSIVE VIEWPORT AUDIT (8 BREAKPOINTS)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 5: Full Responsive Viewport Audit (8 Breakpoints) ---');

    for (const vp of VIEWPORTS) {
      console.log(`  Checking Viewport: ${vp.name} (${vp.width}x${vp.height}px)...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise((r) => setTimeout(r, 350));

      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return {
          scrollWidth: root.scrollWidth,
          clientWidth: window.innerWidth,
          hasOverflow: root.scrollWidth > window.innerWidth,
        };
      });

      console.log(`    scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}, overflow=${overflow.hasOverflow}`);
      assert.strictEqual(overflow.hasOverflow, false, `Viewport ${vp.name} must have 0 horizontal overflow`);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `05_full_page_${vp.name}.png`),
      });
    }

    // Copy screenshots to artifact root for immediate viewing
    const copyPairs = [
      ['01_category_pizza_cards_desktop_1440.png', '01_category_pizza_cards_desktop_1440.png'],
      ['02_spicy_mexican_pizza_modal_desktop_1440.png', '02_spicy_mexican_pizza_modal_desktop_1440.png'],
      ['02_spicy_mexican_pizza_modal_mobile_375.png', '02_spicy_mexican_pizza_modal_mobile_375.png'],
      ['03_burger_details_modal_desktop_1440.png', '03_burger_details_modal_desktop_1440.png'],
      ['03_pasta_details_modal_desktop_1440.png', '03_pasta_details_modal_desktop_1440.png'],
      ['04_tiger_bomb_ambient_backdrop_desktop_1440.png', '04_tiger_bomb_ambient_backdrop_desktop_1440.png'],
      ['04_tiger_bomb_ambient_backdrop_mobile_375.png', '04_tiger_bomb_ambient_backdrop_mobile_375.png'],
    ];

    for (const [src, dst] of copyPairs) {
      const srcPath = path.join(SCREENSHOT_DIR, src);
      const dstPath = path.join(ARTIFACT_DIR, dst);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, dstPath);
      }
    }

    console.log('\n--- BROWSER CONSOLE ERROR AUDIT ---');
    console.log(`  Total browser errors caught: ${browserErrors.length}`);
    if (browserErrors.length > 0) {
      console.log('  Errors:', browserErrors);
    }
    assert.strictEqual(browserErrors.length, 0, 'Must have zero browser errors');

    console.log('\n========================================================================');
    console.log('ALL VERIFICATION ASSERTIONS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\nVerification failed with error:', err);
  process.exit(1);
});
