import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const tempDir = path.join(os.tmpdir(), 'edge-test-autorotate-' + Date.now());

async function run() {
  console.log('--- TESTING FRESH AUTO-ROTATION ---');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9336',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/?guest=1',
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9336/json/list');
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
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const getStatus = async (label) => {
      const res = await send('Runtime.evaluate', {
        expression: `(() => {
          const title = document.querySelector('h1 span') ? document.querySelector('h1 span').textContent : '';
          const dots = Array.from(document.querySelectorAll('button[aria-label^="Go to "]'));
          const activeDotIdx = dots.findIndex(d => d.style.width === '22px');
          return { title, activeDotIdx };
        })()`,
        returnByValue: true,
      });
      console.log(`[${label}] Active Title: "${res.result.value.title}", Active Dot Index: ${res.result.value.activeDotIdx}`);
      return res.result.value;
    };

    await getStatus('0s (Initial Load)');

    console.log('Waiting 5.8s for first auto-rotation...');
    await new Promise(r => setTimeout(r, 5800));
    await getStatus('5.8s');

    console.log('Waiting another 5.8s for second auto-rotation...');
    await new Promise(r => setTimeout(r, 5800));
    await getStatus('11.6s');

    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    edge.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

run();
