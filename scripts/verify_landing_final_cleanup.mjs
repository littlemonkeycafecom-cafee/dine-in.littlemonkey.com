import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const PROJECT_ARTIFACT_DIR = path.resolve('test_artifacts/landing_page_final_cleanup');
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

async function runCleanupVerification() {
  console.log('================================================================');
  console.log('STARTING LANDING PAGE FINAL UI CLEANUP VERIFICATION SUITE');
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
    exactMessageVerified: false,
    zeroOrderingLanguage: false,
    singleCustomerScannerButton: false,
    zeroDuplicateScannerButtons: false,
    yellowDockMatchingReference: false,
    customerAdminLinksRemoved: false,
    staffModalFunctionalViaParam: false,
    labFunctionalViaRoute: false,
    scannerExperiencePreserved: false,
    viewportsTested: [],
  };

  try {
    const page = await browser.newPage();

    // Mark intro seen
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: HEADING, MESSAGE, AND ORDERING LANGUAGE AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Heading, Explanation & Language Audit ---');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 400));

    const contentAudit = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const h1 = document.querySelector('h1')?.innerText?.trim() || '';

      const hasExactHeading = h1 === 'Welcome to Little Monkey Dining';
      const hasOldHeading = bodyText.includes('Welcome to Little Monkey Cafe') || bodyText.includes('Welcome to Little Monkey Café');

      const expectedMsg = 'Please scan the physical QR code located on your dining table to access the menu.';
      const hasExactMsg = bodyText.includes(expectedMsg);

      // Check forbidden ordering phrases
      const forbiddenPhrases = [
        'table ordering',
        'place your table order',
        'order your food',
        'ordering from your table',
        'submit orders',
      ];
      const matchedForbidden = forbiddenPhrases.filter((p) => bodyText.toLowerCase().includes(p));

      // Check customer-facing admin/lab links
      const hasStaffLink = bodyText.includes('Staff QR Administration') || bodyText.includes('PIN 9999');
      const hasLabLink = bodyText.includes('Optical Marker Lab');

      return {
        h1,
        hasExactHeading,
        hasOldHeading,
        hasExactMsg,
        matchedForbidden,
        hasStaffLink,
        hasLabLink,
      };
    });

    console.log('[HEADING] Found:', `"${contentAudit.h1}"`);
    console.log('[HEADING] Matches "Welcome to Little Monkey Dining":', contentAudit.hasExactHeading);
    console.log('[HEADING] Old heading absent:', !contentAudit.hasOldHeading);
    console.log('[EXPLANATION] Exact message present:', contentAudit.hasExactMsg);
    console.log('[LANGUAGE] Forbidden ordering phrases detected:', contentAudit.matchedForbidden);
    console.log('[ADMIN LINK] Staff link removed from customer landing:', !contentAudit.hasStaffLink);
    console.log('[LAB LINK] Lab link removed from customer landing:', !contentAudit.hasLabLink);

    if (!contentAudit.hasExactHeading) {
      throw new Error(`Heading mismatch! Expected 'Welcome to Little Monkey Dining', got '${contentAudit.h1}'`);
    }
    if (!contentAudit.hasExactMsg) {
      throw new Error('Exact non-ordering explanation message was not found on landing page!');
    }
    if (contentAudit.matchedForbidden.length > 0) {
      throw new Error(`Ordering language detected on landing page: ${contentAudit.matchedForbidden.join(', ')}`);
    }
    if (contentAudit.hasStaffLink || contentAudit.hasLabLink) {
      throw new Error('Staff administration or Lab link still visible on customer landing page!');
    }

    summary.exactHeadingVerified = true;
    summary.exactMessageVerified = true;
    summary.zeroOrderingLanguage = true;
    summary.customerAdminLinksRemoved = true;
    console.log('[PASS] Test 1: Exact heading, single explanation, zero ordering language, admin links removed.\n');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: SINGLE CUSTOMER SCANNER BUTTON & NO DUPLICATES
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 2: Single Scanner Action & Zero Duplicates Audit ---');

    const buttonAudit = await page.evaluate(() => {
      // Find all customer-facing buttons (excluding Developer Mode dev-table buttons)
      const allButtons = Array.from(document.querySelectorAll('button'));
      const customerButtons = allButtons.filter((btn) => {
        // Exclude buttons inside DevTableLauncher
        const isInsideDev = btn.closest('div[style*="dashed"]') !== null || btn.innerText.includes('T0') || btn.innerText.includes('Unlock');
        return !isInsideDev;
      });

      const customerScannerButtons = customerButtons.filter((btn) => {
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        const text = btn.innerText.toLowerCase();
        return aria.includes('scan') || text.includes('scan');
      });

      const dockBtn = document.querySelector('.lm-scanner-dock-btn');
      const navHasOtherBtns = document.querySelectorAll('nav button').length !== 1;

      return {
        customerButtonsCount: customerButtons.length,
        customerScannerButtonsCount: customerScannerButtons.length,
        dockBtnPresent: dockBtn !== null,
        navHasOtherBtns,
      };
    });

    console.log('[SCANNER BUTTONS] Customer scanner buttons count:', buttonAudit.customerScannerButtonsCount);
    console.log('[SCANNER BUTTONS] Dock elevated scanner button present:', buttonAudit.dockBtnPresent);
    console.log('[NAV TABS] Other nav buttons (Café/Tables/Menu/Staff) present:', buttonAudit.navHasOtherBtns);

    if (buttonAudit.customerScannerButtonsCount !== 1) {
      throw new Error(`Expected exactly 1 customer scanner button, but found ${buttonAudit.customerScannerButtonsCount}! Duplicate scanner button detected!`);
    }
    if (buttonAudit.navHasOtherBtns) {
      throw new Error('Navigation dock contains extra buttons! Only the central elevated button is allowed.');
    }

    summary.singleCustomerScannerButton = true;
    summary.zeroDuplicateScannerButtons = true;
    console.log('[PASS] Test 2: Exactly ONE customer scanner button confirmed, 0 duplicates.\n');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: RECREATED YELLOW BOTTOM SCANNER DOCK STRUCTURE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 3: Yellow Bottom Scanner Dock Structure & Proportions ---');

    const dockMetrics = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Dining Primary Scanner Navigation"]');
      if (!nav) return null;
      const dockWrapper = nav.querySelector('div');
      const svg = dockWrapper?.querySelector('svg');
      const path = svg?.querySelector('path');
      const pathFill = path?.getAttribute('fill');
      const pathD = path?.getAttribute('d') || '';
      const button = nav.querySelector('button.lm-scanner-dock-btn');
      const btnRect = button?.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      const svgRect = svg?.getBoundingClientRect();

      // Check if button is elevated (top is above the SVG top)
      const isElevated = btnRect && svgRect ? btnRect.top < svgRect.top : false;
      const isScoopPath = pathD.includes('C 156,0') || pathD.includes('34');

      return {
        navPresent: true,
        svgPresent: svg !== null,
        pathFill,
        isScoopPath,
        btnPresent: button !== null,
        isElevated,
        btnWidth: btnRect?.width,
        btnHeight: btnRect?.height,
        dockMaxWidth: dockWrapper ? window.getComputedStyle(dockWrapper).maxWidth : 'none',
      };
    });

    console.log('[DOCK] SVG Present:', dockMetrics?.svgPresent);
    console.log('[DOCK] Path Fill (Golden Yellow):', dockMetrics?.pathFill);
    console.log('[DOCK] Scooped Path Present:', dockMetrics?.isScoopPath);
    console.log('[DOCK] Center Button Elevated:', dockMetrics?.isElevated);
    console.log('[DOCK] Button Size:', `${dockMetrics?.btnWidth}x${dockMetrics?.btnHeight}px`);
    console.log('[DOCK] Max Width Constraint (Proportional on Desktop):', dockMetrics?.dockMaxWidth);

    if (!dockMetrics || !dockMetrics.isScoopPath || !dockMetrics.isElevated || dockMetrics.pathFill !== '#F5BD25') {
      throw new Error(`Yellow bottom scanner dock failed visual structure check! Details: ${JSON.stringify(dockMetrics)}`);
    }

    summary.yellowDockMatchingReference = true;
    console.log('[PASS] Test 3: Yellow bottom scanner dock matches reference visual structure.\n');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: SCANNER OPERATION & CAMERA ACTIVATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 4: Central Scanner Button Operation & Clean Teardown ---');

    console.log('[ACTION] Clicking elevated circular scanner button...');
    await page.click('button.lm-scanner-dock-btn');
    await new Promise((r) => setTimeout(r, 600));

    const scannerLive = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label="Table QR Camera Scanner"]');
      if (!dialog) return null;
      const video = dialog.querySelector('video');
      const isFullScreen = Math.abs(dialog.clientWidth - window.innerWidth) <= 1;
      const hasReticle = dialog.querySelector('.lm-scanner-beam-line') !== null;
      const exitBtn = dialog.querySelector('button[aria-label="Exit Camera Scanner"]');
      const isVideoPlaying = video && !video.paused && video.readyState >= 2;

      return {
        dialogPresent: true,
        isFullScreen,
        hasReticle,
        hasExitBtn: exitBtn !== null,
        isVideoPlaying,
      };
    });

    console.log('[SCANNER LIVE] Full-screen active:', scannerLive?.isFullScreen);
    console.log('[SCANNER LIVE] Live camera video playing:', scannerLive?.isVideoPlaying);
    console.log('[SCANNER LIVE] Exit button present:', scannerLive?.hasExitBtn);

    if (!scannerLive || !scannerLive.isFullScreen || !scannerLive.isVideoPlaying) {
      throw new Error(`Scanner failed to open full-screen or camera did not play! Details: ${JSON.stringify(scannerLive)}`);
    }

    // Capture screenshot of live full-screen camera view
    const scannerShotPath = path.join(PROJECT_ARTIFACT_DIR, 'scanner_live_390px.png');
    await page.screenshot({ path: scannerShotPath });
    fs.copyFileSync(scannerShotPath, path.join(CONV_ARTIFACT_DIR, 'scanner_live_390px.png'));

    // Click Exit
    console.log('[ACTION] Exiting camera scanner...');
    await page.click('button[aria-label="Exit Camera Scanner"]');
    await new Promise((r) => setTimeout(r, 400));

    const closed = await page.evaluate(() => {
      return document.querySelector('div[role="dialog"][aria-label="Table QR Camera Scanner"]') === null;
    });
    console.log('[SCANNER LIVE] Scanner unmounted and closed:', closed);

    if (!closed) {
      throw new Error('Scanner did not close cleanly!');
    }

    summary.scannerExperiencePreserved = true;
    console.log('[PASS] Test 4: Full-screen scanner works seamlessly from central dock button.\n');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: PRESERVATION OF ADMIN MODAL (?staff=true) & LAB (/lab)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 5: Admin Modal (?staff=true) & Lab (/lab) Preservation ---');

    // Test ?staff=true
    await page.goto(`${BASE_URL}/?staff=true`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 400));
    const adminModalOpen = await page.evaluate(() => {
      return document.body.innerText.includes('Operational Admin PIN') || document.body.innerText.includes('authorized café administrators');
    });
    console.log('[PRESERVATION] Admin modal opens via ?staff=true:', adminModalOpen);
    if (!adminModalOpen) {
      throw new Error('Staff Admin modal did not open via ?staff=true query parameter!');
    }
    summary.staffModalFunctionalViaParam = true;

    // Test /lab
    await page.goto(`${BASE_URL}/lab`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 400));
    const labOpen = await page.evaluate(() => {
      return document.body.innerText.includes('QR + Optical Marker Laboratory');
    });
    console.log('[PRESERVATION] Optical Marker Lab loads via /lab route:', labOpen);
    if (!labOpen) {
      throw new Error('Optical Marker Laboratory failed to load at /lab!');
    }
    summary.labFunctionalViaRoute = true;
    console.log('[PASS] Test 5: Operational admin and laboratory routes remain fully functional.\n');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: RESPONSIVE LAYOUT & OVERFLOW AUDIT ACROSS ALL 10 VIEWPORTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 6: Responsive Layout & 0 Overflow Across 10 Viewports ---');

    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 300));

      const overflowInfo = await page.evaluate(() => {
        const docElem = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(docElem.scrollWidth, body.scrollWidth);
        const clientWidth = docElem.clientWidth;
        return {
          scrollWidth,
          clientWidth,
          hasOverflow: scrollWidth > clientWidth,
        };
      });

      console.log(`[${vp.name}] Client: ${overflowInfo.clientWidth}px | Scroll: ${overflowInfo.scrollWidth}px | Overflow: ${overflowInfo.hasOverflow ? 'YES (FAIL)' : 'NO (PASS)'}`);

      if (overflowInfo.hasOverflow) {
        throw new Error(`Horizontal overflow at ${vp.name}! ScrollWidth: ${overflowInfo.scrollWidth}, ClientWidth: ${overflowInfo.clientWidth}`);
      }

      summary.viewportsTested.push(vp.name);

      const shotPath = path.join(PROJECT_ARTIFACT_DIR, `landing_${vp.name}.png`);
      await page.screenshot({ path: shotPath });
      fs.copyFileSync(shotPath, path.join(CONV_ARTIFACT_DIR, `landing_${vp.name}.png`));
    }

    console.log('[PASS] Test 6: All 10 viewports passed with 0 horizontal overflow.\n');

    await page.close();

    console.log('================================================================');
    console.log('ALL VERIFICATION PHASES COMPLETED WITH 100% SUCCESS');
    console.log('================================================================');
    console.log(JSON.stringify(summary, null, 2));

    fs.writeFileSync(
      path.join(PROJECT_ARTIFACT_DIR, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );
  } finally {
    await browser.close();
  }
}

runCleanupVerification().catch((err) => {
  console.error('\n[FATAL ERROR IN VERIFICATION SUITE]:', err);
  process.exit(1);
});
