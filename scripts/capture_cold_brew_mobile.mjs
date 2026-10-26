import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const artifactDir = 'C:\\Users\\chava\\.gemini\\antigravity\\brain\\1ad1951b-83b5-4e28-b2e7-af04a0ed0a93';
const tempDir = path.join(os.tmpdir(), 'browser-mob-' + Date.now());

async function run() {
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/customer-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9198062161', password: 'StrongPassword123' }),
  });
  const { session } = await loginRes.json();
  const token = session.access_token;

  const browser = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9263',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    `http://127.0.0.1:3000/?auth_token=${token}&table=T04`,
  ]);

  await new Promise((r) => setTimeout(r, 2500));
  const targets = await (await fetch('http://127.0.0.1:9263/json/list')).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => {
    ws.onopen = r;
  });

  let id = 1;
  const cb = new Map();
  ws.onmessage = (e) => {
    const res = JSON.parse(e.data);
    if (res.id && cb.has(res.id)) {
      cb.get(res.id)(res.result);
      cb.delete(res.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = id++;
      cb.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Scroll to banner
  await send('Runtime.evaluate', {
    expression: `
    const b = document.querySelector('section[aria-label="Specialty Cold Brew Promotion"]');
    if (b) b.scrollIntoView({ behavior: 'instant', block: 'center' });
  `,
  });
  await new Promise((r) => setTimeout(r, 600));

  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'shot_cold_brew_mobile_banner.png'), Buffer.from(shot.data, 'base64'));
  console.log('✓ Saved shot_cold_brew_mobile_banner.png');

  // 2. Click banner to go to collection
  await send('Runtime.evaluate', {
    expression: `
    const card = document.querySelector('section[aria-label="Specialty Cold Brew Promotion"] div[role="button"]');
    if (card) card.click();
  `,
  });
  await new Promise((r) => setTimeout(r, 800));

  // 3. Open Espresso Orange details modal
  await send('Runtime.evaluate', {
    expression: `
    const eoHeading = Array.from(document.querySelectorAll('#main-menu-catalog h3')).find(h => h.innerText.includes('Espresso Orange'));
    if (eoHeading) eoHeading.closest('div[style*="cursor: pointer"]').click();
  `,
  });
  await new Promise((r) => setTimeout(r, 800));

  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'shot_cold_brew_mobile_modal.png'), Buffer.from(shot.data, 'base64'));
  console.log('✓ Saved shot_cold_brew_mobile_modal.png');

  ws.close();
  browser.kill();
}
run();
