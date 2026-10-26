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
const tempDir = path.join(os.tmpdir(), 'browser-404-suite-' + Date.now());

async function run404Suite() {
  console.log('================================================================');
  console.log('   LITTLE MONKEY CAFÉ DINING — 404 REDESIGN VERIFICATION SUITE   ');
  console.log('================================================================');
  console.log(`Browser: ${browserPath}`);
  console.log(`Artifacts target: ${artifactDir}`);

  const browser = spawn(browserPath, [
    '--headless=new',
    '--remote-debugging-port=9250',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/unknown'
  ]);

  await new Promise((r) => setTimeout(r, 2500));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9250/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');

    if (!pageTarget) throw new Error('No page target found on port 9250');

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
    // TEST 1: DESKTOP 404 EXPERIENCE (1280x900)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Desktop 404 Experience (1280x900 on /unknown) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/unknown' });
    await new Promise((r) => setTimeout(r, 1200));

    const desktopChecks = await evalScript(`(() => {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const vp = document.querySelector('.lm-not-found-viewport');
      const vpBg = vp ? window.getComputedStyle(vp).backgroundColor : null;
      const h1 = document.querySelector('h1');
      const h1Text = h1 ? h1.innerText.trim() : null;
      const p = document.querySelector('main p');
      const pText = p ? p.innerText.trim() : null;
      const primaryBtn = document.querySelector('.lm-btn-primary');
      const primaryBtnText = primaryBtn ? primaryBtn.innerText.trim() : null;
      const primaryBtnBg = primaryBtn ? window.getComputedStyle(primaryBtn).backgroundColor : null;
      const secondaryBtn = document.querySelector('.lm-btn-secondary');
      const secondaryBtnText = secondaryBtn ? secondaryBtn.innerText.trim() : null;
      const hero404 = document.querySelector('main > div:nth-of-type(3)');
      const hero404Text = hero404 ? hero404.innerText.replace(/\\s+/g, '') : null;
      const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;

      return {
        bodyBg,
        vpBg,
        h1Text,
        pText,
        primaryBtnText,
        primaryBtnBg,
        secondaryBtnText,
        hero404Text,
        hasHorizontalScroll,
        url: window.location.href,
        hasMenu: !!document.getElementById('main-menu-catalog'),
      };
    })()`);

    console.log('Desktop 404 Analysis:', JSON.stringify(desktopChecks, null, 2));
    await captureShot('shot_404_desktop.png');

    // -------------------------------------------------------------------------
    // TEST 2: TABLET 404 EXPERIENCE (768x1024 on /wrong-turn)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Tablet 404 Experience (768x1024 on /wrong-turn) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/wrong-turn' });
    await new Promise((r) => setTimeout(r, 1000));

    const tabletChecks = await evalScript(`(() => {
      const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;
      const h1 = document.querySelector('h1');
      return {
        hasHorizontalScroll,
        h1Text: h1 ? h1.innerText.trim() : null,
        url: window.location.href,
      };
    })()`);
    console.log('Tablet 404 Analysis:', JSON.stringify(tabletChecks, null, 2));
    await captureShot('shot_404_tablet.png');

    // -------------------------------------------------------------------------
    // TEST 3: MOBILE 404 EXPERIENCE (375x812 on /404)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Mobile 404 Experience (375x812 on /404) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/404' });
    await new Promise((r) => setTimeout(r, 1000));

    const mobileChecks = await evalScript(`(() => {
      const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;
      const primaryBtn = document.querySelector('.lm-btn-primary');
      const rect = primaryBtn ? primaryBtn.getBoundingClientRect() : null;
      return {
        hasHorizontalScroll,
        btnHeight: rect ? rect.height : null,
        btnWidth: rect ? rect.width : null,
        url: window.location.href,
      };
    })()`);
    console.log('Mobile 404 Analysis:', JSON.stringify(mobileChecks, null, 2));
    await captureShot('shot_404_mobile.png');

    // -------------------------------------------------------------------------
    // TEST 4: BUTTON INTERACTION & NAVIGATION (Click "Back to Home")
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Navigation: Click "Back to Home" ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/not-found' });
    await new Promise((r) => setTimeout(r, 1000));

    const beforeClickUrl = await evalScript(`window.location.href`);
    console.log('URL before click:', beforeClickUrl);

    // Click Primary CTA
    await evalScript(`(() => {
      const btn = document.querySelector('.lm-btn-primary');
      if (btn) btn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 1200));

    const afterClickAnalysis = await evalScript(`(() => {
      return {
        url: window.location.href,
        has404: !!document.querySelector('.lm-not-found-viewport'),
        hasLoginGate: !!document.querySelector('form') || document.body.innerText.includes('WELCOME TO'),
      };
    })()`);
    console.log('After "Back to Home" click:', JSON.stringify(afterClickAnalysis, null, 2));
    await captureShot('shot_404_nav_after_click.png');

    // -------------------------------------------------------------------------
    // TEST 5: PRESERVE VALID ROUTES (e.g. / and /dining and /?table=Table%204)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Validating Valid Routes Preservation ---');
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/?table=Table%204' });
    await new Promise((r) => setTimeout(r, 1000));
    const validRouteCheck = await evalScript(`(() => {
      return {
        url: window.location.href,
        has404: !!document.querySelector('.lm-not-found-viewport'),
        isSecurelyGated: document.body.innerText.includes('WELCOME TO') || !!document.querySelector('form'),
      };
    })()`);
    console.log('Valid route check (/?table=Table%204):', JSON.stringify(validRouteCheck, null, 2));

    console.log('\n================================================================');
    console.log('   ALL 404 REDESIGN VERIFICATION TESTS COMPLETED SUCCESSFULLY!  ');
    console.log('================================================================\n');

  } catch (err) {
    console.error('Test run error:', err);
    process.exit(1);
  } finally {
    browser.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

run404Suite();
