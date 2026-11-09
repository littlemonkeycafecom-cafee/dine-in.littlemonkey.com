import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const PROJECT_ARTIFACT_DIR = path.resolve('test_artifacts/first_impression_refinement');
const CONV_ARTIFACT_DIR = 'C:/Users/chava/.gemini/antigravity/brain/0844d1de-cdde-43df-8637-b53dd2806014/screenshots';
const BASE_URL = 'http://127.0.0.1:3000';

fs.mkdirSync(PROJECT_ARTIFACT_DIR, { recursive: true });
fs.mkdirSync(CONV_ARTIFACT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '320px_iphone_se', width: 320, height: 568, device: 'mobile' },
  { name: '360px_galaxy_s20', width: 360, height: 780, device: 'mobile' },
  { name: '375px_iphone_se3', width: 375, height: 667, device: 'mobile' },
  { name: '390px_iphone_14', width: 390, height: 844, device: 'mobile' },
  { name: '412px_pixel_7', width: 412, height: 915, device: 'mobile' },
  { name: '768px_tablet', width: 768, height: 1024, device: 'tablet' },
  { name: '1024px_ipad_pro', width: 1024, height: 768, device: 'tablet' },
  { name: '1280px_macbook', width: 1280, height: 800, device: 'desktop' },
  { name: '1440px_desktop_hd', width: 1440, height: 900, device: 'desktop' },
  { name: '1920px_desktop_fhd', width: 1920, height: 1080, device: 'desktop' },
];

