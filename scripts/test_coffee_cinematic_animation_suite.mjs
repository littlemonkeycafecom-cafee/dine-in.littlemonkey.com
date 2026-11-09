import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const BASE_URL = 'http://127.0.0.1:3000';

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(message);
  }
  console.log(`[PASS] ${message}`);
}

function getTable01Url() {
  const secrets = JSON.parse(fs.readFileSync(path.resolve('.active_qr_secrets.json'), 'utf8'));
  const credId = Object.keys(secrets).find((k) => k.startsWith('qrc_t01_'));
  const secret = secrets[credId];
  return `${BASE_URL}/?t=T01&cred=${credId}.${secret}`;
}

(async () => {
  console.log('===============================================================');
  console.log('LITTLE MONKEY CAFE - COFFEE CINEMATIC ANIMATIONS QA SUITE');
  console.log('===============================================================');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const consoleErrors = [];

  try {
    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[Console Error]: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`[Page Error]: ${err.message}`);
    });

    await page.setViewport({ width: 1440, height: 900 });

    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // 1. Establish valid table session for Table 01
    console.log('\n--- 1. Authorize Table 01 Session & Load Menu ---');
    const table01Url = getTable01Url();
    console.log('  Navigating to Table 01 entry URL:', table01Url);

    await page.goto(table01Url, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Sign in as Guest if gate is present
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find((b) => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) guestBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Verify Menu and Promotional Square Card are present
    const hasSquareCard = await page.evaluate(() => {
      const card = document.querySelector('.lm-square-coffee-card');
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      const style = window.getComputedStyle(card);
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        aspectRatio: style.aspectRatio,
        borderRadius: style.borderRadius,
      };
    });
    assert(Boolean(hasSquareCard), 'Coffee promotional banner is present as a square card');
    console.log(`  Card dimensions: ${hasSquareCard.width}x${hasSquareCard.height}px (aspect-ratio: ${hasSquareCard.aspectRatio})`);
    assert(Math.abs(hasSquareCard.width - hasSquareCard.height) <= 2, 'Banner is geometrically square (1:1 aspect ratio)');

    // Check Must-Try section and regular menu are preserved
    const menuIntegrity = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasMustTry: text.includes('Must-Try') || text.includes('MUST-TRY') || text.includes('Must Try'),
        hasCategories: text.includes('Pizzas') || text.includes('Coffee') || text.includes('Thin Crust'),
      };
    });
    assert(menuIntegrity.hasMustTry, 'Must-Try section preserved on menu page');
    assert(menuIntegrity.hasCategories, 'Menu categories and catalog preserved');

    // 2. Click Promotional Banner & Test Staged Opening
    console.log('\n--- 2. Staged Opening Choreography Test ---');
    const initialOverflow = await page.evaluate(() => document.body.style.overflow);
    assert(initialOverflow !== 'hidden', 'Initial body scroll is not locked');

    // Click banner
    await page.click('.lm-square-coffee-card');

    // Step 1 check (t ~ 100ms): Card is animating up, backdrop is darkening
    await new Promise((r) => setTimeout(r, 100));
    const stage1 = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return null;
      const card = dialog.querySelector('div[style*="radial-gradient"]');
      const bodyOverflow = document.body.style.overflow;
      return {
        dialogPresent: Boolean(dialog),
        bodyOverflow,
        cardTransform: card ? window.getComputedStyle(card).transform : '',
      };
    });
    assert(Boolean(stage1 && stage1.dialogPresent), 'Dialog mounted into DOM');
    assert(stage1.bodyOverflow === 'hidden', 'Body scroll locked upon modal open');
    console.log('  Card transform during entrance:', stage1.cardTransform);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coffee_anim_01_card_entrance.png') });

    // Step 2 check (t ~ 600ms): Card centered, golden border is drawing
    await new Promise((r) => setTimeout(r, 550));
    const stage2 = await page.evaluate(() => {
      const rect = document.querySelector('svg rect[pathLength="100"]');
      if (!rect) return null;
      const style = window.getComputedStyle(rect);
      return {
        stroke: style.stroke,
        strokeDashoffset: style.strokeDashoffset,
        filter: style.filter,
      };
    });
    assert(Boolean(stage2), 'Golden border SVG rect is present with pathLength=100');
    console.log('  Border stroke offset during draw:', stage2.strokeDashoffset);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coffee_anim_02_border_drawing.png') });

    // Step 3 check (t ~ 1400ms): Border complete, CRAFT MEETS COLD revealed
    await new Promise((r) => setTimeout(r, 850));
    const stage3 = await page.evaluate(() => {
      const title = document.querySelector('#coffee-experience-title');
      const badge = document.body.innerText.includes('CRAFT MEETS COLD');
      const brews = document.querySelectorAll('[aria-label^="Inspect "]');
      const rect = document.querySelector('svg rect[pathLength="100"]');
      const rectStyle = rect ? window.getComputedStyle(rect) : null;
      return {
        titleText: title ? title.textContent : null,
        badgeFound: badge,
        brewCount: brews.length,
        strokeDashoffset: rectStyle ? rectStyle.strokeDashoffset : null,
        borderComplete: rectStyle ? rectStyle.stroke : null,
      };
    });
    assert(stage3.badgeFound, 'CRAFT MEETS COLD title and badge revealed');
    assert(stage3.brewCount === 10, `All 10 signature cold brews rendered in showcase (found ${stage3.brewCount})`);
    console.log('  Border completed stroke color:', stage3.borderComplete);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coffee_anim_03_showcase_revealed.png') });

    // 3. Product Selection & Detail View Transition
    console.log('\n--- 3. Single Drink Prominent Detail View Test ---');
    // Click on Tiger Bomb Cold Brew
    const clickedTigerBomb = await page.evaluate(() => {
      const brews = Array.from(document.querySelectorAll('div[role="button"]'));
      const tiger = brews.find((el) => el.innerText && el.innerText.includes('Tiger Bomb'));
      if (tiger) {
        tiger.click();
        return true;
      }
      return false;
    });
    assert(clickedTigerBomb, 'Selected Tiger Bomb from showcase');
    await new Promise((r) => setTimeout(r, 400));

    const detailState = await page.evaluate(() => {
      const heading = document.querySelector('[role="dialog"] h3');
      const img = document.querySelector('img[alt="Tiger Bomb Cold Brew"]') || document.querySelector('img[alt*="Tiger Bomb"]');
      const text = document.body.innerText;
      return {
        heading: heading ? heading.textContent : null,
        hasImage: Boolean(img),
        imageObjectFit: img ? window.getComputedStyle(img).objectFit : null,
        hasIngredients: text.toUpperCase().includes('HANDCRAFTED INGREDIENTS'),
        hasProcessSteps: text.toUpperCase().includes('ARTISANAL COLD EXTRACTION PROCESS'),
      };
    });
    assert(detailState.heading && detailState.heading.includes('Tiger Bomb'), 'Tiger Bomb detail view rendered');
    assert(detailState.imageObjectFit === 'contain', 'Drink image maintains natural proportions (objectFit: contain)');
    assert(detailState.hasIngredients, 'Ingredients chips displayed');
    assert(detailState.hasProcessSteps, 'Artisanal cold extraction process steps displayed');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coffee_anim_04_single_drink_detail.png') });

    // Return to collection
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const backBtn = btns.find((b) => b.innerText && b.innerText.includes('Back to Collection'));
      if (backBtn) backBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    const returnedCount = await page.evaluate(() => {
      return document.querySelectorAll('[aria-label^="Inspect "]').length;
    });
    assert(returnedCount === 10, 'Returned to collection grid with 10 brews intact');

    // 4. Tab Switch: ICED COFFEE VS COLD BREW
    console.log('\n--- 4. Comparison View Test ---');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const compBtn = btns.find((b) => b.innerText && b.innerText.includes('ICED COFFEE VS COLD BREW'));
      if (compBtn) compBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const compState = await page.evaluate(() => {
      const text = document.body.innerText;
      const glassCutout = document.querySelector('img[src*="cold-brew-glass-cutout"]');
      return {
        hasIced: text.includes('ICED COFFEE') && text.includes('Brewed hot, then chilled'),
        hasColdBrew: text.includes('COLD BREW') && text.includes('67% less acid'),
        hasGlassCutout: Boolean(glassCutout),
      };
    });
    assert(compState.hasIced, 'Iced coffee comparison details rendered');
    assert(compState.hasColdBrew, 'Cold brew comparison details rendered');
    assert(compState.hasGlassCutout, 'Artisanal glass comparison visual present');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coffee_anim_05_comparison_desktop.png') });

    // 5. Reverse Exit Animation Test
    console.log('\n--- 5. Reverse Exit Animation Test ---');
    // Trigger close via Close X button using actual click
    await page.click('button[aria-label="Close Coffee Experience"]');

    // Capture halfway during reverse exit
    await new Promise((r) => setTimeout(r, 180));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coffee_anim_06_reverse_exit.png') });

    // Wait for exit sequence to fully complete (620ms + settling)
    await new Promise((r) => setTimeout(r, 750));

    const afterCloseState = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const bodyOverflow = document.body.style.overflow;
      return {
        dialogPresent: Boolean(dialog),
        bodyOverflow,
      };
    });
    assert(!afterCloseState.dialogPresent, 'Modal cleanly unmounted after exit animation');
    assert(afterCloseState.bodyOverflow !== 'hidden', 'Body scroll restored after modal close');

    // 6. Escape Key Dismissal Test
    console.log('\n--- 6. Escape Key Dismissal Test ---');
    await page.click('.lm-square-coffee-card');
    await new Promise((r) => setTimeout(r, 1500));

    // Press Escape
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 900));

    const afterEscapeState = await page.evaluate(() => {
      return {
        dialogPresent: Boolean(document.querySelector('[role="dialog"]')),
        bodyOverflow: document.body.style.overflow,
      };
    });
    assert(!afterEscapeState.dialogPresent, 'Modal dismissed cleanly via Escape key');
    assert(afterEscapeState.bodyOverflow !== 'hidden', 'Body scroll restored after Escape dismiss');

    // 7. Rapid Click & Timer Resilience Test
    console.log('\n--- 7. Rapid Repeated Clicks Resilience Test ---');
    for (let i = 0; i < 4; i++) {
      // Rapid open then immediate close
      await page.evaluate(() => {
        const card = document.querySelector('.lm-square-coffee-card');
        if (card) card.click();
      });
      await new Promise((r) => setTimeout(r, 120));
      await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Close Coffee Experience"]');
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 120));
    }
    // Allow state to settle
    await new Promise((r) => setTimeout(r, 1000));

    const afterRapidState = await page.evaluate(() => {
      return {
        dialogPresent: Boolean(document.querySelector('[role="dialog"]')),
        bodyOverflow: document.body.style.overflow,
      };
    });
    assert(!afterRapidState.dialogPresent, 'No orphaned modal state after rapid repeated clicks');
    assert(afterRapidState.bodyOverflow !== 'hidden', 'Body scroll cleanly restored after rapid clicks');

    // 8. Multi-Viewport Responsive Tests (320px, 390px, 768px, 1024px)
    console.log('\n--- 8. Multi-Viewport Verification (1024, 768, 390, 320) ---');
    const viewports = [
      { width: 1024, height: 768, name: '1024px Small Desktop' },
      { width: 768, height: 1024, name: '768px Tablet' },
      { width: 390, height: 844, name: '390px Mobile Standard' },
      { width: 320, height: 640, name: '320px Mobile Narrow' },
    ];

    for (const vp of viewports) {
      console.log(`  Testing ${vp.name}...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise((r) => setTimeout(r, 200));

      // Open modal
      await page.click('.lm-square-coffee-card');
      await new Promise((r) => setTimeout(r, 1500));

      const vpMetrics = await page.evaluate((w) => {
        const dialog = document.querySelector('[role="dialog"]');
        const card = dialog ? dialog.querySelector('div[style*="radial-gradient"]') : null;
        const rect = card ? card.getBoundingClientRect() : null;
        return {
          cardWidth: rect ? Math.round(rect.width) : 0,
          cardHeight: rect ? Math.round(rect.height) : 0,
          hasHorizontalOverflow: document.documentElement.scrollWidth > w,
        };
      }, vp.width);

      assert(vpMetrics.cardWidth <= vp.width, `Card width (${vpMetrics.cardWidth}px) fits within viewport (${vp.width}px)`);
      assert(!vpMetrics.hasHorizontalOverflow, `Zero horizontal overflow at ${vp.width}px`);

      if (vp.width === 1024) {
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coffee_anim_07_showcase_1024.png') });
      } else if (vp.width === 768) {
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coffee_anim_08_showcase_768.png') });
      } else if (vp.width === 390) {
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coffee_anim_10_showcase_390.png') });
        // Also test comparison on mobile
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const comp = btns.find((b) => b.innerText && b.innerText.includes('ICED COFFEE VS COLD BREW'));
          if (comp) comp.click();
        });
        await new Promise((r) => setTimeout(r, 400));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coffee_anim_11_comparison_390.png') });
      } else if (vp.width === 320) {
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coffee_anim_12_showcase_320.png') });
      }

      // Close modal
      const closeBtn = await page.$('button[aria-label="Close Coffee Experience"]');
      if (closeBtn) {
        await closeBtn.click();
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    // 9. Check Console Errors
    console.log('\n--- 9. Console Error Verification ---');
    console.log(`Total captured console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.warn(consoleErrors.join('\n'));
    }
    assert(consoleErrors.length === 0, 'Zero JavaScript or console errors throughout the entire test run');

    console.log('\n===============================================================');
    console.log('ALL COFFEE CINEMATIC ANIMATIONS TESTS PASSED SUCCESSFULLY');
    console.log('===============================================================');
  } finally {
    await browser.close();
  }
})();
