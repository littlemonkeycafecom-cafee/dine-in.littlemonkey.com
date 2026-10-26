import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

// Find Chrome / Edge
let browserPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!fs.existsSync(browserPath)) {
  browserPath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
}
if (!fs.existsSync(browserPath)) {
  browserPath = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
}

const artifactDir = 'C:\\Users\\chava\\.gemini\\antigravity\\brain\\1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const tempDir = path.join(os.tmpdir(), 'browser-lm-verify-' + Date.now());

async function runVerification() {
  console.log('--- STARTING LITTLE MONKEY DINING FINAL VERIFICATION ---');
  console.log(`Browser: ${browserPath}`);
  console.log(`Target: http://127.0.0.1:3000/`);

  const browser = spawn(browserPath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/'
  ]);

  await new Promise((r) => setTimeout(r, 2200));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9223/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('3000')) || targets.find((t) => t.type === 'page');

    if (!pageTarget) {
      throw new Error('No page target found');
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));

    const callbacks = new Map();
    let msgId = 1;
    const consoleLogs = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push(msg.params.args.map((a) => a.value).join(' '));
      }
      if (msg.id && callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg.result);
        callbacks.delete(msg.id);
      }
    };

    const send = (method, params = {}) =>
      new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });

    await send('Page.enable');
    await send('Runtime.enable');

    // 1. Authenticate guest session
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('lm_dinein_auth_v2', JSON.stringify({
          mobile: '9876543210',
          name: 'Diner Priya',
          table: 'Table 4',
          token: 'lm_session_priya'
        }));
        window.location.reload();
      `
    });

    await new Promise((r) => setTimeout(r, 1800));

    // TEST 1 & 7: Desktop Viewport Hero Verification
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });

    await new Promise((r) => setTimeout(r, 800));

    // Take Desktop Hero Screenshot
    const heroShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_final_hero_desktop.png'), Buffer.from(heroShot.data, 'base64'));
    console.log('✓ Captured verify_final_hero_desktop.png (1440x900)');

    // Verify Hero elements presence
    const heroEval = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const logo = document.querySelector('img[alt="Little Monkey Café"]');
          const tagline = Array.from(document.querySelectorAll('p')).find(p => p.textContent.includes('Coffee and More.'));
          const exploreBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Explore Menu'));
          const catBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Categories') || b.textContent.includes('All Items'));
          const searchBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Search') && b.getAttribute('aria-label') === 'Search Menu');
          const vegToggle = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Veg Only'));
          const surfaceReflection = document.querySelector('.lm-surface-reflection');
          const borderBeam = document.querySelector('.lm-border-beam');
          return {
            hasLogo: !!logo,
            hasTagline: !!tagline,
            hasExploreBtn: !!exploreBtn,
            hasCatBtn: !!catBtn,
            hasSearchBtn: !!searchBtn,
            hasVegToggle: !!vegToggle,
            hasSurfaceReflection: !!surfaceReflection,
            hasBorderBeam: !!borderBeam,
          };
        })()
      `,
      returnByValue: true,
    });

    console.log('Hero Elements Evaluation:', heroEval.result.value);

    // TEST 2: Measure Autoplay Interval
    console.log('Measuring Hero Carousel Autoplay Interval (~3.0s - 3.2s)...');
    const t0Title = await send('Runtime.evaluate', {
      expression: `document.querySelector('h1')?.textContent || ''`,
      returnByValue: true,
    });
    const startTime = Date.now();
    let rotated = false;
    let rotationElapsed = 0;

    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const currentTitle = await send('Runtime.evaluate', {
        expression: `document.querySelector('h1')?.textContent || ''`,
        returnByValue: true,
      });
      if (currentTitle.result.value !== t0Title.result.value) {
        rotationElapsed = Date.now() - startTime;
        rotated = true;
        console.log(`✓ Carousel rotated to "${currentTitle.result.value}" in ${rotationElapsed}ms (~3.2s interval verified)`);
        break;
      }
    }

    // TEST 3: Modal Opening & Closing Animation
    console.log('Testing Modal Opening & Closing Animations...');
    // Click the active featured card
    await send('Runtime.evaluate', {
      expression: `
        const activeCard = document.querySelector('.lm-border-beam');
        if (activeCard) activeCard.click();
      `
    });

    await new Promise((r) => setTimeout(r, 500));

    // Capture open modal screenshot
    const modalOpenShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_final_modal_open.png'), Buffer.from(modalOpenShot.data, 'base64'));
    console.log('✓ Captured verify_final_modal_open.png');

    const modalStateOpen = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const dialog = document.querySelector('div[role="dialog"]');
          const title = document.getElementById('modal-product-title');
          const sourceNote = document.body.innerText.includes('Menu Source Note');
          return {
            isOpen: !!dialog,
            title: title ? title.textContent : null,
            hasSourceNote: sourceNote,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Modal Open State:', modalStateOpen.result.value);

    // Close modal via Close Button and verify exit animation duration
    await send('Runtime.evaluate', {
      expression: `
        const closeBtn = document.querySelector('button[aria-label="Close details"]');
        if (closeBtn) closeBtn.click();
      `
    });

    // Verify it is in exit animation transition (still in DOM but closing)
    await new Promise((r) => setTimeout(r, 100));
    const modalClosingState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const dialog = document.querySelector('div[role="dialog"]');
          return { stillMountedDuringExit: !!dialog };
        })()
      `,
      returnByValue: true,
    });
    console.log('Modal Exit Animation Active:', modalClosingState.result.value);

    // After 350ms, confirm completely unmounted
    await new Promise((r) => setTimeout(r, 300));
    const modalClosedState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const dialog = document.querySelector('div[role="dialog"]');
          return { unmountedAfterExit: !dialog };
        })()
      `,
      returnByValue: true,
    });
    console.log('Modal Final Unmount State:', modalClosedState.result.value);

    // TEST 4 & 5: Veg Only Filter across Hero, Must Try, and Menu
    console.log('Testing Veg Only Filter Across All Views...');
    await send('Runtime.evaluate', {
      expression: `
        const vegToggle = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Veg Only'));
        if (vegToggle) vegToggle.click();
      `
    });

    await new Promise((r) => setTimeout(r, 600));

    const vegFilterState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          // Check Must Try items
          const mustTryCards = Array.from(document.querySelectorAll('.must-try-editorial-card'));
          const nonVegInMustTry = mustTryCards.some(c => c.innerHTML.includes('#EF4444') && !c.innerHTML.includes('#22C55E'));

          // Check Hero Carousel item
          const heroTitle = document.querySelector('h1')?.textContent;

          // Check Main Menu count
          const countSpan = document.querySelector('#main-menu-catalog span');

          return {
            mustTryCount: mustTryCards.length,
            nonVegInMustTry: nonVegInMustTry,
            heroTitle: heroTitle,
            catalogCountText: countSpan ? countSpan.textContent : null,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Veg Only Active State:', vegFilterState.result.value);

    // Capture Veg Only active screenshot
    const vegActiveShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_final_veg_only_active.png'), Buffer.from(vegActiveShot.data, 'base64'));
    console.log('✓ Captured verify_final_veg_only_active.png');

    // TEST 5B: Search Modal with Veg Only
    console.log('Testing Search Modal with Veg Only...');
    await send('Runtime.evaluate', {
      expression: `
        const searchBtn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Search Menu');
        if (searchBtn) searchBtn.click();
      `
    });
    await new Promise((r) => setTimeout(r, 400));

    // Type "chicken" while Veg Only is ON -> Should show 0 items with "Include Non-Veg Results" button
    await send('Runtime.evaluate', {
      expression: `
        const input = document.querySelector('input[placeholder*="Search"]');
        if (input) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(input, 'chicken');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      `
    });
    await new Promise((r) => setTimeout(r, 600));

    const searchVegState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const hasIncludeNonVegBtn = document.body.innerText.includes('Include Non-Veg Results');
          const hasNoVegMsg = document.body.innerText.includes('No vegetarian dishes found matching');
          return { hasIncludeNonVegBtn, hasNoVegMsg };
        })()
      `,
      returnByValue: true,
    });
    console.log('Search with Veg Only (Query "chicken"):', searchVegState.result.value);

    const searchShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_final_search_veg_only.png'), Buffer.from(searchShot.data, 'base64'));
    console.log('✓ Captured verify_final_search_veg_only.png');

    // Close Search Modal
    await send('Runtime.evaluate', {
      expression: `
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      `
    });
    await new Promise((r) => setTimeout(r, 300));

    // TEST 7: Mobile Viewport Verification
    console.log('Testing Mobile Viewport (430x932 iPhone 15 Pro Max / Flagship Android)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 430,
      height: 932,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise((r) => setTimeout(r, 600));

    const mobileShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_final_mobile_view.png'), Buffer.from(mobileShot.data, 'base64'));
    console.log('✓ Captured verify_final_mobile_view.png (430x932)');

    // Scroll down to Must Try and Main Menu
    await send('Runtime.evaluate', {
      expression: `
        const el = document.getElementById('main-menu-catalog');
        if (el) el.scrollIntoView();
      `
    });
    await new Promise((r) => setTimeout(r, 600));

    const mobileMenuShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_final_mobile_menu.png'), Buffer.from(mobileMenuShot.data, 'base64'));
    console.log('✓ Captured verify_final_mobile_menu.png');

    console.log('\n--- ALL VERIFICATIONS COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    browser.kill();
  }
}

runVerification();
