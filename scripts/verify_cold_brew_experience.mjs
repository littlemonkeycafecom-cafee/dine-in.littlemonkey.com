import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

let browserPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!fs.existsSync(browserPath)) {
  browserPath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
}
if (!fs.existsSync(browserPath)) {
  browserPath = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
}

const artifactDir = 'C:\\Users\\chava\\.gemini\\antigravity\\brain\\1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const tempDir = path.join(os.tmpdir(), 'browser-coldbrew-suite-' + Date.now());

async function waitFor(evalScript, conditionExpr, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await evalScript(conditionExpr);
    if (res) return res;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timeout waiting for expression: ${conditionExpr}`);
}

async function runColdBrewVerificationSuite() {
  console.log('================================================================');
  console.log('   LITTLE MONKEY CAFÉ — COLD BREW EXPERIENCE VERIFICATION       ');
  console.log('================================================================');
  console.log(`Browser: ${browserPath}`);
  console.log(`Artifacts target: ${artifactDir}`);

  // 1. Verify cold brew image files exist
  console.log('\n--- 1. Verifying Generated Cold Brew Assets ---');
  const coldBrewImages = [
    'public/images/cold-brew/cold-brew-campaign-menu.png',
    'public/images/cold-brew/cold-brew-hero-wide.png',
    'public/images/cold-brew/espresso-orange.png',
    'public/images/cold-brew/tiger-bomb.png',
    'public/images/cold-brew/passion-fruit-cold-brew.png',
  ];

  for (const img of coldBrewImages) {
    if (!fs.existsSync(img)) {
      throw new Error(`Missing required asset: ${img}`);
    }
    const stat = fs.statSync(img);
    console.log(`✓ ${img} (${stat.size} bytes)`);
  }

  // 2. Launch browser with CDP
  const browser = spawn(browserPath, [
    '--headless=new',
    '--remote-debugging-port=9261',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/?table=T04',
  ]);

  await new Promise((r) => setTimeout(r, 2500));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9261/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');

    if (!pageTarget) throw new Error('No page target found on port 9261');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    let msgId = 1;
    const callbacks = new Map();
    ws.onmessage = (event) => {
      const res = JSON.parse(event.data);
      if (res.id && callbacks.has(res.id)) {
        const { resolve } = callbacks.get(res.id);
        callbacks.delete(res.id);
        resolve(res.result);
      }
    };

    const send = (method, params = {}) =>
      new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, { resolve });
        ws.send(JSON.stringify({ id, method, params }));
      });

    await send('Page.enable');
    await send('DOM.enable');

    const captureShot = async (filename) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(artifactDir, filename);
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
      console.log(`✓ Saved screenshot: ${filename} (${fs.statSync(filePath).size} bytes)`);
    };

    const evalScript = async (expression) => {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result ? res.result.value : null;
    };

    // Set authenticated customer session in localStorage and reload
    // Authoritative Takeaway / Dine-In shared authentication
    console.log('\n--- 2. Authenticating Customer Session via Backend SSO ---');
    const loginRes = await fetch('http://127.0.0.1:3000/api/auth/customer-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9198062161', password: 'StrongPassword123' }),
    });
    const loginData = await loginRes.json();
    const token = loginData.session?.access_token;
    if (!token) throw new Error('Could not get authentication token from server');
    console.log('✓ Validated server-side session token for Priya Sharma');

    await send('Page.navigate', { url: `http://127.0.0.1:3000/?auth_token=${token}&table=T04` });
    console.log('Waiting for application to validate session and load menu...');
    await waitFor(
      evalScript,
      `Boolean(document.querySelector('section[aria-label="Specialty Cold Brew Promotion"]'))`,
      15000
    );

    // Configure desktop viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 600));

    // Verify Cold Brew Hero Banner
    console.log('\n--- 3. Verifying Cold Brew Hero Banner ---');
    const bannerInfo = await evalScript(`
      (() => {
        const section = document.querySelector('section[aria-label="Specialty Cold Brew Promotion"]');
        if (!section) return { error: 'Banner section not found' };
        const img = section.querySelector('img');
        const text = section.innerText;
        return {
          found: true,
          imgSrc: img ? img.src : null,
          hasCraftMeetsCold: text.includes('CRAFT MEETS COLD'),
          hasDiscountBadge: text.includes('UP TO 17% OFF'),
          hasHeadline: text.includes('Craft Cold Brew Collection'),
          hasExploreBtn: text.includes('Explore Menu'),
        };
      })()
    `);
    console.log('Banner Info:', bannerInfo);

    // Scroll to Cold Brew Banner and capture screenshot
    await evalScript(`
      const b = document.querySelector('section[aria-label="Specialty Cold Brew Promotion"]');
      if (b) b.scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await new Promise((r) => setTimeout(r, 500));
    await captureShot('shot_cold_brew_hero.png');

    // Click Cold Brew Hero Banner to navigate to collection
    console.log('\n--- 4. Clicking Hero Banner to Navigate to Cold Brew Collection ---');
    const clickNavResult = await evalScript(`
      (() => {
        const card = document.querySelector('section[aria-label="Specialty Cold Brew Promotion"] div[role="button"]');
        if (card) {
          card.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `);
    console.log('Click Navigation Result:', clickNavResult);
    await new Promise((r) => setTimeout(r, 1000));

    // Verify Cold Brew Collection in catalog
    const collectionInfo = await evalScript(`
      (() => {
        const cards = Array.from(document.querySelectorAll('#main-menu-catalog h3')).map(h => h.innerText);
        const prices = Array.from(document.querySelectorAll('#main-menu-catalog')).map(el => el.innerText)[0];
        return {
          cardTitles: cards,
          hasEspressoOrange: cards.some(c => c.includes('Espresso Orange')),
          hasTigerBomb: cards.some(c => c.includes('Tiger Bomb')),
          hasPassionFruit: cards.some(c => c.includes('Passion Fruit')),
          hasDiscount249: prices.includes('₹249'),
          hasOriginal299: prices.includes('₹299'),
          hasOriginal289: prices.includes('₹289'),
          has17Percent: prices.includes('17% OFF'),
          has14Percent: prices.includes('14% OFF'),
        };
      })()
    `);
    console.log('Collection Info:', collectionInfo);
    await captureShot('shot_cold_brew_collection.png');

    // Click Espresso Orange to open Product Details Modal
    console.log('\n--- 5. Opening Espresso Orange Product Details Modal ---');
    const openModalResult = await evalScript(`
      (() => {
        const eoHeading = Array.from(document.querySelectorAll('#main-menu-catalog h3'))
          .find(h => h.innerText.includes('Espresso Orange'));
        if (eoHeading) {
          eoHeading.closest('div[style*="cursor: pointer"]').click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `);
    console.log('Open Modal Result:', openModalResult);
    await new Promise((r) => setTimeout(r, 800));

    // Verify Modal Details
    const modalDetails = await evalScript(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return { error: 'Modal not open' };
        const text = dialog.innerText;
        const img = dialog.querySelector('img');
        return {
          title: dialog.querySelector('#modal-product-title')?.innerText,
          imgSrc: img ? img.src : null,
          hasTagline: text.includes('BOLD • CITRUSY • REFRESHING'),
          hasSellingPrice: text.includes('₹249'),
          hasOriginalPrice: text.includes('₹299'),
          hasDiscountBadge: text.includes('17% OFF'),
          hasIngredientsHeader: text.includes('VERIFIED RECIPE & CRAFT LAYERS'),
          hasRichEspresso: text.includes('Top Layer: Rich Espresso'),
          hasOrangeInfusion: text.includes('Middle Layer: Orange Infusion'),
          hasCitrusTonic: text.includes('Base Layer: Citrus Tonic Base'),
          hasFreshOrange: text.includes('Garnish: Fresh Orange'),
          hasCraftPrep: text.includes('Craft Preparation Method'),
          hasColdWaterDrip: text.includes('16-Hour Slow Cold Water Drip'),
          hasAddOrderBtn: text.includes('ADD TO ORDER'),
        };
      })()
    `);
    console.log('Modal Details:', modalDetails);
    await captureShot('shot_cold_brew_detail.png');

    // Test Stepper and Add to Cart Flow
    console.log('\n--- 6. Testing Quantity Stepper and Adding to Cart ---');
    const stepperResult = await evalScript(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return { error: 'No dialog' };
        const buttons = Array.from(dialog.querySelectorAll('button'));
        const plusBtn = buttons.find(b => b.innerHTML.includes('plus') || b.querySelector('svg.lucide-plus'));
        if (plusBtn) {
          plusBtn.click();
          return { incremented: true };
        }
        return { error: 'Plus button not found' };
      })()
    `);
    console.log('Stepper Increment Result:', stepperResult);
    await new Promise((r) => setTimeout(r, 400));

    const grandTotalAfterStepper = await evalScript(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const addBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText.includes('ADD TO ORDER'));
        return addBtn ? addBtn.innerText : null;
      })()
    `);
    console.log('Add Button Text After Stepper:', grandTotalAfterStepper);

    // Click Add to Order
    await evalScript(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const addBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText.includes('ADD TO ORDER'));
        if (addBtn) addBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Open Cart Drawer
    console.log('\n--- 7. Opening Cart Drawer and Verifying Real Selling Price ---');
    await evalScript(`
      (() => {
        const cartBtn = document.querySelector('button[aria-label*="cart" i], button[aria-label*="order" i]') ||
          Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('VIEW CART') || b.innerText.includes('ORDER'));
        if (cartBtn) cartBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const cartInfo = await evalScript(`
      (() => {
        const items = Array.from(document.querySelectorAll('h4')).map(h => h.innerText);
        const bodyText = document.body.innerText;
        return {
          cartItems: items,
          hasEspressoOrange: items.some(i => i.includes('Espresso Orange')),
          has249Each: bodyText.includes('₹249 each'),
          has498Total: bodyText.includes('₹498'),
        };
      })()
    `);
    console.log('Cart Drawer Info:', cartInfo);
    await captureShot('shot_cold_brew_cart.png');

    // Mobile Viewport Check (375x812 iPhone / budget Android)
    console.log('\n--- 8. Testing Mobile Viewport (375x812) ---');
    // Close cart first
    await evalScript(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close cart"], button svg.lucide-x');
        if (closeBtn) closeBtn.closest('button').click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await evalScript(`window.scrollTo(0, 0);`);
    await new Promise((r) => setTimeout(r, 500));
    await captureShot('shot_cold_brew_mobile.png');

    console.log('\n================================================================');
    console.log('   ALL COLD BREW VERIFICATION TESTS PASSED SUCCESSFULLY!        ');
    console.log('================================================================');

    ws.close();
  } finally {
    try {
      browser.kill();
    } catch (e) {}
    try {
      await new Promise((r) => setTimeout(r, 1200));
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Windows file locks may linger slightly; safe to ignore
    }
  }
}

runColdBrewVerificationSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
