import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempDir = path.join(os.tmpdir(), 'chrome-lm-test-' + Date.now());

async function main() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9222/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('3000')) || targets.find(t => t.type === 'page');

    if (!pageTarget) {
      console.error('No page target found', targets);
      return;
    }

    const pageWs = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((r) => (pageWs.onopen = r));

    const pageCallbacks = new Map();
    let pageId = 1;
    pageWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pageCallbacks.has(msg.id)) {
        pageCallbacks.get(msg.id)(msg.result);
        pageCallbacks.delete(msg.id);
      }
    };

    const pageSend = (method, params = {}) => new Promise((resolve) => {
      const msgId = pageId++;
      pageCallbacks.set(msgId, resolve);
      pageWs.send(JSON.stringify({ id: msgId, method, params }));
    });

    await pageSend('Page.enable');
    await pageSend('Emulation.setDeviceMetricsOverride', {
      width: 430,
      height: 932,
      deviceScaleFactor: 2,
      mobile: true,
    });

    // Set authenticated session in localStorage
    await pageSend('Runtime.evaluate', {
      expression: `
        localStorage.setItem('lm_dinein_auth_v2', JSON.stringify({
          mobile: '9876543210',
          name: 'Diner Priya',
          table: 'Table 4',
          token: 'lm_session_test'
        }));
        location.reload();
      `
    });

    // wait for reload & render
    await new Promise(r => setTimeout(r, 2500));

    // Capture screenshot of hero
    const ss1 = await pageSend('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_hero.png', Buffer.from(ss1.data, 'base64'));
    console.log('Saved screenshot_hero.png');

    // Scroll down to Must Try rail and capture
    await pageSend('Runtime.evaluate', {
      expression: `window.scrollBy({ top: 580, behavior: 'instant' });`
    });
    await new Promise(r => setTimeout(r, 600));

    const ss2 = await pageSend('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_must_try.png', Buffer.from(ss2.data, 'base64'));
    console.log('Saved screenshot_must_try.png');

    // Scroll to Menu Section
    await pageSend('Runtime.evaluate', {
      expression: `window.scrollBy({ top: 550, behavior: 'instant' });`
    });
    await new Promise(r => setTimeout(r, 600));

    const ss3 = await pageSend('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_menu.png', Buffer.from(ss3.data, 'base64'));
    console.log('Saved screenshot_menu.png');

    pageWs.close();
  } catch (err) {
    console.error('CDP error:', err);
  } finally {
    chrome.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

main();
