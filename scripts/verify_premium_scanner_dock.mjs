import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const PROJECT_ARTIFACT_DIR = path.resolve('test_artifacts/premium_scanner_dock');
const CONV_ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/0844d1de-cdde-43df-8637-b53dd2806014/screenshots';
const BASE_URL = 'http://127.0.0.1:3000';

fs.mkdirSync(PROJECT_ARTIFACT_DIR, { recursive: true });
fs.mkdirSync(CONV_ARTIFACT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '320px_iphone_se', width: 320, height: 568 },
  { name: '360px_galaxy_s20', width: 360, height: 780 },
  { name: '375px_iphone_se3', width: 375, height: 667 },
  { name: '390px_iphone_14', width: 390, height: 844 },
  { name: '412px_pixel_7', width: 412, height: 915 },
  { name: '768px_tablet', width: 768, height: 1024 },
  { name: '1024px_ipad_pro', width: 1024, height: 768 },
  { name: '1280px_macbook', width: 1280, height: 800 },
  { name: '1440px_desktop_hd', width: 1440, height: 900 },
  { name: '1920px_desktop_fhd', width: 1920, height: 1080 },
];

async function runPremiumDockVerification() {
  console.log('================================================================');
  console.log('STARTING PREMIUM QR SCANNER DOCK VERIFICATION SUITE');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });

  const context = browser.defaultBrowserContext();
  await context.overridePermissions(BASE_URL, ['camera']);

  const summary = {
    exactHeadingVerified: false,
    zeroExtraDockIcons: false,
    singleCustomerScannerButton: false,
    dockVisualContourVerified: false,
    springKeyframesPresent: false,
    cameraStreamActiveOnOpen: false,
    cameraTracksTerminatedOnExit: false,
    cameraReopensCleanly: false,
    viewportsTested: [],
  };

  const page = await browser.newPage();

  // Bypass first-time intro screen
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('lm_dinein_intro_seen', 'true');
  });

  // --- TEST 1: Landing Page Typography & No Extra Dock Icons ---
  console.log('--- TEST 1: Typography & Single Central Interactive Element ---');
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 600));

  const pageInfo = await page.evaluate(() => {
    const heading = document.querySelector('h1')?.textContent?.trim() || '';
    const bodyText = document.body.innerText;
    
    // Check dock
    const nav = document.querySelector('nav[aria-label="Dining Primary Scanner Navigation"]');
    const dockButtons = nav ? Array.from(nav.querySelectorAll('button')) : [];
    const dockLinks = nav ? Array.from(nav.querySelectorAll('a')) : [];
    const extraIcons = Array.from(nav?.querySelectorAll('svg') || []).length;
    
    // Check for customer scanner buttons
    const allButtons = Array.from(document.querySelectorAll('button')).filter((b) => {
      const text = (b.textContent || '').toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return (
        text.includes('scan table') ||
        text.includes('open scanner') ||
        aria.includes('scan table qr')
      );
    });

    return {
      heading,
      dockButtonsCount: dockButtons.length,
      dockLinksCount: dockLinks.length,
      dockSvgCount: extraIcons,
      totalCustomerScannerButtons: allButtons.length,
      hasOrderingLanguage:
        bodyText.includes('table ordering') ||
        bodyText.includes('place your table order') ||
        bodyText.includes('order your food') ||
        bodyText.includes('ordering from your table'),
    };
  });

  console.log(`[PASS] Heading: "${pageInfo.heading}"`);
  summary.exactHeadingVerified = pageInfo.heading === 'Welcome to Little Monkey Dining';
  summary.singleCustomerScannerButton = pageInfo.totalCustomerScannerButtons === 1;
  summary.zeroExtraDockIcons = pageInfo.dockButtonsCount === 1 && pageInfo.dockLinksCount === 0;

  console.log(`[PASS] Total customer scanner buttons: ${pageInfo.totalCustomerScannerButtons} (Expected: 1)`);
  console.log(`[PASS] Dock interactive elements: ${pageInfo.dockButtonsCount} (Expected: 1)`);
  console.log(`[PASS] Zero extra nav buttons/links in dock: ${summary.zeroExtraDockIcons}`);

  // --- TEST 2: Yellow Scanner Dock Structure & Contoured Geometry ---
  console.log('\n--- TEST 2: Yellow Scanner Dock Contour & Geometry ---');
  const dockVisuals = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Dining Primary Scanner Navigation"]');
    const dockWrap = nav?.querySelector('.lm-scanner-dock-wrap');
    const dockSvg = dockWrap?.querySelector('svg');
    const path = dockSvg?.querySelector('path');
    const btn = dockWrap?.querySelector('button.lm-scanner-dock-btn');
    const btnSvg = btn?.querySelector('svg');

    return {
      dockExists: !!dockWrap,
      svgExists: !!dockSvg,
      pathD: path?.getAttribute('d') || '',
      btnExists: !!btn,
      btnTop: btn ? window.getComputedStyle(btn).top : '',
      btnWidth: btn ? window.getComputedStyle(btn).width : '',
      btnHeight: btn ? window.getComputedStyle(btn).height : '',
      btnBorder: btn ? window.getComputedStyle(btn).border : '',
      reticlePaths: btnSvg ? Array.from(btnSvg.querySelectorAll('path')).length : 0,
    };
  });

  console.log(`[DOCK] SVG Path present: ${dockVisuals.pathD.includes('M 32,0')}`);
  console.log(`[BUTTON] Diameter: ${dockVisuals.btnWidth} x ${dockVisuals.btnHeight} | Elevated top: ${dockVisuals.btnTop}`);
  console.log(`[RETICLE] White corner brackets count: ${dockVisuals.reticlePaths}`);
  summary.dockVisualContourVerified =
    dockVisuals.dockExists &&
    dockVisuals.btnExists &&
    dockVisuals.reticlePaths === 4 &&
    dockVisuals.pathD.includes('M 32,0');

  // --- TEST 3: iPhone-Style Spring Keyframes in CSS ---
  console.log('\n--- TEST 3: iPhone-Style Spring Keyframe Motion Verification ---');
  const springRules = await page.evaluate(() => {
    let hasButtonSpring = false;
    let hasDockSpring = false;
    let hasScannerSpring = false;

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule.name === 'lmIosButtonSpring') hasButtonSpring = true;
          if (rule.name === 'lmIosDockSpring') hasDockSpring = true;
          if (rule.name === 'lmScannerSpringRise') hasScannerSpring = true;
        }
      } catch {}
    }
    return { hasButtonSpring, hasDockSpring, hasScannerSpring };
  });

  console.log(`[SPRING] lmIosButtonSpring: ${springRules.hasButtonSpring}`);
  console.log(`[SPRING] lmIosDockSpring: ${springRules.hasDockSpring}`);
  console.log(`[SPRING] lmScannerSpringRise: ${springRules.hasScannerSpring}`);
  summary.springKeyframesPresent =
    springRules.hasButtonSpring &&
    springRules.hasDockSpring &&
    springRules.hasScannerSpring;

  // --- TEST 4: Comprehensive Camera Lifecycle & Complete Teardown ---
  console.log('\n--- TEST 4: Camera Lifecycle, Active Stream & Complete Track Teardown ---');
  
  // Step A: Tap the central circular button
  console.log('[ACTION] Tapping elevated circular scanner button...');
  const scannerBtn = await page.$('.lm-scanner-dock-btn');
  await scannerBtn.click();

  // Wait for scanner to mount and camera to initialize
  await page.waitForSelector('video', { timeout: 4000 });
  await new Promise((r) => setTimeout(r, 1200));

  const liveCameraState = await page.evaluate(() => {
    const video = document.querySelector('video');
    const srcObj = video ? video.srcObject : null;
    const tracks = srcObj && typeof srcObj.getTracks === 'function' ? srcObj.getTracks() : [];
    const activeTracks = tracks.filter((t) => t.readyState === 'live');
    const isPlaying = video && !video.paused && !video.ended;

    // Save stream reference globally on window to test after Exit
    if (srcObj) {
      window.__capturedCameraStream = srcObj;
      window.__capturedTracks = tracks;
    }

    return {
      videoExists: !!video,
      hasSrcObject: !!srcObj,
      isPlaying: !!isPlaying,
      totalTracksCreated: tracks.length,
      activeTracksCount: activeTracks.length,
    };
  });

  console.log(`[CAMERA LIVE] Video element present: ${liveCameraState.videoExists}`);
  console.log(`[CAMERA LIVE] Video is playing: ${liveCameraState.isPlaying}`);
  console.log(`[CAMERA LIVE] Active media tracks: ${liveCameraState.activeTracksCount}`);
  summary.cameraStreamActiveOnOpen = liveCameraState.isPlaying && liveCameraState.activeTracksCount > 0;

  // Save screenshot of live scanner
  const scannerLiveMobilePath = path.join(PROJECT_ARTIFACT_DIR, 'scanner_live_390px.png');
  await page.screenshot({ path: scannerLiveMobilePath });
  fs.copyFileSync(scannerLiveMobilePath, path.join(CONV_ARTIFACT_DIR, 'scanner_live_390px.png'));
  console.log(`[SAVED] ${scannerLiveMobilePath}`);

  // Step B: Tap Exit and verify COMPLETE camera teardown
  console.log('\n[ACTION] Clicking Exit button...');
  const exitBtn = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Exit')
    );
  });

  if (exitBtn) {
    await exitBtn.click();
  }

  // Wait for modal to unmount
  await new Promise((r) => setTimeout(r, 600));

  const postExitCameraState = await page.evaluate(() => {
    const video = document.querySelector('video');
    const tracks = window.__capturedTracks || [];
    const activeTracks = tracks.filter((t) => t.readyState === 'live');
    const endedTracks = tracks.filter((t) => t.readyState === 'ended');

    return {
      videoExists: !!video,
      totalTracks: tracks.length,
      activeTracksCount: activeTracks.length,
      endedTracksCount: endedTracks.length,
      allTracksEnded: tracks.length > 0 && tracks.every((t) => t.readyState === 'ended'),
    };
  });

  console.log(`[CAMERA TEARDOWN] Video element unmounted: ${!postExitCameraState.videoExists}`);
  console.log(`[CAMERA TEARDOWN] Active tracks remaining: ${postExitCameraState.activeTracksCount} (Expected: 0)`);
  console.log(`[CAMERA TEARDOWN] All previous tracks ended: ${postExitCameraState.allTracksEnded}`);
  summary.cameraTracksTerminatedOnExit =
    !postExitCameraState.videoExists &&
    postExitCameraState.activeTracksCount === 0 &&
    postExitCameraState.allTracksEnded;

  // Step C: Reopen scanner to ensure camera access requests cleanly again
  console.log('\n[ACTION] Reopening camera scanner to verify clean reactivation...');
  const reopenBtn = await page.$('.lm-scanner-dock-btn');
  await reopenBtn.click();
  await page.waitForSelector('video', { timeout: 4000 });
  await new Promise((r) => setTimeout(r, 1200));

  const reopenCameraState = await page.evaluate(() => {
    const video = document.querySelector('video');
    const srcObj = video ? video.srcObject : null;
    const tracks = srcObj && typeof srcObj.getTracks === 'function' ? srcObj.getTracks() : [];
    const activeTracks = tracks.filter((t) => t.readyState === 'live');
    const isPlaying = video && !video.paused && !video.ended;

    if (srcObj) {
      window.__reopenTracks = tracks;
    }

    return {
      videoExists: !!video,
      activeTracksCount: activeTracks.length,
      isPlaying: !!isPlaying,
    };
  });

  console.log(`[CAMERA REOPEN] Video active again: ${reopenCameraState.isPlaying}`);
  console.log(`[CAMERA REOPEN] Active tracks count: ${reopenCameraState.activeTracksCount}`);
  summary.cameraReopensCleanly = reopenCameraState.isPlaying && reopenCameraState.activeTracksCount > 0;

  // Exit again cleanly
  const exitBtn2 = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Exit')
    );
  });
  if (exitBtn2) await exitBtn2.click();
  await new Promise((r) => setTimeout(r, 500));

  // --- TEST 5: Responsive Layout Across 10 Viewports ---
  console.log('\n--- TEST 5: Responsive Dock Across 10 Viewports (320px to 1920px) ---');
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 200));

    const check = await page.evaluate(() => {
      const clientWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const dock = document.querySelector('nav[aria-label="Dining Primary Scanner Navigation"]');
      const dockWrap = dock?.querySelector('.lm-scanner-dock-wrap');
      const dockRect = dockWrap ? dockWrap.getBoundingClientRect() : null;

      return {
        clientWidth,
        scrollWidth,
        overflow: scrollWidth > clientWidth + 1,
        dockCentered: dockRect
          ? Math.abs(dockRect.left + dockRect.width / 2 - clientWidth / 2) < 4
          : false,
        dockWidth: dockRect ? Math.round(dockRect.width) : 0,
      };
    });

    const filename = `landing_${vp.name}.png`;
    const localPath = path.join(PROJECT_ARTIFACT_DIR, filename);
    const brainPath = path.join(CONV_ARTIFACT_DIR, filename);

    await page.screenshot({ path: localPath });
    fs.copyFileSync(localPath, brainPath);

    console.log(
      `[${vp.name.padEnd(18)}] Width: ${String(check.dockWidth).padStart(4)}px | Centered: ${String(check.dockCentered).padEnd(5)} | Overflow: ${check.overflow ? 'YES (FAIL)' : 'NO (PASS)'}`
    );

    summary.viewportsTested.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      dockWidth: check.dockWidth,
      dockCentered: check.dockCentered,
      overflow: check.overflow,
    });
  }

  console.log('\n================================================================');
  console.log('SUMMARY RESULTS:');
  console.log(JSON.stringify(summary, null, 2));
  console.log('================================================================');

  await browser.close();

  fs.writeFileSync(
    path.join(PROJECT_ARTIFACT_DIR, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );

  const allPassed =
    summary.exactHeadingVerified &&
    summary.zeroExtraDockIcons &&
    summary.singleCustomerScannerButton &&
    summary.dockVisualContourVerified &&
    summary.springKeyframesPresent &&
    summary.cameraStreamActiveOnOpen &&
    summary.cameraTracksTerminatedOnExit &&
    summary.cameraReopensCleanly &&
    summary.viewportsTested.every((v) => !v.overflow);

  if (allPassed) {
    console.log('\n>>> ALL PREMIUM DOCK & CAMERA CLEANUP TESTS PASSED! <<<');
  } else {
    console.error('\n>>> SOME TESTS FAILED! <<<');
    process.exit(1);
  }
}

runPremiumDockVerification();
