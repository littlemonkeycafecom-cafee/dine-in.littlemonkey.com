import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

let browserPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!fs.existsSync(browserPath)) {
  browserPath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
}

const artifactDir = 'C:\\Users\\chava\\.gemini\\antigravity\\brain\\1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const tempDir = path.join(os.tmpdir(), 'browser-lm-skel-verify-' + Date.now());

async function run() {
  console.log('--- STARTING TARGETED SKELETON VERIFICATION ---');
  const browser = spawn(browserPath, [
    '--headless=new',
    '--remote-debugging-port=9227',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/'
  ]);

  await new Promise((r) => setTimeout(r, 2200));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9227/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => { ws.onopen = resolve; });

    let id = 1;
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
        const msgId = id++;
        callbacks.set(msgId, { resolve });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });

    await send('Page.enable');
    await send('Runtime.enable');

    // Authenticate
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
      `
    });

    await new Promise((r) => setTimeout(r, 2000));

    // Scroll to main-menu-catalog
    await send('Runtime.evaluate', {
      expression: `document.getElementById('main-menu-catalog').scrollIntoView();`
    });

    // Check stylesheet definitions for .animate-shimmer and @keyframes lmShimmerSweep
    const cssCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          let hasShimmerClass = false;
          let hasShimmerSweepKeyframes = false;
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) {
                if (rule.selectorText && rule.selectorText.includes('animate-shimmer')) {
                  hasShimmerClass = true;
                }
                if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === 'lmShimmerSweep') {
                  hasShimmerSweepKeyframes = true;
                }
              }
            } catch (e) {}
          }
          return { hasShimmerClass, hasShimmerSweepKeyframes };
        })()
      `,
      returnByValue: true,
    });
    console.log('CSS Rules Check:', JSON.stringify(cssCheck.result.value, null, 2));

    // Trigger category click and wait 60ms for React render
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('#main-menu-catalog button'));
          const targetBtn = buttons.find(b => b.innerText.includes('Burgers'));
          if (targetBtn) targetBtn.click();
        })()
      `
    });

    await new Promise((r) => setTimeout(r, 60));

    // Check skeletons during active transition
    const skeletonActiveCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const container = document.querySelector('div[aria-label="Loading menu items"]');
          const shimmerEls = document.querySelectorAll('.animate-shimmer');
          let styleDetails = null;
          if (shimmerEls.length > 0) {
            const comp = window.getComputedStyle(shimmerEls[0]);
            const parentComp = window.getComputedStyle(shimmerEls[0].closest('div[style*="min-height"]') || shimmerEls[0].parentElement);
            styleDetails = {
              shimmerAnimation: comp.animationName,
              shimmerBg: comp.backgroundImage,
              cardBg: parentComp.backgroundColor,
              cardBorder: parentComp.borderColor
            };
          }
          return {
            containerExists: !!container,
            shimmerElementsCount: shimmerEls.length,
            styleDetails
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Skeleton Active Transition Check:', JSON.stringify(skeletonActiveCheck.result.value, null, 2));

    // Capture screenshot of skeleton state
    const skelShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verify_skeleton_shimmer_dark.png'), Buffer.from(skelShot.data, 'base64'));
    console.log('Saved screenshot: verify_skeleton_shimmer_dark.png');

    ws.close();
    browser.kill();
  } catch (err) {
    console.error(err);
    browser.kill();
  }
}

run();
