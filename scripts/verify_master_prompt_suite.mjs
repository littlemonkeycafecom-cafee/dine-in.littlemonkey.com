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
const tempDir = path.join(os.tmpdir(), 'browser-master-suite-' + Date.now());

async function runMasterSuite() {
  console.log('================================================================');
  console.log('   LITTLE MONKEY CAFÉ DINING — MASTER AUTOMATED TEST SUITE      ');
  console.log('================================================================');
  console.log(`Browser: ${browserPath}`);
  console.log(`Target: http://127.0.0.1:3000/`);

  const browser = spawn(browserPath, [
    '--headless=new',
    '--remote-debugging-port=9230',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/'
  ]);

  await new Promise((r) => setTimeout(r, 2200));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9230/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');

    if (!pageTarget) throw new Error('No page target found');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => { ws.onopen = resolve; });

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
    await send('Runtime.enable');

    // Authenticate guest session
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('lm_dinein_auth_v2', JSON.stringify({
          mobile: '9876543210',
          name: 'Priya Sharma',
          table: 'Table 4',
          token: 'lm_session_priya'
        }));
        sessionStorage.setItem('lm_intro_animation_played', 'true');
        window.location.reload();
      `
    });

    // Wait for full page readiness after reload
    await new Promise((r) => setTimeout(r, 2600));

    // TEST 1: Desktop Viewport & Hero Composition
    console.log('\n>>> [TEST 1] DESKTOP HERO & YELLOW BRAND MOTION');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 600));

    const heroCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const logoWrap = document.querySelector('.lm-logo-ambient-wrap');
          const logoImg = document.querySelector('.lm-logo-ambient-img');
          const borderBeam = document.querySelector('.lm-border-beam');
          const surfaceReflection = document.querySelector('.lm-surface-reflection');
          const title = document.querySelector('h1') ? document.querySelector('h1').innerText : '';
          const activeCard = document.querySelector('.lm-border-beam');
          const cardStyle = activeCard ? window.getComputedStyle(activeCard) : null;
          
          return {
            hasLogoWrap: !!logoWrap,
            hasLogoImgAnimation: !!logoImg,
            hasBorderBeam: !!borderBeam,
            hasSurfaceReflection: !!surfaceReflection,
            activeTitle: title,
            boxShadow: cardStyle ? cardStyle.boxShadow : ''
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Hero Check Result:', JSON.stringify(heroCheck.result.value, null, 2));

    const ssHero = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_desktop_hero_gliding.png'), Buffer.from(ssHero.data, 'base64'));
    console.log('Saved: verify_desktop_hero_gliding.png');

    // TEST 2: Carousel Autonomous Rotation
    console.log('\n>>> [TEST 2] CAROUSEL AUTONOMOUS ROTATION (~3.2s glide)');
    const initialTitle = heroCheck.result.value.activeTitle;
    console.log(`Initial active title: "${initialTitle}"`);
    console.log('Waiting 3.4 seconds for smooth auto-advance...');
    await new Promise((r) => setTimeout(r, 3400));

    const heroAfterRotate = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const title = document.querySelector('h1') ? document.querySelector('h1').innerText : '';
          return { currentTitle: title };
        })()
      `,
      returnByValue: true,
    });
    console.log('Active title after 3.4s:', heroAfterRotate.result.value.currentTitle);

    const ssRotate = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_carousel_rotation_advanced.png'), Buffer.from(ssRotate.data, 'base64'));
    console.log('Saved: verify_carousel_rotation_advanced.png');

    // TEST 3: Brand Marquee
    console.log('\n>>> [TEST 3] SCROLLING BRAND MARQUEE');
    const marqueeCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const strip = document.querySelector('.scrolling-brand-strip');
          const items = document.querySelectorAll('.marquee-item');
          const text = items[0] ? items[0].innerText.replace(/\\s+/g, ' ').trim() : '';
          const stream = document.querySelector('.marquee-content-stream');
          const computed = stream ? window.getComputedStyle(stream) : null;
          const forbidden = ['FRESH BITES', 'ARTISANAL PIZZAS', 'HANDCRAFTED BURGERS', 'SPECIALTY BREWS'];
          const hasForbidden = forbidden.some(f => (strip ? strip.innerText.toUpperCase().includes(f) : false));
          const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
          
          return {
            exists: !!strip,
            itemText: text,
            animationName: computed ? computed.animationName : '',
            animationDuration: computed ? computed.animationDuration : '',
            hasForbidden,
            hasOverflow
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Marquee Result:', JSON.stringify(marqueeCheck.result.value, null, 2));

    const ssMarquee = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_brand_marquee_scrolling.png'), Buffer.from(ssMarquee.data, 'base64'));
    console.log('Saved: verify_brand_marquee_scrolling.png');

    // TEST 4: Veg Only Toggle & Universal Filtering
    console.log('\n>>> [TEST 4] VEG ONLY FILTER & BRAND YELLOW ACCENT');
    const vegActivate = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const vegBtn = document.querySelector('button[aria-label*=\"Filter vegetarian\"], button[aria-label*=\"vegetarian\"]');
          if (vegBtn) {
            vegBtn.click();
            return { clicked: true };
          }
          return { clicked: false };
        })()
      `,
      returnByValue: true,
    });
    console.log('Veg toggle clicked:', vegActivate.result.value);

    await new Promise((r) => setTimeout(r, 600));

    const vegAudit = await send('Runtime.evaluate', {
      expression: `
        (() => {
          // Check visible products in Menu Section
          const menuSection = document.getElementById('main-menu-catalog');
          const productCards = menuSection ? Array.from(menuSection.querySelectorAll('div[style*=\"minmax\"] > div')) : [];
          
          // Check dietary indicators
          let nonVegFound = false;
          productCards.forEach(card => {
            if (card.innerText.includes('NON-VEG') || card.querySelector('div[style*=\"rgb(239, 68, 68)\"]')) {
              nonVegFound = true;
            }
          });
          
          // Check Hero Veg button styling
          const heroVegBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Veg Only'));
          const btnComp = heroVegBtn ? window.getComputedStyle(heroVegBtn) : null;
          
          return {
            totalDishesRendered: productCards.length,
            nonVegFoundInMenu: nonVegFound,
            buttonBorder: btnComp ? btnComp.borderColor : '',
            buttonBoxShadow: btnComp ? btnComp.boxShadow : ''
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Veg Audit Result:', JSON.stringify(vegAudit.result.value, null, 2));

    const ssVegToolbar = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_veg_only_active_toolbar.png'), Buffer.from(ssVegToolbar.data, 'base64'));
    console.log('Saved: verify_veg_only_active_toolbar.png');

    // Scroll to menu section for screenshot
    await send('Runtime.evaluate', {
      expression: `document.getElementById('main-menu-catalog').scrollIntoView();`
    });
    await new Promise((r) => setTimeout(r, 400));

    const ssVegMenu = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_veg_only_filtered_menu.png'), Buffer.from(ssVegMenu.data, 'base64'));
    console.log('Saved: verify_veg_only_filtered_menu.png');

    // TEST 5: Product Details Modal & Source Note Sanitization
    console.log('\n>>> [TEST 5] PRODUCT DETAILS MODAL (ZERO SOURCE NOTES)');
    const modalOpen = await send('Runtime.evaluate', {
      expression: `
        (() => {
          // Find French Fries card and click it
          const cards = Array.from(document.querySelectorAll('#main-menu-catalog div[style*=\"minmax\"] > div'));
          const frenchFries = cards.find(c => c.innerText.includes('French Fries'));
          if (frenchFries) {
            frenchFries.click();
            return { opened: true, title: 'French Fries' };
          }
          if (cards[0]) {
            cards[0].click();
            return { opened: true, title: 'First Card' };
          }
          return { opened: false };
        })()
      `,
      returnByValue: true,
    });
    console.log('Modal trigger result:', modalOpen.result.value);

    await new Promise((r) => setTimeout(r, 600));

    const modalAudit = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const modalTitle = document.getElementById('modal-product-title');
          const modalText = document.querySelector('div[role=\"dialog\"]') ? document.querySelector('div[role=\"dialog\"]').innerText : '';
          
          const forbiddenStrings = ['SOURCE NOTE', 'VERIFY EXACT', 'AS EXTRACTED', 'NOTE: TWO SIZES', 'OCR'];
          const foundForbidden = forbiddenStrings.filter(s => modalText.toUpperCase().includes(s));
          
          return {
            title: modalTitle ? modalTitle.innerText : '',
            hasForbiddenSourceNotes: foundForbidden.length > 0,
            foundForbiddenList: foundForbidden,
            descriptionSnippet: modalText.substring(0, 160)
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Modal Audit Result:', JSON.stringify(modalAudit.result.value, null, 2));

    const ssModal = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_product_modal_no_notes.png'), Buffer.from(ssModal.data, 'base64'));
    console.log('Saved: verify_product_modal_no_notes.png');

    // Close modal
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const closeBtn = document.querySelector('button[aria-label=\"Close details\"]');
          if (closeBtn) closeBtn.click();
        })()
      `
    });
    await new Promise((r) => setTimeout(r, 400));

    // TEST 6: Public Customer Reviews Section
    console.log('\n>>> [TEST 6] PUBLIC CUSTOMER REVIEWS SECTION');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const revSection = document.querySelector('.lm-editorial-reviews');
          if (revSection) revSection.scrollIntoView();
        })()
      `
    });
    await new Promise((r) => setTimeout(r, 500));

    const reviewsAudit = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const section = document.querySelector('.lm-editorial-reviews');
          const cards = document.querySelectorAll('.review-card');
          const writeBtn = document.querySelector('.lm-write-review-btn');
          const authors = Array.from(document.querySelectorAll('.review-author-name')).map(a => a.innerText);
          
          return {
            sectionExists: !!section,
            reviewsCount: cards.length,
            writeBtnExists: !!writeBtn,
            authorsList: authors
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Reviews Audit Result:', JSON.stringify(reviewsAudit.result.value, null, 2));

    const ssReviews = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_public_editorial_reviews.png'), Buffer.from(ssReviews.data, 'base64'));
    console.log('Saved: verify_public_editorial_reviews.png');

    // TEST 7: Mobile Viewport Responsiveness & Sign-In Icon (360px & 320px)
    console.log('\n>>> [TEST 7] MOBILE VIEWPORT RESPONSIVENESS (360px & 320px)');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 800,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, 0);` });
    await new Promise((r) => setTimeout(r, 600));

    const mobile360Audit = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
          const userBtn = document.querySelector('header button[aria-label*=\"Account\"], header button[aria-label*=\"Sign In\"]');
          const cartBtn = document.querySelector('header button[aria-label=\"View Cart\"]');
          
          return {
            viewportWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            hasOverflow,
            userBtnVisible: !!userBtn && userBtn.offsetWidth > 0,
            cartBtnVisible: !!cartBtn && cartBtn.offsetWidth > 0
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Mobile 360px Result:', JSON.stringify(mobile360Audit.result.value, null, 2));

    const ssMobile360 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_mobile_360_header_signin.png'), Buffer.from(ssMobile360.data, 'base64'));
    console.log('Saved: verify_mobile_360_header_signin.png');

    // Ultra-narrow 320px check
    await send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 700,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise((r) => setTimeout(r, 500));

    const mobile320Audit = await send('Runtime.evaluate', {
      expression: `
        (() => {
          return {
            viewportWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            hasOverflow: document.documentElement.scrollWidth > window.innerWidth
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Mobile 320px Result:', JSON.stringify(mobile320Audit.result.value, null, 2));

    const ssMobile320 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_mobile_320_no_overflow.png'), Buffer.from(ssMobile320.data, 'base64'));
    console.log('Saved: verify_mobile_320_no_overflow.png');

    ws.close();
    browser.kill();
    console.log('\n================================================================');
    console.log('   ALL MASTER SUITE TESTS & SCREENSHOTS COMPLETED!              ');
    console.log('================================================================');
  } catch (err) {
    console.error('Master Suite Error:', err);
    browser.kill();
    process.exit(1);
  }
}

runMasterSuite();
