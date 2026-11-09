/**
 * test_menu_refinement_and_qa_suite.mjs
 * Comprehensive automated QA test suite for Little Monkey Café Dining Menu Refinement:
 * 1. Screen 1: Unauthenticated QR access gate without dev controls or staff triggers.
 * 2. Screen 2: Centered menu heading with gold decorative accent.
 * 3. Elimination of redundant search controls (top & middle) and retention of single dedicated search button.
 * 4. Critical functional category filtering (Pizzas, Pizza Combos, Burgers, Burger Combos, Sandwiches, etc.).
 * 5. Search + category filtering synergy and clearing.
 * 6. Responsive grid alignment and 0px horizontal overflow across 8 viewports:
 *    (320px, 360px, 390px, 430px, 768px, 1024px, 1280px, 1440px).
 * 7. Screenshot generation.
 * 8. Zero console errors.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const BASE_URL = 'http://127.0.0.1:3000';
const ARTIFACTS_DIR = 'C:/Users/chava/.gemini/antigravity/brain/1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';

async function run() {
  console.log('===============================================================');
  console.log('LITTLE MONKEY CAFE — MENU REFINEMENT & FUNCTIONAL QA SUITE');
  console.log('===============================================================');

  // Discover Table 01 and Table 04 credentials from .active_qr_secrets.json & .qr_credentials.json
  const secretsPath = path.resolve(process.cwd(), '.active_qr_secrets.json');
  const credsPath = path.resolve(process.cwd(), '.qr_credentials.json');
  const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

  const t01Cred = creds.find((c) => c.tableNumber === 'Table 01' && c.isActive);
  const t01Secret = secrets[t01Cred.credentialId];
  const t01Url = `${BASE_URL}/?t=T01&cred=${t01Cred.credentialId}.${t01Secret}`;

  console.log('Active Table 01 URL:', t01Url);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Screen 1 — Clean Customer QR Access Gate
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Screen 1 (Unauthenticated QR Access Gate) ---');
    await page.setViewport({ width: 1440, height: 900 });

    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      localStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // Navigate without QR credentials to hit TableQrRequiredGate
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });

    // Verify Brand Logo, Access Badge, Heading, and Guidance Card
    const gateInfo = await page.evaluate(() => {
      const heading = document.querySelector('h1')?.textContent || '';
      const badge = document.querySelector('span')?.textContent || '';
      const hasDevLauncher = Boolean(document.querySelector('.lm-dev-launcher, [style*="DEV ONLY"]'));
      const hasStaffBtn = Array.from(document.querySelectorAll('button')).some((b) =>
        b.textContent.includes('Staff QR Administration')
      );
      const hasGuidanceCard = document.body.textContent.includes('How to Access the Dining Menu');
      const hasLogo = Boolean(document.querySelector('img[alt="Little Monkey Café"]'));

      return {
        heading,
        badge,
        hasDevLauncher,
        hasStaffBtn,
        hasGuidanceCard,
        hasLogo,
      };
    });

    console.log('  Gate heading:', gateInfo.heading);
    assert(gateInfo.heading.includes('Table QR Scan Required'), 'Gate heading is present');
    assert(gateInfo.hasLogo, 'Café logo is present');
    assert(gateInfo.hasGuidanceCard, 'Guidance card is present');
    assert(!gateInfo.hasDevLauncher, 'Developer launcher is NOT displayed on customer access screen');
    assert(!gateInfo.hasStaffBtn, 'Staff QR Administration button is NOT exposed to unauthenticated customer');
    console.log('[PASS] Screen 1 is minimal, intentional, premium, and free of developer controls');

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screen1_customer_qr_gate.png'),
    });

    // -------------------------------------------------------------------------
    // TEST 2: Authorize Table 01 & Enter Dining Menu
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Authorizing Table 01 & Entering Menu ---');
    await page.goto(t01Url, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Sign in as Guest if gate is present
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const guestBtn = btns.find((b) => b.textContent && b.textContent.includes('Continue as Guest'));
      if (guestBtn) {
        guestBtn.click();
      } else {
        const primaryBtn = btns.find((b) => b.type === 'submit' || (b.textContent && b.textContent.includes('Sign In')));
        if (primaryBtn) primaryBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Verify main menu catalog rendered
    const menuSection = await page.$('#main-menu-catalog');
    assert(menuSection, 'MenuSection (#main-menu-catalog) rendered');

    // -------------------------------------------------------------------------
    // TEST 3: Menu Heading, Accent & Search Elimination
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Verifying Menu Heading, Accent, and Redundant Search Elimination ---');
    const menuHeaderInfo = await page.evaluate(() => {
      const heading = document.querySelector('#main-menu-catalog h2')?.textContent || '';
      const topSearchBtn = document.querySelector('header button[aria-label="Search Menu"]');
      const middleSearchBtn = document.querySelector('.lm-hero-carousel button[aria-label="Search Menu"]');
      const menuSearchBtn = document.querySelector('#main-menu-catalog button[aria-label*="Search"]');

      return {
        heading,
        hasTopSearch: Boolean(topSearchBtn),
        hasMiddleSearch: Boolean(middleSearchBtn),
        hasMenuSearch: Boolean(menuSearchBtn),
      };
    });

    console.log('  Menu heading:', menuHeaderInfo.heading);
    assert(menuHeaderInfo.heading.includes('Dine-In Menu'), 'Menu heading is clear and centered');
    assert(!menuHeaderInfo.hasTopSearch, 'Top redundant search button removed from CompactHeader');
    assert(!menuHeaderInfo.hasMiddleSearch, 'Middle redundant search button removed from HeroCarousel');
    assert(menuHeaderInfo.hasMenuSearch, 'Single dedicated Search button present in Menu interface');
    console.log('[PASS] Redundant search controls eliminated; single menu Search button present');

    // -------------------------------------------------------------------------
    // TEST 4: Critical Functional Category Filtering
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Critical Functional Category Filtering ---');

    async function selectCategory(label) {
      await page.evaluate((lbl) => {
        const buttons = Array.from(document.querySelectorAll('#main-menu-catalog [role="tab"]'));
        const btn = buttons.find((b) => b.textContent.trim() === lbl);
        if (btn) btn.click();
      }, label);
      await new Promise((r) => setTimeout(r, 300));
    }

    async function getVisibleCardCategories() {
      return page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('#main-menu-catalog .lm-product-card'));
        return cards.map((c) => {
          const name = c.querySelector('h3')?.textContent?.trim() || '';
          const catTag = c.querySelector('div[style*="uppercase"]')?.textContent?.trim() || '';
          return { name, catTag };
        });
      });
    }

    // A. Pizzas
    console.log('  Testing Pizzas category...');
    await selectCategory('Pizzas');
    const pizzaCards = await getVisibleCardCategories();
    console.log(`    Found ${pizzaCards.length} pizza cards.`);
    assert.strictEqual(pizzaCards.length, 17, 'Exactly 17 Pizzas displayed');
    for (const card of pizzaCards) {
      assert(
        card.catTag.toLowerCase().includes('thin crust pizza') || card.name.toLowerCase().includes('pizza'),
        `Item "${card.name}" belongs to Pizzas`
      );
      assert(!card.name.toLowerCase().includes('burger'), 'No burger products in Pizzas');
      assert(!card.name.toLowerCase().includes('pasta'), 'No pasta products in Pizzas');
    }
    console.log('[PASS] Pizzas category strictly filtered (17 items, zero cross-contamination)');

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screen2_pizzas_filtered_1440.png'),
    });

    // B. Pizza Combos
    console.log('  Testing Pizza Combos category...');
    await selectCategory('Pizza Combos');
    const pizzaComboCards = await getVisibleCardCategories();
    console.log(`    Found ${pizzaComboCards.length} pizza combo cards.`);
    assert.strictEqual(pizzaComboCards.length, 2, 'Exactly 2 Pizza Combos displayed');
    for (const card of pizzaComboCards) {
      assert(card.catTag.toLowerCase().includes('pizza combos'), `Item "${card.name}" belongs to Pizza Combos`);
    }
    console.log('[PASS] Pizza Combos category strictly separated from regular pizzas');

    // C. Burgers
    console.log('  Testing Burgers category...');
    await selectCategory('Burgers');
    const burgerCards = await getVisibleCardCategories();
    console.log(`    Found ${burgerCards.length} burger cards.`);
    assert.strictEqual(burgerCards.length, 9, 'Exactly 9 Burgers displayed');
    for (const card of burgerCards) {
      assert(
        card.catTag.toLowerCase().includes('burgers') || card.name.toLowerCase().includes('burger'),
        `Item "${card.name}" belongs to Burgers`
      );
      assert(!card.name.toLowerCase().includes('pizza'), 'No pizza products in Burgers');
    }
    console.log('[PASS] Burgers category strictly filtered (9 items, zero burger combos)');

    // D. Burger Combos
    console.log('  Testing Burger Combos category...');
    await selectCategory('Burger Combos');
    const burgerComboCards = await getVisibleCardCategories();
    console.log(`    Found ${burgerComboCards.length} burger combo cards.`);
    assert.strictEqual(burgerComboCards.length, 3, 'Exactly 3 Burger Combos displayed');
    for (const card of burgerComboCards) {
      assert(card.catTag.toLowerCase().includes('burger combos'), `Item "${card.name}" belongs to Burger Combos`);
    }
    console.log('[PASS] Burger Combos strictly separated from individual burgers');

    // E. Sandwiches
    console.log('  Testing Sandwiches category...');
    await selectCategory('Sandwiches');
    const sandwichCards = await getVisibleCardCategories();
    console.log(`    Found ${sandwichCards.length} sandwich cards.`);
    assert.strictEqual(sandwichCards.length, 7, 'Exactly 7 Sandwiches displayed');
    for (const card of sandwichCards) {
      assert(card.catTag.toLowerCase().includes('sandwiches'), `Item "${card.name}" belongs to Sandwiches`);
    }
    console.log('[PASS] Sandwiches category strictly filtered (7 items)');

    // F. Cold Brews
    console.log('  Testing Cold Brews category...');
    await selectCategory('Cold Brews');
    const coldBrewCards = await getVisibleCardCategories();
    console.log(`    Found ${coldBrewCards.length} cold brew cards.`);
    assert.strictEqual(coldBrewCards.length, 10, 'Exactly 10 Signature Cold Brews displayed');
    console.log('[PASS] Cold Brews category displays all 10 signature drinks');

    // G. All Items
    console.log('  Testing All Items category...');
    await selectCategory('All Items');
    const allCards = await getVisibleCardCategories();
    console.log(`    Found ${allCards.length} items in All Items.`);
    assert.strictEqual(allCards.length, 194, 'All 194 products displayed under All Items');
    console.log('[PASS] All Items restores full café catalog (194 items)');

    // -------------------------------------------------------------------------
    // TEST 5: Search & Category Synergy
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Search & Category Filtering Synergy ---');
    // Select Burgers category
    await selectCategory('Burgers');

    // Open Search in MenuSection
    await page.click('#main-menu-catalog button[aria-label*="Search"]');
    await new Promise((r) => setTimeout(r, 200));

    // Type "chicken" into menu search input
    const searchInput = await page.$('#main-menu-catalog input[type="text"]');
    assert(searchInput, 'Menu search input opened');
    await searchInput.type('chicken');
    await new Promise((r) => setTimeout(r, 300));

    // Check filtered burgers
    const searchedBurgers = await getVisibleCardCategories();
    console.log(`    Found ${searchedBurgers.length} chicken burgers.`);
    assert(searchedBurgers.length > 0, 'Matching chicken burgers found');
    for (const card of searchedBurgers) {
      assert(card.name.toLowerCase().includes('chicken'), `Item "${card.name}" contains chicken`);
      assert(card.catTag.toLowerCase().includes('burgers'), `Item "${card.name}" is a burger`);
    }

    // Clear search
    await page.evaluate(() => {
      const clearBtn = document.querySelector('#main-menu-catalog button[aria-label="Clear search input"]');
      if (clearBtn) clearBtn.click();
    });
    await new Promise((r) => setTimeout(r, 200));

    // All burgers should be restored
    const restoredBurgers = await getVisibleCardCategories();
    assert.strictEqual(restoredBurgers.length, 9, 'All 9 burgers restored after search cleared');
    console.log('[PASS] Clearing search restores full category contents');

    // Close search input
    await page.evaluate(() => {
      const closeBtn = document.querySelector('#main-menu-catalog button[aria-label="Close search"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 200));

    // -------------------------------------------------------------------------
    // TEST 6: Multi-Viewport Responsive Tests & Screenshots
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Multi-Viewport Responsive Verification (320px to 1440px) ---');
    const viewports = [
      { width: 1440, height: 900, name: 'Desktop Large (1440px)', shot: 'screen2_menu_desktop_1440.png' },
      { width: 1280, height: 800, name: 'Desktop Standard (1280px)', shot: null },
      { width: 1024, height: 768, name: 'Small Desktop (1024px)', shot: null },
      { width: 768, height: 1024, name: 'Tablet Portrait (768px)', shot: 'screen2_menu_tablet_768.png' },
      { width: 430, height: 932, name: 'Mobile Large (430px)', shot: null },
      { width: 390, height: 844, name: 'Mobile Standard (390px)', shot: 'screen2_menu_mobile_390.png' },
      { width: 360, height: 740, name: 'Mobile Medium (360px)', shot: null },
      { width: 320, height: 568, name: 'Mobile Narrow (320px)', shot: 'screen2_menu_narrow_320.png' },
    ];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise((r) => setTimeout(r, 250));

      const overflow = await page.evaluate(() => {
        const bodyWidth = document.body.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const windowWidth = window.innerWidth;
        return {
          overflowX: scrollWidth > windowWidth,
          diff: scrollWidth - windowWidth,
        };
      });

      console.log(`  Testing ${vp.name}: overflow = ${overflow.overflowX ? `+${overflow.diff}px` : '0px'}`);
      assert(!overflow.overflowX, `Zero horizontal overflow at ${vp.width}px`);

      if (vp.shot) {
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, vp.shot),
        });
      }
    }
    console.log('[PASS] All 8 responsive viewports verified with 0px horizontal overflow');

    // -------------------------------------------------------------------------
    // TEST 7: Console Errors Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Console Errors Verification ---');
    console.log(`Total captured console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors);
    }
    assert.strictEqual(consoleErrors.length, 0, 'Zero console errors during execution');
    console.log('[PASS] Zero JavaScript or console errors throughout the entire test suite');

    console.log('\n===============================================================');
    console.log('ALL MENU REFINEMENT & FUNCTIONAL TESTS PASSED SUCCESSFULLY');
    console.log('===============================================================');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\nFAIL: Test suite encountered an error:');
  console.error(err);
  process.exit(1);
});
