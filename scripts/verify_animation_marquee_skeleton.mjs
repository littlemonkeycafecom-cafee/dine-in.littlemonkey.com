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
const tempDir = path.join(os.tmpdir(), 'browser-lm-anim-verify-' + Date.now());

async function runVerification() {
  console.log('--- STARTING ANIMATION, MARQUEE & SKELETON VERIFICATION ---');
  console.log(`Browser: ${browserPath}`);
  console.log(`Target: http://127.0.0.1:3000/`);

  const browser = spawn(browserPath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/'
  ]);

  await new Promise((r) => setTimeout(r, 2500));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9225/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('3000')) || targets.find((t) => t.type === 'page');

    if (!pageTarget) {
      throw new Error('No page target found at port 9225');
    }

    const wsUrl = pageTarget.webSocketDebuggerUrl;
    console.log(`Connected to page target: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let id = 1;
    const callbacks = new Map();
    ws.onmessage = (event) => {
      const res = JSON.parse(event.data);
      if (res.id && callbacks.has(res.id)) {
        const { resolve, reject } = callbacks.get(res.id);
        callbacks.delete(res.id);
        if (res.error) reject(res.error);
        else resolve(res.result);
      }
    };

    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const msgId = id++;
        callbacks.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });

    await send('Page.enable');
    await send('DOM.enable');
    await send('CSS.enable');
    await send('Runtime.enable');

    // Set Desktop viewport 1280x850
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 850,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // Authenticate guest session and reload to access main dining app
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('lm_dinein_auth_v2', JSON.stringify({
          mobile: '9876543210',
          name: 'Diner Priya',
          table: 'Table 4',
          token: 'lm_session_priya'
        }));
        sessionStorage.setItem('lm_intro_animation_played', 'true');
        window.location.reload();
      `,
    });

    await new Promise((r) => setTimeout(r, 2000));

    // 1. Verify Brand Marquee
    console.log('\n--- 1. VERIFY BRAND MARQUEE ---');
    const marqueeAudit = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const strip = document.querySelector('.scrolling-brand-strip');
          const stream = document.querySelector('.marquee-content-stream');
          const halves = document.querySelectorAll('.marquee-half');
          const items = document.querySelectorAll('.marquee-item');
          
          if (!strip || !stream) {
            return { error: 'Marquee strip or stream missing' };
          }
          
          const text = items[0] ? items[0].innerText.replace(/\\s+/g, ' ').trim() : '';
          const forbidden = ['FRESH BITES', 'ARTISANAL PIZZAS', 'HANDCRAFTED BURGERS', 'SPECIALTY BREWS'];
          const hasForbidden = forbidden.some(f => strip.innerText.toUpperCase().includes(f));
          
          const computed = window.getComputedStyle(stream);
          const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
          
          return {
            exists: true,
            halvesCount: halves.length,
            itemsCount: items.length,
            itemText: text,
            animationName: computed.animationName,
            animationDuration: computed.animationDuration,
            animationTiming: computed.animationTimingFunction,
            hasForbidden,
            hasOverflow,
            scrollWidth: document.documentElement.scrollWidth,
            windowWidth: window.innerWidth
          };
        })()
      `,
      returnByValue: true,
    });

    console.log('Marquee Audit Result:', JSON.stringify(marqueeAudit.result.value, null, 2));

    // 2. Verify Hero Carousel Smooth Movement & Logo Aura
    console.log('\n--- 2. VERIFY HERO CAROUSEL & YELLOW BRAND MOTION ---');
    const heroAudit1 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const logoImg = document.querySelector('.lm-logo-ambient-img');
          const logoWrap = document.querySelector('.lm-logo-ambient-wrap');
          const activeCard = document.querySelector('.lm-border-beam');
          const surfaceReflect = document.querySelector('.lm-surface-reflection');
          
          // Get card title and transition style
          const cards = document.querySelectorAll('section > div:nth-child(4) > div > div');
          let activeTitle = '';
          const titleEl = document.querySelector('h3');
          if (titleEl) activeTitle = titleEl.innerText;
          
          let cardTransition = '';
          if (activeCard) {
            cardTransition = window.getComputedStyle(activeCard).transition;
          }
          
          return {
            hasLogoWrap: !!logoWrap,
            hasLogoImgClass: !!logoImg,
            hasActiveCardBorderBeam: !!activeCard,
            hasSurfaceReflection: !!surfaceReflect,
            cardTransition,
            activeTitle
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Hero State 1:', JSON.stringify(heroAudit1.result.value, null, 2));

    // Wait ~3.4s to verify auto-rotation advances to next item smoothly
    console.log('Waiting 3.4s for autonomous carousel glide...');
    await new Promise((r) => setTimeout(r, 3400));

    const heroAudit2 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const titleEl = document.querySelector('h3');
          const activeCard = document.querySelector('.lm-border-beam');
          return {
            activeTitleAfterRotation: titleEl ? titleEl.innerText : '',
            hasActiveCardBorderBeam: !!activeCard,
            cardStyle: activeCard ? activeCard.getAttribute('style') : ''
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Hero State 2 (after 3.4s):', JSON.stringify(heroAudit2.result.value, null, 2));

    // Capture Desktop Marquee & Hero Screenshot
    const ss1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_marquee_and_hero.png'), Buffer.from(ss1.data, 'base64'));
    console.log('Saved screenshot: verify_marquee_and_hero.png');

    // 3. Verify SkeletonCard & Shimmer Animation
    console.log('\n--- 3. VERIFY SKELETONCARD & SHIMMER ANIMATION ---');
    // Click category to trigger transition and immediately inspect SkeletonCard
    const skeletonAudit = await send('Runtime.evaluate', {
      expression: `
        (() => {
          // Find Burgers category button and click it
          const buttons = Array.from(document.querySelectorAll('#main-menu-catalog button'));
          const burgerBtn = buttons.find(b => b.innerText.includes('Burgers'));
          if (burgerBtn) burgerBtn.click();
          
          // Check if SkeletonCards render
          const skeletons = document.querySelectorAll('.animate-shimmer');
          const skeletonCard = document.querySelector('div[aria-label="Loading menu items"]');
          
          let firstSkeletonBg = '';
          let firstSkeletonAnim = '';
          if (skeletons.length > 0) {
            const comp = window.getComputedStyle(skeletons[0]);
            firstSkeletonBg = comp.backgroundImage || comp.backgroundColor;
            firstSkeletonAnim = comp.animationName;
          }
          
          return {
            burgerBtnFound: !!burgerBtn,
            skeletonContainerFound: !!skeletonCard,
            skeletonElementsCount: skeletons.length,
            firstSkeletonBg,
            firstSkeletonAnim
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Skeleton Inspection during transition:', JSON.stringify(skeletonAudit.result.value, null, 2));

    // Capture Skeleton Shimmer screenshot immediately
    const ss2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_skeleton_shimmer_dark.png'), Buffer.from(ss2.data, 'base64'));
    console.log('Saved screenshot: verify_skeleton_shimmer_dark.png');

    // Wait for transition to complete and dishes to appear
    await new Promise((r) => setTimeout(r, 800));

    const postTransitionAudit = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const productCards = document.querySelectorAll('#main-menu-catalog div[style*="minmax"] > div');
          return {
            productCountRendered: productCards.length,
            headerText: document.querySelector('#main-menu-catalog h2') ? document.querySelector('#main-menu-catalog h2').innerText : ''
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Menu after transition:', JSON.stringify(postTransitionAudit.result.value, null, 2));

    // 4. Verify Mobile Viewport
    console.log('\n--- 4. VERIFY MOBILE VIEWPORT (390x844) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await new Promise((r) => setTimeout(r, 1000));

    const mobileAudit = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
          const strip = document.querySelector('.scrolling-brand-strip');
          return {
            hasOverflow,
            scrollWidth: document.documentElement.scrollWidth,
            windowWidth: window.innerWidth,
            marqueeVisible: !!strip && strip.offsetHeight > 0
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Mobile Viewport Audit:', JSON.stringify(mobileAudit.result.value, null, 2));

    const ss3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_mobile_fluid_experience.png'), Buffer.from(ss3.data, 'base64'));
    console.log('Saved screenshot: verify_mobile_fluid_experience.png');

    ws.close();
    browser.kill();

    console.log('\n--- ALL VERIFICATIONS COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Verification error:', err);
    browser.kill();
    process.exit(1);
  }
}

runVerification();
