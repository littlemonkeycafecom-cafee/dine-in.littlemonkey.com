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
const tempDir = path.join(os.tmpdir(), 'browser-15-shots-' + Date.now());

async function run() {
  console.log('--- STARTING CAPTURE OF ALL 15 MANDATORY MASTER VERIFICATION SCREENSHOTS ---');
  const browser = spawn(browserPath, [
    '--headless=new',
    '--remote-debugging-port=9235',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/'
  ]);

  await new Promise((r) => setTimeout(r, 2200));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9235/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');

    if (!pageTarget) throw new Error('No page target found');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => { ws.onopen = resolve; });

    let id = 1;
    const callbacks = new Map();
    const consoleMessages = [];

    ws.onmessage = (event) => {
      const res = JSON.parse(event.data);
      if (res.method === 'Runtime.consoleAPICalled') {
        const text = res.params.args.map(a => a.value || '').join(' ');
        consoleMessages.push({ type: res.params.type, text });
      }
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

    // Authenticate diner session
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

    await new Promise((r) => setTimeout(r, 2500));

    // Desktop mode (1440x900)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 600));

    // 1. Desktop hero
    console.log('Capturing: shot_01_desktop_hero.png');
    const ss1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_01_desktop_hero.png'), Buffer.from(ss1.data, 'base64'));

    // 2. Mobile hero
    console.log('Capturing: shot_02_mobile_hero.png');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise((r) => setTimeout(r, 500));
    const ss2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_02_mobile_hero.png'), Buffer.from(ss2.data, 'base64'));

    // Switch back to desktop for sequence captures
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 500));

    // 3. Hero carousel after an autoplay transition (wait ~3.4s)
    console.log('Waiting 3.4s for autoplay glide...');
    await new Promise((r) => setTimeout(r, 3400));
    console.log('Capturing: shot_03_hero_carousel_after_autoplay.png');
    const ss3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_03_hero_carousel_after_autoplay.png'), Buffer.from(ss3.data, 'base64'));

    // 4. Hero carousel after several transitions (wait another 3.4s)
    console.log('Waiting another 3.4s for second transition...');
    await new Promise((r) => setTimeout(r, 3400));
    console.log('Capturing: shot_04_hero_carousel_after_several_transitions.png');
    const ss4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_04_hero_carousel_after_several_transitions.png'), Buffer.from(ss4.data, 'base64'));

    // 5. Yellow logo animation (zoomed / focused on logo)
    console.log('Capturing: shot_05_yellow_logo_animation.png');
    await send('Runtime.evaluate', {
      expression: `window.scrollTo({ top: 0, behavior: 'instant' });`
    });
    const ss5 = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 500, y: 70, width: 440, height: 180, scale: 1 }
    });
    fs.writeFileSync(path.join(artifactDir, 'shot_05_yellow_logo_animation.png'), Buffer.from(ss5.data, 'base64'));

    // 6. Featured-card yellow animation (focused clip on active card)
    console.log('Capturing: shot_06_featured_card_yellow_animation.png');
    const ss6 = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 520, y: 320, width: 400, height: 420, scale: 1 }
    });
    fs.writeFileSync(path.join(artifactDir, 'shot_06_featured_card_yellow_animation.png'), Buffer.from(ss6.data, 'base64'));

    // 7. Veg Only disabled
    console.log('Capturing: shot_07_veg_only_disabled.png');
    const ss7 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_07_veg_only_disabled.png'), Buffer.from(ss7.data, 'base64'));

    // 8. Veg Only enabled
    console.log('Activating Veg Only switch...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('button[aria-label*=\"Filter vegetarian\"], button[aria-label*=\"vegetarian\"]');
          if (btn) btn.click();
        })()
      `
    });
    await new Promise((r) => setTimeout(r, 600));
    console.log('Capturing: shot_08_veg_only_enabled.png');
    const ss8 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_08_veg_only_enabled.png'), Buffer.from(ss8.data, 'base64'));

    // 9. Menu after filter changes
    console.log('Scrolling to menu catalog...');
    await send('Runtime.evaluate', {
      expression: `document.getElementById('main-menu-catalog').scrollIntoView();`
    });
    await new Promise((r) => setTimeout(r, 400));
    console.log('Capturing: shot_09_menu_after_filter_changes.png');
    const ss9 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_09_menu_after_filter_changes.png'), Buffer.from(ss9.data, 'base64'));

    // 10. Scrolling brand announcement (clip of marquee strip)
    console.log('Capturing: shot_10_scrolling_brand_announcement.png');
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.scrolling-brand-strip').scrollIntoView();`
    });
    await new Promise((r) => setTimeout(r, 300));
    const ss10 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_10_scrolling_brand_announcement.png'), Buffer.from(ss10.data, 'base64'));

    // 11. Skeleton loading state (trigger category switch to show dark skeleton cards)
    console.log('Triggering category switch for skeleton cards...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('#main-menu-catalog button'));
          const btn = buttons.find(b => b.innerText.includes('Burgers'));
          if (btn) btn.click();
        })()
      `
    });
    await new Promise((r) => setTimeout(r, 50)); // capture during 220ms skeleton window
    console.log('Capturing: shot_11_skeleton_loading_state.png');
    const ss11 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_11_skeleton_loading_state.png'), Buffer.from(ss11.data, 'base64'));

    // 12. Fully loaded menu
    console.log('Waiting for dishes to settle...');
    await new Promise((r) => setTimeout(r, 600));
    console.log('Capturing: shot_12_fully_loaded_menu.png');
    const ss12 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_12_fully_loaded_menu.png'), Buffer.from(ss12.data, 'base64'));

    // 13. Product-detail modal
    console.log('Opening product detail modal...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.querySelector('#main-menu-catalog div[style*=\"minmax\"] > div');
          if (card) card.click();
        })()
      `
    });
    await new Promise((r) => setTimeout(r, 600));
    console.log('Capturing: shot_13_product_detail_modal.png');
    const ss13 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_13_product_detail_modal.png'), Buffer.from(ss13.data, 'base64'));

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

    // 14. Public-review section
    console.log('Scrolling to public reviews...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const rev = document.querySelector('.lm-editorial-reviews');
          if (rev) rev.scrollIntoView();
        })()
      `
    });
    await new Promise((r) => setTimeout(r, 500));
    console.log('Capturing: shot_14_public_review_section.png');
    const ss14 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_14_public_review_section.png'), Buffer.from(ss14.data, 'base64'));

    // 15. Mobile header with the sign-in icon (at 360px viewport)
    console.log('Capturing: shot_15_mobile_header_with_signin_icon.png');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 740,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, 0);` });
    await new Promise((r) => setTimeout(r, 500));
    const ss15 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'shot_15_mobile_header_with_signin_icon.png'), Buffer.from(ss15.data, 'base64'));

    console.log('\n--- ALL 15 MANDATORY SCREENSHOTS CAPTURED SUCCESSFULLY ---');
    console.log('Console messages recorded:', consoleMessages.length);

    ws.close();
    browser.kill();
  } catch (err) {
    console.error('Error during capture:', err);
    browser.kill();
    process.exit(1);
  }
}

run();
