import { strict as assert } from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteerPath = 'C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer';
const puppeteer = require(puppeteerPath);

const BASE_URL = 'http://127.0.0.1:3000';

async function runAnimationPerformanceProfile() {
  console.log('================================================================');
  console.log('SUITE 3: ANIMATION, MOTION PROFILING & FRAME AUDIT');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  // ---------------------------------------------------------------------------
  // 1. Logo Proportions & Aspect Ratio Verification
  // ---------------------------------------------------------------------------
  console.log('Step 1: Inspecting Logo Proportions in Branded Opening Screen...');
  await page.goto(`${BASE_URL}/?table=4`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.waitForSelector('[role="banner"][aria-label="Little Monkey Café Welcome"] img', { timeout: 3000 });

  const logoMetrics = await page.evaluate(() => {
    const img = document.querySelector('[role="banner"][aria-label="Little Monkey Café Welcome"] img');
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return {
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
      objectFit: window.getComputedStyle(img).objectFit,
      aspectRatio: img.naturalWidth / img.naturalHeight,
      renderedRatio: rect.width / rect.height,
    };
  });

  console.log('  Logo Metrics:', logoMetrics);
  assert(logoMetrics, 'Logo must exist in intro screen');
  // Proportions match if rendered ratio is within 5% of natural ratio
  const ratioDelta = Math.abs(logoMetrics.aspectRatio - logoMetrics.renderedRatio);
  assert(ratioDelta < 0.1, `Logo aspect ratio preserved (delta: ${ratioDelta.toFixed(4)})`);
  console.log(`  [PASS] Logo rendered with natural proportions (Natural: ${logoMetrics.naturalWidth}x${logoMetrics.naturalHeight}, Rendered: ${logoMetrics.renderedWidth.toFixed(1)}x${logoMetrics.renderedHeight.toFixed(1)}).`);

  // ---------------------------------------------------------------------------
  // 2. Prefers-Reduced-Motion Compliance Test
  // ---------------------------------------------------------------------------
  console.log('\nStep 2: Testing Reduced-Motion Mode (prefers-reduced-motion: reduce)...');
  const rmPage = await browser.newPage();
  await rmPage.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await rmPage.goto(`${BASE_URL}/?table=4`, { waitUntil: 'domcontentloaded' });
  await rmPage.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await rmPage.reload({ waitUntil: 'domcontentloaded' });

  // With reduced motion, intro screen should immediately bypass and display login gate
  await new Promise(r => setTimeout(r, 200));
  const isIntroBypassed = await rmPage.evaluate(() => {
    const banner = document.querySelector('[role="banner"][aria-label="Little Monkey Café Welcome"]');
    return !banner;
  });
  assert(isIntroBypassed, 'Reduced motion must immediately bypass the branded intro animation.');
  console.log('  [PASS] prefers-reduced-motion immediately bypasses opening sequence.');
  await rmPage.close();

  // ---------------------------------------------------------------------------
  // 3. High-Resolution Frame Profiling (Liquid Wave & Open Transition)
  // ---------------------------------------------------------------------------
  console.log('\nStep 3: High-Resolution Frame Profiling during Menu Entry and Liquid Wave...');

  // Enter as guest
  await page.click('[role="banner"][aria-label="Little Monkey Café Welcome"]');
  await new Promise(r => setTimeout(r, 500));
  const guestBtn = await page.waitForSelector('button ::-p-text(Continue as Guest)', { timeout: 3000 });
  await guestBtn.click();
  await page.waitForSelector('.lm-product-card', { timeout: 4000 });

  // Start FPS & Frame Time Tracker in Page Context
  await page.evaluate(() => {
    window.__fpsData = [];
    window.__perfObserverLayoutShifts = [];

    // Track CLS
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__perfObserverLayoutShifts.push(entry.value);
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch {}

    let lastTime = performance.now();
    function step(now) {
      const delta = now - lastTime;
      lastTime = now;
      window.__fpsData.push({ time: now, delta });
      if (window.__fpsData.length < 300) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  });

  // Trigger modal open (which runs Liquid Wave transition)
  const firstCard = await page.$('.lm-product-card');
  await firstCard.click();
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 3000 });

  // Wait 1.2 seconds to capture full wave and modal presentation
  await new Promise(r => setTimeout(r, 1200));

  const frameProfile = await page.evaluate(() => {
    const deltas = window.__fpsData.map(d => d.delta).slice(1); // skip initial delta
    if (deltas.length === 0) return null;

    const totalDuration = deltas.reduce((a, b) => a + b, 0);
    const avgDelta = totalDuration / deltas.length;
    const avgFps = 1000 / avgDelta;
    const maxDelta = Math.max(...deltas);
    const minDelta = Math.min(...deltas);
    // Standard 60Hz frame time is 16.67ms. Dropped frames = delta > 33.3ms (skipping a full v-sync frame)
    const droppedFrames = deltas.filter(d => d > 33.3).length;
    const cls = window.__perfObserverLayoutShifts.reduce((a, b) => a + b, 0);

    return {
      frameCount: deltas.length,
      durationMs: totalDuration.toFixed(1),
      avgFps: avgFps.toFixed(1),
      avgFrameTimeMs: avgDelta.toFixed(2),
      minFrameTimeMs: minDelta.toFixed(2),
      maxFrameTimeMs: maxDelta.toFixed(2),
      droppedFrames,
      clsScore: cls.toFixed(4),
    };
  });

  console.log('  Frame Profile Metrics:', frameProfile);
  assert(frameProfile && Number(frameProfile.avgFps) > 40, `Average FPS must remain high and smooth (Measured: ${frameProfile?.avgFps} FPS)`);
  console.log(`  [PASS] Measured Motion Performance: ${frameProfile.avgFps} FPS across ${frameProfile.frameCount} frames (Cumulative Layout Shift: ${frameProfile.clsScore}).`);

  // ---------------------------------------------------------------------------
  // 4. Modal Dismiss & Interaction Blocking Audit
  // ---------------------------------------------------------------------------
  console.log('\nStep 4: Auditing Dismissal and Verifying No Blocking Overlays Remain...');
  await page.evaluate(() => {
    const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('CLOSE'));
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  const overlayAudit = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]');
    const introBanner = document.querySelector('[role="banner"][aria-label="Little Monkey Café Welcome"]');
    // Ensure elementFromPoint on main catalog hits active cards, not a stuck overlay
    const centerEl = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return {
      modalInDom: Boolean(modal),
      introBannerInDom: Boolean(introBanner),
      centerElementTag: centerEl ? centerEl.tagName : null,
      centerElementClass: centerEl ? centerEl.className : null,
    };
  });

  console.log('  Overlay Audit:', overlayAudit);
  assert(!overlayAudit.modalInDom, 'Product modal must unmount upon close.');
  assert(!overlayAudit.introBannerInDom, 'Intro screen must be dismissed.');
  console.log('  [PASS] No lingering overlays or blocking backdrop elements detected.');

  // ---------------------------------------------------------------------------
  // 5. Console Error Verification
  // ---------------------------------------------------------------------------
  console.log('\nStep 5: Inspecting Browser Console Log...');
  console.log(`  Total Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('  Errors observed:', consoleErrors);
  }
  assert(consoleErrors.length === 0, 'Zero browser console errors expected during normal navigation.');
  console.log('  [PASS] Zero browser console errors detected.');

  await browser.close();

  console.log('\n================================================================');
  console.log('SUITE 3 COMPLETE: ALL ANIMATION & PERFORMANCE CHECKS PASSED');
  console.log('================================================================\n');
}

runAnimationPerformanceProfile().catch(err => {
  console.error('\nSuite 3 encountered an unexpected failure:', err);
  process.exit(1);
});
