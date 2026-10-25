import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const tempDir = path.join(os.tmpdir(), 'edge-lm-test-' + Date.now());

async function main() {
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9333',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/?guest=1'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9333/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page');

    if (!pageTarget) {
      console.error('No page target found', targets);
      return;
    }

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

    // Wait 2.2s for initial animation
    await new Promise(r => setTimeout(r, 2200));

    // Scroll to Must Try section
    await send('Runtime.evaluate', {
      expression: `window.scrollTo({ top: 460, behavior: 'instant' });`
    });
    await new Promise(r => setTimeout(r, 1200));

    const ss1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('edge_must_try_view.png', Buffer.from(ss1.data, 'base64'));
    console.log('Saved edge_must_try_view.png');

    // Scroll to Menu Catalog Section
    await send('Runtime.evaluate', {
      expression: `window.scrollTo({ top: 920, behavior: 'instant' });`
    });
    await new Promise(r => setTimeout(r, 1200));

    const ss2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('edge_catalog_view.png', Buffer.from(ss2.data, 'base64'));
    console.log('Saved edge_catalog_view.png');

    ws.close();
  } catch (err) {
    console.error('Edge CDP error:', err);
  } finally {
    edge.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

main();
