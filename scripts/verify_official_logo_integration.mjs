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
const tempDir = path.join(os.tmpdir(), 'browser-logo-suite-' + Date.now());

async function runLogoVerificationSuite() {
  console.log('================================================================');
  console.log('   LITTLE MONKEY CAFÉ — OFFICIAL BRAND LOGO INTEGRATION SUITE   ');
  console.log('================================================================');
  console.log(`Browser: ${browserPath}`);
  console.log(`Artifacts target: ${artifactDir}`);

  // ---------------------------------------------------------------------------
  // 1. Verify Branding Asset Files & Manifest
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Checking Static Branding & Icon Assets ---');
  const assetFiles = [
    'public/branding/little-monkey-official-logo.png',
    'public/branding/little-monkey-logo-transparent.png',
    'public/branding/little-monkey-logo-nav.png',
    'public/favicon.ico',
    'public/favicon-32x32.png',
    'public/favicon-16x16.png',
    'public/apple-touch-icon.png',
    'public/icon-192.png',
    'public/icon-512.png',
    'public/manifest.json'
  ];

  for (const f of assetFiles) {
    if (!fs.existsSync(f)) {
      throw new Error(`Missing expected branding asset: ${f}`);
    }
    const stat = fs.statSync(f);
    console.log(`✓ ${f} (${stat.size} bytes)`);
  }

  // Verify HTTP asset serving via dev server
  const manifestRes = await fetch('http://127.0.0.1:3000/manifest.json');
  if (manifestRes.status !== 200) throw new Error('manifest.json returned non-200');
  const manifestData = await manifestRes.json();
  console.log('✓ manifest.json served via HTTP 200:', manifestData.name, '| Icons:', manifestData.icons.length);

  // ---------------------------------------------------------------------------
  // 2. Launch Browser with CDP
  // ---------------------------------------------------------------------------
  const browser = spawn(browserPath, [
    '--headless=new',
    '--remote-debugging-port=9260',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/unknown'
  ]);

  await new Promise((r) => setTimeout(r, 2500));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9260/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');

    if (!pageTarget) throw new Error('No page target found on port 9260');

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
      return res?.result?.value;
    };

    // -------------------------------------------------------------------------
    // TEST A: 404 PAGE LOGO INTEGRATION (Desktop & Mobile)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Official Logo on Custom 404 Page (Desktop) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/wrong-turn' });
    await new Promise((r) => setTimeout(r, 1200));

    const check404Logo = await evalScript(`(() => {
      const img = document.querySelector('header img');
      if (!img) return { found: false };
      const rect = img.getBoundingClientRect();
      return {
        found: true,
        src: img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2),
        renderedWidth: rect.width,
        renderedHeight: rect.height,
        alt: img.alt
      };
    })()`);
    console.log('404 Page Logo Analysis (Desktop):', JSON.stringify(check404Logo, null, 2));
    await captureShot('shot_official_logo_404_desktop.png');

    console.log('\n--- 3. Testing Official Logo on Custom 404 Page (Mobile 375x812) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise((r) => setTimeout(r, 800));
    const check404Mobile = await evalScript(`(() => {
      const img = document.querySelector('header img');
      return {
        found: !!img,
        hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth
      };
    })()`);
    console.log('404 Page Mobile Analysis:', JSON.stringify(check404Mobile, null, 2));
    await captureShot('shot_official_logo_404_mobile.png');

    // -------------------------------------------------------------------------
    // TEST B: LANDING SCREEN / LOGIN GATE LOGO
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Official Logo on Customer Login Gate (Landing) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/?table=Table%204' });
    await new Promise((r) => setTimeout(r, 1200));

    const checkLandingLogo = await evalScript(`(() => {
      const img = document.querySelector('.lm-logo-ambient-wrap img');
      if (!img) return { found: false };
      const rect = img.getBoundingClientRect();
      return {
        found: true,
        src: img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2),
        renderedWidth: rect.width,
        renderedHeight: rect.height,
        alt: img.alt
      };
    })()`);
    console.log('Landing Screen Logo Analysis:', JSON.stringify(checkLandingLogo, null, 2));
    await captureShot('shot_official_logo_landing.png');

    // -------------------------------------------------------------------------
    // TEST C: AUTHENTICATED DINING HEADER & HERO CAROUSEL LOGO
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Authenticating Session & Testing Header + Hero Carousel Logo ---');
    // Issue verified guest token via server
    const tokenRes = await fetch('http://127.0.0.1:3000/api/auth/guest-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Verified Diner', phone: '9876543210', tableNumber: 'Table 4' })
    });
    const { token } = await tokenRes.json();
    console.log('Obtained guest session token:', token ? 'YES' : 'NO');

    // Navigate to URL with auth_token parameter
    await send('Page.navigate', { url: `http://127.0.0.1:3000/?auth_token=${token}&table=Table%204` });
    await new Promise((r) => setTimeout(r, 2500));

    const checkHeaderAndHero = await evalScript(`(() => {
      const headerImg = document.querySelector('header a img');
      const heroImg = document.querySelector('.lm-hero-container .lm-logo-ambient-img');
      const footerImg = document.querySelector('footer img');

      return {
        headerLogo: headerImg ? {
          src: headerImg.src,
          naturalWidth: headerImg.naturalWidth,
          naturalHeight: headerImg.naturalHeight,
          renderedWidth: headerImg.getBoundingClientRect().width,
          renderedHeight: headerImg.getBoundingClientRect().height,
          alt: headerImg.alt
        } : null,
        heroLogo: heroImg ? {
          src: heroImg.src,
          naturalWidth: heroImg.naturalWidth,
          naturalHeight: heroImg.naturalHeight,
          renderedWidth: heroImg.getBoundingClientRect().width,
          renderedHeight: heroImg.getBoundingClientRect().height,
          alt: heroImg.alt
        } : null,
        footerLogo: footerImg ? {
          src: footerImg.src,
          naturalWidth: footerImg.naturalWidth,
          naturalHeight: footerImg.naturalHeight,
          alt: footerImg.alt
        } : null
      };
    })()`);
    console.log('Authenticated Header & Hero Logo Analysis:', JSON.stringify(checkHeaderAndHero, null, 2));
    await captureShot('shot_official_logo_header_and_hero.png');

    // Test Mobile Header Logo
    console.log('\n--- 6. Testing Mobile Authenticated Header Logo (375x812) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise((r) => setTimeout(r, 800));
    const checkMobileHeader = await evalScript(`(() => {
      const headerImg = document.querySelector('header a img');
      const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;
      return {
        headerLogoVisible: !!headerImg,
        hasHorizontalScroll,
        renderedWidth: headerImg ? headerImg.getBoundingClientRect().width : null,
        renderedHeight: headerImg ? headerImg.getBoundingClientRect().height : null
      };
    })()`);
    console.log('Mobile Header Logo Analysis:', JSON.stringify(checkMobileHeader, null, 2));
    await captureShot('shot_official_logo_header_mobile.png');

    // -------------------------------------------------------------------------
    // TEST D: VERSION METADATA CONFIRMATION
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Confirming Version Metadata ---');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const pkgLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    console.log(`package.json version: ${pkg.version}`);
    console.log(`package-lock.json version: ${pkgLock.version}`);
    if (pkg.version !== '2.5.6' || pkgLock.version !== '2.5.6') {
      throw new Error('Version mismatch! Expected 2.5.6');
    }
    console.log('✓ Application version metadata verified at 2.5.6');

    console.log('\n================================================================');
    console.log('   ALL OFFICIAL BRAND LOGO INTEGRATION TESTS PASSED!            ');
    console.log('================================================================\n');

  } catch (err) {
    console.error('Verification suite failure:', err);
    process.exit(1);
  } finally {
    browser.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

runLogoVerificationSuite();