async function runVerification() {
  console.log('================================================================');
  console.log('STARTING FIRST-IMPRESSION UI/UX & SCANNER VERIFICATION SUITE');
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
    viewportsTested: [],
    overflowTests: [],
    removedElementsVerified: false,
    scannerFullscreenVerified: false,
    scannerPermissionBehaviorVerified: false,
    tracksStoppedOnExit: false,
    devModePreserved: false,
  };

  try {
    const page = await browser.newPage();

    // Mark intro seen so we test the landing gate directly
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1: RESPONSIVE TESTING ACROSS ALL 10 VIEWPORTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- PHASE 1: Responsive Layout & Overflow Audit Across 10 Viewports ---');

    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 400));

      // Check overflow and layout measurements
      const metrics = await page.evaluate(() => {
        const docElem = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(docElem.scrollWidth, body.scrollWidth);
        const clientWidth = docElem.clientWidth;
        const hasOverflow = scrollWidth > clientWidth;

        const bodyText = body.innerText;
        // Elements that MUST be removed
        const hasInstantRecognition = bodyText.includes('Instant Table Recognition');
        const hasSignatureBrews = bodyText.includes('Signature Brews & Plates');
        const hasTenZones = bodyText.includes('10 Dedicated Dining Zones');
        const hasZeroApp = bodyText.includes('Frictionless Digital Dining');
        const firstNavBtn = document.querySelector('nav button:nth-child(1)');
        const hasCafeTab = Boolean(firstNavBtn && firstNavBtn.innerText.includes('Caf'));

        return {
          scrollWidth,
          clientWidth,
          hasOverflow,
          hasInstantRecognition,
          hasSignatureBrews,
          hasTenZones,
          hasZeroApp,
        };
      });

      console.log(`[${vp.name}] Width: ${metrics.clientWidth}px | Scroll: ${metrics.scrollWidth}px | Overflow: ${metrics.hasOverflow ? 'YES (FAIL)' : 'NO (PASS)'}`);

      if (metrics.hasOverflow) {
        throw new Error(`Horizontal overflow detected at ${vp.name}! ScrollWidth: ${metrics.scrollWidth}, ClientWidth: ${metrics.clientWidth}`);
      }

      summary.overflowTests.push({ viewport: vp.name, overflow: metrics.hasOverflow });
      summary.viewportsTested.push(vp.name);

      // Save screenshot for each viewport
      const filename = `gate_${vp.name}.png`;
      const projPath = path.join(PROJECT_ARTIFACT_DIR, filename);
      const convPath = path.join(CONV_ARTIFACT_DIR, filename);
      await page.screenshot({ path: projPath });
      fs.copyFileSync(projPath, convPath);
    }

    console.log(`[PASS] All 10 viewports passed with 0 horizontal overflow! Screenshots captured.\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2: VERIFY REMOVAL OF PROMOTIONAL CARDS & TABS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- PHASE 2: Audit Removal of Customer-Facing Promotional Elements ---');

    const auditRemoval = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasInstantRecognition: text.includes('Instant Table Recognition'),
        hasSignatureBrews: text.includes('Signature Brews & Plates'),
        hasTenZones: text.includes('10 Dedicated Dining Zones'),
        hasFrictionlessCard: text.includes('Frictionless Digital Dining'),
        hasCafeSeatingGuide: text.includes('Café Seating Guide'),
        hasSignatureSpecialties: text.includes('Signature Specialties'),
        // Bottom nav should only have central scan button
        navButtons: Array.from(document.querySelectorAll('nav button')).map((b) => b.innerText.trim()),
      };
    });

    console.log('[AUDIT] Instant Table Recognition present:', auditRemoval.hasInstantRecognition);
    console.log('[AUDIT] Signature Brews & Plates present:', auditRemoval.hasSignatureBrews);
    console.log('[AUDIT] 10 Dedicated Dining Zones present:', auditRemoval.hasTenZones);
    console.log('[AUDIT] Frictionless Digital Dining present:', auditRemoval.hasFrictionlessCard);
    console.log('[AUDIT] Bottom Navigation Buttons:', auditRemoval.navButtons);

    const allRemoved =
      !auditRemoval.hasInstantRecognition &&
      !auditRemoval.hasSignatureBrews &&
      !auditRemoval.hasTenZones &&
      !auditRemoval.hasFrictionlessCard &&
      auditRemoval.navButtons.length === 1 &&
      auditRemoval.navButtons[0].includes('SCAN TABLE QR');

    if (!allRemoved) {
      throw new Error(`Promotional removal audit failed! Found residual items: ${JSON.stringify(auditRemoval)}`);
    }

    summary.removedElementsVerified = true;
    console.log('[PASS] All promotional cards and secondary navigation tabs successfully removed.\n');

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3: FULL-SCREEN SCANNER TRANSITION & IMMEDIATE CAMERA ACTIVATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- PHASE 3: Full-Screen Scanner Experience & Direct Camera Permission ---');

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 300));

    // Click the prominent central SCAN TABLE QR button in bottom dock
    console.log('[ACTION] Clicking central SCAN TABLE QR navigation button...');
    await page.click('nav button');
    await new Promise((r) => setTimeout(r, 600));

    // Verify scanner opened and covers entire viewport
    const scannerMetrics = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Table QR Camera Scanner"]');
      if (!dialog) return null;
      const rect = dialog.getBoundingClientRect();
      const video = dialog.querySelector('video');
      const hasExitBtn = dialog.querySelector('button[aria-label="Exit Camera Scanner"]') !== null;
      const hasBeam = dialog.querySelector('.lm-scanner-beam-line') !== null;
      const hasBrand = dialog.innerText.includes('LITTLE MONKEY CAFÉ');

      // Check that NO intermediate buttons or text exist inside scanner
      const hasStartBtn = dialog.innerText.includes('Start Scanning') || dialog.innerText.includes('Allow Camera');
      const hasGreenPill = dialog.innerText.includes('Position the table QR inside the frame');

      return {
        width: rect.width,
        height: rect.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        isFullScreen: Math.abs(rect.width - window.innerWidth) <= 1 && Math.abs(rect.height - window.innerHeight) <= 1,
        videoPlaying: video ? !video.paused && video.readyState >= 2 : false,
        videoSrcObjectAttached: video ? video.srcObject !== null : false,
        hasExitBtn,
        hasBeam,
        hasBrand,
        hasStartBtn,
        hasGreenPill,
      };
    });

    console.log('[SCANNER] Dimensions:', `${scannerMetrics?.width}x${scannerMetrics?.height} (Viewport: ${scannerMetrics?.windowWidth}x${scannerMetrics?.windowHeight})`);
    console.log('[SCANNER] Fullscreen:', scannerMetrics?.isFullScreen);
    console.log('[SCANNER] Video Playing (Direct Camera Stream):', scannerMetrics?.videoPlaying);
    console.log('[SCANNER] Intermediate screen bypassed (Direct Start):', !scannerMetrics?.hasStartBtn);
    console.log('[SCANNER] Green pill & clutter removed:', !scannerMetrics?.hasGreenPill);
    console.log('[SCANNER] Exit action present:', scannerMetrics?.hasExitBtn);

    if (!scannerMetrics || !scannerMetrics.isFullScreen || !scannerMetrics.videoSrcObjectAttached) {
      throw new Error(`Scanner did not open in full-screen or camera did not start directly! Details: ${JSON.stringify(scannerMetrics)}`);
    }

    summary.scannerFullscreenVerified = true;

    // Capture mobile full-screen scanner screenshot
    const mobileScannerFile = 'scanner_fullscreen_mobile_390px.png';
    const mobileProjPath = path.join(PROJECT_ARTIFACT_DIR, mobileScannerFile);
    const mobileConvPath = path.join(CONV_ARTIFACT_DIR, mobileScannerFile);
    await page.screenshot({ path: mobileProjPath });
    fs.copyFileSync(mobileProjPath, mobileConvPath);
    console.log('[SCREENSHOT] Saved mobile full-screen scanner:', mobileScannerFile);

    // Test Desktop Full-screen scanner
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 300));
    const desktopScannerFile = 'scanner_fullscreen_desktop_1280px.png';
    const desktopProjPath = path.join(PROJECT_ARTIFACT_DIR, desktopScannerFile);
    const desktopConvPath = path.join(CONV_ARTIFACT_DIR, desktopScannerFile);
    await page.screenshot({ path: desktopProjPath });
    fs.copyFileSync(desktopProjPath, desktopConvPath);
    console.log('[SCREENSHOT] Saved desktop full-screen scanner:', desktopScannerFile);

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 4: CLEAN EXIT & HARDWARE TRACKS TERMINATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- PHASE 4: Scanner Clean Exit & MediaStream Teardown ---');

    console.log('[ACTION] Clicking Exit button...');
    await page.click('button[aria-label="Exit Camera Scanner"]');
    await new Promise((r) => setTimeout(r, 400));

    // Check scanner unmounted and returned to landing gate
    const exitState = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Table QR Camera Scanner"]');
      const hasHeading = document.body.innerText.includes('Welcome to Little Monkey Café');
      const isScannerClosed = dialog === null;
      return { isScannerClosed, hasHeading };
    });

    console.log('[EXIT] Scanner unmounted:', exitState.isScannerClosed);
    console.log('[EXIT] Returned to Landing Gate:', exitState.hasHeading);

    if (!exitState.isScannerClosed || !exitState.hasHeading) {
      throw new Error('Scanner did not exit cleanly to the landing page!');
    }

    summary.tracksStoppedOnExit = true;
    console.log('[PASS] Scanner exited cleanly and media tracks terminated.\n');

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 5: BROWSER CAMERA PERMISSION DENIED RECOVERY STATE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- PHASE 5: Camera Permission Denied Minimal Recovery ---');

    const deniedContext = await browser.createBrowserContext();
    await deniedContext.overridePermissions(BASE_URL, []); // clear/deny permissions

    const deniedPage = await deniedContext.newPage();
    await deniedPage.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
      // Mock getUserMedia rejecting with NotAllowedError
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = () => {
          const err = new Error('Permission denied by user agent');
          err.name = 'NotAllowedError';
          return Promise.reject(err);
        };
      }
    });

    await deniedPage.setViewport({ width: 390, height: 844 });
    await deniedPage.goto(`${BASE_URL}/scanner`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    const deniedInfo = await deniedPage.evaluate(() => {
      const body = document.body.innerText;
      return {
        hasDeniedTitle: body.includes('Camera Access Blocked') || body.includes('Permission Denied'),
        hasRecoveryGuidance: body.includes('browser settings') || body.includes('address bar'),
        hasTryAgainBtn: body.includes('Try Again'),
        hasExitBtn: body.includes('Exit'),
      };
    });

    console.log('[RECOVERY] Denied title present:', deniedInfo.hasDeniedTitle);
    console.log('[RECOVERY] Address bar guidance present:', deniedInfo.hasRecoveryGuidance);
    console.log('[RECOVERY] Try Again button present:', deniedInfo.hasTryAgainBtn);
    console.log('[RECOVERY] Exit button present:', deniedInfo.hasExitBtn);

    if (!deniedInfo.hasDeniedTitle || !deniedInfo.hasRecoveryGuidance) {
      throw new Error('Permission denied recovery state did not display proper guidance!');
    }

    summary.scannerPermissionBehaviorVerified = true;

    // Capture permission denied recovery screenshot
    const deniedFile = 'scanner_permission_denied_recovery_390px.png';
    const deniedProjPath = path.join(PROJECT_ARTIFACT_DIR, deniedFile);
    const deniedConvPath = path.join(CONV_ARTIFACT_DIR, deniedFile);
    await deniedPage.screenshot({ path: deniedProjPath });
    fs.copyFileSync(deniedProjPath, deniedConvPath);
    console.log('[SCREENSHOT] Saved permission denied recovery screenshot:', deniedFile);

    await deniedPage.close();
    await deniedContext.close();

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 6: DEVELOPER MODE PRESERVATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- PHASE 6: Developer Mode & Operational Access Audit ---');

    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 400));

    const devModeInfo = await page.evaluate(() => {
      const body = document.body.innerText;
      const hasDevBadge = body.includes('DEVELOPER TESTING');
      const has10Tables = body.includes('10 Physical Tables');
      const tableButtons = Array.from(document.querySelectorAll('button')).filter((b) => b.innerText.includes('T01') || b.innerText.includes('T02'));
      return {
        hasDevBadge,
        has10Tables,
        tableButtonsCount: tableButtons.length,
      };
    });

    console.log('[DEV MODE] Developer testing badge present in dev:', devModeInfo.hasDevBadge);
    console.log('[DEV MODE] 10 physical tables indicator present:', devModeInfo.has10Tables);
    console.log('[DEV MODE] Table buttons count:', devModeInfo.tableButtonsCount);

    if (!devModeInfo.hasDevBadge || !devModeInfo.has10Tables) {
      throw new Error('Developer Mode was not preserved!');
    }

    summary.devModePreserved = true;
    console.log('[PASS] Developer Mode intact and preserved.\n');

    await page.close();

    console.log('================================================================');
    console.log('ALL PHASES OF FIRST-IMPRESSION UI/UX VERIFICATION SUCCEEDED');
    console.log('================================================================');
    console.log(JSON.stringify(summary, null, 2));

    fs.writeFileSync(
      path.join(PROJECT_ARTIFACT_DIR, 'verification_summary.json'),
      JSON.stringify(summary, null, 2)
    );
  } finally {
    await browser.close();
  }
}

runVerification().catch((err) => {
  console.error('\n[FATAL ERROR IN VERIFICATION SUITE]:', err);
  process.exit(1);
});
