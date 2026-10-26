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
const tempDir = path.join(os.tmpdir(), 'browser-auth-suite-' + Date.now());

async function run() {
  console.log('=== STARTING DINE-IN ACCESS & SHARED CUSTOMER AUTHENTICATION VERIFICATION SUITE ===');

  const browser = spawn(browserPath, [
    '--headless=new',
    '--remote-debugging-port=9240',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:3000/'
  ]);

  await new Promise((r) => setTimeout(r, 2500));

  try {
    const targetsRes = await fetch('http://127.0.0.1:9240/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');

    if (!pageTarget) throw new Error('No page target found on port 9240');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => { ws.onopen = resolve; });

    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const res = JSON.parse(event.data);
      if (res.id && callbacks.has(res.id)) {
        const cb = callbacks.get(res.id);
        callbacks.delete(res.id);
        cb(res);
      }
    };

    const send = (method, params = {}) => {
      return new Promise((resolve) => {
        const msgId = id++;
        callbacks.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    };

    const evaluate = async (expression) => {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res?.result?.result?.value;
    };

    const captureShot = async (filename) => {
      const { result } = await send('Page.captureScreenshot', { format: 'png' });
      const outPath = path.join(artifactDir, filename);
      fs.writeFileSync(outPath, Buffer.from(result.data, 'base64'));
      console.log(`[Captured Artifact] ${filename} (${result.data.length} bytes)`);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // ------------------------------------------------------------------------
    // TEST 1: Unauthenticated Visit -> Login Gate Shown, Menu Hidden
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Unauthenticated Visit ---');
    await evaluate(`localStorage.clear(); sessionStorage.clear();`);
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/' });
    await new Promise((r) => setTimeout(r, 2000));

    const test1GateVisible = await evaluate(`Boolean(document.querySelector('input[type="tel"]'))`);
    const test1MenuHidden = await evaluate(`!document.getElementById('main-menu-catalog')`);
    const test1Heading = await evaluate(`document.querySelector('h1')?.textContent || ''`);

    console.log(`Test 1 Result: Gate Visible=${test1GateVisible}, Menu Hidden=${test1MenuHidden}, Heading="${test1Heading}"`);
    if (!test1GateVisible || !test1MenuHidden) {
      throw new Error('Test 1 Failed: Unauthenticated diner was not gated.');
    }
    await captureShot('verify_auth_gate_unauthenticated.png');

    // ------------------------------------------------------------------------
    // TEST 2: Tampered Storage / Frontend Flag Bypass Attempt Rejection
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Tampered Storage Bypass Attempt ---');
    await evaluate(`
      localStorage.setItem('lm_dinein_auth_v2', JSON.stringify({
        mobile: '9876543210',
        name: 'Attacker Fake User',
        isAuthenticated: true
      }));
    `);
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/' });
    await new Promise((r) => setTimeout(r, 2000));

    const test2GateVisible = await evaluate(`Boolean(document.querySelector('input[type="tel"]'))`);
    const test2StorageWiped = await evaluate(`!localStorage.getItem('lm_dinein_auth_v2')`);
    console.log(`Test 2 Result: Tamper Gated=${test2GateVisible}, Invalid Storage Cleared=${test2StorageWiped}`);
    if (!test2GateVisible) {
      throw new Error('Test 2 Failed: Tampered localStorage bypassed server authentication.');
    }
    await captureShot('verify_auth_gate_tamper_rejected.png');

    // ------------------------------------------------------------------------
    // TEST 3: Existing Takeaway Account Seamless Access (SSO Handshake)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Takeaway Authenticated Session SSO ---');
    // Login to shared backend to get authoritative session token
    const loginRes = await fetch('http://127.0.0.1:3000/api/auth/customer-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9198062161', password: 'StrongPassword123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.session?.access_token;
    if (!token) throw new Error('Could not get token for test customer Priya Sharma');

    // Pass token via URL parameter as if redirected/linked from Takeaway
    await send('Page.navigate', { url: `http://127.0.0.1:3000/?auth_token=${token}` });
    await new Promise((r) => setTimeout(r, 2500));

    const test3MenuVisible = await evaluate(`Boolean(document.getElementById('main-menu-catalog'))`);
    const test3DinerName = await evaluate(`document.body.innerText.includes('Priya') || document.body.innerText.includes('Sharma')`);
    const test3UrlCleaned = await evaluate(`!window.location.search.includes('auth_token')`);

    console.log(`Test 3 Result: Menu Visible Directly=${test3MenuVisible}, Diner Name Recognized=${test3DinerName}, URL Param Cleaned=${test3UrlCleaned}`);
    if (!test3MenuVisible) {
      throw new Error('Test 3 Failed: Takeaway authenticated customer could not access Dine-In directly.');
    }
    await captureShot('verify_auth_takeaway_sso_direct_entry.png');

    // ------------------------------------------------------------------------
    // TEST 4: Shared Account Login In Dine-In (Mobile + Password)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Mobile + Password Login via Login Gate ---');
    await evaluate(`localStorage.clear(); sessionStorage.clear();`);
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/' });
    await new Promise((r) => setTimeout(r, 1500));

    // Fill in mobile and password on CustomerLoginGate with React native setter
    await evaluate(`
      const setVal = (el, val) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const tel = document.querySelector('input[type="tel"]');
      const pwd = document.querySelector('input[type="password"]');
      setVal(tel, '9198062161');
      setVal(pwd, 'StrongPassword123');

      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 3500));

    const test4MenuVisible = await evaluate(`Boolean(document.getElementById('main-menu-catalog'))`);
    const test4Error = await evaluate(`document.querySelector('.lm-border-beam')?.innerText || ''`);
    console.log(`Test 4 Result: Menu Visible After Login=${test4MenuVisible}`);
    if (!test4MenuVisible) {
      console.log('Test 4 Error text on screen:', test4Error);
      throw new Error('Test 4 Failed: Mobile + password login failed to unlock Dine-In menu.');
    }
    await captureShot('verify_auth_login_shared_account.png');

    // ------------------------------------------------------------------------
    // TEST 5: Expired Token Re-Authentication Enforcement
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Expired Token Re-Authentication Enforcement ---');
    const expiredPayload = { sub: 'user_123', phone: '+919876543210', name: 'Arjun', exp: Math.floor(Date.now()/1000) - 3600 };
    const expiredToken = 'dev_token.' + Buffer.from(JSON.stringify(expiredPayload)).toString('base64') + '.lmc';

    await evaluate(`
      localStorage.setItem('lm_dinein_auth_v2', JSON.stringify({
        token: '${expiredToken}',
        mobile: '9876543210',
        name: 'Arjun'
      }));
    `);
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/' });
    await new Promise((r) => setTimeout(r, 2000));

    const test5GateVisible = await evaluate(`Boolean(document.querySelector('input[type="tel"]'))`);
    const test5MenuBlocked = await evaluate(`!document.getElementById('main-menu-catalog')`);
    console.log(`Test 5 Result: Gate Visible On Expired=${test5GateVisible}, Menu Blocked=${test5MenuBlocked}`);
    if (!test5GateVisible || !test5MenuBlocked) {
      throw new Error('Test 5 Failed: Expired token was not gated.');
    }
    await captureShot('verify_auth_expired_token_relogin.png');

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
    ws.close();
    browser.kill();
  } catch (err) {
    console.error('Test Suite Exception:', err);
    browser.kill();
    process.exit(1);
  }
}

run();
