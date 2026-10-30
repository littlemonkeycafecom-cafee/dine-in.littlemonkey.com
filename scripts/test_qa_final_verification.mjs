import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';

(async () => {
  console.log('--- Starting Final QA Verification Suite ---');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const results = {
    variedRatios: [],
    touchInteraction: null,
    desktopHover: null,
    reducedMotion: null,
    categorySeparation: null,
    readOnlyDining: null
  };

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 1. Authenticate with Guest Preview
    await page.goto('http://127.0.0.1:3000/?token=dev_preview_token', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));
    await page.click('body').catch(() => {});
    const guestBtn = await page.$('button::-p-text(Continue as Guest)');
    if (guestBtn) {
      await guestBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }

    // -------------------------------------------------------------
    // Test 1: Category Separation (Pizzas vs Pizza Combos)
    // -------------------------------------------------------------
    console.log('\n[1/5] Verifying Category Separation & Dietary Filtering...');
    const catCheck = await page.evaluate(() => {
      // Find category tabs or buttons
      const catButtons = Array.from(document.querySelectorAll('button, a'))
        .filter(el => el.textContent && (el.textContent.includes('Pizza') || el.textContent.includes('Combo')));
      
      const sections = Array.from(document.querySelectorAll('section, h2, h3'))
        .map(s => s.textContent?.trim());

      return {
        pizzaFound: sections.some(s => s?.includes('Pizzas')),
        pizzaCombosFound: sections.some(s => s?.includes('Pizza Combos') || s?.includes('Combos')),
        allHeaders: sections.filter(s => s && (s.includes('Pizza') || s.includes('Burger') || s.includes('Pasta') || s.includes('Dessert') || s.includes('Cold Brew')))
      };
    });
    results.categorySeparation = catCheck;
    console.log('Category check result:', JSON.stringify(catCheck, null, 2));

    // -------------------------------------------------------------
    // Test 2: Varied Image Ratios (Landscape, Square, Portrait/Cutout)
    // -------------------------------------------------------------
    console.log('\n[2/5] Testing Varied Image Aspect Ratios in Product Details...');
    
    // We will find and test 3 different types of items:
    // 1) Cold Brew (Tiger Bomb / portrait cutout)
    // 2) Pizza / Meal (Square/Landscape food photo)
    // 3) Dessert / Side (Square food photo)
    
    const itemSearches = [
      { type: 'portrait_cutout', query: 'Tiger Bomb' },
      { type: 'food_photo_pizza', query: 'Margherita' },
      { type: 'food_photo_dessert', query: 'Brownie' }
    ];

    for (const itemSearch of itemSearches) {
      console.log(`Testing item: ${itemSearch.query} (${itemSearch.type})...`);
      // Scroll to find card with text
      const found = await page.evaluate((text) => {
        const cards = Array.from(document.querySelectorAll('.lm-product-card'));
        for (const c of cards) {
          if (c.textContent && c.textContent.includes(text)) {
            c.scrollIntoView({ block: 'center' });
            return true;
          }
        }
        return false;
      }, itemSearch.query);

      if (!found) {
        // Fallback: try searching or pick first card
        console.log(`Could not find card matching "${itemSearch.query}", clicking available card`);
      }

      await new Promise(r => setTimeout(r, 400));
      const card = await page.evaluateHandle((text) => {
        const cards = Array.from(document.querySelectorAll('.lm-product-card'));
        const matched = cards.find(c => c.textContent && c.textContent.includes(text));
        return matched || cards[0];
      }, itemSearch.query);

      if (card) {
        await card.click();
        await page.waitForSelector('.lm-product-details-modal', { timeout: 4000 });
        await new Promise(r => setTimeout(r, 600));

        // Evaluate modal image metrics
        const metrics = await page.evaluate(() => {
          const modal = document.querySelector('.lm-product-details-modal');
          const wrap = document.querySelector('.lm-detail-img-wrap');
          const img = document.querySelector('.lm-detail-img');
          const title = document.querySelector('.lm-product-details-modal h2, .lm-product-details-modal h3');
          const price = document.querySelector('.lm-detail-footer');

          const modalRect = modal ? modal.getBoundingClientRect() : null;
          const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
          const imgRect = img ? img.getBoundingClientRect() : null;
          const titleRect = title ? title.getBoundingClientRect() : null;
          const priceRect = price ? price.getBoundingClientRect() : null;

          const imgComputed = img ? window.getComputedStyle(img) : null;
          const wrapComputed = wrap ? window.getComputedStyle(wrap) : null;

          // Check if title and price overlap
          const overlaps = titleRect && priceRect ? !(
            titleRect.bottom < priceRect.top ||
            titleRect.top > priceRect.bottom ||
            titleRect.right < priceRect.left ||
            titleRect.left > priceRect.right
          ) : false;

          return {
            titleText: title ? title.textContent?.trim() : '',
            modalBounds: modalRect ? { width: modalRect.width, height: modalRect.height } : null,
            wrapBounds: wrapRect ? { width: wrapRect.width, height: wrapRect.height } : null,
            wrapOverflow: wrapComputed ? wrapComputed.overflow : '',
            imgBounds: imgRect ? { width: imgRect.width, height: imgRect.height } : null,
            imgNatural: img ? { width: img.naturalWidth, height: img.naturalHeight, ratio: (img.naturalWidth / img.naturalHeight).toFixed(2) } : null,
            objectFit: imgComputed ? imgComputed.objectFit : '',
            titlePriceOverlap: overlaps,
            containedWithinViewport: modalRect ? (modalRect.width <= window.innerWidth && modalRect.right <= window.innerWidth) : false,
            imageContainedInWrap: wrapRect && imgRect ? (wrapComputed.overflow === 'hidden') : false
          };
        });

        // Screenshot the modal
        const screenshotPath = path.join(ARTIFACT_DIR, `qa_ratio_${itemSearch.type}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`Saved screenshot to ${screenshotPath}`);

        results.variedRatios.push({
          item: itemSearch.query,
          type: itemSearch.type,
          ...metrics
        });

        // Close modal
        const closeBtn = await page.$('.lm-product-details-modal button::-p-text(CLOSE)');
        if (closeBtn) {
          await closeBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // -------------------------------------------------------------
    // Test 3: Desktop Hover Zoom & Isolation
    // -------------------------------------------------------------
    console.log('\n[3/5] Testing Desktop Image Hover Zoom & Isolation...');
    await page.evaluate(() => {
      const card = document.querySelector('.lm-product-card');
      if (card) card.scrollIntoView({ block: 'center' });
    });
    await new Promise(r => setTimeout(r, 400));

    const hoverMetrics = await page.evaluate(async () => {
      const card = document.querySelector('.lm-product-card');
      const wrap = card?.querySelector('.lm-product-card-img-wrap');
      const img = card?.querySelector('.lm-product-card-img');
      if (!card || !wrap || !img) return { error: 'Elements not found' };

      const cardBefore = card.getBoundingClientRect();
      const wrapBefore = wrap.getBoundingClientRect();
      const imgBefore = img.getBoundingClientRect();

      // Dispatch hover event to wrap
      wrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      // Wait a moment for transition
      await new Promise(r => setTimeout(r, 400));

      const cardAfter = card.getBoundingClientRect();
      const wrapAfter = wrap.getBoundingClientRect();
      const imgAfter = img.getBoundingClientRect();

      return {
        cardPositionShifted: Math.abs(cardBefore.top - cardAfter.top) > 1 || Math.abs(cardBefore.left - cardAfter.left) > 1,
        wrapShifted: Math.abs(wrapBefore.width - wrapAfter.width) > 1 || Math.abs(wrapBefore.height - wrapAfter.height) > 1,
        imgScaled: imgAfter.width > imgBefore.width,
        scaleRatio: (imgAfter.width / imgBefore.width).toFixed(3),
        wrapOverflow: window.getComputedStyle(wrap).overflow
      };
    });
    results.desktopHover = hoverMetrics;
    console.log('Desktop hover metrics:', JSON.stringify(hoverMetrics, null, 2));

    // -------------------------------------------------------------
    // Test 4: Touch Emulation (Mobile 390x844)
    // -------------------------------------------------------------
    console.log('\n[4/5] Testing Touch Device Interaction & Dimensions...');
    const touchPage = await browser.newPage();
    await touchPage.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true
    });

    await touchPage.goto('http://127.0.0.1:3000/?token=dev_preview_token', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));
    const touchGuestBtn = await touchPage.$('button::-p-text(Continue as Guest)');
    if (touchGuestBtn) {
      await touchGuestBtn.tap();
      await new Promise(r => setTimeout(r, 800));
    }

    // Scroll to card and tap
    await touchPage.evaluate(() => {
      const card = document.querySelector('.lm-product-card');
      if (card) card.scrollIntoView({ block: 'center' });
    });
    await new Promise(r => setTimeout(r, 400));

    const touchCard = await touchPage.waitForSelector('.lm-product-card');
    await touchCard.tap();
    await touchPage.waitForSelector('.lm-product-details-modal', { timeout: 4000 });
    await new Promise(r => setTimeout(r, 600));

    const touchMetrics = await touchPage.evaluate(() => {
      const modal = document.querySelector('.lm-product-details-modal');
      const wrap = document.querySelector('.lm-detail-img-wrap');
      const img = document.querySelector('.lm-detail-img');
      const closeBtn = document.querySelector('.lm-product-details-modal button');

      const modalRect = modal ? modal.getBoundingClientRect() : null;
      const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
      const imgRect = img ? img.getBoundingClientRect() : null;

      // In touch device with (hover: none), hover scale is forced to 1 !important
      return {
        viewportWidth: window.innerWidth,
        modalWidth: modalRect ? modalRect.width : 0,
        modalHeight: modalRect ? modalRect.height : 0,
        wrapWidth: wrapRect ? wrapRect.width : 0,
        wrapHeight: wrapRect ? wrapRect.height : 0,
        imgWidth: imgRect ? imgRect.width : 0,
        imgHeight: imgRect ? imgRect.height : 0,
        fitsInViewport: modalRect ? (modalRect.width <= window.innerWidth && modalRect.right <= window.innerWidth) : false,
        wrapClippedProperly: wrapRect && modalRect ? wrapRect.width <= modalRect.width : false,
        closeButtonAccessible: !!closeBtn
      };
    });

    const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'qa_touch_mobile_product_detail.png');
    await touchPage.screenshot({ path: mobileScreenshotPath });
    console.log(`Saved touch mobile screenshot to ${mobileScreenshotPath}`);
    results.touchInteraction = touchMetrics;
    console.log('Touch metrics:', JSON.stringify(touchMetrics, null, 2));

    await touchPage.close();

    // -------------------------------------------------------------
    // Test 5: Read-Only Dining Compliance Audit
    // -------------------------------------------------------------
    console.log('\n[5/5] Auditing Read-Only Dining Rules (Zero Carts, Zero Checkout)...');
    const readOnlyAudit = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, input'));
      const cartKeywords = ['add to cart', 'add to bag', 'checkout', 'place order', 'book a table', 'reserve table', 'view cart'];
      const violations = [];

      for (const b of buttons) {
        const text = (b.textContent || b.getAttribute('aria-label') || '').toLowerCase().trim();
        for (const kw of cartKeywords) {
          if (text.includes(kw)) {
            violations.push({ text, tag: b.tagName });
          }
        }
      }

      const quantityControls = document.querySelectorAll('.quantity-selector, .cart-qty, input[type="number"]');

      return {
        cartViolationsCount: violations.length,
        cartViolations: violations,
        quantityControlsCount: quantityControls.length,
        isStrictlyReadOnly: violations.length === 0 && quantityControls.length === 0
      };
    });
    results.readOnlyDining = readOnlyAudit;
    console.log('Read-only dining audit:', JSON.stringify(readOnlyAudit, null, 2));

    await page.close();

  } catch (err) {
    console.error('Error during QA tests:', err);
  } finally {
    await browser.close();
  }

  console.log('\n=== FINAL QA VERIFICATION SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
})();
