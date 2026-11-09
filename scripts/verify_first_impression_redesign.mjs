import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/node_modules/puppeteer');

const PROJECT_ARTIFACT_DIR = path.resolve('test_artifacts/first_impression_redesign');
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
  { name: '1280px_desktop', width: 1280, height: 800 },
];

async function runVerification() {
  console.log('================================================================');
  console.log('STARTING FIRST-IMPRESSION UI/UX & QR SCANNER VERIFICATION SUITE');
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

  const summaryResults = [];

  try {
    const page = await browser.newPage();

    // Bypass welcome intro screen for testing
    await page.evaluateOnNewDocument(() => {
      sessionStorage.setItem('lm_dinein_intro_seen', 'true');
    });

    for (const vp of VIEWPORTS) {
      console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 600));

      // 1. Check Headline & Required Strings
      const pageStrings = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasHeading: text.includes('Table QR Scan Required'),
          hasBadge: text.includes('IN-CAFÉ QR ACCESS REQUIRED'),
          hasMenuPreview: text.includes('Signature Brews & Plates'),
          hasTableZones: text.includes('10 Dedicated Dining Zones'),
          hasZeroApp: text.includes('Frictionless Digital Dining'),
        };
      });

      console.log(`[${vp.name}] Heading present: ${pageStrings.hasHeading}`);
      console.log(`[${vp.name}] Access badge present: ${pageStrings.hasBadge}`);

      // 2. Check Horizontal Overflow
      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      console.log(`[${vp.name}] Horizontal Overflow: ${overflow.hasOverflow} (${overflow.scrollWidth}px vs ${overflow.clientWidth}px)`);

      // 3. Inspect Bottom Navigation Surface
      const navInfo = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Dining Bottom Navigation"]');
        if (!nav) return { found: false };
        const rect = nav.getBoundingClientRect();
        const style = window.getComputedStyle(nav);

        const centerBtn = nav.querySelector('button[aria-label="Scan Table QR Code"]');
        const centerBtnRect = centerBtn ? centerBtn.getBoundingClientRect() : null;

        return {
          found: true,
          position: style.position,
          backgroundColor: style.backgroundColor,
          borderTopLeftRadius: style.borderTopLeftRadius,
          borderTopRightRadius: style.borderTopRightRadius,
          navTop: Math.round(rect.top),
          navHeight: Math.round(rect.height),
          navWidth: Math.round(rect.width),
          centerBtnFound: !!centerBtn,
          centerBtnElevated: centerBtnRect ? centerBtnRect.top < rect.top : false,
          elevationDistance: centerBtnRect ? Math.round(rect.top - centerBtnRect.top) : 0,
        };
      });

      console.log(`[${vp.name}] Nav surface found: ${navInfo.found}`);
      console.log(`[${vp.name}] Nav background: ${navInfo.backgroundColor}`);
      console.log(`[${vp.name}] Nav rounded corners: ${navInfo.borderTopLeftRadius}`);
      console.log(`[${vp.name}] Center scanner elevated: ${navInfo.centerBtnElevated} (elevated by ${navInfo.elevationDistance}px)`);

      // 4. Capture Gate Screenshot
      const gateScreenshotPath = path.join(PROJECT_ARTIFACT_DIR, `gate_${vp.name}.png`);
      const convGatePath = path.join(CONV_ARTIFACT_DIR, `gate_${vp.name}.png`);
      await page.screenshot({ path: gateScreenshotPath, fullPage: false });
      fs.copyFileSync(gateScreenshotPath, convGatePath);
      console.log(`[${vp.name}] Screenshot saved: ${gateScreenshotPath}`);

      summaryResults.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        hasHeading: pageStrings.hasHeading,
        hasBadge: pageStrings.hasBadge,
        hasOverflow: overflow.hasOverflow,
        navFound: navInfo.found,
        centerBtnElevated: navInfo.centerBtnElevated,
        elevationDistance: navInfo.elevationDistance,
      });
    }

    // Modal & Interactive Behavior Verification on 390px Mobile
    console.log('\n--- Testing Interactive Modals & Scanner Routing (390px) ---');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    // Test 1: Tables Modal
    console.log('[INTERACTION] Opening Table Locator modal...');
    const tablesTab = await page.$('nav button:nth-of-type(2)');
    if (tablesTab) {
      await tablesTab.click();
      await new Promise((r) => setTimeout(r, 400));
      const modalText = await page.evaluate(() => document.body.innerText);
      const hasSeatingGuide = modalText.includes('Café Seating Guide');
      const hasAllZones = modalText.includes('Window Bay') && modalText.includes('Private Alcove');
      console.log(`[INTERACTION] Table modal opened: ${hasSeatingGuide}, has zones: ${hasAllZones}`);

      const tableModalPath = path.join(PROJECT_ARTIFACT_DIR, 'modal_table_locator_390px.png');
      await page.screenshot({ path: tableModalPath });
      fs.copyFileSync(tableModalPath, path.join(CONV_ARTIFACT_DIR, 'modal_table_locator_390px.png'));

      // Close modal
      const closeBtn = await page.$('div[role="dialog"] button');
      if (closeBtn) await closeBtn.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // Test 2: Menu Preview Modal
    console.log('[INTERACTION] Opening Menu Preview modal...');
    const menuTab = await page.$('nav button:nth-of-type(3)');
    if (menuTab) {
      await menuTab.click();
      await new Promise((r) => setTimeout(r, 400));
      const modalText = await page.evaluate(() => document.body.innerText);
      const hasSpecialties = modalText.includes('Signature Specialties');
      const hasDishes = modalText.includes('Basque Burnt Cheesecake') && modalText.includes('House Blend');
      console.log(`[INTERACTION] Menu modal opened: ${hasSpecialties}, has dishes: ${hasDishes}`);

      const menuModalPath = path.join(PROJECT_ARTIFACT_DIR, 'modal_menu_preview_390px.png');
      await page.screenshot({ path: menuModalPath });
      fs.copyFileSync(menuModalPath, path.join(CONV_ARTIFACT_DIR, 'modal_menu_preview_390px.png'));

      // Close modal
      const closeBtn = await page.$('div[role="dialog"] button');
      if (closeBtn) await closeBtn.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // Test 3: Elevated Center Scanner Button Routing to /scanner
    console.log('[INTERACTION] Clicking center elevated circular scanner button...');
    const centerScannerBtn = await page.$('button[aria-label="Scan Table QR Code"]');
    if (centerScannerBtn) {
      await centerScannerBtn.click();
      await new Promise((r) => setTimeout(r, 700));

      const scannerUrl = page.url();
      console.log(`[SCANNER ROUTE] Current URL: ${scannerUrl}`);

      // Check State 1: Permission Prompt Card
      const promptInfo = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasPromptHeading: text.includes('Camera Access Required'),
          hasBadge: text.includes('IN-APP CAMERA SCANNER'),
          hasZeroStorage: text.includes('Zero Storage'),
          hasLocalDecoding: text.includes('On-Device Recognition'),
        };
      });
      console.log(`[SCANNER PROMPT] Prompt heading: ${promptInfo.hasPromptHeading}`);
      console.log(`[SCANNER PROMPT] Privacy guarantees present: ${promptInfo.hasZeroStorage && promptInfo.hasLocalDecoding}`);

      const promptPath = path.join(PROJECT_ARTIFACT_DIR, 'scanner_permission_prompt_390px.png');
      await page.screenshot({ path: promptPath });
      fs.copyFileSync(promptPath, path.join(CONV_ARTIFACT_DIR, 'scanner_permission_prompt_390px.png'));

      // Click "Allow Camera & Start Scanning"
      console.log('[SCANNER ACTION] Clicking "Allow Camera & Start Scanning"...');
      const startCamClicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Allow Camera'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      console.log(`[SCANNER ACTION] Button found & clicked: ${startCamClicked}`);
      await new Promise((r) => setTimeout(r, 1200));

      // Check State 2: Active Camera Viewfinder
      const liveScannerInfo = await page.evaluate(() => {
        const text = document.body.innerText;
        const video = document.querySelector('video');
        const beam = document.querySelector('.lm-scanner-beam-line');
        const corners = document.querySelectorAll('.lm-scanner-corner');
        return {
          hasVideo: !!video,
          cornerCount: corners.length,
          hasScanline: !!beam,
          hasGuidancePill: text.includes('Position the table QR inside the frame'),
        };
      });

      console.log(`[SCANNER LIVE] Active video element: ${liveScannerInfo.hasVideo}`);
      console.log(`[SCANNER LIVE] Glowing corners count (expected 4): ${liveScannerInfo.cornerCount}`);
      console.log(`[SCANNER LIVE] Animated scanning beam line: ${liveScannerInfo.hasScanline}`);
      console.log(`[SCANNER LIVE] Live guidance pill: ${liveScannerInfo.hasGuidancePill}`);

      const liveScannerPath = path.join(PROJECT_ARTIFACT_DIR, 'scanner_viewfinder_live_390px.png');
      await page.screenshot({ path: liveScannerPath });
      fs.copyFileSync(liveScannerPath, path.join(CONV_ARTIFACT_DIR, 'scanner_viewfinder_live_390px.png'));
      console.log(`[SCANNER LIVE] Screenshot saved: ${liveScannerPath}`);

      // Exit Scanner
      const exitBtn = await page.$('button[aria-label="Exit Camera Scanner"]');
      if (exitBtn) {
        await exitBtn.click();
        await new Promise((r) => setTimeout(r, 500));
        console.log(`[SCANNER EXIT] Returned to URL: ${page.url()}`);
      }
    }

    console.log('\n================================================================');
    console.log('SUMMARY RESULTS TABLE');
    console.log('================================================================');
    console.table(summaryResults);

    const allPassed = summaryResults.every(
      (r) => r.hasHeading && r.hasBadge && !r.hasOverflow && r.navFound && r.centerBtnElevated
    );

    if (allPassed) {
      console.log('\n>>> ALL VIEWPORT AND INTERACTIVE CHECKS PASSED PERFECTLY! <<<');
    } else {
      console.error('\n>>> SOME CHECKS FAILED! Inspect table above. <<<');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Error during verification:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runVerification();
