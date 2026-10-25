import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const tempDir = path.join(os.tmpdir(), 'edge-cart-check-' + Date.now());

async function run() {
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9338',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/?guest=1',
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9338/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));

    const callbacks = new Map();
    let msgId = 1;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg.result);
        callbacks.delete(msg.id);
      }
    };

    const send = (method, params = {}) =>
      new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Scroll to catalog
    await send('Runtime.evaluate', {
      expression: `document.getElementById('main-menu-catalog').scrollIntoView({ behavior: 'instant' });`,
    });
    await new Promise((r) => setTimeout(r, 600));

    // Add first item
    await send('Runtime.evaluate', {
      expression: `(() => {
        const addBtn = document.querySelector('#main-menu-catalog button');
        // Look for buttons with ADD text
        const buttons = Array.from(document.querySelectorAll('#main-menu-catalog button'));
        const btn = buttons.find(b => b.textContent.trim() === 'ADD');
        if (btn) btn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 800));

    // Open Cart Drawer
    await send('Runtime.evaluate', {
      expression: `(() => {
        const cartBtn = document.querySelector('header button[aria-label*="Cart"]');
        if (cartBtn) cartBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 800));

    const cartInfo = await send('Runtime.evaluate', {
      expression: `(() => {
        const backdrop = document.querySelector('div[style*="z-index: 9999"]');
        if (!backdrop) return null;
        return {
          isOpen: true,
          content: backdrop.textContent.replace(/\\s+/g, ' ')
        };
      })()`,
      returnByValue: true,
    });
    console.log('Cart drawer verification:', cartInfo.result.value);

    const ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('verify_cart_open.png', Buffer.from(ss.data, 'base64'));
    console.log('✓ Captured verify_cart_open.png');

    ws.close();
  } catch (e) {
    console.error(e);
  } finally {
    edge.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

run();
