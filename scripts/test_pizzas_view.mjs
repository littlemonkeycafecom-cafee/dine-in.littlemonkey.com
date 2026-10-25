import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const tempDir = path.join(os.tmpdir(), 'edge-lm-pizza-' + Date.now());

async function main() {
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9336',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/?guest=1'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9336/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page');

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

    const send = (method, params = {}) => new Promise((resolve) => {
      const id = msgId++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 430,
      height: 932,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await new Promise(r => setTimeout(r, 1500));

    // Scroll to Category Tabs and click Pizzas
    await send('Runtime.evaluate', {
      expression: `
        const menuEl = document.getElementById('main-menu-catalog');
        if (menuEl) menuEl.scrollIntoView({ behavior: 'instant' });
        const buttons = Array.from(document.querySelectorAll('#main-menu-catalog button'));
        const pizzaBtn = buttons.find(b => b.textContent.includes('Pizzas'));
        if (pizzaBtn) pizzaBtn.click();
      `
    });

    await new Promise(r => setTimeout(r, 800));

    const ss1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('edge_pizza_view.png', Buffer.from(ss1.data, 'base64'));
    console.log('Saved edge_pizza_view.png');

    // Scroll down to Chicken and Sweet Corn Pizza
    await send('Runtime.evaluate', {
      expression: `window.scrollBy({ top: 750, behavior: 'instant' });`
    });
    await new Promise(r => setTimeout(r, 600));

    const ss2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('edge_pizza_flag_view.png', Buffer.from(ss2.data, 'base64'));
    console.log('Saved edge_pizza_flag_view.png');

    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edge.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

main();
